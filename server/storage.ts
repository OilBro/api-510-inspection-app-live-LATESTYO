// Storage helpers supporting Manus S3 proxy, Cloudflare R2, and local filesystem
// Set STORAGE_PROVIDER=r2 to use Cloudflare R2, STORAGE_PROVIDER=local for local filesystem
// Defaults to Manus S3 if credentials exist, otherwise falls back to local filesystem

import { ENV } from './_core/env';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

const isTestEnv = process.env.NODE_ENV === 'test';
// Deterministic mock URL used in tests; no real network calls are performed
const MOCK_R2_BASE_URL = 'https://pub-00403c9b844b4ab5a932e46119e654c8.r2.dev';
const mockR2Store = new Map<string, Buffer>();

type StorageProvider = 's3' | 'r2' | 'local';
type StorageConfig = { baseUrl: string; apiKey: string };

// Local storage directory (relative to project root)
const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), 'local-storage');

// Get storage provider from environment (auto-detects best available)
function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (!provider && isTestEnv) {
    return 'r2';
  }
  if (provider === 'r2') return 'r2';
  if (provider === 'local') return 'local';
  if (provider === 's3') return 's3';

  // Auto-detect: use s3 only if Manus Forge credentials exist (not OpenAI or other LLM providers)
  const isManusForgUrl = ENV.forgeApiUrl && ENV.forgeApiUrl.includes('forge.manus');
  if (isManusForgUrl && ENV.forgeApiKey) return 's3';
  if (hasR2Config()) return 'r2';

  // No cloud storage credentials available - fall back to local filesystem
  return 'local';
}

// ============================================================================
// LOCAL FILESYSTEM STORAGE (Fallback for offline/local development)
// ============================================================================

function ensureLocalStorageDir(subDir?: string): string {
  const dir = subDir ? path.join(LOCAL_STORAGE_DIR, subDir) : LOCAL_STORAGE_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function localPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  const fileDir = path.dirname(filePath);

  ensureLocalStorageDir();
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  // Return a URL that can be served by the Express app
  const url = `/local-storage/${key}`;
  console.log(`[Storage:Local] Saved file: ${key} (${buffer.length} bytes)`);
  return { key, url };
}

async function localGet(
  relKey: string,
  _expiresIn = 300
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const url = `/local-storage/${key}`;
  return { key, url };
}

// ============================================================================
// MANUS S3 PROXY (Default)
// ============================================================================

function getS3Config(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  // Normalize path separators to forward slashes
  let key = relKey.replace(/\\/g, '/');
  // Strip leading slashes
  key = key.replace(/^\/+/, '');
  // SECURITY: Reject directory traversal sequences
  if (key.includes('..')) {
    throw new Error(`Invalid storage key: directory traversal detected in "${relKey}"`);
  }
  return key;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getS3Config();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

async function s3Get(
  relKey: string,
  _expiresIn = 300
): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getS3Config();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

// ============================================================================
// CLOUDFLARE R2
// ============================================================================

let r2Client: S3Client | null = null;

function hasR2Config(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT &&
    process.env.R2_BUCKET_NAME
  );
}

function useMockR2(): boolean {
  return isTestEnv && !hasR2Config();
}

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "Cloudflare R2 credentials missing: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT"
    );
  }

  r2Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2Client;
}

function getR2BucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME environment variable not set");
  }
  return bucketName;
}

function getR2PublicUrl(): string | null {
  return process.env.R2_PUBLIC_URL || null;
}

/**
 * Mock R2 PUT used during tests when real credentials are unavailable.
 * Stores data in-memory and returns a deterministic public URL.
 */
function mockR2Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
): { key: string; url: string } {
  const key = normalizeKey(relKey);
  const body = Buffer.from(data);
  mockR2Store.set(key, body);
  return { key, url: `${MOCK_R2_BASE_URL}/${key}` };
}

/**
 * Mock R2 GET used during tests when real credentials are unavailable.
 * Returns a deterministic URL without performing any network calls.
 */
function mockR2Get(relKey: string): { key: string; url: string } {
  const key = normalizeKey(relKey);
  return { key, url: `${MOCK_R2_BASE_URL}/${key}` };
}

async function r2Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (useMockR2()) {
    return mockR2Put(relKey, data);
  }
  const client = getR2Client();
  const bucketName = getR2BucketName();
  const key = normalizeKey(relKey);

  // Convert string to Buffer if needed
  const bodyData = typeof data === 'string' ? Buffer.from(data) : data;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: bodyData,
    ContentType: contentType,
  });

  await client.send(command);

  // Return public URL if configured, otherwise presigned URL
  const publicUrl = getR2PublicUrl();
  // Remove trailing slash from publicUrl to prevent double slashes
  const cleanPublicUrl = publicUrl?.replace(/\/+$/, '');
  const url = cleanPublicUrl
    ? `${cleanPublicUrl}/${key}`
    : await getR2PresignedUrl(client, bucketName, key);

  return { key, url };
}

async function r2Get(
  relKey: string,
  expiresIn = 300
): Promise<{ key: string; url: string }> {
  if (useMockR2()) {
    return mockR2Get(relKey);
  }
  const client = getR2Client();
  const bucketName = getR2BucketName();
  const key = normalizeKey(relKey);

  // Return public URL if configured, otherwise presigned URL
  const publicUrl = getR2PublicUrl();
  // Remove trailing slash from publicUrl to prevent double slashes
  const cleanPublicUrl = publicUrl?.replace(/\/+$/, '');
  const url = cleanPublicUrl
    ? `${cleanPublicUrl}/${key}`
    : await getR2PresignedUrl(client, bucketName, key, expiresIn);

  return { key, url };
}

async function getR2PresignedUrl(
  client: S3Client,
  bucketName: string,
  key: string,
  expiresIn = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

// ============================================================================
// PUBLIC API (Auto-selects provider)
// ============================================================================

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const provider = getStorageProvider();

  if (provider === 'local') {
    return localPut(relKey, data, contentType);
  } else if (provider === 'r2') {
    return r2Put(relKey, data, contentType);
  } else {
    return s3Put(relKey, data, contentType);
  }
}

export async function storageGet(
  relKey: string,
  expiresIn = 300
): Promise<{ key: string; url: string }> {
  const provider = getStorageProvider();

  if (provider === 'local') {
    return localGet(relKey, expiresIn);
  } else if (provider === 'r2') {
    return r2Get(relKey, expiresIn);
  } else {
    return s3Get(relKey, expiresIn);
  }
}

// Export provider info for debugging
export function getStorageInfo(): { provider: StorageProvider; configured: boolean } {
  const provider = getStorageProvider();
  let configured = false;

  try {
    if (provider === 'local') {
      ensureLocalStorageDir();
      configured = true;
    } else if (provider === 'r2') {
      if (useMockR2()) {
        configured = true;
      } else {
        getR2Client();
        getR2BucketName();
        configured = true;
      }
    } else {
      getS3Config();
      configured = true;
    }
  } catch (error) {
    configured = false;
  }

  return { provider, configured };
}

// Export local storage directory for Express static serving
export { LOCAL_STORAGE_DIR };
