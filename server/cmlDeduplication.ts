import { logger } from "./_core/logger";
/**
 * CML Deduplication Logic
 * 
 * Consolidates duplicate CML entries from PDF extraction into single database records.
 * Groups readings by: cmlNumber + componentType + location
 * Merges multi-angle readings (0°, 90°, 180°, 270°) into tml1-4 fields
 */

interface ParsedTMLReading {
  legacyLocationId?: string;
  tmlId?: string;
  location?: string;
  component?: string;
  readingType?: string;
  nozzleSize?: string;
  angle?: string;
  nominalThickness?: number | string;
  previousThickness?: number | string;
  currentThickness?: number | string;
  minimumRequired?: number | string;
  calculatedMAWP?: number | string;
}

interface ConsolidatedTMLReading {
  legacyLocationId: string;
  componentType: string;
  location: string;
  readingType?: string;
  nozzleSize?: string;
  service?: string;
  tml1?: number;
  tml2?: number;
  tml3?: number;
  tml4?: number;
  tActual?: number;
  nominalThickness?: number;
  previousThickness?: number;
  angles: string[]; // Track which angles were consolidated
}

/**
 * Groups and consolidates TML readings to eliminate duplicates
 */
export function consolidateTMLReadings(readings: ParsedTMLReading[]): ConsolidatedTMLReading[] {
  // Validate input
  if (!readings || !Array.isArray(readings)) {
    logger.warn('[CML Dedup] Invalid readings input:', readings);
    return [];
  }
  
  // Filter out null/undefined readings
  const validReadings = readings.filter(r => r !== null && r !== undefined);
  if (validReadings.length === 0) {
    logger.warn('[CML Dedup] No valid readings to process');
    return [];
  }
  
  // Group readings by unique CML identifier
  const groupedReadings = new Map<string, ParsedTMLReading[]>();
  
  for (const reading of validReadings) {
    const legacyLocationId = String(reading.legacyLocationId || reading.tmlId || reading.location || 'N/A');
    const componentType = String(reading.component || 'Unknown');
    const location = String(reading.location || reading.legacyLocationId || 'N/A');
    
    // Create unique key for grouping
    const groupKey = `${legacyLocationId}|${componentType}|${location}`;
    
    if (!groupedReadings.has(groupKey)) {
      groupedReadings.set(groupKey, []);
    }
    groupedReadings.get(groupKey)!.push(reading);
  }
  
  // Consolidate each group into a single record
  const consolidated: ConsolidatedTMLReading[] = [];
  
  for (const [groupKey, group] of Array.from(groupedReadings.entries())) {
    const [legacyLocationId, componentType, location] = groupKey.split('|');
    
    // Sort readings by angle for consistent tml1-4 ordering
    const sortedGroup = group.sort((a: ParsedTMLReading, b: ParsedTMLReading) => {
      const angleA = parseAngle(a.angle);
      const angleB = parseAngle(b.angle);
      return angleA - angleB;
    });
    
    // Extract thickness values from sorted group
    const thicknessValues: number[] = [];
    const angles: string[] = [];
    
    for (const reading of sortedGroup) {
      const thickness = parseThickness(reading.currentThickness);
      if (thickness !== null) {
        thicknessValues.push(thickness);
        angles.push(reading.angle || 'N/A');
      }
    }
    
    // Use first reading for metadata
    if (sortedGroup.length === 0) {
      logger.warn('[CML Dedup] Empty sorted group for:', groupKey);
      continue;
    }
    const firstReading = sortedGroup[0];
    
    // Build consolidated record
    const consolidatedRecord: ConsolidatedTMLReading = {
      legacyLocationId: legacyLocationId.substring(0, 10),
      componentType: componentType.substring(0, 255),
      location: location.substring(0, 50),
      readingType: firstReading.readingType,
      nozzleSize: firstReading.nozzleSize,
      angles,
    };
    
    // Assign thickness values to tml1-4 fields
    if (thicknessValues.length > 0) consolidatedRecord.tml1 = thicknessValues[0];
    if (thicknessValues.length > 1) consolidatedRecord.tml2 = thicknessValues[1];
    if (thicknessValues.length > 2) consolidatedRecord.tml3 = thicknessValues[2];
    if (thicknessValues.length > 3) consolidatedRecord.tml4 = thicknessValues[3];
    
    // Calculate tActual as minimum of all readings
    if (thicknessValues.length > 0) {
      consolidatedRecord.tActual = Math.min(...thicknessValues);
    }
    
    // Add nominal and previous thickness from first reading
    const nominalThickness = parseThickness(firstReading.nominalThickness);
    if (nominalThickness !== null) {
      consolidatedRecord.nominalThickness = nominalThickness;
    }
    
    const previousThickness = parseThickness(firstReading.previousThickness);
    if (previousThickness !== null) {
      consolidatedRecord.previousThickness = previousThickness;
    }
    
    // Detect service for nozzles
    if (firstReading.readingType === 'nozzle' || componentType.match(/manway|relief|vapor|liquid|drain|vent/i)) {
      consolidatedRecord.service = detectNozzleService(componentType, location);
    }
    
    consolidated.push(consolidatedRecord);
  }
  
  return consolidated;
}

/**
 * Parse angle string to numeric value for sorting
 */
function parseAngle(angle?: string): number {
  if (!angle) return 0;
  const match = angle.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Parse thickness value (handles string and number inputs)
 */
function parseThickness(value?: string | number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? null : num;
}

/**
 * Detect nozzle service type from component name or location
 */
function detectNozzleService(componentType: string, location: string): string {
  const combined = `${componentType} ${location}`.toLowerCase();
  
  if (combined.includes('manway') || combined.includes('manhole')) return 'Manway';
  if (combined.includes('relief')) return 'Relief';
  if (combined.includes('vapor') || combined.includes('vap')) return 'Vapor Out';
  if (combined.includes('liquid')) return 'Liquid Out';
  if (combined.includes('drain')) return 'Drain';
  if (combined.includes('vent')) return 'Vent';
  if (combined.includes('inlet')) return 'Inlet';
  if (combined.includes('outlet')) return 'Outlet';
  
  return 'Unknown';
}
