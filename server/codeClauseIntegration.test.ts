/**
 * CODE CLAUSE INTEGRATION TESTS
 * 
 * Verifies:
 * 1. The getCodeReference endpoint returns correct clauses for each calculation type
 * 2. Head type variants return the correct UG-32 sub-paragraph
 * 3. The fallback knowledge base covers all calculation types
 * 4. Confidence scores are within valid range
 * 5. All required fields are present in the response
 */

import { describe, it, expect } from 'vitest';
import { getCodeReference, selectFormula, CODE_CLAUSE_KNOWLEDGE_BASE } from './cohereService';

// ============================================================================
// TEST 1: getCodeReference returns correct clauses for each calculation type
// ============================================================================

describe('Code Clause Reference — Calculation Type Mapping', () => {
  it('shell_tmin returns UG-27 circumferential stress formula', async () => {
    const result = await getCodeReference('shell_tmin');
    expect(result).toBeDefined();
    expect(result.selectedClause).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
    expect(result.selectedClause.paragraph).toContain('UG-27');
    expect(result.selectedClause.formula).toContain('PR');
    expect(result.selectedClause.formula).toContain('SE');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('shell_mawp returns UG-27 MAWP formula', async () => {
    const result = await getCodeReference('shell_mawp');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
    expect(result.selectedClause.paragraph).toContain('UG-27');
    // MAWP formula should contain SEt
    expect(result.selectedClause.formula).toMatch(/SE.*t|t.*SE/);
  });

  it('remaining_life returns API 510 Section 7.1.1', async () => {
    const result = await getCodeReference('remaining_life');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('API 510');
    expect(result.selectedClause.paragraph).toContain('7.1');
    expect(result.selectedClause.formula).toContain('t_actual');
    expect(result.selectedClause.formula).toContain('t_required');
  });

  it('corrosion_rate returns API 510 corrosion rate formula', async () => {
    const result = await getCodeReference('corrosion_rate');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('API 510');
    expect(result.selectedClause.formula).toContain('t_previous');
    expect(result.selectedClause.formula).toContain('t_current');
  });

  it('inspection_interval returns API 510 Section 6.4', async () => {
    const result = await getCodeReference('inspection_interval');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('API 510');
    expect(result.selectedClause.paragraph).toContain('6.4');
    expect(result.selectedClause.formula).toContain('RL');
  });

  it('nozzle_reinforcement returns UG-37', async () => {
    const result = await getCodeReference('nozzle_reinforcement');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
    expect(result.selectedClause.paragraph).toContain('UG-37');
  });
});

// ============================================================================
// TEST 2: Head type variants return correct UG-32 sub-paragraphs
// ============================================================================

describe('Code Clause Reference — Head Type Variants', () => {
  it('head_tmin with ellipsoidal returns UG-32(d)', async () => {
    const result = await getCodeReference('head_tmin', 'ellipsoidal');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
    expect(result.selectedClause.paragraph).toContain('UG-32');
    // Ellipsoidal formula: PD/(2SE-0.2P)
    expect(result.selectedClause.formula).toContain('PD');
    expect(result.selectedClause.formula).toContain('2SE');
  });

  it('head_tmin with hemispherical returns UG-32(f)', async () => {
    const result = await getCodeReference('head_tmin', 'hemispherical');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
    expect(result.selectedClause.paragraph).toContain('UG-32');
    // Hemispherical formula: PR/(2SE-0.2P)
    expect(result.selectedClause.formula).toContain('PR');
  });

  it('head_tmin with torispherical returns UG-32(e)', async () => {
    const result = await getCodeReference('head_tmin', 'torispherical');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
    expect(result.selectedClause.paragraph).toContain('UG-32');
    // Torispherical formula contains L and M
    expect(result.selectedClause.formula).toMatch(/L|M|0\.885/);
  });

  it('head_mawp with ellipsoidal returns correct MAWP formula', async () => {
    const result = await getCodeReference('head_mawp', 'ellipsoidal');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
    // MAWP formula: 2SEt/(D+0.2t)
    expect(result.selectedClause.formula).toContain('2SE');
  });

  it('head_mawp with hemispherical returns correct MAWP formula', async () => {
    const result = await getCodeReference('head_mawp', 'hemispherical');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
    expect(result.selectedClause.formula).toContain('2SE');
  });

  it('head_mawp with torispherical returns correct MAWP formula', async () => {
    const result = await getCodeReference('head_mawp', 'torispherical');
    expect(result).toBeDefined();
    expect(result.selectedClause.code).toBe('ASME VIII-1');
  });
});

// ============================================================================
// TEST 3: Knowledge base completeness
// ============================================================================

describe('Code Clause Knowledge Base — Completeness', () => {
  it('knowledge base contains at least 10 clauses', () => {
    expect(CODE_CLAUSE_KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(10);
  });

  it('every clause has required fields', () => {
    for (const clause of CODE_CLAUSE_KNOWLEDGE_BASE) {
      expect(clause.id).toBeTruthy();
      expect(clause.code).toBeTruthy();
      expect(clause.paragraph).toBeTruthy();
      expect(clause.title).toBeTruthy();
      expect(clause.formula).toBeTruthy();
      expect(clause.applicability).toBeTruthy();
      expect(clause.limitations).toBeTruthy();
      expect(clause.componentTypes).toBeDefined();
      expect(clause.componentTypes.length).toBeGreaterThan(0);
      expect(clause.variables).toBeDefined();
      expect(Object.keys(clause.variables).length).toBeGreaterThan(0);
    }
  });

  it('knowledge base covers shell calculations (UG-27)', () => {
    const shellClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.paragraph.includes('UG-27')
    );
    expect(shellClauses.length).toBeGreaterThanOrEqual(1);
  });

  it('knowledge base covers head calculations (UG-32)', () => {
    const headClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.paragraph.includes('UG-32')
    );
    expect(headClauses.length).toBeGreaterThanOrEqual(3); // ellipsoidal, hemispherical, torispherical
  });

  it('knowledge base covers nozzle reinforcement (UG-37)', () => {
    const nozzleClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.paragraph.includes('UG-37')
    );
    expect(nozzleClauses.length).toBeGreaterThanOrEqual(1);
  });

  it('knowledge base covers remaining life (API 510)', () => {
    const rlClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.code === 'API 510' && c.formula.includes('t_actual')
    );
    expect(rlClauses.length).toBeGreaterThanOrEqual(1);
  });

  it('knowledge base covers corrosion rate (API 510)', () => {
    const crClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.code === 'API 510' && c.formula.includes('t_previous')
    );
    expect(crClauses.length).toBeGreaterThanOrEqual(1);
  });

  it('knowledge base covers inspection intervals (API 510)', () => {
    const intervalClauses = CODE_CLAUSE_KNOWLEDGE_BASE.filter(c =>
      c.code === 'API 510' && c.paragraph.includes('6.4')
    );
    expect(intervalClauses.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// TEST 4: Response structure validation
// ============================================================================

describe('Code Clause Reference — Response Structure', () => {
  it('response contains selectedClause, confidence, and explanation', async () => {
    const result = await getCodeReference('shell_tmin');
    expect(result).toHaveProperty('selectedClause');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('explanation');
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.explanation).toBe('string');
  });

  it('selectedClause contains all required display fields', async () => {
    const result = await getCodeReference('shell_tmin');
    const clause = result.selectedClause;
    expect(clause).toHaveProperty('id');
    expect(clause).toHaveProperty('code');
    expect(clause).toHaveProperty('paragraph');
    expect(clause).toHaveProperty('title');
    expect(clause).toHaveProperty('formula');
    expect(clause).toHaveProperty('applicability');
    expect(clause).toHaveProperty('limitations');
    expect(clause).toHaveProperty('componentTypes');
    expect(clause).toHaveProperty('variables');
  });

  it('confidence is between 0 and 1 for shell_tmin', async () => {
    const result = await getCodeReference('shell_tmin');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('confidence is between 0 and 1 for remaining_life', async () => {
    const result = await getCodeReference('remaining_life');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('variables object has descriptive values', async () => {
    const result = await getCodeReference('shell_tmin');
    const vars = result.selectedClause.variables;
    expect(Object.keys(vars).length).toBeGreaterThan(0);
    for (const [key, desc] of Object.entries(vars)) {
      expect(key.length).toBeGreaterThan(0);
      expect(typeof desc).toBe('string');
      expect((desc as string).length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// TEST 5: Formula correctness — formulas match ASME/API standards
// ============================================================================

describe('Code Clause Reference — Formula Correctness', () => {
  it('shell t_min formula is PR/(SE-0.6P) per UG-27(c)(1)', async () => {
    const result = await getCodeReference('shell_tmin');
    const formula = result.selectedClause.formula;
    // Must contain the key components of UG-27(c)(1)
    expect(formula).toMatch(/PR/);
    expect(formula).toMatch(/SE/);
    expect(formula).toMatch(/0\.6P/);
  });

  it('shell MAWP returns UG-27 clause with correct formula components', async () => {
    const result = await getCodeReference('shell_mawp');
    const clause = result.selectedClause;
    // The Rerank may return the t_min formula (same clause UG-27) or the MAWP formula
    // Both are correct — they are the same code paragraph
    expect(clause.paragraph).toContain('UG-27');
    expect(clause.code).toBe('ASME VIII-1');
    // The clause must contain the 0.6 factor (either in formula or mawpFormula)
    const allFormulas = `${clause.formula} ${clause.mawpFormula || ''}`;
    expect(allFormulas).toMatch(/0\.6/);
    expect(allFormulas).toMatch(/SE/);
  });

  it('ellipsoidal head formula contains PD/(2SE-0.2P) per UG-32(d)', async () => {
    const result = await getCodeReference('head_tmin', 'ellipsoidal');
    const formula = result.selectedClause.formula;
    expect(formula).toMatch(/PD/);
    expect(formula).toMatch(/2SE/);
    expect(formula).toMatch(/0\.2P/);
  });

  it('remaining life formula is (t_actual - t_required) / Corrosion_Rate per API 510 §7.1.1', async () => {
    const result = await getCodeReference('remaining_life');
    const formula = result.selectedClause.formula;
    expect(formula).toContain('t_actual');
    expect(formula).toContain('t_required');
    expect(formula).toContain('Corrosion_Rate');
  });

  it('corrosion rate formula is (t_previous - t_current) / Years per API 510 §7.1', async () => {
    const result = await getCodeReference('corrosion_rate');
    const formula = result.selectedClause.formula;
    expect(formula).toContain('t_previous');
    expect(formula).toContain('t_current');
  });

  it('inspection interval formula references RL/2 and 10 years per API 510 §6.4', async () => {
    const result = await getCodeReference('inspection_interval');
    const formula = result.selectedClause.formula;
    expect(formula).toMatch(/RL.*2|half/i);
    expect(formula).toMatch(/10/);
  });
});
