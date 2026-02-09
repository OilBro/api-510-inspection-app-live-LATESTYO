/**
 * Component Group Normalizer
 * 
 * Normalizes component names into canonical groups for stationKey system.
 * 
 * CRITICAL: Head names are PRESERVED as-is from the source data.
 * South Head stays SOUTHHEAD, North Head stays NORTHHEAD.
 * We do NOT remap South→West or North→East — that destroys traceability.
 * 
 * The vessel orientation (horizontal vs vertical) determines which heads
 * are "top/bottom" vs "north/south" vs "east/west", but the NAMES in the
 * inspection report are the canonical reference per API 510 §7.1.1.
 */

/**
 * Normalize component type into canonical group
 * 
 * Groups:
 * - SHELL: Vessel shell/body
 * - SOUTHHEAD: South head (preserves source identity)
 * - NORTHHEAD: North head (preserves source identity)
 * - EASTHEAD: East head (preserves source identity)
 * - WESTHEAD: West head (preserves source identity)
 * - NOZZLE: All nozzles
 * - OTHER: Unknown or unclassified
 */
export function normalizeComponentGroup(componentType: string | null | undefined): string {
  if (!componentType) return 'OTHER';
  
  const normalized = componentType.trim().toUpperCase();
  
  // Nozzle patterns - check first (nozzle types like "2\" Nozzle", "18\" MW")
  if (normalized.includes('NOZZLE') || normalized.match(/^N\d+/) || normalized.includes(' MW')) {
    return 'NOZZLE';
  }
  
  // Shell patterns
  if (normalized.includes('SHELL') || normalized.includes('VESSEL SHELL')) {
    return 'SHELL';
  }
  
  // PRESERVE head names exactly as they appear in the source data
  // South Head stays SOUTHHEAD (never mapped to West)
  if (normalized.includes('SOUTH HEAD') || normalized.includes('SOUTH')) {
    return 'SOUTHHEAD';
  }
  
  // North Head stays NORTHHEAD (never mapped to East)
  if (normalized.includes('NORTH HEAD') || normalized.includes('NORTH')) {
    return 'NORTHHEAD';
  }
  
  // East Head stays EASTHEAD
  if (normalized.includes('EAST HEAD') || normalized.includes('EAST')) {
    return 'EASTHEAD';
  }
  
  // West Head stays WESTHEAD
  if (normalized.includes('WEST HEAD') || normalized.includes('WEST')) {
    return 'WESTHEAD';
  }
  
  // Top/Bottom heads - map to directional names
  // These are orientation-dependent and should be mapped based on vessel orientation
  // Default: Top → EASTHEAD, Bottom → WESTHEAD (horizontal vessel convention)
  if (normalized.includes('TOP HEAD')) {
    return 'EASTHEAD';
  }
  if (normalized.includes('BOTTOM HEAD') || normalized.includes('BTTM HEAD')) {
    return 'WESTHEAD';
  }
  
  // Generic "Head" - default to OTHER (don't assume direction)
  if (normalized === 'HEAD') {
    return 'OTHER';
  }
  
  return 'OTHER';
}
