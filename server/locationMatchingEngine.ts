/**
 * Location Matching Engine for TML Data
 * 
 * Implements location-based matching for Thickness Monitoring Locations (TMLs).
 * Prioritizes physical location over CML number when matching new readings
 * to historical data, as CML numbers may change between inspections but
 * physical locations remain constant.
 * 
 * Code References:
 * - API 510 §7.1.1: Thickness Measurement Locations
 * - API 570 §7.1.2: Piping Thickness Locations
 */

import { nanoid } from 'nanoid';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TmlLocation {
  id?: string;
  legacyLocationId: string;
  componentType: string;
  locationDescription: string;
  sliceNumber?: number;
  circumferentialPosition?: number; // degrees: 0, 45, 90, 135, 180, 225, 270, 315
  axialPosition?: string;
  distanceFromDatum?: number;
  distanceUnit?: string;
}

export interface TmlReading {
  location: TmlLocation;
  thickness: number;
  thicknessUnit: string;
  measurementDate: Date;
  measurementMethod?: string;
  inspector?: string;
}

export interface LocationMatch {
  existingId: string;
  newReading: TmlReading;
  matchType: 'exact' | 'location_based' | 'fuzzy' | 'cml_number_only';
  confidence: number;
  matchReason: string;
  cmlNumberChanged: boolean;
  oldCmlNumber?: string;
  newCmlNumber?: string;
}

export interface MatchResult {
  matched: LocationMatch[];
  unmatched: TmlReading[];
  conflicts: Array<{
    newReading: TmlReading;
    candidates: Array<{
      existingId: string;
      existingLocation: TmlLocation;
      confidence: number;
      reason: string;
    }>;
  }>;
  summary: {
    totalNew: number;
    exactMatches: number;
    locationMatches: number;
    fuzzyMatches: number;
    cmlOnlyMatches: number;
    unmatched: number;
    conflicts: number;
  };
}

// ============================================================================
// LOCATION PARSING
// ============================================================================

/**
 * Parse CML/TML naming convention to extract slice and circumferential position
 * Format: "2" or "2-45" where first number is slice, second is degrees
 */
export function parseCmlNamingConvention(legacyLocationId: string): {
  sliceNumber: number | null;
  circumferentialPosition: number | null;
  raw: string;
} {
  const raw = legacyLocationId.trim();
  
  // Pattern: "2-45" or "2-0" (slice-degrees)
  const dashPattern = /^(\d+)-(\d+)$/;
  const dashMatch = raw.match(dashPattern);
  if (dashMatch) {
    return {
      sliceNumber: parseInt(dashMatch[1], 10),
      circumferentialPosition: parseInt(dashMatch[2], 10),
      raw
    };
  }
  
  // Pattern: "CML 2-45" or "TML 2-45"
  const prefixPattern = /^(?:CML|TML)\s*(\d+)-(\d+)$/i;
  const prefixMatch = raw.match(prefixPattern);
  if (prefixMatch) {
    return {
      sliceNumber: parseInt(prefixMatch[1], 10),
      circumferentialPosition: parseInt(prefixMatch[2], 10),
      raw
    };
  }
  
  // Pattern: just a number "2" (slice only)
  const numberPattern = /^(\d+)$/;
  const numberMatch = raw.match(numberPattern);
  if (numberMatch) {
    return {
      sliceNumber: parseInt(numberMatch[1], 10),
      circumferentialPosition: null,
      raw
    };
  }
  
  // Pattern: "CML 001" or "TML 001"
  const cmlPattern = /^(?:CML|TML)\s*(\d+)$/i;
  const cmlMatch = raw.match(cmlPattern);
  if (cmlMatch) {
    return {
      sliceNumber: parseInt(cmlMatch[1], 10),
      circumferentialPosition: null,
      raw
    };
  }
  
  return {
    sliceNumber: null,
    circumferentialPosition: null,
    raw
  };
}

/**
 * Normalize component type for comparison
 */
