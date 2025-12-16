import { ENV } from "./_core/env";
import { logger } from "./_core/logger";

const DOCUPIPE_API_URL = "https://app.docupipe.ai";
const DOCUPIPE_API_KEY = process.env.DOCUPIPE_API_KEY || '';
const DOCUPIPE_SCHEMA_ID = process.env.DOCUPIPE_SCHEMA_ID || ''; // Schema ID for API 510 standardization

// Log API key status on module load
if (DOCUPIPE_API_KEY) {
  logger.info("[Docupipe] API key loaded successfully:", DOCUPIPE_API_KEY.substring(0, 10) + "...");
} else {
  logger.warn("[Docupipe] WARNING: API key not found in environment variables");
}

if (DOCUPIPE_SCHEMA_ID) {
  logger.info("[Docupipe] Schema ID loaded:", DOCUPIPE_SCHEMA_ID);
} else {
  logger.warn("[Docupipe] WARNING: Schema ID not found - standardization will not be available");
}

interface DocupipeUploadResponse {
  documentId: string;
  jobId: string;
}

interface DocupipeJobStatus {
  status: "processing" | "completed" | "failed";
  documentId?: string;
}

interface DocupipeDocumentResult {
  documentId: string;
  status: string;
  result: {
    pages: Array<{
      sections: Array<{
        type: string;
        text: string;
        bbox?: number[];
        header?: string;
      }>;
      text: string;
      pageNum: number;
    }>;
    numPages: number;
    text: string;
    language?: string;
  };
}

interface DocupipeStandardizeResponse {
  standardizationId: string;
  jobId: string;
}

interface DocupipeStandardizationResult {
  standardizationId: string;
  status: "processing" | "completed" | "failed";
  result?: Record<string, any>;
}

/**
 * Upload a document to Docupipe for processing
 */
