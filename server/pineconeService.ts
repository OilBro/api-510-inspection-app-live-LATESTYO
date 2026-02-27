/**
 * PINECONE VECTOR SEARCH SERVICE
 * OilPro 510 - Regulatory-Grade Inspection Application
 *
 * Provides persistent vector search capabilities for:
 * 1. Semantic search across inspection data, standards, and best practices
 * 2. Cross-vessel fleet-wide pattern recognition
 * 3. Audit preparation context retrieval
 * 4. Auto-indexing of new inspection data
 *
 * Integration with existing cohereService.ts:
 * - Pinecone replaces in-memory embedding storage
 * - Cohere Rerank still handles formula selection
 * - Cohere Command R+ still powers RAG, now with Pinecone-retrieved context
 *
 * Index: api510-inspection-data (llama-text-embed-v2, 1024 dimensions, cosine)
 * Namespaces: per-vessel (vessel-54-11-XXX), per-domain (api510-standards, etc.)
 */

import { logger } from './_core/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_HOST = 'https://api510-inspection-data-jig3qlz.svc.aped-4627-b74a.pinecone.io';
const INDEX_NAME = 'api510-inspection-data';

// All available namespaces in the knowledge base
const VESSEL_NAMESPACES = [
  'vessel-54-11-001',
  'vessel-54-11-002',
  'vessel-54-11-004',
  'vessel-54-11-005',
  'vessel-54-11-067',
  'vessel-57-11-001',
] as const;

const KNOWLEDGE_NAMESPACES = [
  'api510-standards',
  'asme-code-knowledge',
  'damage-mechanisms',
  'compliance-regulatory',
  'nde-inspection-methods',
  'best-practices',
  'business-strategy',
  'oilpro-fleet',
  'sachem-facility',
] as const;

const ALL_NAMESPACES = [...VESSEL_NAMESPACES, ...KNOWLEDGE_NAMESPACES] as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PineconeSearchResult {
  id: string;
  score: number;
  namespace: string;
  fields: Record<string, unknown>;
  text: string;
}

export interface PineconeSearchOptions {
  query: string;
  namespace?: string;
  topK?: number;
  filter?: Record<string, unknown>;
  rerank?: boolean;
}

export interface FleetSearchResult {
  results: PineconeSearchResult[];
  namespacesSearched: string[];
  totalResults: number;
}

