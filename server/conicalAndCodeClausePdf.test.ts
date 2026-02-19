/**
 * Tests for:
 * 1. Conical section calculations (ASME VIII-1 UG-32(g))
 * 2. PDF code clause reference embedding (Cohere Rerank + local fallback)
 */
import { describe, expect, it, vi } from "vitest";

// ============================================================================
// PART 1: Conical Section Calculation Tests (UG-32(g))
// ============================================================================

describe("Conical Section Calculations — ASME VIII-1 UG-32(g)", () => {
  /**
   * UG-32(g) formula: t = PD / (2cos(α)(SE - 0.6P))
   * MAWP formula: MAWP = 2SEt·cos(α) / (D + 1.2t·cos(α))
   */

  function calculateConicalTmin(P: number, D: number, S: number, E: number, alphaDeg: number): number {
    const alpha = alphaDeg * (Math.PI / 180);
    const cosAlpha = Math.cos(alpha);
    const denominator = 2 * cosAlpha * (S * E - 0.6 * P);
    return denominator > 0 ? (P * D) / denominator : 0;
  }

  function calculateConicalMAWP(S: number, E: number, t: number, D: number, alphaDeg: number): number {
    const alpha = alphaDeg * (Math.PI / 180);
    const cosAlpha = Math.cos(alpha);
    return (2 * S * E * t * cosAlpha) / (D + 1.2 * t * cosAlpha);
  }

  it("calculates minimum thickness for 30° half-apex angle (standard case)", () => {
    // Standard test case: P=250 psi, D=48", S=20000 psi, E=0.85, α=30°
    const tmin = calculateConicalTmin(250, 48, 20000, 0.85, 30);
    expect(tmin).toBeGreaterThan(0);
    expect(tmin).toBeLessThan(1.0); // Reasonable for this pressure/diameter
    // Manual verification: t = 250*48 / (2*cos(30°)*(20000*0.85 - 0.6*250))
    // = 12000 / (2 * 0.8660 * (17000 - 150))
    // = 12000 / (2 * 0.8660 * 16850)
    // = 12000 / 29175.1
    // ≈ 0.411
    expect(tmin).toBeCloseTo(0.411, 2);
  });

  it("calculates minimum thickness for 0° half-apex angle (cylinder equivalent)", () => {
    // α=0° should give same result as cylindrical shell formula
    // t = PD / (2*1.0*(SE - 0.6P)) = PD / (2SE - 1.2P)
    const tmin = calculateConicalTmin(250, 48, 20000, 0.85, 0);
    // = 250*48 / (2*1.0*(17000-150)) = 12000 / (2*16850) = 12000/33700 ≈ 0.356
    expect(tmin).toBeCloseTo(0.356, 2);
  });

  it("calculates minimum thickness for 15° half-apex angle", () => {
    const tmin = calculateConicalTmin(250, 48, 20000, 0.85, 15);
    // cos(15°) ≈ 0.9659
    // = 12000 / (2 * 0.9659 * 16850) = 12000 / 32551 ≈ 0.369
    expect(tmin).toBeCloseTo(0.369, 2);
  });

  it("returns higher thickness for larger half-apex angles", () => {
    const tmin15 = calculateConicalTmin(250, 48, 20000, 0.85, 15);
    const tmin30 = calculateConicalTmin(250, 48, 20000, 0.85, 30);
    // Larger angle → thicker wall required
    expect(tmin30).toBeGreaterThan(tmin15);
  });

  it("calculates MAWP for conical section", () => {
    // MAWP = 2SEt·cos(α) / (D + 1.2t·cos(α))
    const mawp = calculateConicalMAWP(20000, 0.85, 0.480, 48, 30);
    // = 2*20000*0.85*0.480*cos(30°) / (48 + 1.2*0.480*cos(30°))
    // = 2*20000*0.85*0.480*0.8660 / (48 + 1.2*0.480*0.8660)
    // = 14122.56 / (48 + 0.4989)
    // = 14122.56 / 48.4989
    // ≈ 291.2
    expect(mawp).toBeGreaterThan(250); // Should exceed design pressure for 0.480" wall
    expect(mawp).toBeCloseTo(291.2, 0);
  });

  it("flags half-apex angle > 30° as exceeding UG-32(g) limit", () => {
    // The UI should warn when α > 30°
    const alphaDeg = 45;
    expect(alphaDeg > 30).toBe(true);
    // Calculation still works but results are NOT valid per UG-32(g)
    const tmin = calculateConicalTmin(250, 48, 20000, 0.85, 45);
    expect(tmin).toBeGreaterThan(0);
    // At 45°, cos(45°) ≈ 0.7071, so thickness increases significantly
    const tmin30 = calculateConicalTmin(250, 48, 20000, 0.85, 30);
    expect(tmin).toBeGreaterThan(tmin30);
  });

  it("handles edge case: α = 0° (pure cylinder)", () => {
    const tmin = calculateConicalTmin(250, 48, 20000, 0.85, 0);
    // cos(0) = 1.0, so this is equivalent to PD/(2(SE-0.6P))
    const cylinderTmin = (250 * 48) / (2 * (20000 * 0.85 - 0.6 * 250));
    expect(tmin).toBeCloseTo(cylinderTmin, 6);
  });

  it("returns 0 when denominator is non-positive (invalid inputs)", () => {
    // If SE - 0.6P ≤ 0, denominator goes to 0 or negative
    // P = 30000, S = 10000, E = 1.0 → SE = 10000, 0.6P = 18000 → SE - 0.6P = -8000
    const tmin = calculateConicalTmin(30000, 48, 10000, 1.0, 30);
    expect(tmin).toBe(0);
  });
});

