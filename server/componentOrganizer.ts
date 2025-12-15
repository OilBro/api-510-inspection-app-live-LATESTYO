/**
 * Component Organizer - Automatically categorize TML readings by vessel component
 */

export type ComponentCategory = 'shell' | 'east_head' | 'west_head' | 'nozzle' | 'other';

export interface OrganizedComponent {
  category: ComponentCategory;
  displayName: string;
  readings: any[];
  nozzleSize?: string; // For nozzles: "24\"", "3\"", etc.
  nozzleType?: string; // For nozzles: "Manway", "Relief", etc.
}

/**
 * Categorize a component based on its name/description
 */
export function categorizeComponent(componentName: string): {
  category: ComponentCategory;
  nozzleSize?: string;
  nozzleType?: string;
} {
  const lower = componentName.toLowerCase();
  
  // Check for nozzles first (most specific)
  const nozzleKeywords = ['nozzle', 'manway', 'relief', 'vapor', 'sight', 'gauge', 'feed', 'inlet', 'outlet'];
  if (nozzleKeywords.some(kw => lower.includes(kw))) {
    // Extract nozzle size (e.g., "24\"", "3\"", "2\"", "1\"")
    const sizeMatch = componentName.match(/(\d+)\s*[""'′]|(\d+)\s*inch/i);
    const nozzleSize = sizeMatch ? `${sizeMatch[1] || sizeMatch[2]}"` : undefined;
    
    // Extract nozzle type
    let nozzleType: string | undefined;
    if (lower.includes('manway')) nozzleType = 'Manway';
    else if (lower.includes('relief')) nozzleType = 'Relief';
    else if (lower.includes('vapor out') || lower.includes('vapor-out')) nozzleType = 'Vapor Out';
    else if (lower.includes('vapor in') || lower.includes('vapor-in')) nozzleType = 'Vapor In';
    else if (lower.includes('sight') && lower.includes('gauge')) nozzleType = 'Sight Gauge';
    else if (lower.includes('reactor') && lower.includes('feed')) nozzleType = 'Reactor Feed';
    else if (lower.includes('gauge')) nozzleType = 'Gauge';
    else if (lower.includes('inlet')) nozzleType = 'Inlet';
    else if (lower.includes('outlet') || lower.includes('out')) nozzleType = 'Out';
    
    return { category: 'nozzle', nozzleSize, nozzleType };
  }
  
  // Check for heads
  if (lower.includes('east') && (lower.includes('head') || lower.includes('seam'))) {
    return { category: 'east_head' };
  }
  if (lower.includes('west') && (lower.includes('head') || lower.includes('seam'))) {
    return { category: 'west_head' };
  }
  if (lower.includes('head') && !lower.includes('overhead')) {
    // Generic head - try to determine which one
    if (lower.includes('left') || lower.includes('front')) return { category: 'east_head' };
    if (lower.includes('right') || lower.includes('rear')) return { category: 'west_head' };
    return { category: 'other' }; // Can't determine which head
  }
  
  // Check for shell
  if (lower.includes('shell') || lower.includes('vessel shell') || lower.includes('body')) {
    return { category: 'shell' };
  }
  
  // Default
  return { category: 'other' };
}

/**
 * Organize TML readings by component category
 */
export function organizeReadingsByComponent(readings: any[]): OrganizedComponent[] {
  const groups: Map<string, OrganizedComponent> = new Map();
  
  for (const reading of readings) {
    const componentName = reading.componentType || reading.component || 'Unknown';
    const { category, nozzleSize, nozzleType } = categorizeComponent(componentName);
    
    // Create unique key for grouping
    let groupKey: string;
    if (category === 'nozzle') {
      // Group nozzles by type and size
      groupKey = `nozzle_${nozzleType || 'unknown'}_${nozzleSize || 'unknown'}`;
    } else {
      groupKey = category;
    }
    
    // Get or create group
    if (!groups.has(groupKey)) {
      let displayName: string;
      if (category === 'shell') displayName = 'Vessel Shell';
      else if (category === 'east_head') displayName = 'East Head';
      else if (category === 'west_head') displayName = 'West Head';
      else if (category === 'nozzle') {
        displayName = nozzleType ? `${nozzleSize || ''} ${nozzleType}`.trim() : `Nozzle ${nozzleSize || ''}`.trim();
      } else displayName = componentName;
      
      groups.set(groupKey, {
        category,
        displayName,
        readings: [],
        nozzleSize,
        nozzleType,
      });
    }
    
    groups.get(groupKey)!.readings.push(reading);
  }
  
  // Sort groups: Shell, East Head, West Head, then Nozzles by size (descending), then Others
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const order = { shell: 1, east_head: 2, west_head: 3, nozzle: 4, other: 5 };
    const orderDiff = order[a.category] - order[b.category];
    if (orderDiff !== 0) return orderDiff;
    
    // Within nozzles, sort by size (descending)
    if (a.category === 'nozzle' && b.category === 'nozzle') {
      const sizeA = parseInt(a.nozzleSize || '0');
      const sizeB = parseInt(b.nozzleSize || '0');
      return sizeB - sizeA; // Larger nozzles first
    }
    
    return 0;
  });
  
  return sortedGroups;
}

/**
 * Get full component name without truncation
 */
export function getFullComponentName(componentName: string): string {
  // Remove common truncation patterns
  if (componentName.endsWith('...')) {
    // Try to infer full name
    const lower = componentName.toLowerCase();
    if (lower.startsWith('vessel')) return 'Vessel Shell';
    if (lower.startsWith('east')) return 'East Head';
    if (lower.startsWith('west')) return 'West Head';
  }
  
  return componentName;
}
