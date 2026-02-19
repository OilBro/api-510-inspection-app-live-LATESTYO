/**
 * COHERE AI SERVICE MODULE
 * OilPro 510 - Regulatory-Grade Inspection Application
 * 
 * Provides three AI-powered capabilities for API 510 compliance:
 * 
 * 1. RERANK V3 — Formula Selection & Code Clause Retrieval
 *    Ensures the correct ASME/API code clause is selected for each calculation context.
 *    
 * 2. EMBED V3 — Historical Inspection Memory & Similarity Search
 *    Converts inspection findings into vectors for semantic similarity search across
 *    historical records, enabling pattern recognition and trend analysis.
 *    
 * 3. COMMAND R+ — Code-Grounded Engineering Guidance (RAG)
 *    Provides engineering guidance strictly grounded in ASME/API code documents,
 *    with citation tracking for audit defensibility.
 * 
 * References:
 * - Cohere API v2: https://docs.cohere.com
 * - ASME Section VIII Division 1 (2023 Edition)
 * - API 510 Pressure Vessel Inspection Code
 * - API 579-1/ASME FFS-1 Fitness-For-Service
 */

import { CohereClient } from 'cohere-ai';
import { logger } from './_core/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const COHERE_API_KEY = process.env.COHERE_API_KEY;

const MODELS = {
  rerank: 'rerank-v3.5',
  embed: 'embed-english-v3.0',
  chat: 'command-r-plus-08-2024',
} as const;

const EMBED_DIMENSION = 1024; // embed-english-v3.0 output dimension

let cohereClient: CohereClient | null = null;

function getClient(): CohereClient {
  if (!cohereClient) {
    if (!COHERE_API_KEY) {
      throw new Error('COHERE_API_KEY is not configured. Cannot initialize Cohere client.');
    }
    cohereClient = new CohereClient({ token: COHERE_API_KEY });
  }
  return cohereClient;
}

// ============================================================================
// CODE CLAUSE KNOWLEDGE BASE
// ============================================================================

/**
 * Comprehensive ASME/API code clause knowledge base for Rerank-powered
 * formula selection. Each entry is a self-contained code reference with
 * the governing paragraph, formula, applicability, and limitations.
 */