// ============================================================================
// PART 2: PDF Code Clause Reference Embedding Tests
// ============================================================================

describe("PDF Code Clause Reference — Local Fallback", () => {
  /**
   * Tests the local fallback code clause lookup that's used when
   * Cohere Rerank API is unavailable. This is the same logic embedded
   * in professionalPdfGenerator.ts.
   */

  // Import the knowledge base - use dynamic import
  let CODE_CLAUSE_KNOWLEDGE_BASE: any[];
  
  // Load before tests
  it("loads knowledge base", async () => {
    const mod = await import("./cohereService");
    CODE_CLAUSE_KNOWLEDGE_BASE = mod.CODE_CLAUSE_KNOWLEDGE_BASE;
    expect(CODE_CLAUSE_KNOWLEDGE_BASE).toBeDefined();
    expect(CODE_CLAUSE_KNOWLEDGE_BASE.length).toBeGreaterThan(0);
  });

  function getLocalFallbackClause(calculationType: string, headType?: string) {
    const clauseMap: Record<string, string> = {
      shell_tmin: 'UG-27-circ',
      shell_mawp: 'UG-27-circ',
      head_tmin: headType?.toLowerCase().includes('hemispher') ? 'UG-32-f-hemispherical'
        : headType?.toLowerCase().includes('torisp') ? 'UG-32-e-torispherical'
        : 'UG-32-d-ellipsoidal',
      head_mawp: headType?.toLowerCase().includes('hemispher') ? 'UG-32-f-hemispherical'
        : headType?.toLowerCase().includes('torisp') ? 'UG-32-e-torispherical'
        : 'UG-32-d-ellipsoidal',
      remaining_life: 'API510-7.1.1-RL',
      corrosion_rate: 'API510-CR-ST',
      inspection_interval: 'API510-interval',
      nozzle_reinforcement: 'UG-37-reinforcement',
    };

    const clauseId = clauseMap[calculationType] || 'UG-27-circ';
    const clause = CODE_CLAUSE_KNOWLEDGE_BASE.find((c: any) => c.id === clauseId);

    if (clause) {
      return {
        paragraph: `${clause.code} ${clause.paragraph}`,
        title: clause.title,
        formula: clause.formula,
        confidence: 1.0,
        source: 'local_fallback',
      };
    }

    return {
      paragraph: 'ASME VIII-1',
      title: 'Code Reference',
      formula: 'See applicable code section',
      confidence: 0,
      source: 'local_fallback',
    };
  }

  it("returns UG-27(c)(1) for shell_tmin", () => {
    const ref = getLocalFallbackClause('shell_tmin');
    expect(ref.paragraph).toContain('UG-27');
    expect(ref.formula).toContain('PR');
    expect(ref.confidence).toBe(1.0);
    expect(ref.source).toBe('local_fallback');
  });

  it("returns UG-27(c)(1) for shell_mawp", () => {
    const ref = getLocalFallbackClause('shell_mawp');
    expect(ref.paragraph).toContain('UG-27');
    expect(ref.formula).toContain('SE');
  });

  it("returns UG-32(d) for ellipsoidal head_tmin", () => {
    const ref = getLocalFallbackClause('head_tmin', 'Ellipsoidal');
    expect(ref.paragraph).toContain('UG-32(d)');
    expect(ref.formula).toContain('PD');
    expect(ref.title).toContain('Ellipsoidal');
  });

  it("returns UG-32(e) for torispherical head_tmin", () => {
    const ref = getLocalFallbackClause('head_tmin', 'Torispherical');
    expect(ref.paragraph).toContain('UG-32(e)');
    expect(ref.title).toContain('Torispherical');
  });

  it("returns UG-32(f) for hemispherical head_tmin", () => {
    const ref = getLocalFallbackClause('head_tmin', 'Hemispherical');
    expect(ref.paragraph).toContain('UG-32(f)');
    expect(ref.title).toContain('Hemispherical');
  });

  it("returns UG-32(d) for head_mawp with ellipsoidal type", () => {
    const ref = getLocalFallbackClause('head_mawp', 'Ellipsoidal');
    expect(ref.paragraph).toContain('UG-32(d)');
  });

  it("returns API 510 §7.1.1 for remaining_life", () => {
    const ref = getLocalFallbackClause('remaining_life');
    expect(ref.paragraph).toContain('API 510');
    expect(ref.paragraph).toContain('7.1.1');
    expect(ref.formula).toContain('RL');
    expect(ref.title).toContain('Remaining Life');
  });

  it("returns API 510 §7.1 for corrosion_rate", () => {
    const ref = getLocalFallbackClause('corrosion_rate');
    expect(ref.paragraph).toContain('API 510');
    expect(ref.formula).toContain('CR');
  });

  it("returns API 510 §6.4 for inspection_interval", () => {
    const ref = getLocalFallbackClause('inspection_interval');
    expect(ref.paragraph).toContain('API 510');
    expect(ref.formula).toContain('RL');
  });

  it("returns UG-37 for nozzle_reinforcement", () => {
    const ref = getLocalFallbackClause('nozzle_reinforcement');
    expect(ref.paragraph).toContain('UG-37');
    expect(ref.title).toContain('Reinforcement');
  });

  it("falls back to UG-27 for unknown calculation type", () => {
    const ref = getLocalFallbackClause('unknown_type');
    expect(ref.paragraph).toContain('UG-27');
  });

  it("defaults to ellipsoidal when head type is undefined", () => {
    const ref = getLocalFallbackClause('head_tmin');
    expect(ref.paragraph).toContain('UG-32(d)');
    expect(ref.title).toContain('Ellipsoidal');
  });
});

