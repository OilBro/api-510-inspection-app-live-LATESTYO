/**
 * COHERE INTEGRATION TEST SUITE
 * OilPro 510 — Regulatory-Grade Inspection Application
 * 
 * Tests all three Cohere-powered capabilities:
 * 1. Rerank V3 — Code clause knowledge base integrity & formula selection
 * 2. Embed V3 — Cosine similarity, summary builder, and embedding pipeline
 * 3. Command R+ — Engineering guidance RAG system prompt and response structure
 * 
 * Tests are organized into:
 * - UNIT TESTS: Pure function tests (no API calls)
 * - INTEGRATION TESTS: Live Cohere API tests (require COHERE_API_KEY)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CODE_CLAUSE_KNOWLEDGE_BASE,
  cosineSimilarity,
  buildInspectionSummary,
  findSimilarInspections,
  selectFormula,
  generateEmbeddings,
  askEngineeringQuestion,
  type CodeClause,
  type SimilarInspection,
} from './cohereService';

// ============================================================================
// SECTION 1: CODE CLAUSE KNOWLEDGE BASE INTEGRITY
// ============================================================================

describe('Code Clause Knowledge Base Integrity', () => {
  it('should contain all required ASME VIII-1 shell formulas', () => {
    const shellClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.componentTypes.some(t => ['shell', 'cylinder', 'barrel'].includes(t))
    );
    expect(shellClauses.length).toBeGreaterThanOrEqual(2); // UG-27 circ + long
    
    // Verify UG-27 circumferential stress formula exists
    const ug27Circ = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => c.id === 'UG-27-circ');
    expect(ug27Circ).toBeDefined();
    expect(ug27Circ!.formula).toContain('PR');
    expect(ug27Circ!.formula).toContain('SE');
    expect(ug27Circ!.formula).toContain('0.6P');
    expect(ug27Circ!.mawpFormula).toContain('SEt');
  });

  it('should contain all required ASME VIII-1 head formulas', () => {
    const headClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.componentTypes.some(t => ['head', 'ellipsoidal', 'torispherical', 'hemispherical', 'flat'].includes(t))
    );
    expect(headClauses.length).toBeGreaterThanOrEqual(4); // ellip, tori, hemi, flat
    
    // Verify 2:1 ellipsoidal head
    const ellip = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => c.id.includes('ellip') || c.title.toLowerCase().includes('ellipsoidal'));
    expect(ellip).toBeDefined();
    expect(ellip!.paragraph).toContain('UG-32');
  });

  it('should contain nozzle reinforcement formulas (UG-37)', () => {
    const nozzleClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.componentTypes.some(t => ['nozzle', 'opening', 'reinforcement'].includes(t))
    );
    expect(nozzleClauses.length).toBeGreaterThanOrEqual(1);
    
    const ug37 = nozzleClauses.find(c => c.paragraph.includes('UG-37'));
    expect(ug37).toBeDefined();
  });

  it('should contain API 510 remaining life and corrosion rate formulas', () => {
    const api510Clauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.code.includes('API 510') || c.title.toLowerCase().includes('remaining life') || c.title.toLowerCase().includes('corrosion rate')
    );
    expect(api510Clauses.length).toBeGreaterThanOrEqual(2);
  });

  it('should have unique IDs for all clauses', () => {
    const ids = CODE_CLAUSE_KNOWLEDGE_BASE.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have non-empty required fields for all clauses', () => {
    for (const clause of CODE_CLAUSE_KNOWLEDGE_BASE) {
      expect(clause.id).toBeTruthy();
      expect(clause.code).toBeTruthy();
      expect(clause.paragraph).toBeTruthy();
      expect(clause.title).toBeTruthy();
      expect(clause.formula).toBeTruthy();
      expect(clause.applicability).toBeTruthy();
      expect(clause.componentTypes.length).toBeGreaterThan(0);
      expect(Object.keys(clause.variables).length).toBeGreaterThan(0);
    }
  });

  it('should have valid variable definitions for all formulas', () => {
    for (const clause of CODE_CLAUSE_KNOWLEDGE_BASE) {
      // Each variable should have a non-empty description
      for (const [varName, varDesc] of Object.entries(clause.variables)) {
        expect(varName.length).toBeGreaterThan(0);
        expect((varDesc as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('should cover all major ASME VIII-1 component types', () => {
    const allComponentTypes = new Set<string>();
    for (const clause of CODE_CLAUSE_KNOWLEDGE_BASE) {
      clause.componentTypes.forEach(t => allComponentTypes.add(t));
    }
    
    // Must cover these fundamental types
    const requiredTypes = ['shell', 'head', 'nozzle'];
    for (const reqType of requiredTypes) {
      const found = [...allComponentTypes].some(t => 
        t.includes(reqType) || reqType.includes(t)
      );
      expect(found).toBe(true);
    }
  });
});

// ============================================================================
// SECTION 2: COSINE SIMILARITY FUNCTION
// ============================================================================

describe('Cosine Similarity Calculations', () => {
  it('should return 1.0 for identical vectors', () => {
    const vec = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 10);
  });

  it('should return -1.0 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  it('should return 0.0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  it('should handle high-dimensional vectors (1024-dim like embed-english-v3.0)', () => {
    const dim = 1024;
    const a = Array.from({ length: dim }, (_, i) => Math.sin(i * 0.1));
    const b = Array.from({ length: dim }, (_, i) => Math.sin(i * 0.1 + 0.01)); // slightly shifted
    
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.99); // Very similar vectors
    expect(sim).toBeLessThanOrEqual(1.0);
  });

  it('should throw on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dimension mismatch');
  });

  it('should return 0 for zero vectors', () => {
    const zero = [0, 0, 0];
    const nonZero = [1, 2, 3];
    expect(cosineSimilarity(zero, nonZero)).toBe(0);
  });

  it('should be symmetric: sim(a,b) === sim(b,a)', () => {
    const a = [0.5, -0.3, 0.8, 1.2];
    const b = [1.0, 0.2, -0.5, 0.7];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it('should be scale-invariant', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const aScaled = a.map(x => x * 100);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(aScaled, b), 10);
  });

  it('should correctly compute known cosine similarity', () => {
    // Known example: cos([1,0], [1,1]) = 1/sqrt(2) ≈ 0.7071
    const a = [1, 0];
    const b = [1, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1 / Math.sqrt(2), 6);
  });
});

// ============================================================================
// SECTION 3: INSPECTION SUMMARY BUILDER
// ============================================================================

describe('Inspection Summary Builder', () => {
  it('should build summary with all fields populated', () => {
    const summary = buildInspectionSummary({
      vesselTagNumber: '54-11-001',
      vesselName: 'Amine Contactor',
      materialSpec: 'SA-516 Gr 70',
      designPressure: 150,
      designTemperature: 650,
      headType: '2:1 Ellipsoidal',
      product: 'Amine Solution',
      inspectionResults: 'General corrosion with localized pitting on lower shell',
      recommendations: 'Monitor corrosion rate, schedule repair within 12 months',
      status: 'Active',
    });

    expect(summary).toContain('54-11-001');
    expect(summary).toContain('Amine Contactor');
    expect(summary).toContain('SA-516 Gr 70');
    expect(summary).toContain('150');
    expect(summary).toContain('650');
    expect(summary).toContain('Ellipsoidal');
    expect(summary).toContain('pitting');
    expect(summary).toContain('Monitor');
  });

  it('should handle minimal fields (only vesselTagNumber)', () => {
    const summary = buildInspectionSummary({
      vesselTagNumber: 'V-100',
    });

    expect(summary).toContain('V-100');
    expect(summary.length).toBeGreaterThan(5);
  });

  it('should handle null and undefined optional fields gracefully', () => {
    const summary = buildInspectionSummary({
      vesselTagNumber: 'V-200',
      vesselName: null,
      materialSpec: undefined,
      designPressure: null,
      designTemperature: null,
      headType: null,
    });

    expect(summary).toContain('V-200');
    // Should not contain "null" or "undefined" as text
    expect(summary).not.toContain('null');
    expect(summary).not.toContain('undefined');
  });

  it('should handle string pressure/temperature values', () => {
    const summary = buildInspectionSummary({
      vesselTagNumber: 'V-300',
      designPressure: '250',
      designTemperature: '700',
    });

    expect(summary).toContain('250');
    expect(summary).toContain('700');
  });
});

// ============================================================================
// SECTION 4: FIND SIMILAR INSPECTIONS
// ============================================================================

describe('Find Similar Inspections', () => {
  // Create test embeddings (simplified 4-dimensional for testing)
  const testEmbeddings = [
    {
      inspectionId: 'insp-001',
      vesselTagNumber: 'V-100',
      vesselName: 'Amine Contactor',
      embedding: [0.9, 0.1, 0.1, 0.1],
      findings: 'General corrosion on lower shell',
      inspectionDate: '2024-01-15',
    },
    {
      inspectionId: 'insp-002',
      vesselTagNumber: 'V-200',
      vesselName: 'Separator',
      embedding: [0.85, 0.15, 0.1, 0.1],
      findings: 'Pitting corrosion near bottom head weld',
      inspectionDate: '2024-03-20',
    },
    {
      inspectionId: 'insp-003',
      vesselTagNumber: 'V-300',
      vesselName: 'Deaerator',
      embedding: [0.1, 0.1, 0.9, 0.1],
      findings: 'Stress corrosion cracking on upper head',
      inspectionDate: '2024-06-10',
    },
    {
      inspectionId: 'insp-004',
      vesselTagNumber: 'V-400',
      vesselName: 'Flash Drum',
      embedding: [0.1, 0.1, 0.1, 0.9],
      findings: 'Erosion damage at nozzle inlet',
      inspectionDate: '2024-09-01',
    },
  ];

  it('should return results sorted by similarity (highest first)', () => {
    const query = [0.88, 0.12, 0.1, 0.1]; // Similar to V-100 and V-200
    const results = findSimilarInspections(query, testEmbeddings, 4, 0.0);
    
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
    }
  });

  it('should respect topK limit', () => {
    const query = [0.5, 0.5, 0.5, 0.5]; // Somewhat similar to all
    const results = findSimilarInspections(query, testEmbeddings, 2, 0.0);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should filter by minimum similarity threshold', () => {
    const query = [0.9, 0.1, 0.1, 0.1]; // Very similar to V-100
    const results = findSimilarInspections(query, testEmbeddings, 10, 0.95);
    
    for (const result of results) {
      expect(result.similarity).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('should return empty array when no results meet threshold', () => {
    const query = [0.9, 0.1, 0.1, 0.1];
    const results = findSimilarInspections(query, testEmbeddings, 10, 0.999);
    // Only exact match would meet this threshold
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should include correct metadata in results', () => {
    const query = [0.9, 0.1, 0.1, 0.1];
    const results = findSimilarInspections(query, testEmbeddings, 1, 0.0);
    
    expect(results[0]).toHaveProperty('inspectionId');
    expect(results[0]).toHaveProperty('vesselTagNumber');
    expect(results[0]).toHaveProperty('vesselName');
    expect(results[0]).toHaveProperty('similarity');
    expect(results[0]).toHaveProperty('findings');
    expect(results[0]).toHaveProperty('inspectionDate');
  });

  it('should handle empty stored embeddings', () => {
    const query = [0.5, 0.5, 0.5, 0.5];
    const results = findSimilarInspections(query, [], 5, 0.0);
    expect(results).toEqual([]);
  });

  it('should find V-100 as most similar to a corrosion query vector', () => {
    // Query vector very close to V-100's embedding
    const query = [0.91, 0.09, 0.1, 0.1];
    const results = findSimilarInspections(query, testEmbeddings, 1, 0.0);
    
    expect(results[0].vesselTagNumber).toBe('V-100');
    expect(results[0].findings).toContain('corrosion');
  });

  it('should round similarity to 3 decimal places', () => {
    const query = [0.5, 0.5, 0.5, 0.5];
    const results = findSimilarInspections(query, testEmbeddings, 4, 0.0);
    
    for (const result of results) {
      const decimalPlaces = result.similarity.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(3);
    }
  });
});

// ============================================================================
// SECTION 5: LIVE COHERE API INTEGRATION TESTS
// ============================================================================

const hasApiKey = !!process.env.COHERE_API_KEY;

describe.skipIf(!hasApiKey)('Cohere API Integration — Rerank V3 (Formula Selection)', () => {
  it('should select UG-27 for shell thickness query', async () => {
    const result = await selectFormula(
      'minimum required thickness for cylindrical shell under internal pressure',
      'shell',
      3
    );

    expect(result.selectedClause).toBeDefined();
    expect(result.selectedClause.paragraph).toContain('UG-27');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.topClauses.length).toBeLessThanOrEqual(3);
    expect(result.explanation).toBeTruthy();
  }, 30000);

  it('should select UG-32 for ellipsoidal head query', async () => {
    const result = await selectFormula(
      'minimum thickness for 2:1 ellipsoidal head',
      'head',
      3
    );

    expect(result.selectedClause).toBeDefined();
    expect(result.selectedClause.paragraph).toContain('UG-32');
    expect(result.selectedClause.title.toLowerCase()).toContain('ellipsoidal');
  }, 30000);

  it('should select UG-37 for nozzle reinforcement query', async () => {
    const result = await selectFormula(
      'reinforcement required for vessel opening nozzle area replacement',
      'nozzle',
      3
    );

    expect(result.selectedClause).toBeDefined();
    expect(result.selectedClause.paragraph).toContain('UG-37');
  }, 30000);

  it('should select remaining life formula for API 510 query', async () => {
    const result = await selectFormula(
      'remaining life calculation for corroding pressure vessel API 510',
      undefined,
      5
    );

    expect(result.selectedClause).toBeDefined();
    const titleLower = result.selectedClause.title.toLowerCase();
    const hasRelevantTerm = titleLower.includes('remaining life') || 
                            titleLower.includes('corrosion') ||
                            titleLower.includes('retirement');
    expect(hasRelevantTerm).toBe(true);
  }, 30000);

  it('should return ranked results with decreasing relevance scores', async () => {
    const result = await selectFormula(
      'MAWP calculation for shell',
      undefined,
      5
    );

    expect(result.topClauses.length).toBeGreaterThan(1);
    for (let i = 1; i < result.topClauses.length; i++) {
      expect(result.topClauses[i - 1].relevanceScore).toBeGreaterThanOrEqual(
        result.topClauses[i].relevanceScore
      );
    }
  }, 30000);
});

describe.skipIf(!hasApiKey)('Cohere API Integration — Embed V3 (Embeddings)', () => {
  it('should generate embeddings with correct dimension', async () => {
    const result = await generateEmbeddings([
      'General corrosion on lower shell near bottom head weld',
    ]);

    expect(result.length).toBe(1);
    expect(result[0].embedding.length).toBe(1024); // embed-english-v3.0 dimension
    expect(result[0].text).toContain('corrosion');
  }, 30000);

  it('should generate embeddings for multiple texts', async () => {
    const texts = [
      'Pitting corrosion on shell',
      'Stress corrosion cracking on head',
      'Erosion at nozzle inlet',
    ];
    const result = await generateEmbeddings(texts);

    expect(result.length).toBe(3);
    for (const r of result) {
      expect(r.embedding.length).toBe(1024);
      expect(r.dimension).toBe(1024);
    }
  }, 30000);

  it('should produce similar embeddings for semantically similar texts', async () => {
    const result = await generateEmbeddings([
      'Corrosion damage found on the cylindrical shell of pressure vessel during API 510 inspection',
      'Wall thinning and metal loss observed on the barrel section of the tank during thickness survey',
      'The quarterly financial report shows increased revenue in the technology sector for Q3 2024',
    ]);

    // First two (both about vessel corrosion) should be more similar to each other
    // than either is to the third (completely unrelated financial text)
    const sim12 = cosineSimilarity(result[0].embedding, result[1].embedding);
    const sim13 = cosineSimilarity(result[0].embedding, result[2].embedding);
    
    expect(sim12).toBeGreaterThan(sim13);
  }, 30000);
});

describe.skipIf(!hasApiKey)('Cohere API Integration — Command R+ (Engineering Guidance)', () => {
  it('should answer an ASME code question with citations', async () => {
    const result = await askEngineeringQuestion(
      'What is the formula for minimum required thickness of a cylindrical shell under internal pressure per UG-27?'
    );

    expect(result.answer).toBeTruthy();
    expect(result.answer.length).toBeGreaterThan(50);
    expect(result.confidence).toBeDefined();
    expect(['high', 'medium', 'low']).toContain(result.confidence);
    expect(result.disclaimer).toBeTruthy();
    expect(result.citations).toBeDefined();
  }, 60000);

  it('should include relevant code citations in response', async () => {
    const result = await askEngineeringQuestion(
      'When is a hydrostatic test required after a repair per API 510?'
    );

    expect(result.answer).toBeTruthy();
    // The answer should reference API 510 or testing
    const answerLower = result.answer.toLowerCase();
    const hasRelevantContent = answerLower.includes('hydrostatic') || 
                               answerLower.includes('test') ||
                               answerLower.includes('api 510') ||
                               answerLower.includes('repair');
    expect(hasRelevantContent).toBe(true);
  }, 60000);

  it('should handle vessel context in the question', async () => {
    const result = await askEngineeringQuestion(
      'What is the maximum allowable working pressure for this vessel?',
      {
        vesselTagNumber: '54-11-001',
        materialSpec: 'SA-516 Gr 70',
        designPressure: 150,
        designTemperature: 650,
        headType: '2:1 Ellipsoidal',
        currentFindings: 'General corrosion, minimum reading 0.385 inches',
      }
    );

    expect(result.answer).toBeTruthy();
    // Should reference the vessel context
    const answerLower = result.answer.toLowerCase();
    const hasContext = answerLower.includes('sa-516') || 
                       answerLower.includes('mawp') ||
                       answerLower.includes('pressure') ||
                       answerLower.includes('thickness');
    expect(hasContext).toBe(true);
  }, 60000);

  it('should always include a disclaimer', async () => {
    const result = await askEngineeringQuestion(
      'How do I calculate remaining life per API 510?'
    );

    expect(result.disclaimer).toBeTruthy();
    expect(result.disclaimer.length).toBeGreaterThan(20);
  }, 60000);
});

// ============================================================================
// SECTION 6: KNOWLEDGE BASE FORMULA ACCURACY CROSS-CHECK
// ============================================================================

describe('Knowledge Base Formula Accuracy Cross-Check', () => {
  it('UG-27 shell formula should match ASME standard: t = PR/(SE-0.6P)', () => {
    const ug27 = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => c.id === 'UG-27-circ');
    expect(ug27).toBeDefined();
    
    // The formula should contain the correct components
    const formula = ug27!.formula.replace(/\s/g, '');
    expect(formula).toContain('PR');
    expect(formula).toContain('SE');
    expect(formula).toContain('0.6P');
  });

  it('UG-27 MAWP formula should match: MAWP = SEt/(R+0.6t)', () => {
    const ug27 = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => c.id === 'UG-27-circ');
    expect(ug27).toBeDefined();
    
    const mawp = ug27!.mawpFormula.replace(/\s/g, '');
    expect(mawp).toContain('SEt');
    expect(mawp).toContain('R+0.6t');
  });

  it('Ellipsoidal head formula should contain D (diameter) and SE', () => {
    const ellip = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => 
      c.title.toLowerCase().includes('ellipsoidal')
    );
    expect(ellip).toBeDefined();
    
    const formula = ellip!.formula;
    expect(formula).toContain('PD');
    expect(formula).toContain('SE');
  });

  it('Hemispherical head formula should use 2SE (not SE)', () => {
    const hemi = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => 
      c.title.toLowerCase().includes('hemispherical')
    );
    expect(hemi).toBeDefined();
    
    const formula = hemi!.formula;
    expect(formula).toContain('2SE');
  });

  it('Torispherical head formula should include M factor', () => {
    const tori = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => 
      c.title.toLowerCase().includes('torispherical') || c.title.toLowerCase().includes('flanged and dished')
    );
    expect(tori).toBeDefined();
    
    // Torispherical formula uses M (stress intensification factor)
    const formula = tori!.formula;
    const hasM = formula.includes('M') || formula.includes('0.885');
    expect(hasM).toBe(true);
  });

  it('API 510 remaining life formula should be (t_actual - t_required) / Corrosion_Rate', () => {
    const rl = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => 
      c.title.toLowerCase().includes('remaining life')
    );
    expect(rl).toBeDefined();
    
    const formula = rl!.formula.toLowerCase();
    const hasCorrectStructure = 
      (formula.includes('t_act') || formula.includes('t_actual') || formula.includes('tact')) &&
      (formula.includes('t_req') || formula.includes('t_required') || formula.includes('tmin') || formula.includes('t_min')) &&
      (formula.includes('corrosion_rate') || formula.includes('corrosion rate') || formula.includes('cr'));
    expect(hasCorrectStructure).toBe(true);
  });

  it('API 510 corrosion rate formula should be (t_prev - t_act) / time', () => {
    const cr = CODE_CLAUSE_KNOWLEDGE_BASE.find(c => 
      c.title.toLowerCase().includes('corrosion rate')
    );
    expect(cr).toBeDefined();
    
    const formula = cr!.formula.toLowerCase();
    const hasCorrectStructure = 
      (formula.includes('t_prev') || formula.includes('t_previous') || formula.includes('tprev') || formula.includes('t_initial')) &&
      (formula.includes('t_act') || formula.includes('t_actual') || formula.includes('tact') || formula.includes('t_current'));
    expect(hasCorrectStructure).toBe(true);
  });
});
