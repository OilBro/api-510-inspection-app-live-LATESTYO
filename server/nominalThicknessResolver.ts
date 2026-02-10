/**
 * Nominal Thickness Resolver — Single Authoritative Source
 * =========================================================
 * 
 * API 510 §5.5 requires that the "original nominal thickness" be established
 * from the most authoritative source available. This module implements a
 * deterministic resolution hierarchy:
 * 
 *   1. Table A component data (extracted from inspection report)
 *   2. TML-level nominalThickness (per-reading value from import)
 *   3. Vessel-level shell/head nominal thickness (inspection record)
 *   4. Pipe schedule lookup (NPS + schedule → wall thickness)
 *   5. HARD STOP — flag as unresolved, block RL/CR calculations
 * 
 * The resolver returns both the resolved value and the authority source
 * for audit trail purposes.
 * 
 * @module nominalThicknessResolver
 * @version 1.0.0
 */

import { logger } from './_core/logger';

// ============================================================================
// Types
// ============================================================================

export type NominalSource = 
  | 'table_a'
  | 'tml_reading'
  | 'vessel_shell'
  | 'vessel_head'
  | 'pipe_schedule'
  | 'unresolved';

export interface NominalResolution {
  /** Resolved nominal thickness in inches, or null if unresolved */
  value: number | null;
  /** Authority source that provided the value */
  source: NominalSource;
  /** Human-readable explanation for audit trail */
  reason: string;
  /** Whether calculations can proceed (false = HARD STOP) */
  calculationReady: boolean;
  /** All candidate values considered, for transparency */
  candidates: Array<{
    source: NominalSource;
    value: number | null;
    reason: string;
  }>;
}

export interface ResolverInput {
  componentType: 'shell' | 'head';
  componentName: string;
  
  /** Table A component data (if available) */
  tableANominal?: number | null;
  
  /** TML-level nominal thicknesses from readings */
  tmlNominals?: number[];
  
  /** Vessel-level nominal thickness from inspection record */
  vesselNominal?: number | null;
  
  /** Pipe schedule data (for piping components) */
  pipeSchedule?: {
    nps: number;       // Nominal Pipe Size
    schedule: string;  // e.g., "40", "80", "STD", "XS"
  };
}

// ============================================================================
// Pipe Schedule Lookup Table (ASME B36.10M / B36.19M)
// ============================================================================

/**
 * Standard pipe wall thicknesses by NPS and schedule.
 * Values in inches. Only the most common sizes/schedules included.
 */
const PIPE_SCHEDULE_TABLE: Record<string, Record<string, number>> = {
  '0.5':  { '40': 0.109, '80': 0.147, 'STD': 0.109, 'XS': 0.147 },
  '0.75': { '40': 0.113, '80': 0.154, 'STD': 0.113, 'XS': 0.154 },
  '1':    { '40': 0.133, '80': 0.179, 'STD': 0.133, 'XS': 0.179 },
  '1.25': { '40': 0.140, '80': 0.191, 'STD': 0.140, 'XS': 0.191 },
  '1.5':  { '40': 0.145, '80': 0.200, 'STD': 0.145, 'XS': 0.200 },
  '2':    { '40': 0.154, '80': 0.218, 'STD': 0.154, 'XS': 0.218 },
  '2.5':  { '40': 0.203, '80': 0.276, 'STD': 0.203, 'XS': 0.276 },
  '3':    { '40': 0.216, '80': 0.300, 'STD': 0.216, 'XS': 0.300 },
  '3.5':  { '40': 0.226, '80': 0.318, 'STD': 0.226, 'XS': 0.318 },
  '4':    { '40': 0.237, '80': 0.337, 'STD': 0.237, 'XS': 0.337 },
  '5':    { '40': 0.258, '80': 0.375, 'STD': 0.258, 'XS': 0.375 },
  '6':    { '40': 0.280, '80': 0.432, 'STD': 0.280, 'XS': 0.432 },
  '8':    { '40': 0.322, '80': 0.500, 'STD': 0.322, 'XS': 0.500 },
  '10':   { '40': 0.365, '80': 0.594, 'STD': 0.365, 'XS': 0.500 },
  '12':   { '40': 0.406, '80': 0.688, 'STD': 0.375, 'XS': 0.500 },
  '14':   { '40': 0.438, '80': 0.750, 'STD': 0.375, 'XS': 0.500 },
  '16':   { '40': 0.500, '80': 0.844, 'STD': 0.375, 'XS': 0.500 },
  '18':   { '40': 0.562, '80': 0.938, 'STD': 0.375, 'XS': 0.500 },
  '20':   { '40': 0.594, '80': 1.031, 'STD': 0.375, 'XS': 0.500 },
  '24':   { '40': 0.688, '80': 1.219, 'STD': 0.375, 'XS': 0.500 },
  '30':   { 'STD': 0.375, 'XS': 0.500 },
  '36':   { 'STD': 0.375, 'XS': 0.500 },
};

/**
 * Look up pipe wall thickness from NPS and schedule.
 */
export function lookupPipeSchedule(nps: number, schedule: string): number | null {
  const npsKey = String(nps);
  const scheduleKey = schedule.toUpperCase()
    .replace(/^SCHEDULE\s*/i, '')
    .replace(/^SCH\s*/i, '')
    .trim();
  
  const npsEntry = PIPE_SCHEDULE_TABLE[npsKey];
  if (!npsEntry) return null;
  
  return npsEntry[scheduleKey] ?? null;
}

// ============================================================================
// Main Resolver
// ============================================================================

