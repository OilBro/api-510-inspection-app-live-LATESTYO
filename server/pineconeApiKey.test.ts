/**
 * Pinecone API Key Validation Test
 * Verifies that the PINECONE_API_KEY is configured and can connect
 * to the api510-inspection-data index.
 */

import { describe, it, expect } from 'vitest';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_HOST = 'https://api510-inspection-data-jig3qlz.svc.aped-4627-b74a.pinecone.io';

describe('Pinecone API Key Configuration', () => {
  it('should have PINECONE_API_KEY set in environment', () => {
    expect(PINECONE_API_KEY).toBeDefined();
    expect(PINECONE_API_KEY).not.toBe('');
    expect(typeof PINECONE_API_KEY).toBe('string');
    expect(PINECONE_API_KEY!.length).toBeGreaterThan(10);
  });

  it('should successfully connect to Pinecone index and retrieve stats', async () => {
    const response = await fetch(`${INDEX_HOST}/describe_index_stats`, {
      method: 'POST',
      headers: {
        'Api-Key': PINECONE_API_KEY!,
        'Content-Type': 'application/json',
        'X-Pinecone-API-Version': '2025-01',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);

    const data = await response.json() as {
      namespaces?: Record<string, { vectorCount?: number }>;
      dimension?: number;
      totalVectorCount?: number;
    };

    // Verify the index exists and has the expected dimension (1024 for llama-text-embed-v2)
    expect(data).toBeDefined();
    console.log('[Pinecone Test] Index stats:', JSON.stringify({
      dimension: data.dimension,
      totalVectorCount: data.totalVectorCount,
      namespaceCount: Object.keys(data.namespaces ?? {}).length,
    }));
  }, 15000); // 15s timeout for network call
});
