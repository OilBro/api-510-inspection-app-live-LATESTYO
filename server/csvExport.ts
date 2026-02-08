/**
 * CSV Export Helper
 * 
 * Generates CSV files from inspection calculation data
 */

/**
 * Convert array of objects to CSV string
 */
export function arrayToCSV(data: any[], headers: string[]): string {
  if (!data || data.length === 0) {
    return headers.join(',') + '\n';
  }

  const rows: string[] = [];
  
  // Add header row
  rows.push(headers.join(','));
  
  // Add data rows
  data.forEach(item => {
    const row = headers.map(header => {
      const value = item[header];
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }
      
      // Convert to string and escape commas/quotes
      const stringValue = String(value);
      
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    });
    
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

/**
 * Generate comprehensive CSV export for an inspection
 */
export function generateInspectionCSV(data: {
  inspection: any;
  components: any[];
  tmlReadings: any[];
  nozzles: any[];
}): string {
  const { inspection, components, tmlReadings, nozzles } = data;
  
  const sections: string[] = [];
  
  // ============================================================================
  // INSPECTION METADATA
  // ============================================================================
  sections.push('INSPECTION METADATA');
  sections.push('Field,Value');
  sections.push(`Vessel Tag,${inspection.vesselTagNumber || ''}`);
  sections.push(`Vessel Name,${inspection.vesselName || ''}`);
  sections.push(`Manufacturer,${inspection.manufacturer || ''}`);
  sections.push(`Serial Number,${inspection.serialNumber || ''}`);
  sections.push(`Year Built,${inspection.yearBuilt || ''}`);
  sections.push(`Inspection Date,${inspection.inspectionDate || ''}`);
  sections.push(`Design Pressure,${inspection.designPressure || ''}`);
  sections.push(`Design Temperature,${inspection.designTemperature || ''}`);
  sections.push(`Operating Pressure,${inspection.operatingPressure || ''}`);
  sections.push(`Material Spec,${inspection.materialSpec || ''}`);
  sections.push(`Allowable Stress,${inspection.allowableStress || ''}`);
  sections.push(`Joint Efficiency,${inspection.jointEfficiency || ''}`);
  sections.push(`Radiography Type,${inspection.radiographyType || ''}`);
  sections.push(`Specific Gravity,${inspection.specificGravity || ''}`);
  sections.push(`Vessel Type,${inspection.vesselType || ''}`);
  sections.push(`Inside Diameter,${inspection.insideDiameter || ''}`);
  sections.push(`Overall Length,${inspection.overallLength || ''}`);
  sections.push('');
  sections.push('');
  
  // ============================================================================
  // COMPONENT CALCULATIONS
  // ============================================================================
  sections.push('COMPONENT CALCULATIONS');
  
  const componentHeaders = [
    'componentName',
    'componentType',
    'materialCode',
    'designTemp',
    'designMAWP',
    'insideDiameter',
    'nominalThickness',
    'previousThickness',
    'actualThickness',
    'minimumThickness',
    'corrosionRate',
    'corrosionRateLongTerm',
    'corrosionRateShortTerm',
    'governingRateType',
    'remainingLife',
    'timeSpan',
    'nextInspectionYears',
    'allowableStress',
    'jointEfficiency',
    'corrosionAllowance',
    'calculatedMAWP',
    'dataQualityStatus',
  ];
  
  sections.push(arrayToCSV(components, componentHeaders));
  sections.push('');
  sections.push('');
  
  // ============================================================================
  // TML READINGS
  // ============================================================================
  sections.push('TML READINGS (THICKNESS MEASUREMENT LOCATIONS)');
  
  const tmlHeaders = [
    'legacyLocationId',
    'componentType',
    'location',
    'readingType',
    'nozzleSize',
    'angle',
    'service',
    'nominalThickness',
    'previousThickness',
    'actualThickness',
    'tml1',
    'tml2',
    'tml3',
    'tml4',
    'minimumThickness',
    'corrosionRate',
    'remainingLife',
    'notes',
  ];
  
  sections.push(arrayToCSV(tmlReadings, tmlHeaders));
  sections.push('');
  sections.push('');
  
  // ============================================================================
  // NOZZLE EVALUATIONS
  // ============================================================================
  sections.push('NOZZLE EVALUATIONS');
  
  const nozzleHeaders = [
    'nozzleId',
    'service',
    'size',
    'rating',
    'schedule',
    'nominalThickness',
    'minimumThickness',
    'actualThickness',
    'corrosionRate',
    'remainingLife',
    'status',
    'notes',
  ];
  
  sections.push(arrayToCSV(nozzles, nozzleHeaders));
  sections.push('');
  
  return sections.join('\n');
}