/**
 * Resolve the nominal thickness for a component using the authority hierarchy.
 * 
 * The hierarchy is:
 *   1. Table A → most authoritative (from inspection report summary table)
 *   2. TML readings → per-CML nominal from import data
 *   3. Vessel-level → inspection record shell/head nominal
 *   4. Pipe schedule → lookup from NPS + schedule
 *   5. HARD STOP → unresolved
 */
export function resolveNominalThickness(input: ResolverInput): NominalResolution {
  const candidates: NominalResolution['candidates'] = [];
  
  // ---- Level 1: Table A ----
  if (input.tableANominal != null && !isNaN(input.tableANominal) && input.tableANominal > 0) {
    candidates.push({
      source: 'table_a',
      value: input.tableANominal,
      reason: `Table A nominal for ${input.componentName}: ${input.tableANominal}" (most authoritative)`
    });
  } else {
    candidates.push({
      source: 'table_a',
      value: null,
      reason: 'Table A data not available or zero'
    });
  }
  
  // ---- Level 2: TML readings ----
  const validTmlNominals = (input.tmlNominals || []).filter(v => !isNaN(v) && v > 0);
  if (validTmlNominals.length > 0) {
    // Use the minimum TML nominal (conservative, per API 510)
    const minTmlNominal = Math.min(...validTmlNominals);
    candidates.push({
      source: 'tml_reading',
      value: minTmlNominal,
      reason: `Minimum TML nominal from ${validTmlNominals.length} readings: ${minTmlNominal}"`
    });
  } else {
    candidates.push({
      source: 'tml_reading',
      value: null,
      reason: 'No valid TML-level nominal thicknesses'
    });
  }
  
  // ---- Level 3: Vessel-level ----
  if (input.vesselNominal != null && !isNaN(input.vesselNominal) && input.vesselNominal > 0) {
    const vesselSource: NominalSource = input.componentType === 'shell' ? 'vessel_shell' : 'vessel_head';
    candidates.push({
      source: vesselSource,
      value: input.vesselNominal,
      reason: `Vessel-level ${input.componentType} nominal: ${input.vesselNominal}"`
    });
  } else {
    candidates.push({
      source: input.componentType === 'shell' ? 'vessel_shell' : 'vessel_head',
      value: null,
      reason: `No vessel-level ${input.componentType} nominal thickness`
    });
  }
  
  // ---- Level 4: Pipe schedule ----
  if (input.pipeSchedule) {
    const pipeNominal = lookupPipeSchedule(input.pipeSchedule.nps, input.pipeSchedule.schedule);
    if (pipeNominal != null) {
      candidates.push({
        source: 'pipe_schedule',
        value: pipeNominal,
        reason: `Pipe schedule NPS ${input.pipeSchedule.nps} Sch ${input.pipeSchedule.schedule}: ${pipeNominal}"`
      });
    } else {
      candidates.push({
        source: 'pipe_schedule',
        value: null,
        reason: `Pipe schedule NPS ${input.pipeSchedule.nps} Sch ${input.pipeSchedule.schedule} not found in lookup table`
      });
    }
  }
  
  // ---- Resolve by hierarchy ----
  for (const candidate of candidates) {
    if (candidate.value != null && candidate.value > 0) {
      logger.info(`[NominalResolver] ${input.componentName}: Resolved to ${candidate.value}" from ${candidate.source}`);
      return {
        value: candidate.value,
        source: candidate.source,
        reason: candidate.reason,
        calculationReady: true,
        candidates
      };
    }
  }
  
  // ---- Level 5: HARD STOP ----
  logger.warn(`[NominalResolver] ${input.componentName}: UNRESOLVED — no valid nominal thickness from any source`);
  return {
    value: null,
    source: 'unresolved',
    reason: `HARD STOP: No nominal thickness available for ${input.componentName}. ` +
            `Checked: Table A, TML readings, vessel data, pipe schedule. ` +
            `Remaining life and corrosion rate calculations BLOCKED until nominal is provided.`,
    calculationReady: false,
    candidates
  };
}

/**
 * Batch-resolve nominal thicknesses for all components in a recalculation.
 * Returns a map of componentName → NominalResolution.
 */
export function resolveAllNominals(
  components: Array<{
    componentType: 'shell' | 'head';
    componentName: string;
    tmlNominals: number[];
  }>,
  inspection: {
    shellNominalThickness?: string | number | null;
    headNominalThickness?: string | number | null;
  },
  tableAComponents?: Array<{
    componentName?: string;
    nominalThickness?: number;
  }> | null
): Map<string, NominalResolution> {
  const results = new Map<string, NominalResolution>();
  
  for (const comp of components) {
    // Find matching Table A component
    let tableANominal: number | null = null;
    if (tableAComponents) {
      const match = tableAComponents.find(ta => {
        const taName = (ta.componentName || '').toLowerCase();
        const compName = comp.componentName.toLowerCase();
        return taName.includes(compName) || compName.includes(taName) ||
               (comp.componentType === 'shell' && (taName.includes('shell') || taName.includes('cylinder'))) ||
               (comp.componentType === 'head' && taName.includes('head'));
      });
      if (match?.nominalThickness) {
        tableANominal = match.nominalThickness;
      }
    }
    
    // Get vessel-level nominal
    let vesselNominal: number | null = null;
    if (comp.componentType === 'shell' && inspection.shellNominalThickness) {
      vesselNominal = parseFloat(String(inspection.shellNominalThickness));
    } else if (comp.componentType === 'head' && inspection.headNominalThickness) {
      vesselNominal = parseFloat(String(inspection.headNominalThickness));
    }
    
    const resolution = resolveNominalThickness({
      componentType: comp.componentType,
      componentName: comp.componentName,
      tableANominal,
      tmlNominals: comp.tmlNominals,
      vesselNominal,
    });
    
    results.set(comp.componentName, resolution);
  }
  
  return results;
}
