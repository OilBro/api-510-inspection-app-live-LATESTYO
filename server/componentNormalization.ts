/**
 * Component Type Normalization
 * 
 * Standardizes component names and types from various PDF extraction formats
 * to consistent values used throughout the application.
 * 
 * Standard Component Names:
 * - "Vessel Shell" for shell/cylinder components
 * - "East Head" for first head (north/left/top for horizontal vessels)
 * - "West Head" for second head (south/right/bottom for horizontal vessels)
 * - "Nozzle" for nozzle components
 * 
 * Standard Component Types:
 * - "shell" for shell components
 * - "head" for head components
 * - "nozzle" for nozzle components
 */

import { logger } from "./_core/logger";

export interface NormalizedComponent {
  component: string;      // Display name: "Vessel Shell", "East Head", "West Head", "Nozzle"
  componentType: string;  // Type for calculations: "shell", "head", "nozzle"
}

/**
 * Normalize component name and type from raw extraction values.
 * 
 * @param component - Raw component name from extraction
 * @param componentType - Raw component type from extraction
 * @param location - Location field (may contain head identification)
 * @param vesselOrientation - "Horizontal" or "Vertical" (affects head naming)
 * @returns Normalized component name and type
 */
export function normalizeComponent(
  component: string | null | undefined,
  componentType: string | null | undefined,
  location: string | null | undefined,
  vesselOrientation?: string | null
): NormalizedComponent {
  const comp = (component || '').toLowerCase().trim();
  const compType = (componentType || '').toLowerCase().trim();
  const loc = (location || '').toLowerCase().trim();
  const combined = `${comp} ${compType} ${loc}`;
  
  // Check for nozzle first (most specific)
  if (isNozzle(combined)) {
    return { component: 'Nozzle', componentType: 'nozzle' };
  }
  
  // Check for shell
  if (isShell(combined)) {
    return { component: 'Vessel Shell', componentType: 'shell' };
  }
  
  // Check for heads - use location field as primary indicator
  if (isEastHead(comp, compType, loc)) {
    return { component: 'East Head', componentType: 'head' };
  }
  
  if (isWestHead(comp, compType, loc)) {
    return { component: 'West Head', componentType: 'head' };
  }
  
  // If it's a generic head without direction, check vessel orientation
  if (isGenericHead(combined)) {
    // For horizontal vessels, "Top Head" should map to one end, "Bottom Head" to other
    // But this is ambiguous - log a warning
    logger.warn(`[Component Normalization] Generic head detected without direction: component="${component}", componentType="${componentType}", location="${location}"`);
    return { component: 'East Head', componentType: 'head' }; // Default to East Head
  }
  
  // Default: return as-is but normalized
  return {
    component: component || 'Unknown',
    componentType: compType || 'unknown'
  };
}

/**
 * Check if the combined string indicates a nozzle component
 */
function isNozzle(combined: string): boolean {
  return combined.includes('nozzle') ||
         combined.includes('manway') ||
         combined.includes('manhole') ||
         combined.includes('relief') ||
         combined.includes('inlet') ||
         combined.includes('outlet') ||
         combined.includes('drain') ||
         combined.includes('vent') ||
         combined.includes('connection') ||
         /\bn\d+\b/.test(combined); // N1, N2, etc.
}

/**
 * Check if the combined string indicates a shell component
 */
function isShell(combined: string): boolean {
  // Explicit shell matches
  if (combined.includes('shell')) return true;
  if (combined.includes('cylinder')) return true;
  if (combined.includes('body')) return true;
  
  // Numeric location patterns that indicate shell (e.g., "7-0", "8-45", "9-90")
  // These are slice-angle patterns used for shell readings
  if (/\d+-\d+/.test(combined) && !combined.includes('head')) return true;
  
  return false;
}

/**
 * Check if the component is an East Head
 * Matches: 'east head', 'e head', 'head 1', 'head-1', 'left head', 'north head', 'top head' (for horizontal)
 */