export const CODE_CLAUSE_KNOWLEDGE_BASE: CodeClause[] = [
  // --- ASME VIII-1 UG-27: Cylindrical Shells ---
  {
    id: 'UG-27-circ',
    code: 'ASME VIII-1',
    paragraph: 'UG-27(c)(1)',
    title: 'Cylindrical Shell — Circumferential Stress (Longitudinal Joints)',
    formula: 't = PR / (SE - 0.6P)',
    mawpFormula: 'MAWP = SEt / (R + 0.6t)',
    applicability: 'Cylindrical shells under internal pressure. Circumferential stress governs when P ≤ 0.385SE.',
    limitations: 'Thin-wall formula only: t ≤ R/2. For thick-wall, use mandatory Appendix 1.',
    componentTypes: ['shell', 'cylinder', 'barrel'],
    variables: {
      P: 'Design pressure (psi)',
      R: 'Inside radius (inches)',
      S: 'Allowable stress at design temperature (psi) per ASME Section II Part D',
      E: 'Joint efficiency per UW-12',
      t: 'Minimum required wall thickness (inches)',
    },
  },
  {
    id: 'UG-27-long',
    code: 'ASME VIII-1',
    paragraph: 'UG-27(c)(2)',
    title: 'Cylindrical Shell — Longitudinal Stress (Circumferential Joints)',
    formula: 't = PR / (2SE + 0.4P)',
    mawpFormula: 'MAWP = 2SEt / (R - 0.4t)',
    applicability: 'Cylindrical shells under internal pressure. Longitudinal stress from circumferential joints.',
    limitations: 'Thin-wall formula only: t ≤ R/2. Denominator R - 0.4t must be > 0.',
    componentTypes: ['shell', 'cylinder', 'barrel'],
    variables: {
      P: 'Design pressure (psi)',
      R: 'Inside radius (inches)',
      S: 'Allowable stress at design temperature (psi)',
      E: 'Joint efficiency per UW-12',
      t: 'Minimum required wall thickness (inches)',
    },
  },

  // --- ASME VIII-1 UG-32: Formed Heads ---
  {
    id: 'UG-32-d-ellipsoidal',
    code: 'ASME VIII-1',
    paragraph: 'UG-32(d)',
    title: '2:1 Ellipsoidal Head — Internal Pressure',
    formula: 't = PD / (2SE - 0.2P)',
    mawpFormula: 'MAWP = 2SEt / (D + 0.2t)',
    applicability: '2:1 semi-ellipsoidal heads under internal pressure. K=1.0 for standard 2:1 ratio.',
    limitations: 'Thin-wall formula: t ≤ 0.25D. Head must be formed to true ellipsoidal shape.',
    componentTypes: ['head', 'ellipsoidal', '2:1 ellipsoidal'],
    variables: {
      P: 'Design pressure (psi)',
      D: 'Inside diameter of head skirt (inches)',
      S: 'Allowable stress at design temperature (psi)',
      E: 'Joint efficiency of head-to-shell weld',
      t: 'Minimum required head thickness (inches)',
    },
  },
  {
    id: 'UG-32-e-torispherical',
    code: 'ASME VIII-1',
    paragraph: 'UG-32(e)',
    title: 'Torispherical (Flanged & Dished) Head — Internal Pressure',
    formula: 't = 0.885PL / (SE - 0.1P)',
    mawpFormula: 'MAWP = SEt / (0.885L + 0.1t)',
    applicability: 'ASME flanged and dished (torispherical) heads. L = inside crown radius, r = knuckle radius. Standard F&D: L = OD, r = 0.06L.',
    limitations: 'r ≥ 0.06L, r ≥ 3t, L ≤ OD. M factor = 0.885 for standard F&D (L/r = 16.67).',
    componentTypes: ['head', 'torispherical', 'flanged and dished', 'F&D'],
    variables: {
      P: 'Design pressure (psi)',
      L: 'Inside crown radius (inches)',
      S: 'Allowable stress at design temperature (psi)',
      E: 'Joint efficiency',
      M: 'Stress intensification factor = ¼(3 + √(L/r))',
      t: 'Minimum required head thickness (inches)',
    },
  },
  {
    id: 'UG-32-f-hemispherical',
    code: 'ASME VIII-1',
    paragraph: 'UG-32(f)',
    title: 'Hemispherical Head — Internal Pressure',
    formula: 't = PR / (2SE - 0.2P)',
    mawpFormula: 'MAWP = 2SEt / (R + 0.2t)',
    applicability: 'Hemispherical heads under internal pressure.',
    limitations: 'Thin-wall formula: t ≤ 0.356R. For t > 0.356R, use Appendix 1-3.',
    componentTypes: ['head', 'hemispherical'],
    variables: {
      P: 'Design pressure (psi)',
      R: 'Inside radius of head (inches)',
      S: 'Allowable stress at design temperature (psi)',
      E: 'Joint efficiency',
      t: 'Minimum required head thickness (inches)',
    },
  },

  // --- ASME VIII-1 UG-34: Flat Heads ---
  {
    id: 'UG-34-flat',
    code: 'ASME VIII-1',
    paragraph: 'UG-34',
    title: 'Unstayed Flat Heads and Covers',
    formula: 't = d × √(CP / SE)',
    mawpFormula: 'MAWP = SEt² / (Cd²)',
    applicability: 'Flat heads, covers, and blind flanges under internal pressure.',
    limitations: 'C factor depends on attachment method (0.10 to 0.33 per Figure UG-34).',
    componentTypes: ['head', 'flat', 'cover', 'blind flange'],
    variables: {
      P: 'Design pressure (psi)',
      d: 'Diameter or short span (inches)',
      S: 'Allowable stress at design temperature (psi)',
      E: 'Joint efficiency',
      C: 'Attachment factor per Figure UG-34',
      t: 'Minimum required thickness (inches)',
    },
  },

  // --- ASME VIII-1 UG-27: Conical Sections ---
  {
    id: 'UG-27-conical',
    code: 'ASME VIII-1',
    paragraph: 'UG-27 / Appendix 1-4(e)',
    title: 'Conical Section — Internal Pressure',
    formula: 't = PD / (2cos(α)(SE - 0.6P))',
    mawpFormula: 'MAWP = 2SEt·cos(α) / (D + 1.2t·cos(α))',
    applicability: 'Conical shells and reducers under internal pressure.',
    limitations: 'Half apex angle α ≤ 30° without reinforcement. For α > 30°, special analysis required.',
    componentTypes: ['cone', 'conical', 'reducer'],
    variables: {
      P: 'Design pressure (psi)',
      D: 'Inside diameter at large end (inches)',
      S: 'Allowable stress at design temperature (psi)',
      E: 'Joint efficiency',
      'α': 'Half apex angle (degrees)',
      t: 'Minimum required thickness (inches)',
    },
  },

  // --- ASME VIII-1 UG-37: Nozzle Reinforcement ---
  {
    id: 'UG-37-reinforcement',
    code: 'ASME VIII-1',
    paragraph: 'UG-37',
    title: 'Reinforcement Required for Openings in Shells and Formed Heads',
    formula: 'A_required = d × t_r × F + 2 × t_n × t_r × F × (1 - f_r1)',
    mawpFormula: 'N/A — Area replacement method',
    applicability: 'All openings in pressure vessels that require reinforcement per UG-36.',
    limitations: 'Opening diameter ≤ one-half the vessel diameter or 20 inches. Larger openings require special analysis.',
    componentTypes: ['nozzle', 'opening', 'manway'],
    variables: {
      d: 'Finished diameter of opening (inches)',
      t_r: 'Required thickness of shell or head (inches)',
      F: 'Correction factor for plane under consideration',
      t_n: 'Nominal thickness of nozzle wall (inches)',
      f_r1: 'Strength reduction factor for nozzle material',
    },
  },

  // --- ASME VIII-1 UG-45: Nozzle Minimum Thickness ---
  {
    id: 'UG-45-nozzle-min',
    code: 'ASME VIII-1',
    paragraph: 'UG-45',
    title: 'Nozzle Neck Minimum Thickness',
    formula: 't_min = max(t_UG16b, t_UG45a, t_UG45b)',
    mawpFormula: 'N/A — Minimum thickness requirement',
    applicability: 'All nozzle necks. Minimum thickness is the greater of: (a) thickness per UG-16(b), (b) thickness per UG-27/UG-32 for nozzle as independent vessel, (c) thickness from pipe schedule requirements.',
    limitations: 'Nozzle neck must also satisfy reinforcement requirements of UG-37.',
    componentTypes: ['nozzle', 'nozzle neck'],
    variables: {
      t_UG16b: 'Minimum thickness per UG-16(b) (inches)',
      t_UG45a: 'Thickness as independent vessel per UG-27/UG-32 (inches)',
      t_UG45b: 'Pipe schedule thickness requirement (inches)',
    },
  },

  // --- API 510: Remaining Life ---
  {
    id: 'API510-7.1.1-RL',
    code: 'API 510',
    paragraph: '§7.1.1',
    title: 'Remaining Life Calculation',
    formula: 'RL = (t_actual - t_required) / Corrosion_Rate',
    mawpFormula: 'N/A',
    applicability: 'All in-service pressure vessels subject to corrosion or erosion.',
    limitations: 'Corrosion rate must be explicitly defined as LT, ST, or user-provided. Never averaged unless code-permitted.',
    componentTypes: ['shell', 'head', 'nozzle', 'any'],
    variables: {
      t_actual: 'Current measured thickness (inches)',
      t_required: 'Minimum required thickness per ASME calculations (inches)',
      Corrosion_Rate: 'Rate in inches/year (LT, ST, or user-provided)',
      RL: 'Remaining life (years)',
    },
  },

  // --- API 510: Corrosion Rate ---
  {
    id: 'API510-CR-ST',
    code: 'API 510',
    paragraph: '§7.1',
    title: 'Short-Term Corrosion Rate',
    formula: 'CR_ST = (t_previous - t_current) / Years_between_inspections',
    mawpFormula: 'N/A',
    applicability: 'Corrosion rate between two consecutive thickness measurements.',
    limitations: 'Requires at least two thickness readings at the same CML location.',
    componentTypes: ['shell', 'head', 'nozzle', 'any'],
    variables: {
      t_previous: 'Previous thickness measurement (inches)',
      t_current: 'Current thickness measurement (inches)',
      Years_between_inspections: 'Time between measurements (years)',
    },
  },
  {
    id: 'API510-CR-LT',
    code: 'API 510',
    paragraph: '§7.1',
    title: 'Long-Term Corrosion Rate',
    formula: 'CR_LT = (t_nominal - t_current) / Age_of_vessel',
    mawpFormula: 'N/A',
    applicability: 'Overall corrosion rate from original construction to current measurement.',
    limitations: 'Requires known nominal (original) thickness and vessel age.',
    componentTypes: ['shell', 'head', 'nozzle', 'any'],
    variables: {
      t_nominal: 'Original nominal thickness (inches)',
      t_current: 'Current thickness measurement (inches)',
      Age_of_vessel: 'Years since construction or last major repair',
    },
  },

  // --- API 510: Inspection Intervals ---
  {
    id: 'API510-interval',
    code: 'API 510',
    paragraph: '§6.4',
    title: 'Inspection Interval Determination',
    formula: 'Interval = MIN(RL / 2, 10 years)',
    mawpFormula: 'N/A',
    applicability: 'Determining next internal or on-stream inspection date.',
    limitations: 'If RL ≤ 4 years, internal inspection is required. RBI programs may extend intervals with documented risk assessment.',
    componentTypes: ['shell', 'head', 'nozzle', 'any'],
    variables: {
      RL: 'Remaining life (years)',
      Interval: 'Maximum inspection interval (years)',
    },
  },

  // --- API 510: MAWP at Next Inspection ---
  {
    id: 'API510-MAP-next',
    code: 'API 510',
    paragraph: '§7.1.2',
    title: 'MAWP at Next Inspection (Projected)',
    formula: 't_next = t_actual - (CR × Years_to_next); MAWP_next = f(t_next)',
    mawpFormula: 'MAWP_next = SEt_next / (R + 0.6t_next) for shells',
    applicability: 'Projecting MAWP at the next scheduled inspection based on corrosion rate.',
    limitations: 'Assumes linear corrosion rate. Non-linear degradation requires FFS assessment per API 579.',
    componentTypes: ['shell', 'head', 'any'],
    variables: {
      t_actual: 'Current measured thickness (inches)',
      CR: 'Governing corrosion rate (in/yr)',
      Years_to_next: 'Years until next inspection',
      t_next: 'Projected thickness at next inspection (inches)',
    },
  },

  // --- ASME Section II Part D: Material Properties ---
  {
    id: 'ASME-IID-stress',
    code: 'ASME Section II Part D',
    paragraph: 'Table 1A',
    title: 'Allowable Stress Values for Ferrous Materials',
    formula: 'S = f(material_spec, temperature)',
    mawpFormula: 'N/A — Lookup table',
    applicability: 'All ferrous materials used in ASME VIII-1 construction. Values at design temperature.',
    limitations: 'Interpolation between tabulated temperatures is permitted. Extrapolation is not.',
    componentTypes: ['any'],
    variables: {
      material_spec: 'ASME material specification (e.g., SA-516 Gr 70)',
      temperature: 'Design temperature (°F)',
      S: 'Maximum allowable stress (psi)',
    },
  },

  // --- Joint Efficiency ---
  {
    id: 'UW-12-joint-eff',
    code: 'ASME VIII-1',
    paragraph: 'UW-12',
    title: 'Joint Efficiency Factors',
    formula: 'E = f(joint_type, radiography_extent)',
    mawpFormula: 'N/A — Lookup table',
    applicability: 'All welded joints in pressure vessels. E depends on joint category and extent of radiographic examination.',
    limitations: 'Full RT (RT-1): E=1.0, Spot RT (RT-2): E=0.85, No RT (RT-3): E=0.70, RT-4: E=0.65.',
    componentTypes: ['any'],
    variables: {
      joint_type: 'Joint category per UW-3',
      radiography_extent: 'RT-1 (Full), RT-2 (Spot), RT-3 (None), RT-4',
      E: 'Joint efficiency factor',
    },
  },
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CodeClause {
  id: string;
  code: string;
  paragraph: string;
  title: string;
  formula: string;
  mawpFormula: string;
  applicability: string;
  limitations: string;
  componentTypes: string[];
  variables: Record<string, string>;
}

export interface RerankResult {
  clause: CodeClause;
  relevanceScore: number;
  rank: number;
}

export interface FormulaSelectionResult {
  query: string;
  topClauses: RerankResult[];
  selectedClause: CodeClause;
  confidence: number;
  explanation: string;
}

export interface SimilarInspection {
  inspectionId: string;
  vesselTagNumber: string;
  vesselName: string;
  similarity: number;
  findings: string;
  inspectionDate: string;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimension: number;
}

export interface EngineeringGuidanceResult {
  question: string;
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  disclaimer: string;
}

export interface Citation {
  code: string;
  paragraph: string;
  text: string;
}

// ============================================================================
// INTEGRATION 1: RERANK V3 — Formula Selection & Code Clause Retrieval
// ============================================================================

/**
 * Select the most appropriate ASME/API code clause for a given calculation context.
 * Uses Cohere Rerank V3 to semantically match the query against the full code clause
 * knowledge base, ensuring the correct formula is applied.
 * 
 * @param query - Natural language description of the calculation needed
 * @param componentType - Optional filter for component type (shell, head, nozzle)
 * @param topN - Number of top results to return (default: 3)
 * @returns FormulaSelectionResult with ranked clauses and confidence
 */
export async function selectFormula(
  query: string,
  componentType?: string,
  topN: number = 3
): Promise<FormulaSelectionResult> {
  const client = getClient();
  
  // Filter knowledge base by component type if specified
  let candidates = CODE_CLAUSE_KNOWLEDGE_BASE;
  if (componentType) {
    const normalizedType = componentType.toLowerCase();
    candidates = candidates.filter(clause => 
      clause.componentTypes.some(ct => 
        ct.toLowerCase().includes(normalizedType) || normalizedType.includes(ct.toLowerCase())
      )
    );
    // Always include 'any' type clauses
    const anyClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c => 
      c.componentTypes.includes('any') && !candidates.includes(c)
    );
    candidates = [...candidates, ...anyClauses];
  }
  
  // Build document strings for reranking
  const documents = candidates.map(clause => 
    `${clause.code} ${clause.paragraph}: ${clause.title}. Formula: ${clause.formula}. ${clause.applicability}. Limitations: ${clause.limitations}`
  );
  
  try {
    const response = await client.v2.rerank({
      model: MODELS.rerank,
      query,
      documents,
      topN: Math.min(topN, documents.length),
    });
    
    const topClauses: RerankResult[] = response.results.map((result, rank) => ({
      clause: candidates[result.index],
      relevanceScore: result.relevanceScore,
      rank: rank + 1,
    }));
    
    const selectedClause = topClauses[0].clause;
    const confidence = topClauses[0].relevanceScore;
    
    // Generate explanation
    let explanation: string;
    if (confidence > 0.5) {
      explanation = `High confidence match: ${selectedClause.code} ${selectedClause.paragraph} — ${selectedClause.title}. This is the governing code section for this calculation.`;
    } else if (confidence > 0.2) {
      explanation = `Moderate confidence match: ${selectedClause.code} ${selectedClause.paragraph}. Review the applicability statement to confirm this is the correct formula for your specific geometry and loading.`;
    } else {
      explanation = `Low confidence match: ${selectedClause.code} ${selectedClause.paragraph}. The query may not precisely match standard code terminology. Verify the selected clause against the actual code section before proceeding.`;
    }
    
    logger.info(`[Cohere Rerank] Formula selected: ${selectedClause.id} (confidence: ${confidence.toFixed(4)}) for query: "${query}"`);
    
    return {
      query,
      topClauses,
      selectedClause,
      confidence,
      explanation,
    };
  } catch (error) {
    logger.error('[Cohere Rerank] Formula selection failed:', error);
    throw new Error(`Formula selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the code clause explanation for a specific calculation type.
 * This is a convenience wrapper that maps common calculation types to queries.
 */
export async function getCodeReference(
  calculationType: 'shell_tmin' | 'shell_mawp' | 'head_tmin' | 'head_mawp' | 'nozzle_reinforcement' | 'remaining_life' | 'corrosion_rate' | 'inspection_interval',
  headType?: string
): Promise<FormulaSelectionResult> {
  const queryMap: Record<string, { query: string; component?: string }> = {
    shell_tmin: { query: 'minimum required thickness for cylindrical shell under internal pressure', component: 'shell' },
    shell_mawp: { query: 'maximum allowable working pressure MAWP for cylindrical shell at actual thickness', component: 'shell' },
    head_tmin: { query: `minimum required thickness for ${headType || 'ellipsoidal'} head under internal pressure`, component: 'head' },
    head_mawp: { query: `maximum allowable working pressure MAWP for ${headType || 'ellipsoidal'} head`, component: 'head' },
    nozzle_reinforcement: { query: 'reinforcement required for openings in shells nozzle area replacement', component: 'nozzle' },
    remaining_life: { query: 'remaining life calculation based on corrosion rate and minimum thickness' },
    corrosion_rate: { query: 'corrosion rate calculation short term long term between inspections' },
    inspection_interval: { query: 'next inspection interval determination based on remaining life API 510' },
  };
  
  const { query, component } = queryMap[calculationType];
  return selectFormula(query, component);
}

// ============================================================================
// INTEGRATION 2: EMBED V3 — Historical Inspection Memory
// ============================================================================

/**
 * Generate embeddings for inspection text using Cohere Embed V3.
 * Used to build the historical memory of inspection findings for similarity search.
 * 
 * @param texts - Array of text strings to embed
 * @param inputType - 'search_document' for indexing, 'search_query' for searching
 * @returns Array of EmbeddingResult objects
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: 'search_document' | 'search_query' = 'search_document'
): Promise<EmbeddingResult[]> {
  const client = getClient();
  
  // Cohere embed API has a limit of 96 texts per call
  const BATCH_SIZE = 96;
  const allResults: EmbeddingResult[] = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    try {
      const response = await client.v2.embed({
        model: MODELS.embed,
        texts: batch,
        inputType,
        embeddingTypes: ['float'],
      });
      
      const embeddings = response.embeddings.float!;
      
      for (let j = 0; j < batch.length; j++) {
        allResults.push({
          text: batch[j],
          embedding: embeddings[j],
          dimension: EMBED_DIMENSION,
        });
      }
    } catch (error) {
      logger.error(`[Cohere Embed] Embedding batch ${i / BATCH_SIZE + 1} failed:`, error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  logger.info(`[Cohere Embed] Generated ${allResults.length} embeddings (${EMBED_DIMENSION}D)`);
  return allResults;
}

/**
 * Build a searchable text summary from an inspection record for embedding.
 * Combines vessel data, findings, measurements, and recommendations into
 * a single text representation optimized for semantic search.
 */
export function buildInspectionSummary(inspection: {
  vesselTagNumber: string;
  vesselName?: string | null;
  materialSpec?: string | null;
  designPressure?: string | number | null;
  designTemperature?: string | number | null;
  headType?: string | null;
  product?: string | null;
  inspectionResults?: string | null;
  recommendations?: string | null;
  status?: string | null;
}): string {
  const parts: string[] = [];
  
  parts.push(`Vessel: ${inspection.vesselTagNumber}`);
  if (inspection.vesselName) parts.push(`Name: ${inspection.vesselName}`);
  if (inspection.materialSpec) parts.push(`Material: ${inspection.materialSpec}`);
  if (inspection.designPressure) parts.push(`Design Pressure: ${inspection.designPressure} psi`);
  if (inspection.designTemperature) parts.push(`Design Temperature: ${inspection.designTemperature}°F`);
  if (inspection.headType) parts.push(`Head Type: ${inspection.headType}`);
  if (inspection.product) parts.push(`Product/Service: ${inspection.product}`);
  if (inspection.inspectionResults) parts.push(`Findings: ${inspection.inspectionResults}`);
  if (inspection.recommendations) parts.push(`Recommendations: ${inspection.recommendations}`);
  if (inspection.status) parts.push(`Status: ${inspection.status}`);
  
  return parts.join('. ');
}

/**
 * Calculate cosine similarity between two embedding vectors.
 * Used for finding similar inspections in the historical database.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

/**
 * Find similar inspections by comparing embeddings.
 * This is the core "historical memory" function that enables pattern recognition.
 * 
 * @param queryEmbedding - Embedding of the current inspection or query
 * @param storedEmbeddings - Array of stored embeddings with metadata
 * @param topK - Number of similar results to return
 * @param minSimilarity - Minimum similarity threshold (0-1)
 * @returns Array of similar inspections sorted by similarity
 */
export function findSimilarInspections(
  queryEmbedding: number[],
  storedEmbeddings: Array<{
    inspectionId: string;
    vesselTagNumber: string;
    vesselName: string;
    embedding: number[];
    findings: string;
    inspectionDate: string;
  }>,
  topK: number = 5,
  minSimilarity: number = 0.3
): SimilarInspection[] {
  const scored = storedEmbeddings.map(stored => ({
    ...stored,
    similarity: cosineSimilarity(queryEmbedding, stored.embedding),
  }));
  
  return scored
    .filter(s => s.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map(s => ({
      inspectionId: s.inspectionId,
      vesselTagNumber: s.vesselTagNumber,
      vesselName: s.vesselName,
      similarity: Math.round(s.similarity * 1000) / 1000,
      findings: s.findings,
      inspectionDate: s.inspectionDate,
    }));
}

// ============================================================================
// INTEGRATION 3: COMMAND R+ — Code-Grounded Engineering Guidance (RAG)
// ============================================================================

/**
 * System prompt for the engineering guidance RAG system.
 * Strictly constrains the model to ASME/API code-based answers.
 */
const ENGINEERING_SYSTEM_PROMPT = `You are a Senior API 510 Authorized Inspector and ASME Code Consultant embedded in the OilPro 510 inspection application. Your role is to provide engineering guidance that is STRICTLY grounded in the following codes and standards:

1. ASME BPVC Section VIII Division 1 — Rules for Construction of Pressure Vessels
2. API 510 — Pressure Vessel Inspection Code  
3. API 579-1/ASME FFS-1 — Fitness-For-Service
4. ASME Section II Part D — Material Properties
5. ASME Section V — Nondestructive Examination
6. ASME Section IX — Welding, Brazing, and Fusing Qualifications

MANDATORY RULES:
- ALWAYS cite the specific code paragraph (e.g., "Per API 510 §7.1.1" or "Per ASME VIII-1 UG-27(c)(1)")
- NEVER provide guidance that is not directly supported by a code section
- If the question falls outside the scope of these codes, state: "This question requires analysis beyond the scope of the referenced codes. Consult a qualified Professional Engineer."
- Use engineering language exclusively. No marketing or persuasive tone.
- State uncertainty explicitly when present
- When multiple code sections could apply, list all applicable sections and explain which governs
- Include relevant formulas with variable definitions
- Flag any assumptions made in your response

FORMAT:
- Start with the direct answer
- Cite the governing code section
- Provide the relevant formula if applicable
- List any limitations or caveats
- End with a professional disclaimer if the question involves judgment calls`;

/**
 * Ask an engineering question and receive code-grounded guidance.
 * Uses Cohere Command R+ with RAG grounding from the code clause knowledge base.
 * 
 * @param question - Engineering question from the user
 * @param context - Optional context about the vessel or inspection being discussed
 * @returns EngineeringGuidanceResult with answer, citations, and confidence
 */
export async function askEngineeringQuestion(
  question: string,
  context?: {
    vesselTagNumber?: string;
    materialSpec?: string;
    designPressure?: number;
    designTemperature?: number;
    headType?: string;
    currentFindings?: string;
  }
): Promise<EngineeringGuidanceResult> {
  const client = getClient();
  
  // First, use Rerank to find the most relevant code clauses for context
  let relevantClauses: RerankResult[] = [];
  try {
    const formulaResult = await selectFormula(question, undefined, 5);
    relevantClauses = formulaResult.topClauses;
  } catch (error) {
    logger.warn('[Cohere RAG] Rerank pre-filtering failed, proceeding without clause context:', error);
  }
  
  // Build context-enriched prompt
  let contextStr = '';
  if (context) {
    const parts: string[] = [];
    if (context.vesselTagNumber) parts.push(`Vessel: ${context.vesselTagNumber}`);
    if (context.materialSpec) parts.push(`Material: ${context.materialSpec}`);
    if (context.designPressure) parts.push(`Design Pressure: ${context.designPressure} psi`);
    if (context.designTemperature) parts.push(`Design Temperature: ${context.designTemperature}°F`);
    if (context.headType) parts.push(`Head Type: ${context.headType}`);
    if (context.currentFindings) parts.push(`Current Findings: ${context.currentFindings}`);
    contextStr = `\n\nVessel Context:\n${parts.join('\n')}`;
  }
  
  // Build RAG documents from relevant code clauses
  let codeContext = '';
  if (relevantClauses.length > 0) {
    codeContext = '\n\nRelevant Code References:\n' + relevantClauses.map(rc => 
      `[${rc.clause.code} ${rc.clause.paragraph}] ${rc.clause.title}\nFormula: ${rc.clause.formula}\nApplicability: ${rc.clause.applicability}\nLimitations: ${rc.clause.limitations}`
    ).join('\n\n');
  }
  
  const userMessage = `${question}${contextStr}${codeContext}`;
  
  try {
    const response = await client.v2.chat({
      model: MODELS.chat,
      messages: [
        { role: 'system', content: ENGINEERING_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });
    
    const answerText = response.message?.content?.[0]?.type === 'text'
      ? response.message.content[0].text
      : '';
    
    // Extract citations from the answer (look for code references)
    const citations = extractCitations(answerText);
    
    // Determine confidence based on citation count and relevance
    let confidence: 'high' | 'medium' | 'low';
    if (citations.length >= 2 && relevantClauses.length > 0 && relevantClauses[0].relevanceScore > 0.3) {
      confidence = 'high';
    } else if (citations.length >= 1) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    const disclaimer = confidence === 'low'
      ? 'This response has low citation confidence. The guidance provided should be independently verified against the applicable code sections before being used for compliance decisions.'
      : 'This guidance is provided for reference purposes. All compliance decisions should be verified by a qualified API 510 Authorized Inspector or Professional Engineer.';
    
    logger.info(`[Cohere RAG] Engineering guidance generated: ${citations.length} citations, confidence: ${confidence}`);
    
    return {
      question,
      answer: answerText,
      citations,
      confidence,
      disclaimer,
    };
  } catch (error) {
    logger.error('[Cohere RAG] Engineering guidance failed:', error);
    throw new Error(`Engineering guidance failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract code citations from the answer text.
 * Looks for patterns like "API 510 §7.1.1", "ASME VIII-1 UG-27", etc.
 */
function extractCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<string>();
  
  // Pattern: API 510 §X.X.X or API 510 Section X.X
  const api510Pattern = /API\s*510\s*(?:§|Section\s*|Para(?:graph)?\s*)?(\d+(?:\.\d+)*)/gi;
  let match;
  while ((match = api510Pattern.exec(text)) !== null) {
    const key = `API 510 §${match[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        code: 'API 510',
        paragraph: `§${match[1]}`,
        text: extractSurroundingContext(text, match.index, 150),
      });
    }
  }
  
  // Pattern: ASME VIII-1 UG-XX or ASME Section VIII UG-XX
  const asmePattern = /ASME\s*(?:Section\s*)?(?:VIII|8)[\s-]*(?:Div(?:ision)?\s*)?1?\s*(?:,?\s*)?(?:UG|UW|UCS|UHA|UHT|Appendix)\s*[-]?\s*(\d+(?:\([a-z]\))?(?:\(\d+\))?)/gi;
  while ((match = asmePattern.exec(text)) !== null) {
    const paragraph = match[0].replace(/ASME\s*(?:Section\s*)?(?:VIII|8)[\s-]*(?:Div(?:ision)?\s*)?1?\s*(?:,?\s*)?/i, '').trim();
    const key = `ASME VIII-1 ${paragraph}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        code: 'ASME VIII-1',
        paragraph,
        text: extractSurroundingContext(text, match.index, 150),
      });
    }
  }
  
  // Pattern: API 579 or ASME FFS
  const ffsPattern = /(?:API\s*579|ASME\s*FFS)[\s-]*(?:1)?\s*(?:§|Section\s*|Part\s*)?(\d+(?:\.\d+)*)?/gi;
  while ((match = ffsPattern.exec(text)) !== null) {
    const paragraph = match[1] ? `§${match[1]}` : 'General';
    const key = `API 579 ${paragraph}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        code: 'API 579-1/ASME FFS-1',
        paragraph,
        text: extractSurroundingContext(text, match.index, 150),
      });
    }
  }
  
  // Pattern: ASME Section II Part D
  const matPattern = /ASME\s*(?:Section\s*)?II\s*(?:Part\s*)?D\s*(?:Table\s*)?(\w+)?/gi;
  while ((match = matPattern.exec(text)) !== null) {
    const table = match[1] ? `Table ${match[1]}` : 'General';
    const key = `ASME II-D ${table}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        code: 'ASME Section II Part D',
        paragraph: table,
        text: extractSurroundingContext(text, match.index, 150),
      });
    }
  }
  
  return citations;
}

/**
 * Extract surrounding context from text around a match position.
 */
function extractSurroundingContext(text: string, position: number, radius: number): string {
  const start = Math.max(0, position - radius / 2);
  const end = Math.min(text.length, position + radius);
  let context = text.slice(start, end).trim();
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';
  return context;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MODELS as COHERE_MODELS,
  EMBED_DIMENSION,
};