export async function uploadDocument(
  fileBuffer: Buffer,
  filename: string
): Promise<DocupipeUploadResponse> {
  logger.info("[Docupipe uploadDocument] API key check:", DOCUPIPE_API_KEY ? "PRESENT (" + DOCUPIPE_API_KEY.substring(0, 10) + "...)" : "MISSING");
  
  logger.info("[Docupipe] API key check - value:", DOCUPIPE_API_KEY ? "PRESENT (" + DOCUPIPE_API_KEY.substring(0, 10) + "...)" : "MISSING/EMPTY", "| length:", DOCUPIPE_API_KEY ? DOCUPIPE_API_KEY.length : 0);
  if (!DOCUPIPE_API_KEY) {
    logger.error("[Docupipe] ERROR: API key check failed!");
    throw new Error("DOCUPIPE_API_KEY is not configured");
  }

  const base64Content = fileBuffer.toString("base64");

  const response = await fetch(`${DOCUPIPE_API_URL}/document`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-API-Key": DOCUPIPE_API_KEY,
    },
    body: JSON.stringify({
      document: {
        file: {
          contents: base64Content,
          filename: filename,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Docupipe upload failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Check the status of a Docupipe job
 */
export async function checkJobStatus(jobId: string): Promise<DocupipeJobStatus> {
  logger.info("[Docupipe] API key check - value:", DOCUPIPE_API_KEY ? "PRESENT (" + DOCUPIPE_API_KEY.substring(0, 10) + "...)" : "MISSING/EMPTY", "| length:", DOCUPIPE_API_KEY ? DOCUPIPE_API_KEY.length : 0);
  if (!DOCUPIPE_API_KEY) {
    logger.error("[Docupipe] ERROR: API key check failed!");
    throw new Error("DOCUPIPE_API_KEY is not configured");
  }

  const response = await fetch(`${DOCUPIPE_API_URL}/job/${jobId}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-Key": DOCUPIPE_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Docupipe job status check failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Wait for a job to complete with exponential backoff
 */
export async function waitForJobCompletion(
  jobId: string,
  maxWaitSeconds: number = 120
): Promise<DocupipeJobStatus> {
  let waitSeconds = 2;
  let totalWaited = 0;
  let status: DocupipeJobStatus;

  do {
    status = await checkJobStatus(jobId);

    if (status.status === "failed") {
      throw new Error(`Docupipe job ${jobId} failed`);
    }

    if (status.status === "completed") {
      return status;
    }

    // Wait with exponential backoff
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    totalWaited += waitSeconds;
    waitSeconds = Math.min(waitSeconds * 2, 10); // Cap at 10 seconds

    if (totalWaited >= maxWaitSeconds) {
      throw new Error(`Job ${jobId} did not complete within ${maxWaitSeconds} seconds`);
    }
  } while (status.status === "processing");

  return status;
}

/**
 * Get the parsed document results
 */
export async function getDocumentResult(
  documentId: string
): Promise<DocupipeDocumentResult> {
  logger.info("[Docupipe] API key check - value:", DOCUPIPE_API_KEY ? "PRESENT (" + DOCUPIPE_API_KEY.substring(0, 10) + "...)" : "MISSING/EMPTY", "| length:", DOCUPIPE_API_KEY ? DOCUPIPE_API_KEY.length : 0);
  if (!DOCUPIPE_API_KEY) {
    logger.error("[Docupipe] ERROR: API key check failed!");
    throw new Error("DOCUPIPE_API_KEY is not configured");
  }

  const response = await fetch(`${DOCUPIPE_API_URL}/document/${documentId}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-Key": DOCUPIPE_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Docupipe get document failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Standardize a document using a schema
 */
export async function standardizeDocument(
  documentId: string,
  schemaId?: string
): Promise<DocupipeStandardizeResponse> {
  logger.info("[Docupipe] API key check - value:", DOCUPIPE_API_KEY ? "PRESENT (" + DOCUPIPE_API_KEY.substring(0, 10) + "...)" : "MISSING/EMPTY", "| length:", DOCUPIPE_API_KEY ? DOCUPIPE_API_KEY.length : 0);
  if (!DOCUPIPE_API_KEY) {
    logger.error("[Docupipe] ERROR: API key check failed!");
    throw new Error("DOCUPIPE_API_KEY is not configured");
  }

  const schema = schemaId || DOCUPIPE_SCHEMA_ID;
  if (!schema) {
    throw new Error("No schema ID provided and DOCUPIPE_SCHEMA_ID is not configured");
  }

  const response = await fetch(`${DOCUPIPE_API_URL}/v2/standardize/batch`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-API-Key": DOCUPIPE_API_KEY,
    },
    body: JSON.stringify({
      documentIds: [documentId],
      schemaId: schema,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Docupipe standardization failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  logger.info("[Docupipe] Standardization response:", JSON.stringify(result));
  return result;
}

/**
 * Get standardization results
 */
export async function getStandardizationResult(
  standardizationId: string
): Promise<DocupipeStandardizationResult> {
  logger.info("[Docupipe] API key check - value:", DOCUPIPE_API_KEY ? "PRESENT (" + DOCUPIPE_API_KEY.substring(0, 10) + "...)" : "MISSING/EMPTY", "| length:", DOCUPIPE_API_KEY ? DOCUPIPE_API_KEY.length : 0);
  if (!DOCUPIPE_API_KEY) {
    logger.error("[Docupipe] ERROR: API key check failed!");
    throw new Error("DOCUPIPE_API_KEY is not configured");
  }

  const response = await fetch(`${DOCUPIPE_API_URL}/standardization/${standardizationId}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-Key": DOCUPIPE_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Docupipe get standardization failed: ${response.status} - ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Wait for standardization to complete
 */
export async function waitForStandardizationCompletion(
  standardizationId: string,
  maxWaitSeconds: number = 120
): Promise<DocupipeStandardizationResult> {
  let waitSeconds = 3; // Start with 3 seconds to give API time to register the standardization
  let totalWaited = 0;
  let result: DocupipeStandardizationResult;

  // Initial wait before first check
  logger.info("[Docupipe] Waiting 3 seconds before first status check...");
  await new Promise((resolve) => setTimeout(resolve, 3000));
  totalWaited += 3;

  do {
    result = await getStandardizationResult(standardizationId);

    if (result.status === "failed") {
      throw new Error(`Docupipe standardization ${standardizationId} failed`);
    }

    if (result.status === "completed") {
      return result;
    }

    // Wait with exponential backoff
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    totalWaited += waitSeconds;
    waitSeconds = Math.min(waitSeconds * 2, 10);

    if (totalWaited >= maxWaitSeconds) {
      throw new Error(`Standardization ${standardizationId} did not complete within ${maxWaitSeconds} seconds`);
    }
  } while (result.status === "processing");

  return result;
}

/**
 * Complete workflow: Upload, parse, and standardize document
 * Returns standardized JSON data
 */
export async function parseAndStandardizeDocument(
  fileBuffer: Buffer,
  filename: string,
  schemaId?: string
): Promise<any> {
  logger.info("[Docupipe] Starting upload and standardization workflow...");
  
  // Step 1: Upload document
  const { documentId, jobId } = await uploadDocument(fileBuffer, filename);
  logger.info("[Docupipe] Document uploaded:", documentId);

  // Step 2: Wait for document processing
  await waitForJobCompletion(jobId);
  logger.info("[Docupipe] Document processing completed");

  // Step 3: Start standardization
  const standardizationResponse = await standardizeDocument(documentId, schemaId);
  logger.info("[Docupipe] Standardization response:", JSON.stringify(standardizationResponse));
  
  // Extract standardization ID from response (could be standardizationId or id)
  const standardizationId = standardizationResponse.standardizationId || (standardizationResponse as any).id || (standardizationResponse as any).standardizationIds?.[0];
  
  if (!standardizationId) {
    logger.error("[Docupipe] No standardization ID found in response:", standardizationResponse);
    throw new Error("Failed to get standardization ID from Docupipe response");
  }
  
  logger.info("[Docupipe] Standardization started:", standardizationId);

  // Step 4: Wait for standardization
  const standardizationResult = await waitForStandardizationCompletion(standardizationId);
  logger.info("[Docupipe] Standardization completed");

  return standardizationResult.result;
}

/**
 * Fallback: Parse document without standardization (basic text extraction)
 */
export async function parseDocument(
  fileBuffer: Buffer,
  filename: string
): Promise<DocupipeDocumentResult> {
  const { documentId, jobId } = await uploadDocument(fileBuffer, filename);
  await waitForJobCompletion(jobId);
  return await getDocumentResult(documentId);
}

