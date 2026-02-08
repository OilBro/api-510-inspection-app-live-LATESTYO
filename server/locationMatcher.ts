/**
 * Location-Based CML/TML Matching Utility
 * 
 * This module provides functions to match new UT readings to existing CMLs
 * based on LOCATION rather than CML number. This is critical because:
 * - CML numbers may change between inspection reports
 * - Physical locations remain the same across inspections
 * - Matching by location ensures historical data continuity
 * 
 * Supports:
 * - Simple locations: "2'", "4'", "6'"
 * - Slice-angle format: "10-0", "10-45", "10-90" (slice 10 at 0°, 45°, 90°)
 * - Head locations: "East Head 12 O'Clock", "West Head Center"
 * - Nozzle locations: "N1", "N2-90"
 */

export interface ExistingCML {
  id: string;
  legacyLocationId: string;
  location: string;
  component: string;
  sliceLocation?: string;
  angularPosition?: number;
  currentThickness?: number;
}

export interface NewReading {
  legacyLocationId: string;
  location: string;
  component: string;
  angularPosition?: number;
  thickness: number;
  tmin?: number;
}

export interface MatchResult {
  matched: Array<{
    existingCmlId: string;
    existingCmlNumber: string;
    newReading: NewReading;
    confidence: number;
    matchType: 'exact' | 'normalized' | 'fuzzy' | 'angular';
  }>;
  unmatched: Array<{
    reading: NewReading;
    reason: string;
  }>;
  summary: {
    totalNew: number;
    matchedCount: number;
    unmatchedCount: number;
    matchRate: number;
  };
}

export interface MatchOptions {
  minConfidence?: number;
  allowFuzzyMatch?: boolean;
}

/**
 * Normalize a location string for comparison
 * Handles various formats: "2'", "2 ft", "2 feet", "2\"", etc.
 */
export function normalizeLocation(location: string): string {
  if (!location) return '';
  
  let normalized = location.trim().toLowerCase();
  
  // Normalize apostrophes and quotes
  normalized = normalized.replace(/[''`]/g, "'");
  normalized = normalized.replace(/[""]/g, '"');
  
  // Normalize feet indicators
  normalized = normalized.replace(/\s*(ft|feet)\s*/gi, "'");
  
  // Normalize inches indicators
  normalized = normalized.replace(/\s*(in|inch|inches)\s*/gi, '"');
  
  // Normalize o'clock variations
  normalized = normalized.replace(/o['']?\s*clock/gi, 'oclock');
  normalized = normalized.replace(/o\s+clock/gi, 'oclock');
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Extract the base location from a slice-angle format
 * e.g., "8-45" -> "8", "10-90" -> "10"
 */
export function extractBaseLocation(location: string): string {
  const normalized = normalizeLocation(location);
  
  // Check for slice-angle format: number-angle
  const sliceMatch = normalized.match(/^(\d+)-(\d+)$/);
  if (sliceMatch) {
    return sliceMatch[1];
  }
  
  return normalized;
}

/**
 * Extract angular position from a slice-angle format
 * e.g., "8-45" -> 45, "10-90" -> 90
 */
export function extractAngularPosition(location: string): number | null {
  const normalized = normalizeLocation(location);
  
  // Check for slice-angle format: number-angle
  const sliceMatch = normalized.match(/^(\d+)-(\d+)$/);
  if (sliceMatch) {
    return parseInt(sliceMatch[2], 10);
  }
  
  return null;
}

/**
 * Calculate similarity between two location strings
 * Returns a value between 0 and 1
 */
export function calculateLocationSimilarity(loc1: string, loc2: string): number {
  const norm1 = normalizeLocation(loc1);
  const norm2 = normalizeLocation(loc2);
  
  // Exact match after normalization
  if (norm1 === norm2) return 1.0;
  
  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const longer = norm1.length > norm2.length ? norm1 : norm2;
    const shorter = norm1.length > norm2.length ? norm2 : norm1;
    return shorter.length / longer.length;
  }
  
  // Levenshtein distance-based similarity
  const distance = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1.0;
  
  return 1 - (distance / maxLen);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Match new readings to existing CMLs by location
 * This is the main function for location-based matching
 */
export function matchReadingsByLocation(
  existingCMLs: ExistingCML[],
  newReadings: NewReading[],
  options: MatchOptions = {}
): MatchResult {
  const { minConfidence = 0.7, allowFuzzyMatch = true } = options;
  
  const matched: MatchResult['matched'] = [];
  const unmatched: MatchResult['unmatched'] = [];
  
  // Track which existing CMLs have been matched
  const matchedExistingIds = new Set<string>();
  
  for (const reading of newReadings) {
    let bestMatch: {
      cml: ExistingCML;
      confidence: number;
      matchType: 'exact' | 'normalized' | 'fuzzy' | 'angular';
    } | null = null;
    
    const readingLocation = normalizeLocation(reading.location);
    const readingBase = extractBaseLocation(reading.location);
    const readingAngle = reading.angularPosition ?? extractAngularPosition(reading.location);
    
    for (const cml of existingCMLs) {
      // Skip already matched CMLs
      if (matchedExistingIds.has(cml.id)) continue;
      
      const cmlLocation = normalizeLocation(cml.location);
      const cmlBase = extractBaseLocation(cml.location);
      const cmlAngle = cml.angularPosition ?? extractAngularPosition(cml.location);
      
      // 1. Try exact match on normalized location
      if (readingLocation === cmlLocation) {
        // If both have angular positions, they must match
        if (readingAngle !== null && cmlAngle !== null) {
          if (readingAngle === cmlAngle) {
            bestMatch = { cml, confidence: 1.0, matchType: 'exact' };
            break;
          }
        } else {
          bestMatch = { cml, confidence: 1.0, matchType: 'exact' };
          break;
        }
      }
      
      // 2. Try base location + angular position match
      if (readingBase === cmlBase && readingAngle !== null && cmlAngle !== null) {
        if (readingAngle === cmlAngle) {
          const confidence = 0.95;
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { cml, confidence, matchType: 'angular' };
          }
        }
      }
      
      // 3. Try fuzzy match if allowed
      if (allowFuzzyMatch) {
        const similarity = calculateLocationSimilarity(reading.location, cml.location);
        
        // Also check component match for higher confidence
        const componentMatch = normalizeLocation(reading.component) === normalizeLocation(cml.component);
        const adjustedSimilarity = componentMatch ? similarity * 1.1 : similarity;
        
        if (adjustedSimilarity >= minConfidence) {
          if (!bestMatch || adjustedSimilarity > bestMatch.confidence) {
            bestMatch = { cml, confidence: Math.min(adjustedSimilarity, 1.0), matchType: 'fuzzy' };
          }
        }
      }
    }
    
    if (bestMatch && bestMatch.confidence >= minConfidence) {
      matched.push({
        existingCmlId: bestMatch.cml.id,
        existingCmlNumber: bestMatch.cml.legacyLocationId,
        newReading: reading,
        confidence: bestMatch.confidence,
        matchType: bestMatch.matchType,
      });
      matchedExistingIds.add(bestMatch.cml.id);
    } else {
      unmatched.push({
        reading,
        reason: bestMatch 
          ? `Best match confidence (${(bestMatch.confidence * 100).toFixed(1)}%) below threshold (${(minConfidence * 100).toFixed(1)}%)`
          : 'No matching location found',
      });
    }
  }
  
  return {
    matched,
    unmatched,
    summary: {
      totalNew: newReadings.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      matchRate: newReadings.length > 0 ? matched.length / newReadings.length : 0,
    },
  };
}
