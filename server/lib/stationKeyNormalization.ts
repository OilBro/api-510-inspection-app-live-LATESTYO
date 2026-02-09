/**
 * Station Key Normalization System
 * 
 * Provides canonical identifiers for physical measurement locations across inspections.
 * Solves the "slice vs CML" confusion by using geometric coordinates as the primary key.
 * 
 * REGULATORY COMPLIANCE:
 * - API 510 §7.1.1: Thickness measurements must be traceable to specific locations
 * - ASME VIII-1: Corrosion rate calculations require comparing same physical locations
 * 
 * BUCKET B - DATA LINEAGE & MAPPING (Critical for audit defensibility)
 */

import { normalizeComponentGroup } from './componentGroupNormalizer';

/**
 * Normalize a string for consistent comparison
 * - Trim whitespace
 * - Convert to uppercase
 * - Collapse multiple spaces
 * - Normalize separators
 */
export function normalizeString(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/[-_]/g, '-') // Normalize separators
    .replace(/[°'"]/g, '') // Remove degree symbols and quotes
    ;
}

/**
 * Parse slice-angle format from location string
 * Examples:
 * - "7-0" → { slice: 7, angle: 0 }
 * - "27-45" → { slice: 27, angle: 45 }
 * - "2-90" → { slice: 2, angle: 90 }
 */
export function parseSliceAngle(location: string): { slice: number | null; angle: number | null } {
  const normalized = normalizeString(location);
  const match = normalized.match(/^(\d+)-(\d+)$/);
  
  if (match) {
    return {
      slice: parseInt(match[1], 10),
      angle: parseInt(match[2], 10),
    };
  }
  
  return { slice: null, angle: null };
}

/**
 * Parse axial position from description
 * Examples:
 * - "2' from South Head seam" → "2FT"
 * - "4'" → "4FT"
 * - "2\" head side" → "2IN-HEAD"
 * - "2\" shell side" → "2IN-SHELL"
 */
export function parseAxialPosition(description: string): string | null {
  if (!description) return null;
  
  // Don't normalize yet - we need to preserve quotes for parsing
  const trimmed = description.trim().toUpperCase();
  
  // Match feet: "2'", "4'", "6'"
  const feetMatch = trimmed.match(/(\d+)\s*'/);
  if (feetMatch) {
    return `${feetMatch[1]}FT`;
  }
  
  // Match inches: "2\"", "4\""
  const inchMatch = trimmed.match(/(\d+)\s*\"/);
  if (inchMatch) {
    // Check for explicit "SHELL SIDE" or "HEAD SIDE" patterns
    let side = '';
    if (trimmed.includes('SHELL') && (trimmed.includes('SIDE') || trimmed.includes('SHELL'))) {
      side = 'SHELL';
    } else if (trimmed.includes('HEAD') && (trimmed.includes('SIDE') || trimmed.includes('HEAD'))) {
      side = 'HEAD';
    }
    return side ? `${inchMatch[1]}IN-${side}` : `${inchMatch[1]}IN`;
  }
  
  return null;
}

/**
 * Parse head position from description
 * Examples:
 * - "South Head 12 O'Clock" → "12-OCLOCK"
 * - "North Head 3 O'Clock" → "3-OCLOCK"
 * - "South Head Center" → "CENTER"
 */
export function parseHeadPosition(description: string): string | null {
  const normalized = normalizeString(description);
  
  // Match clock positions: "12 O'Clock", "3 O'Clock"
  const clockMatch = normalized.match(/(\d+)\s*O\s*CLOCK/);
  if (clockMatch) {
    return `${clockMatch[1]}-OCLOCK`;
  }
  
  // Match center
  if (normalized.includes('CENTER')) {
    return 'CENTER';
  }
  
  return null;
}

/**
 * Determine head name from component or location
 * Handles various naming conventions:
 * - "South Head" → "SOUTH-HEAD"
 * - "North Head" → "NORTH-HEAD"
 * - "East Head" → "EAST-HEAD"
 * - "West Head" → "WEST-HEAD"
 * - "Top Head" → "EAST-HEAD" (normalized)
 * - "Bottom Head" → "WEST-HEAD" (normalized)
 */
export function parseHeadName(component: string, location?: string): string | null {
  const text = normalizeString(`${component} ${location || ''}`);
  
  // Direct matches
  if (text.includes('SOUTH HEAD')) return 'SOUTH-HEAD';
  if (text.includes('NORTH HEAD')) return 'NORTH-HEAD';
  if (text.includes('EAST HEAD')) return 'EAST-HEAD';
  if (text.includes('WEST HEAD')) return 'WEST-HEAD';
  
  // Normalized matches (per componentNormalization.ts)
  if (text.includes('TOP HEAD')) return 'EAST-HEAD';
  if (text.includes('BOTTOM HEAD') || text.includes('BTTM HEAD')) return 'WEST-HEAD';
  
  return null;
}

/**
 * Generate canonical stationKey for a TML reading
 * 
 * PRECEDENCE RULES:
 * 1. If sliceNumber + angleDeg are provided → use them (highest priority)
 * 2. If location matches slice-angle format → parse it
 * 3. If component is a head → use head position
 * 4. If component is a nozzle → use nozzle ID
 * 5. Fallback to normalized location
 */
export interface StationKeyInput {
  component?: string | null;
  componentType?: string | null;
  location?: string | null;
  sliceNumber?: number | null;
  angleDeg?: number | null;
  legacyLocationId?: string | null;
  service?: string | null; // For nozzles
}

export interface StationKeyResult {
  stationKey: string;
  componentGroup: string;
  sliceNumber: number | null;
  angleDeg: number | null;
  trueCmlId: string | null;
  axialPosition: string | null;
  confidence: 'high' | 'medium' | 'low';
  method: string;
}

export function generateStationKey(input: StationKeyInput): StationKeyResult {
  const component = normalizeString(input.component || input.componentType || '');
  const rawLocation = input.location || ''; // Keep raw location for parsing quotes
  const location = normalizeString(rawLocation);
  const componentGroup = normalizeComponentGroup(input.component || input.componentType);
  
  // RULE 1: Explicit slice + angle (highest confidence)
  if (input.sliceNumber != null && input.angleDeg != null) {
    return {
      stationKey: `SHELL-SLICE-${input.sliceNumber}-A${input.angleDeg}`,
      componentGroup,
      sliceNumber: input.sliceNumber,
      angleDeg: input.angleDeg,
      trueCmlId: input.legacyLocationId || null,
      axialPosition: parseAxialPosition(rawLocation),
      confidence: 'high',
      method: 'explicit_slice_angle',
    };
  }
  
  // RULE 2: Parse slice-angle from location (e.g., "7-0", "27-45")
  const parsed = parseSliceAngle(location);
  if (parsed.slice != null && parsed.angle != null) {
    return {
      stationKey: `SHELL-SLICE-${parsed.slice}-A${parsed.angle}`,
      componentGroup,
      sliceNumber: parsed.slice,
      angleDeg: parsed.angle,
      trueCmlId: input.legacyLocationId || null,
      axialPosition: parseAxialPosition(rawLocation),
      confidence: 'high',
      method: 'parsed_slice_angle',
    };
  }
  
  // RULE 2.5: Seam-adjacent locations (shell/head transition zones)
  // Examples: "2\" from SH Shell", "2\" from SH Head", "2\" from NH Shell"
  const axialPos = parseAxialPosition(rawLocation);
  if (axialPos && (axialPos.includes('IN-SHELL') || axialPos.includes('IN-HEAD'))) {
    // Determine which head based on component or location
    // Check full names first to avoid false matches (e.g., "SHELL" contains "SH")
    const headRef = location.includes('SOUTH') ? 'SH' :
                    location.includes('NORTH') ? 'NH' :
                    location.includes('EAST') ? 'EH' :
                    location.includes('WEST') ? 'WH' :
                    location.includes('SH') ? 'SH' :
                    location.includes('NH') ? 'NH' :
                    location.includes('EH') ? 'EH' :
                    location.includes('WH') ? 'WH' : 'UNKNOWN';
    
    return {
      stationKey: `SEAM-${headRef}-${axialPos}`,
      componentGroup,
      sliceNumber: null,
      angleDeg: null,
      trueCmlId: input.legacyLocationId || null,
      axialPosition: axialPos,
      confidence: 'high',
      method: 'seam_adjacent',
    };
  }
  
  // RULE 2.6: Shell readings with axial position (feet measurements)
  // Examples: "2'", "6'", "24'"
  if (axialPos && axialPos.includes('FT') && componentGroup === 'SHELL') {
    return {
      stationKey: `SHELL-${axialPos}`,
      componentGroup,
      sliceNumber: null,
      angleDeg: null,
      trueCmlId: input.legacyLocationId || null,
      axialPosition: axialPos,
      confidence: 'high',
      method: 'shell_axial_position',
    };
  }
  
  // RULE 3: Head readings
  const headName = parseHeadName(component, location);
  if (headName) {
    const position = parseHeadPosition(location);
    if (position) {
      return {
        stationKey: `${headName}-${position}`,
        componentGroup,
        sliceNumber: null,
        angleDeg: null,
        trueCmlId: input.legacyLocationId || null,
        axialPosition: null,
        confidence: 'high',
        method: 'head_position',
      };
    }
  }
  
  // RULE 4: Nozzle readings
  if (component.includes('NOZZLE') || component.startsWith('N') || input.service) {
    const nozzleId = input.legacyLocationId || location || 'UNKNOWN';
    return {
      stationKey: `NOZZLE-${normalizeString(nozzleId)}`,
      componentGroup: 'NOZZLE',
      sliceNumber: null,
      angleDeg: null,
      trueCmlId: null,
      axialPosition: null,
      confidence: 'medium',
      method: 'nozzle_id',
    };
  }
  
  // RULE 5: Fallback to normalized location
  const fallbackKey = normalizeString(location || input.legacyLocationId || 'UNKNOWN');
  return {
    stationKey: `LOCATION-${fallbackKey}`,
    componentGroup,
    sliceNumber: null,
    angleDeg: null,
    trueCmlId: input.legacyLocationId || null,
    axialPosition: parseAxialPosition(rawLocation),
    confidence: 'low',
    method: 'fallback_location',
  };
}

/**
 * Resolve stationKey using CML correlation mapping
 * 
 * This function integrates with the cmlCorrelations table to map
 * current inspection locations to baseline inspection locations.
 * 
 * PRECEDENCE:
 * 1. Explicit correlation mapping (if exists)
 * 2. Direct stationKey generation
 */
export async function resolveStationKeyWithCorrelation(
  input: StationKeyInput,
  correlationMappings?: Array<{
    baselineCML: string;
    currentCML: string;
    baselineDescription?: string | null;
    currentDescription?: string | null;
  }>
): Promise<StationKeyResult> {
  // Try to find correlation mapping first
  if (correlationMappings && correlationMappings.length > 0) {
    const normalizedLocation = normalizeString(input.location || '');
    const normalizedCML = normalizeString(input.legacyLocationId || '');
    
    for (const mapping of correlationMappings) {
      const matchesCurrent = 
        normalizeString(mapping.currentCML).includes(normalizedLocation) ||
        normalizedLocation.includes(normalizeString(mapping.currentCML)) ||
        normalizeString(mapping.currentDescription || '').includes(normalizedLocation);
      
      if (matchesCurrent) {
        // Use baseline CML as the stationKey anchor
        const baselineKey = generateStationKey({
          ...input,
          legacyLocationId: mapping.baselineCML,
          location: mapping.baselineDescription || mapping.baselineCML,
        });
        
        return {
          ...baselineKey,
          confidence: 'high',
          method: 'correlation_mapping',
        };
      }
    }
  }
  
  // No correlation found, use direct generation
  return generateStationKey(input);
}