export function normalizeComponentType(componentType: string): string {
  const lower = componentType.toLowerCase().trim();
  
  // Head types
  if (lower.includes('head')) {
    if (lower.includes('north') || lower.includes('top')) return 'north_head';
    if (lower.includes('south') || lower.includes('bottom')) return 'south_head';
    if (lower.includes('east') || lower.includes('left')) return 'east_head';
    if (lower.includes('west') || lower.includes('right')) return 'west_head';
    return 'head';
  }
  
  // Shell types
  if (lower.includes('shell') || lower.includes('body') || lower.includes('cylinder')) {
    return 'shell';
  }
  
  // Nozzle types
  if (lower.includes('nozzle') || lower.includes('connection')) {
    return 'nozzle';
  }
  
  // Piping
  if (lower.includes('pipe') || lower.includes('piping')) {
    return 'piping';
  }
  
  return lower.replace(/\s+/g, '_');
}

/**
 * Normalize location description for fuzzy matching
 */
export function normalizeLocationDescription(description: string): string {
  return description
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\b(from|the|at|on|of|in|to)\b/g, '') // Remove common words
    .replace(/\s+/g, ' ')    // Normalize whitespace (after removing words to clean up gaps)
    .trim();
}

// ============================================================================
// MATCHING ALGORITHMS
// ============================================================================

/**
 * Calculate location similarity score between two TML locations
 * Returns a score from 0 to 1, where 1 is an exact match
 */
export function calculateLocationSimilarity(
  existing: TmlLocation,
  newLoc: TmlLocation
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  
  // Component type match (required for any match)
  const existingType = normalizeComponentType(existing.componentType);
  const newType = normalizeComponentType(newLoc.componentType);
  
  if (existingType !== newType) {
    return { score: 0, reason: 'Component type mismatch' };
  }
  score += 0.3;
  reasons.push('Component type match');
  
  // Parse CML naming convention
  const existingParsed = parseCmlNamingConvention(existing.legacyLocationId);
  const newParsed = parseCmlNamingConvention(newLoc.legacyLocationId);
  
  // Slice number match (high weight)
  const existingSlice = existing.sliceNumber ?? existingParsed.sliceNumber;
  const newSlice = newLoc.sliceNumber ?? newParsed.sliceNumber;
  
  if (existingSlice !== null && newSlice !== null && existingSlice === newSlice) {
    score += 0.35;
    reasons.push(`Slice ${existingSlice} match`);
  }
  
  // Circumferential position match (high weight)
  const existingCirc = existing.circumferentialPosition ?? existingParsed.circumferentialPosition;
  const newCirc = newLoc.circumferentialPosition ?? newParsed.circumferentialPosition;
  
  if (existingCirc !== null && newCirc !== null) {
    if (existingCirc === newCirc) {
      score += 0.25;
      reasons.push(`Circumferential ${existingCirc}° match`);
    } else {
      // Adjacent positions (within 45°) get partial credit
      const diff = Math.abs(existingCirc - newCirc);
      if (diff <= 45 || diff >= 315) {
        score += 0.1;
        reasons.push(`Adjacent circumferential position (${existingCirc}° vs ${newCirc}°)`);
      }
    }
  }
  
  // Location description fuzzy match
  if (existing.locationDescription && newLoc.locationDescription) {
    const existingDesc = normalizeLocationDescription(existing.locationDescription);
    const newDesc = normalizeLocationDescription(newLoc.locationDescription);
    
    if (existingDesc === newDesc) {
      score += 0.1;
      reasons.push('Location description match');
    } else if (existingDesc.includes(newDesc) || newDesc.includes(existingDesc)) {
      score += 0.05;
      reasons.push('Partial location description match');
    }
  }
  
  return {
    score: Math.min(score, 1),
    reason: reasons.join('; ')
  };
}

/**
 * Match new TML readings to existing historical data
 * Prioritizes location-based matching over CML number matching
 */