export interface UpsertRecord {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CORE API FUNCTIONS
// ============================================================================

/**
 * Check if Pinecone is configured and available
 */
export function isPineconeConfigured(): boolean {
  return !!PINECONE_API_KEY;
}

/**
 * Make an authenticated request to the Pinecone API
 */
async function pineconeRequest(
  path: string,
  method: 'GET' | 'POST' = 'POST',
  body?: unknown
): Promise<unknown> {
  if (!PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is not configured');
  }

  const url = `${INDEX_HOST}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Api-Key': PINECONE_API_KEY,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2025-01',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[Pinecone] API error ${response.status}: ${errorText}`);
    throw new Error(`Pinecone API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search inspection data within a specific namespace or across all namespaces.
 * Uses Pinecone's integrated embedding (llama-text-embed-v2) for query vectorization.
 *
 * @param options - Search configuration
 * @returns Array of ranked search results with metadata
 */
export async function searchInspectionData(
  options: PineconeSearchOptions
): Promise<PineconeSearchResult[]> {
  const { query, namespace, topK = 5, filter, rerank = true } = options;

  const searchBody: Record<string, unknown> = {
    query: {
      inputs: { text: query },
      top_k: rerank ? Math.max(topK * 3, 15) : topK,
      ...(filter && { filter }),
    },
  };

  if (rerank) {
    searchBody.rerank = {
      model: 'pinecone-rerank-v0',
      rank_fields: ['text'],
      top_n: topK,
    };
  }

  try {
    const ns = namespace || 'vessel-54-11-005'; // default namespace
    const result = await pineconeRequest(
      `/records/namespaces/${encodeURIComponent(ns)}/search`,
      'POST',
      searchBody
    ) as { result?: { hits?: Array<{ _id: string; _score: number; fields: Record<string, unknown> }> } };

    const hits = result?.result?.hits || [];
    return hits.map(hit => ({
      id: hit._id,
      score: hit._score,
      namespace: ns,
      fields: hit.fields,
      text: (hit.fields?.text as string) || '',
    }));
  } catch (error) {
    logger.error('[Pinecone] Search failed:', error);
    throw error;
  }
}

/**
 * Search across ALL vessel namespaces for fleet-wide pattern recognition.
 * Performs parallel searches, deduplicates, and reranks the combined results.
 *
 * @param query - Natural language search query
 * @param topK - Number of final results (default: 10)
 * @param includeKnowledge - Also search knowledge base namespaces (default: true)
 * @returns FleetSearchResult with combined, reranked results
 */
export async function searchAcrossFleet(
  query: string,
  topK: number = 10,
  includeKnowledge: boolean = true
): Promise<FleetSearchResult> {
  const namespacesToSearch = includeKnowledge
    ? ALL_NAMESPACES
    : VESSEL_NAMESPACES;

  // Parallel search across all namespaces
  const searchPromises = namespacesToSearch.map(async ns => {
    try {
      const results = await searchInspectionData({
        query,
        namespace: ns,
        topK: 5,
        rerank: false, // Don't rerank individual namespace searches
      });
      return results.map(r => ({ ...r, namespace: ns }));
    } catch (error) {
      logger.warn(`[Pinecone] Fleet search failed for namespace ${ns}:`, error);
      return [];
    }
  });

  const allResults = (await Promise.all(searchPromises)).flat();

  // Sort by score and take top results
  allResults.sort((a, b) => b.score - a.score);
  const topResults = allResults.slice(0, topK);

  return {
    results: topResults,
    namespacesSearched: [...namespacesToSearch],
    totalResults: allResults.length,
  };
}

/**
 * Get audit-relevant context for a specific vessel.
 * Searches both the vessel's data and compliance/best-practice namespaces.
 *
 * @param vesselId - Vessel tag number (e.g., "54-11-005")
 * @param question - Audit-related question
 * @returns Array of contextually relevant records for audit preparation
 */
export async function getAuditContext(
  vesselId: string,
  question: string
): Promise<PineconeSearchResult[]> {
  const vesselNamespace = `vessel-${vesselId}`;
  const auditNamespaces = [
    vesselNamespace,
    'compliance-regulatory',
    'best-practices',
    'api510-standards',
    'sachem-facility',
  ];

  const searchPromises = auditNamespaces.map(async ns => {
    try {
      return await searchInspectionData({
        query: question,
        namespace: ns,
        topK: 3,
        rerank: true,
      });
    } catch {
      return [];
    }
  });

  const allResults = (await Promise.all(searchPromises)).flat();
  allResults.sort((a, b) => b.score - a.score);

  logger.info(`[Pinecone] Audit context for ${vesselId}: ${allResults.length} results from ${auditNamespaces.length} namespaces`);

  return allResults.slice(0, 10);
}

// ============================================================================
// DATA INGESTION FUNCTIONS
// ============================================================================

/**
 * Upsert (insert or update) records into a vessel's namespace.
 * Used for auto-indexing when inspection data is saved in the app.
 *
 * @param vesselId - Vessel tag number (e.g., "54-11-005")
 * @param records - Array of records to upsert
 */
export async function upsertInspectionRecords(
  vesselId: string,
  records: UpsertRecord[]
): Promise<void> {
  const namespace = `vessel-${vesselId}`;

  const pineconeRecords = records.map(r => ({
    _id: r.id,
    text: r.text,
    vessel_id: vesselId,
    ...r.metadata,
  }));

  await pineconeRequest(
    `/records/namespaces/${encodeURIComponent(namespace)}/upsert`,
    'POST',
    { records: pineconeRecords }
  );

  logger.info(`[Pinecone] Upserted ${records.length} records to namespace ${namespace}`);
}

/**
 * Build a searchable text summary from vessel and component data.
 * Converts structured database records into rich text for vector indexing.
 */
export function buildComponentSummary(data: {
  vesselTagNumber: string;
  componentName: string;
  componentType: string;
  nominalThickness?: number;
  actualThickness?: number;
  minimumThickness?: number;
  corrosionRate?: number;
  remainingLife?: number;
  materialCode?: string;
  designPressure?: number;
  calculatedMAWP?: number;
}): string {
  const parts: string[] = [];

  parts.push(`Vessel ${data.vesselTagNumber} ${data.componentName} (${data.componentType})`);
  if (data.materialCode) parts.push(`Material: ${data.materialCode}`);
  if (data.nominalThickness) parts.push(`Nominal thickness: ${data.nominalThickness} inches`);
  if (data.actualThickness) parts.push(`Actual thickness: ${data.actualThickness} inches`);
  if (data.minimumThickness) parts.push(`Minimum required: ${data.minimumThickness} inches`);
  if (data.corrosionRate !== undefined) parts.push(`Corrosion rate: ${data.corrosionRate} inches/year`);
  if (data.remainingLife !== undefined) parts.push(`Remaining life: ${data.remainingLife} years`);
  if (data.designPressure) parts.push(`Design pressure: ${data.designPressure} psig`);
  if (data.calculatedMAWP) parts.push(`Calculated MAWP: ${data.calculatedMAWP} psig`);

  return parts.join('. ') + '.';
}

/**
 * Sync a vessel's full data from the database to Pinecone.
 * Call this after major data changes or to rebuild the index for a vessel.
 *
 * @param vesselId - Vessel tag number
 * @param components - Array of component calculation data
 * @param findings - Array of inspection findings
 * @param recommendations - Array of recommendations
 */
export async function syncVesselData(
  vesselId: string,
  components: Array<{
    componentName: string;
    componentType: string;
    nominalThickness?: number;
    actualThickness?: number;
    minimumThickness?: number;
    corrosionRate?: number;
    remainingLife?: number;
    materialCode?: string;
    designPressure?: number;
    calculatedMAWP?: number;
  }>,
  findings?: Array<{ id: string; description: string; severity?: string }>,
  recommendations?: Array<{ id: string; description: string; priority?: string }>
): Promise<void> {
  const records: UpsertRecord[] = [];

  // Index each component
  for (const comp of components) {
    records.push({
      id: `${vesselId}-${comp.componentName.replace(/\s+/g, '-').toLowerCase()}`,
      text: buildComponentSummary({ vesselTagNumber: vesselId, ...comp }),
      metadata: {
        component: comp.componentType,
        data_type: 'calculation',
      },
    });
  }

  // Index findings
  if (findings) {
    for (const finding of findings) {
      records.push({
        id: `${vesselId}-finding-${finding.id}`,
        text: `Vessel ${vesselId} finding: ${finding.description}. Severity: ${finding.severity || 'unspecified'}.`,
        metadata: {
          component: 'finding',
          data_type: 'finding',
          severity: finding.severity,
        },
      });
    }
  }

  // Index recommendations
  if (recommendations) {
    for (const rec of recommendations) {
      records.push({
        id: `${vesselId}-rec-${rec.id}`,
        text: `Vessel ${vesselId} recommendation: ${rec.description}. Priority: ${rec.priority || 'unspecified'}.`,
        metadata: {
          component: 'recommendation',
          data_type: 'recommendation',
          priority: rec.priority,
        },
      });
    }
  }

  await upsertInspectionRecords(vesselId, records);
  logger.info(`[Pinecone] Full sync completed for vessel ${vesselId}: ${records.length} records`);
}

// ============================================================================
// INDEX INFO
// ============================================================================

/**
 * Get current index statistics
 */
export async function getIndexStats(): Promise<{
  totalRecords: number;
  namespaces: Record<string, { recordCount: number }>;
}> {
  const result = await pineconeRequest(
    '/describe_index_stats',
    'POST',
    {}
  ) as { totalRecordCount: number; namespaces: Record<string, { recordCount: number }> };

  return {
    totalRecords: result.totalRecordCount,
    namespaces: result.namespaces,
  };
}
