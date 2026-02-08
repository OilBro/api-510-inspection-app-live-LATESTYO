/**
 * Component Group Normalizer
 * 
 * Normalizes component names into canonical groups for stationKey system.
 * Based on vessel 54-11-001 analysis and user requirements.
 */

/**
 * Normalize component type into canonical group
 * 
 * Groups:
 * - SHELL: Vessel shell/body
 * - EASTHEAD: East/top/north head
 * - WESTHEAD: West/bottom/south head
 * - NOZZLE: All nozzles
 * - OTHER: Unknown or unclassified
 */
export function normalizeComponentGroup(componentType: string | null | undefined): string {
  if (!componentType) return 'OTHER';
  
  const normalized = componentType.trim().toUpperCase();
  
  // Nozzle patterns
  if (normalized.includes('NOZZLE') || normalized.match(/^N\d+/)) {
    return 'NOZZLE';
  }
  
  // Shell patterns
  if (normalized.includes('SHELL') || normalized.includes('VESSEL SHELL')) {
    return 'SHELL';
  }
  
  // East Head patterns (includes "top", "north")
  if (
    normalized.includes('EAST HEAD') ||
    normalized.includes('TOP HEAD') ||
    normalized.includes('NORTH HEAD')
  ) {
    return 'EASTHEAD';
  }
  
  // West Head patterns (includes "bottom", "south", "bttm")
  if (
    normalized.includes('WEST HEAD') ||
    normalized.includes('BOTTOM HEAD') ||
    normalized.includes('BTTM HEAD') ||
    normalized.includes('SOUTH HEAD')
  ) {
    return 'WESTHEAD';
  }
  
  // Generic "Head" - default to EASTHEAD
  if (normalized === 'HEAD') {
    return 'EASTHEAD';
  }
  
  return 'OTHER';
}