export function matchTmlReadings(
  existingLocations: TmlLocation[],
  newReadings: TmlReading[],
  options: {
    exactMatchThreshold?: number;
    fuzzyMatchThreshold?: number;
    allowCmlOnlyMatch?: boolean;
  } = {}
): MatchResult {
  const {
    exactMatchThreshold = 0.95,
    fuzzyMatchThreshold = 0.7,
    allowCmlOnlyMatch = true
  } = options;
  
  const result: MatchResult = {
    matched: [],
    unmatched: [],
    conflicts: [],
    summary: {
      totalNew: newReadings.length,
      exactMatches: 0,
      locationMatches: 0,
      fuzzyMatches: 0,
      cmlOnlyMatches: 0,
      unmatched: 0,
      conflicts: 0
    }
  };
  
  const usedExistingIds = new Set<string>();
  
  for (const newReading of newReadings) {
    const candidates: Array<{
      existingId: string;
      existingLocation: TmlLocation;
      confidence: number;
      reason: string;
    }> = [];
    
    // Calculate similarity with all existing locations
    for (const existing of existingLocations) {
      if (!existing.id || usedExistingIds.has(existing.id)) continue;
      
      const { score, reason } = calculateLocationSimilarity(existing, newReading.location);
      
      if (score >= fuzzyMatchThreshold) {
        candidates.push({
          existingId: existing.id,
          existingLocation: existing,
          confidence: score,
          reason
        });
      }
    }
    
    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    if (candidates.length === 0) {
      // No match found - try CML number only if allowed
      if (allowCmlOnlyMatch) {
        const cmlMatch = existingLocations.find(
          e => e.id && 
               !usedExistingIds.has(e.id) && 
               e.legacyLocationId === newReading.location.legacyLocationId
        );
        
        if (cmlMatch && cmlMatch.id) {
          result.matched.push({
            existingId: cmlMatch.id,
            newReading,
            matchType: 'cml_number_only',
            confidence: 0.5,
            matchReason: 'CML number match only (location data insufficient)',
            cmlNumberChanged: false
          });
          usedExistingIds.add(cmlMatch.id);
          result.summary.cmlOnlyMatches++;
          continue;
        }
      }
      
      // No match at all
      result.unmatched.push(newReading);
      result.summary.unmatched++;
    } else if (candidates.length === 1 || candidates[0].confidence >= exactMatchThreshold) {
      // Single high-confidence match or exact match
      const best = candidates[0];
      const cmlChanged = best.existingLocation.legacyLocationId !== newReading.location.legacyLocationId;
      
      let matchType: 'exact' | 'location_based' | 'fuzzy';
      if (best.confidence >= exactMatchThreshold) {
        matchType = 'exact';
        result.summary.exactMatches++;
      } else if (best.confidence >= 0.85) {
        matchType = 'location_based';
        result.summary.locationMatches++;
      } else {
        matchType = 'fuzzy';
        result.summary.fuzzyMatches++;
      }
      
      result.matched.push({
        existingId: best.existingId,
        newReading,
        matchType,
        confidence: best.confidence,
        matchReason: best.reason,
        cmlNumberChanged: cmlChanged,
        oldCmlNumber: cmlChanged ? best.existingLocation.legacyLocationId : undefined,
        newCmlNumber: cmlChanged ? newReading.location.legacyLocationId : undefined
      });
      usedExistingIds.add(best.existingId);
    } else {
      // Multiple candidates with similar confidence - conflict
      result.conflicts.push({
        newReading,
        candidates: candidates.slice(0, 3) // Top 3 candidates
      });
      result.summary.conflicts++;
    }
  }
  
  return result;
}

// ============================================================================
// CORROSION RATE CALCULATION
// ============================================================================

/**
 * Calculate corrosion rate between two readings at the same location
 * Returns rate in mils per year (mpy) or inches per year
 */