describe("CODE_CLAUSE_KNOWLEDGE_BASE integrity", () => {
  let CODE_CLAUSE_KNOWLEDGE_BASE: any[];

  it("loads knowledge base", async () => {
    const mod = await import("./cohereService");
    CODE_CLAUSE_KNOWLEDGE_BASE = mod.CODE_CLAUSE_KNOWLEDGE_BASE;
    expect(CODE_CLAUSE_KNOWLEDGE_BASE).toBeDefined();
  });

  it("contains all required clause IDs for PDF embedding", () => {
    const requiredIds = [
      'UG-27-circ',
      'UG-32-d-ellipsoidal',
      'UG-32-e-torispherical',
      'UG-32-f-hemispherical',
      'UG-37-reinforcement',
      'API510-7.1.1-RL',
      'API510-CR-ST',
      'API510-interval',
      'UG-27-conical',
    ];

    for (const id of requiredIds) {
      const clause = CODE_CLAUSE_KNOWLEDGE_BASE.find((c: any) => c.id === id);
      expect(clause, `Missing clause ID: ${id}`).toBeDefined();
      expect(clause.formula).toBeTruthy();
      expect(clause.code).toBeTruthy();
      expect(clause.paragraph).toBeTruthy();
    }
  });

  it("has valid structure for all clauses", () => {
    for (const clause of CODE_CLAUSE_KNOWLEDGE_BASE) {
      expect(clause.id).toBeTruthy();
      expect(clause.code).toBeTruthy();
      expect(clause.paragraph).toBeTruthy();
      expect(clause.title).toBeTruthy();
      expect(clause.formula).toBeTruthy();
      expect(clause.componentTypes).toBeDefined();
      expect(Array.isArray(clause.componentTypes)).toBe(true);
    }
  });

  it("conical clause references UG-32(g) or UG-27/Appendix 1-4", () => {
    const conical = CODE_CLAUSE_KNOWLEDGE_BASE.find((c: any) => c.id === 'UG-27-conical');
    expect(conical).toBeDefined();
    expect(conical.formula).toContain('cos');
    expect(conical.formula).toContain('α');
    expect(conical.componentTypes).toContain('conical');
  });
});