function isEastHead(comp: string, compType: string, loc: string): boolean {
  const combined = `${comp} ${compType}`;
  
  // Explicit east head matches (check location too)
  if (combined.includes('east') || loc.includes('east head')) return true;
  if (combined.includes('e head')) return true;
  if (combined.includes('head 1') || combined.includes('head-1')) return true;
  if (combined.includes('left head')) return true;
  if (combined.includes('north head')) return true;
  
  // For horizontal vessels, "Top Head" is often the first head (East)
  // This is a convention in some reports
  if (combined.includes('top head')) return true;
  
  // If it's a head but not explicitly west/right/south/bottom, treat as east (first head)
  // Exclude if location indicates west head
  if ((combined.includes('head') && !combined.includes('shell')) &&
      !combined.includes('west') && !combined.includes('w head') &&
      !combined.includes('head 2') && !combined.includes('head-2') &&
      !combined.includes('right') && !combined.includes('south') &&
      !combined.includes('bottom') && !combined.includes('bttm') &&
      !loc.includes('west') && !loc.includes('south') && !loc.includes('bottom') && !loc.includes('bttm')) {
    return true;
  }
  
  return false;
}

/**
 * Check if the component is a West Head
 * Matches: 'west head', 'w head', 'head 2', 'head-2', 'right head', 'south head', 'bottom head'
 */
function isWestHead(comp: string, compType: string, loc: string): boolean {
  const combined = `${comp} ${compType}`;
  
  // Explicit west head matches (check location too)
  if (combined.includes('west') || loc.includes('west head')) return true;
  if (combined.includes('w head')) return true;
  if (combined.includes('head 2') || combined.includes('head-2')) return true;
  if (combined.includes('right head')) return true;
  if (combined.includes('south head')) return true;
  
  // For horizontal vessels, "Bottom Head" is often the second head (West)
  if (combined.includes('bottom head') || combined.includes('bttm head')) return true;
  if (combined.includes('btm head')) return true;
  
  // Check location field for west indicators
  if (loc.includes('west') || loc.includes('south') || loc.includes('bottom') || loc.includes('bttm')) {
    return true;
  }
  
  return false;
}

/**
 * Check if the component is a generic head without direction
 */
function isGenericHead(combined: string): boolean {
  return combined.includes('head') && 
         !combined.includes('shell') &&
         !combined.includes('east') && !combined.includes('west') &&
         !combined.includes('north') && !combined.includes('south') &&
         !combined.includes('top') && !combined.includes('bottom') &&
         !combined.includes('left') && !combined.includes('right') &&
         !combined.includes('head 1') && !combined.includes('head 2') &&
         !combined.includes('head-1') && !combined.includes('head-2');
}

/**
 * Normalize a batch of TML readings
 */
export function normalizeReadings(
  readings: Array<{
    component?: string | null;
    componentType?: string | null;
    location?: string | null;
  }>,
  vesselOrientation?: string | null
): Array<{
  component: string;
  componentType: string;
  location: string;
}> {
  return readings.map(reading => {
    const normalized = normalizeComponent(
      reading.component,
      reading.componentType,
      reading.location,
      vesselOrientation
    );
    return {
      ...reading,
      component: normalized.component,
      componentType: normalized.componentType,
      location: reading.location || 'Unknown'
    };
  });
}

/**
 * Get the standard component type for calculations
 */
export function getCalculationComponentType(componentName: string): 'shell' | 'head' | 'nozzle' {
  const lower = componentName.toLowerCase();
  if (lower.includes('shell') || lower.includes('cylinder') || lower.includes('body')) {
    return 'shell';
  }
  if (lower.includes('head')) {
    return 'head';
  }
  if (lower.includes('nozzle') || lower.includes('manway') || lower.includes('connection')) {
    return 'nozzle';
  }
  return 'shell'; // Default to shell
}