export function calculateCorrosionRate(
  previousReading: { thickness: number; date: Date },
  currentReading: { thickness: number; date: Date },
  options: { unit?: 'mpy' | 'ipy' } = {}
): {
  rate: number;
  unit: string;
  thicknessLoss: number;
  timeSpan: number;
  timeUnit: string;
  isValid: boolean;
  warning?: string;
} {
  const { unit = 'mpy' } = options;
  
  const thicknessLoss = previousReading.thickness - currentReading.thickness;
  const timeDiffMs = currentReading.date.getTime() - previousReading.date.getTime();
  const timeSpanYears = timeDiffMs / (1000 * 60 * 60 * 24 * 365.25);
  
  // Validation checks
  if (timeSpanYears < 0.1) {
    return {
      rate: 0,
      unit: unit === 'mpy' ? 'mils/year' : 'in/year',
      thicknessLoss,
      timeSpan: timeSpanYears,
      timeUnit: 'years',
      isValid: false,
      warning: 'Time span too short for reliable corrosion rate calculation (< 0.1 years)'
    };
  }
  
  if (thicknessLoss < 0) {
    return {
      rate: 0,
      unit: unit === 'mpy' ? 'mils/year' : 'in/year',
      thicknessLoss,
      timeSpan: timeSpanYears,
      timeUnit: 'years',
      isValid: false,
      warning: 'Negative thickness loss detected - current reading thicker than previous (possible measurement error or repair)'
    };
  }
  
  // Calculate rate
  let rate: number;
  let rateUnit: string;
  
  if (unit === 'mpy') {
    rate = (thicknessLoss * 1000) / timeSpanYears; // Convert inches to mils
    rateUnit = 'mils/year';
  } else {
    rate = thicknessLoss / timeSpanYears;
    rateUnit = 'in/year';
  }
  
  // Check for anomalous rate
  let warning: string | undefined;
  if (unit === 'mpy' && rate > 50) {
    warning = `High corrosion rate detected (${rate.toFixed(1)} mpy) - verify measurements`;
  } else if (unit === 'ipy' && rate > 0.05) {
    warning = `High corrosion rate detected (${rate.toFixed(4)} in/year) - verify measurements`;
  }
  
  return {
    rate: Math.round(rate * 1000) / 1000, // Round to 3 decimal places
    unit: rateUnit,
    thicknessLoss,
    timeSpan: Math.round(timeSpanYears * 100) / 100,
    timeUnit: 'years',
    isValid: true,
    warning
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process a batch of new readings and calculate corrosion rates
 */
export function processTmlBatch(
  existingReadings: Array<TmlLocation & { 
    id: string;
    previousThickness?: number;
    previousDate?: Date;
  }>,
  newReadings: TmlReading[]
): {
  matchResult: MatchResult;
  corrosionRates: Array<{
    locationId: string;
    legacyLocationId: string;
    rate: number;
    unit: string;
    thicknessLoss: number;
    timeSpan: number;
    warning?: string;
  }>;
} {
  // First, match locations
  const matchResult = matchTmlReadings(existingReadings, newReadings);
  
  // Then calculate corrosion rates for matched locations
  const corrosionRates: Array<{
    locationId: string;
    legacyLocationId: string;
    rate: number;
    unit: string;
    thicknessLoss: number;
    timeSpan: number;
    warning?: string;
  }> = [];
  
  for (const match of matchResult.matched) {
    const existing = existingReadings.find(e => e.id === match.existingId);
    
    if (existing?.previousThickness && existing.previousDate) {
      const rateResult = calculateCorrosionRate(
        { thickness: existing.previousThickness, date: existing.previousDate },
        { thickness: match.newReading.thickness, date: match.newReading.measurementDate }
      );
      
      if (rateResult.isValid) {
        corrosionRates.push({
          locationId: match.existingId,
          legacyLocationId: match.newReading.location.legacyLocationId,
          rate: rateResult.rate,
          unit: rateResult.unit,
          thicknessLoss: rateResult.thicknessLoss,
          timeSpan: rateResult.timeSpan,
          warning: rateResult.warning
        });
      }
    }
  }
  
  return {
    matchResult,
    corrosionRates
  };
}

/**
 * Generate a unique location ID based on physical location
 */
export function generateLocationId(location: TmlLocation): string {
  const componentType = normalizeComponentType(location.componentType);
  const parsed = parseCmlNamingConvention(location.legacyLocationId);
  
  const parts = [componentType];
  
  if (parsed.sliceNumber !== null) {
    parts.push(`s${parsed.sliceNumber}`);
  }
  
  if (parsed.circumferentialPosition !== null) {
    parts.push(`c${parsed.circumferentialPosition}`);
  }
  
  if (parts.length === 1) {
    // Fallback to CML number if no structured data
    parts.push(location.legacyLocationId.replace(/\s+/g, '_'));
  }
  
  return `loc_${parts.join('_')}_${nanoid(8)}`;
}
