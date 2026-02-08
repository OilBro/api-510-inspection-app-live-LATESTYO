/**
 * Section 5 Gold-Standard PDF Import Tests
 * 
 * Comprehensive verification tests for:
 * - Extraction Validation Engine
 * - Location Matching Engine
 * - Enhanced PDF Parser
 * - Parser Selection Engine
 * 
 * Code References:
 * - API 510 §7.1.1: Thickness Measurement Requirements
 * - ASME VIII-1: Pressure Vessel Design Standards
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Import validation engine functions
import {
  validateDesignPressure,
  validateDesignTemperature,
  validateInsideDiameter,
  validateThickness,
  validateJointEfficiency,
  validateMaterialSpec,
  validateThicknessRelationships,
  validateCorrosionRate,
  validateVesselData,
  validateTMLReading
} from './extractionValidationEngine';

// Import location matching engine
import {
  parseCmlNamingConvention,
  normalizeComponentType,
  normalizeLocationDescription,
  calculateLocationSimilarity,
  matchTmlReadings,
  calculateCorrosionRate as calcCorrosionRate,
  processTmlBatch,
  generateLocationId,
  TmlLocation,
  TmlReading
} from './locationMatchingEngine';

// Import enhanced PDF parser
import {
  EnhancedPdfParser,
  selectParser,
  ExtractedPdfData
} from './services/enhancedPdfParser';

// ============================================================================
// EXTRACTION VALIDATION ENGINE TESTS
// ============================================================================

describe('Extraction Validation Engine', () => {
  
  describe('validateDesignPressure', () => {
    it('should pass for valid pressure within normal range', () => {
      const result = validateDesignPressure(150);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should fail for negative pressure', () => {
      const result = validateDesignPressure(-10);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should fail for pressure exceeding maximum', () => {
      const result = validateDesignPressure(20000);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should warn for unusually high pressure', () => {
      const result = validateDesignPressure(6000);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('warning');
    });
    
    it('should fail when pressure is undefined', () => {
      const result = validateDesignPressure(undefined);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
  });
  
  describe('validateDesignTemperature', () => {
    it('should pass for valid temperature', () => {
      const result = validateDesignTemperature(500);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should fail for temperature below cryogenic limit', () => {
      const result = validateDesignTemperature(-400);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should fail for temperature above maximum', () => {
      const result = validateDesignTemperature(2000);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should warn for unusual temperature', () => {
      const result = validateDesignTemperature(1200);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('warning');
    });
  });
  
  describe('validateInsideDiameter', () => {
    it('should pass for typical vessel diameter', () => {
      const result = validateInsideDiameter(48);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should fail for diameter too small', () => {
      const result = validateInsideDiameter(2);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should fail for diameter too large', () => {
      const result = validateInsideDiameter(800);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
  });
  
  describe('validateThickness', () => {
    it('should pass for typical shell thickness', () => {
      const result = validateThickness(0.375, 'Shell thickness');
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should fail for thickness below measurable threshold', () => {
      const result = validateThickness(0.02, 'Shell thickness');
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should fail for unreasonably thick measurement', () => {
      const result = validateThickness(8.0, 'Shell thickness');
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should warn for unusual thickness', () => {
      const result = validateThickness(3.0, 'Shell thickness');
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('warning');
    });
  });
  
  describe('validateJointEfficiency', () => {
    it('should pass for standard joint efficiency 1.0', () => {
      const result = validateJointEfficiency(1.0);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should pass for standard joint efficiency 0.85', () => {
      const result = validateJointEfficiency(0.85);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should fail for joint efficiency below minimum', () => {
      const result = validateJointEfficiency(0.3);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should fail for joint efficiency above 1.0', () => {
      const result = validateJointEfficiency(1.2);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should warn for non-standard joint efficiency', () => {
      const result = validateJointEfficiency(0.75);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('warning');
    });
  });
  
  describe('validateMaterialSpec', () => {
    it('should pass for SA-516 Grade 70', () => {
      const result = validateMaterialSpec('SA-516 Grade 70');
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should pass for SA-515 Gr 60', () => {
      const result = validateMaterialSpec('SA-515 Gr 60');
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should fail when material spec is missing', () => {
      const result = validateMaterialSpec(undefined);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should warn for non-standard format', () => {
      const result = validateMaterialSpec('Carbon Steel');
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('warning');
    });
  });
  
  describe('validateThicknessRelationships', () => {
    it('should pass when t_actual < t_previous < t_nominal', () => {
      const result = validateThicknessRelationships(0.350, 0.375, 0.500);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should warn when t_actual > t_previous (measurement error)', () => {
      const result = validateThicknessRelationships(0.400, 0.375, 0.500);
      expect(result.status).toBe('warning');
      expect(result.message).toContain('measurement error');
    });
    
    it('should warn when t_actual > t_nominal', () => {
      const result = validateThicknessRelationships(0.550, 0.500, 0.500);
      expect(result.status).toBe('warning');
    });
    
    it('should warn for excessive thickness loss', () => {
      const result = validateThicknessRelationships(0.200, 0.450, 0.500);
      expect(result.status).toBe('warning');
      expect(result.message).toContain('exceeds 50%');
    });
  });
  
  describe('validateCorrosionRate', () => {
    it('should pass for normal corrosion rate', () => {
      const result = validateCorrosionRate(0.350, 0.375, 5);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('passed');
    });
    
    it('should fail for negative corrosion rate', () => {
      const result = validateCorrosionRate(0.400, 0.375, 5);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should fail for excessive corrosion rate', () => {
      const result = validateCorrosionRate(0.100, 0.500, 1);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('failed');
    });
    
    it('should warn for high corrosion rate', () => {
      const result = validateCorrosionRate(0.300, 0.375, 5);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('warning');
    });
    
    it('should return pending when data is insufficient', () => {
      const result = validateCorrosionRate(0.350, undefined, 5);
      expect(result.status).toBe('pending');
    });
  });
  
  describe('validateVesselData', () => {
    it('should validate complete vessel data', () => {
      const result = validateVesselData({
        designPressure: 150,
        designTemperature: 500,
        insideDiameter: 48,
        materialSpec: 'SA-516 Grade 70',
        jointEfficiency: 1.0
      });
      
      expect(result.overallStatus).toBe('passed');
      expect(result.completenessScore).toBeGreaterThanOrEqual(100);
      expect(result.physicalValidationPassRate).toBeGreaterThan(0);
    });
    
    it('should detect missing required fields', () => {
      const result = validateVesselData({
        designPressure: 150
      });
      
      expect(result.completenessScore).toBeLessThan(100);
    });
  });
});

// ============================================================================
// LOCATION MATCHING ENGINE TESTS
// ============================================================================

describe('Location Matching Engine', () => {
  
  describe('parseCmlNamingConvention', () => {
    it('should parse simple CML number', () => {
      const result = parseCmlNamingConvention('2');
      expect(result.sliceNumber).toBe(2);
      expect(result.circumferentialPosition).toBeNull();
    });
    
    it('should parse CML with circumferential position', () => {
      const result = parseCmlNamingConvention('2-45');
      expect(result.sliceNumber).toBe(2);
      expect(result.circumferentialPosition).toBe(45);
    });
    
    it('should parse CML prefix format', () => {
      const result = parseCmlNamingConvention('CML 3-90');
      expect(result.sliceNumber).toBe(3);
      expect(result.circumferentialPosition).toBe(90);
    });
    
    it('should parse TML prefix format', () => {
      const result = parseCmlNamingConvention('TML 001');
      expect(result.sliceNumber).toBe(1);
    });
    
    it('should handle non-standard format', () => {
      const result = parseCmlNamingConvention('Shell-A');
      expect(result.sliceNumber).toBeNull();
      expect(result.raw).toBe('Shell-A');
    });
  });
  
  describe('normalizeComponentType', () => {
    it('should normalize shell variations', () => {
      expect(normalizeComponentType('Vessel Shell')).toBe('shell');
      expect(normalizeComponentType('Shell Body')).toBe('shell');
      expect(normalizeComponentType('Cylinder')).toBe('shell');
    });
    
    it('should normalize head variations with direction', () => {
      expect(normalizeComponentType('North Head')).toBe('north_head');
      expect(normalizeComponentType('South Head')).toBe('south_head');
      expect(normalizeComponentType('East Head')).toBe('east_head');
      expect(normalizeComponentType('West Head')).toBe('west_head');
    });
    
    it('should normalize nozzle types', () => {
      expect(normalizeComponentType('Nozzle A')).toBe('nozzle');
      expect(normalizeComponentType('Connection B')).toBe('nozzle');
    });
    
    it('should normalize piping', () => {
      expect(normalizeComponentType('Inlet Pipe')).toBe('piping');
      expect(normalizeComponentType('Process Piping')).toBe('piping');
    });
  });
  
  describe('normalizeLocationDescription', () => {
    it('should normalize location descriptions', () => {
      const result = normalizeLocationDescription('12 o\'clock position on the East End');
      expect(result).toBe('12 oclock position east end');
    });
    
    it('should remove common words', () => {
      const result = normalizeLocationDescription('At the top of the vessel');
      expect(result).not.toContain('the');
      expect(result).not.toContain('of');
    });
  });
  
  describe('calculateLocationSimilarity', () => {
    it('should return high score for exact match', () => {
      const existing: TmlLocation = {
        id: 'loc1',
        legacyLocationId: '2-45',
        componentType: 'shell',
        locationDescription: 'Shell slice 2',
        sliceNumber: 2,
        circumferentialPosition: 45
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '2-45',
        componentType: 'shell',
        locationDescription: 'Shell slice 2',
        sliceNumber: 2,
        circumferentialPosition: 45
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      expect(result.score).toBeGreaterThan(0.9);
    });
    
    it('should return 0 for component type mismatch', () => {
      const existing: TmlLocation = {
        id: 'loc1',
        legacyLocationId: '2-45',
        componentType: 'shell',
        locationDescription: 'Shell',
        sliceNumber: 2,
        circumferentialPosition: 45
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '2-45',
        componentType: 'head',
        locationDescription: 'Head',
        sliceNumber: 2,
        circumferentialPosition: 45
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      expect(result.score).toBe(0);
    });
    
    it('should give partial credit for adjacent circumferential positions', () => {
      const existing: TmlLocation = {
        id: 'loc1',
        legacyLocationId: '2-45',
        componentType: 'shell',
        locationDescription: 'Shell',
        sliceNumber: 2,
        circumferentialPosition: 45
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '2-90',
        componentType: 'shell',
        locationDescription: 'Shell',
        sliceNumber: 2,
        circumferentialPosition: 90
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.score).toBeLessThan(0.9);
    });
  });
  
  describe('matchTmlReadings', () => {
    const existingLocations: TmlLocation[] = [
      { id: 'loc1', legacyLocationId: '1-0', componentType: 'shell', locationDescription: 'Shell slice 1', sliceNumber: 1, circumferentialPosition: 0 },
      { id: 'loc2', legacyLocationId: '1-90', componentType: 'shell', locationDescription: 'Shell slice 1', sliceNumber: 1, circumferentialPosition: 90 },
      { id: 'loc3', legacyLocationId: '2-0', componentType: 'shell', locationDescription: 'Shell slice 2', sliceNumber: 2, circumferentialPosition: 0 },
      { id: 'loc4', legacyLocationId: 'H1', componentType: 'north_head', locationDescription: 'North Head', sliceNumber: 1 }
    ];
    
    it('should match readings by location', () => {
      const newReadings: TmlReading[] = [
        {
          location: { legacyLocationId: '1-0', componentType: 'shell', locationDescription: 'Shell slice 1', sliceNumber: 1, circumferentialPosition: 0 },
          thickness: 0.350,
          thicknessUnit: 'inches',
          measurementDate: new Date()
        }
      ];
      
      const result = matchTmlReadings(existingLocations, newReadings);
      expect(result.matched.length).toBe(1);
      expect(result.matched[0].existingId).toBe('loc1');
      expect(result.unmatched.length).toBe(0);
    });
    
    it('should detect CML number changes', () => {
      const newReadings: TmlReading[] = [
        {
          location: { legacyLocationId: 'NEW-1', componentType: 'shell', locationDescription: 'Shell slice 1', sliceNumber: 1, circumferentialPosition: 0 },
          thickness: 0.350,
          thicknessUnit: 'inches',
          measurementDate: new Date()
        }
      ];
      
      const result = matchTmlReadings(existingLocations, newReadings);
      expect(result.matched.length).toBe(1);
      expect(result.matched[0].cmlNumberChanged).toBe(true);
      expect(result.matched[0].oldCmlNumber).toBe('1-0');
      expect(result.matched[0].newCmlNumber).toBe('NEW-1');
    });
    
    it('should report unmatched readings', () => {
      const newReadings: TmlReading[] = [
        {
          location: { legacyLocationId: '99-0', componentType: 'shell', locationDescription: 'New location', sliceNumber: 99, circumferentialPosition: 0 },
          thickness: 0.350,
          thicknessUnit: 'inches',
          measurementDate: new Date()
        }
      ];
      
      const result = matchTmlReadings(existingLocations, newReadings);
      expect(result.unmatched.length).toBe(1);
    });
    
    it('should provide summary statistics', () => {
      const newReadings: TmlReading[] = [
        {
          location: { legacyLocationId: '1-0', componentType: 'shell', locationDescription: 'Shell', sliceNumber: 1, circumferentialPosition: 0 },
          thickness: 0.350,
          thicknessUnit: 'inches',
          measurementDate: new Date()
        },
        {
          location: { legacyLocationId: '99-0', componentType: 'shell', locationDescription: 'New', sliceNumber: 99, circumferentialPosition: 0 },
          thickness: 0.400,
          thicknessUnit: 'inches',
          measurementDate: new Date()
        }
      ];
      
      const result = matchTmlReadings(existingLocations, newReadings);
      expect(result.summary.totalNew).toBe(2);
      expect(result.summary.exactMatches + result.summary.locationMatches + result.summary.fuzzyMatches + result.summary.cmlOnlyMatches).toBe(1);
      expect(result.summary.unmatched).toBe(1);
    });
  });
  
  describe('calculateCorrosionRate', () => {
    it('should calculate valid corrosion rate', () => {
      const result = calcCorrosionRate(
        { thickness: 0.375, date: new Date('2020-01-01') },
        { thickness: 0.350, date: new Date('2025-01-01') }
      );
      
      expect(result.isValid).toBe(true);
      expect(result.rate).toBeGreaterThan(0);
      expect(result.thicknessLoss).toBeCloseTo(0.025, 3);
      expect(result.timeSpan).toBeCloseTo(5, 1);
    });
    
    it('should warn for negative thickness loss', () => {
      const result = calcCorrosionRate(
        { thickness: 0.350, date: new Date('2020-01-01') },
        { thickness: 0.375, date: new Date('2025-01-01') }
      );
      
      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('Negative thickness loss');
    });
    
    it('should reject short time spans', () => {
      const result = calcCorrosionRate(
        { thickness: 0.375, date: new Date('2025-01-01') },
        { thickness: 0.370, date: new Date('2025-01-15') }
      );
      
      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('too short');
    });
    
    it('should warn for high corrosion rate', () => {
      const result = calcCorrosionRate(
        { thickness: 0.500, date: new Date('2024-01-01') },
        { thickness: 0.400, date: new Date('2025-01-01') }
      );
      
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('High corrosion rate');
    });
  });
  
  describe('generateLocationId', () => {
    it('should generate unique IDs', () => {
      const loc: TmlLocation = {
        legacyLocationId: '2-45',
        componentType: 'shell',
        locationDescription: 'Shell slice 2'
      };
      
      const id1 = generateLocationId(loc);
      const id2 = generateLocationId(loc);
      
      expect(id1).toMatch(/^loc_shell_s2_c45_/);
      expect(id1).not.toBe(id2); // Should be unique
    });
  });
});

// ============================================================================
// ENHANCED PDF PARSER TESTS
// ============================================================================

describe('Enhanced PDF Parser', () => {
  
  describe('parseAndValidate', () => {
    const parser = new EnhancedPdfParser();
    
    const validPdfData: ExtractedPdfData = {
      vesselData: {
        vesselTagNumber: 'V-1001',
        designPressure: 150,
        designTemperature: 500,
        materialSpec: 'SA-516 Grade 70',
        insideDiameter: 48,
        jointEfficiency: 1.0
      },
      inspectionData: {
        inspectionDate: '2025-01-15',
        inspector: 'John Smith',
        inspectorCertification: 'API-510-12345'
      },
      thicknessMeasurements: [
        { cml: '1', component: 'Vessel Shell', readings: [0.350, 0.355, 0.348], minThickness: 0.348, nominalThickness: 0.500 },
        { cml: '2', component: 'North Head', readings: [0.375, 0.380], minThickness: 0.375, nominalThickness: 0.500 }
      ],
      nozzles: [
        { nozzleNumber: 'N1', service: 'Inlet', size: 4, actualThickness: 0.237, minimumRequired: 0.200 },
        { nozzleNumber: 'N2', service: 'Outlet', size: 6, actualThickness: 0.280, minimumRequired: 0.250 }
      ]
    };
    
    it('should validate complete extraction data', async () => {
      const result = await parser.parseAndValidate(validPdfData, {
        fileName: 'test-report.pdf',
        fileUrl: 'https://example.com/test.pdf',
        userId: 'user123'
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.overallStatus).toBe('valid');
      expect(result.extractionJobId).toMatch(/^job_/);
      expect(result.importedFileId).toMatch(/^file_/);
    });
    
    it('should detect missing required fields', async () => {
      const incompleteData: ExtractedPdfData = {
        vesselData: {
          vesselTagNumber: 'V-1001'
          // Missing designPressure, designTemperature, etc.
        },
        inspectionData: {
          inspectionDate: '2025-01-15'
        },
        thicknessMeasurements: [],
        nozzles: []
      };
      
      const result = await parser.parseAndValidate(incompleteData, {
        fileName: 'incomplete.pdf',
        fileUrl: 'https://example.com/incomplete.pdf',
        userId: 'user123'
      });
      
      expect(result.validation.errorFields).toBeGreaterThan(0);
      expect(result.validation.criticalErrors.length).toBeGreaterThan(0);
    });
    
    it('should validate thickness measurements', async () => {
      const dataWithBadThickness: ExtractedPdfData = {
        ...validPdfData,
        thicknessMeasurements: [
          { cml: '1', component: 'Shell', readings: [0.01], minThickness: 0.01, nominalThickness: 0.500 }
        ]
      };
      
      const result = await parser.parseAndValidate(dataWithBadThickness, {
        fileName: 'bad-thickness.pdf',
        fileUrl: 'https://example.com/bad.pdf',
        userId: 'user123'
      });
      
      const tmlField = result.parsedFields.find(f => f.fieldName.includes('tml_1'));
      expect(tmlField?.validationStatus).toBe('error');
    });
    
    it('should validate nozzle data', async () => {
      const dataWithBadNozzle: ExtractedPdfData = {
        ...validPdfData,
        nozzles: [
          { nozzleNumber: 'N1', service: 'Inlet', size: 4, actualThickness: 0.150, minimumRequired: 0.200 }
        ]
      };
      
      const result = await parser.parseAndValidate(dataWithBadNozzle, {
        fileName: 'bad-nozzle.pdf',
        fileUrl: 'https://example.com/bad.pdf',
        userId: 'user123'
      });
      
      const nozzleField = result.parsedFields.find(f => f.fieldName === 'nozzle_N1');
      expect(nozzleField?.validationStatus).toBe('error');
      expect(nozzleField?.validationMessages.some(m => m.includes('below minimum'))).toBe(true);
    });
    
    it('should generate audit trail entries', async () => {
      const result = await parser.parseAndValidate(validPdfData, {
        fileName: 'audit-test.pdf',
        fileUrl: 'https://example.com/audit.pdf',
        userId: 'user123'
      });
      
      expect(result.auditEntries.length).toBeGreaterThan(0);
      expect(result.auditEntries[0].action).toBe('EXTRACTION_STARTED');
      expect(result.auditEntries[result.auditEntries.length - 1].action).toBe('EXTRACTION_COMPLETED');
    });
  });
  
  describe('Location Matching Integration', () => {
    it('should perform location matching when enabled', async () => {
      const existingLocations: TmlLocation[] = [
        { id: 'loc1', legacyLocationId: '1', componentType: 'shell', locationDescription: 'Shell', sliceNumber: 1 },
        { id: 'loc2', legacyLocationId: '2', componentType: 'north_head', locationDescription: 'North Head', sliceNumber: 2 }
      ];
      
      const parser = new EnhancedPdfParser({
        enableLocationMatching: true,
        existingTmlLocations: existingLocations
      });
      
      const pdfData: ExtractedPdfData = {
        vesselData: {
          vesselTagNumber: 'V-1001',
          designPressure: 150,
          designTemperature: 500,
          materialSpec: 'SA-516 Grade 70',
          insideDiameter: 48
        },
        inspectionData: {
          inspectionDate: '2025-01-15'
        },
        thicknessMeasurements: [
          { cml: '1', component: 'Vessel Shell', readings: [0.350], minThickness: 0.350 },
          { cml: '3', component: 'New Location', readings: [0.400], minThickness: 0.400 }
        ],
        nozzles: []
      };
      
      const result = await parser.parseAndValidate(pdfData, {
        fileName: 'matching-test.pdf',
        fileUrl: 'https://example.com/matching.pdf',
        userId: 'user123'
      });
      
      expect(result.locationMatching).toBeDefined();
      expect(result.locationMatching?.matched).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// PARSER SELECTION ENGINE TESTS
// ============================================================================

describe('Parser Selection Engine', () => {
  
  describe('selectParser', () => {
    it('should recommend Manus LLM for text-based PDFs', () => {
      const result = selectParser({
        fileName: 'report.pdf',
        fileSize: 1024 * 1024,
        mimeType: 'application/pdf',
        isScanned: false
      });
      
      expect(result.recommendedParser).toBe('manus_llm');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
    
    it('should recommend Docupipe for scanned documents', () => {
      const result = selectParser({
        fileName: 'scanned.pdf',
        fileSize: 5 * 1024 * 1024,
        mimeType: 'application/pdf',
        isScanned: true
      });
      
      expect(result.recommendedParser).toBe('docupipe');
      expect(result.fallbackParser).toBe('manus_llm');
    });
    
    it('should recommend manual entry for non-PDF files', () => {
      const result = selectParser({
        fileName: 'data.xlsx',
        fileSize: 100 * 1024,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      expect(result.recommendedParser).toBe('manual');
    });
    
    it('should reduce confidence for large documents', () => {
      const smallDoc = selectParser({
        fileName: 'small.pdf',
        fileSize: 1024 * 1024,
        mimeType: 'application/pdf',
        pageCount: 10
      });
      
      const largeDoc = selectParser({
        fileName: 'large.pdf',
        fileSize: 15 * 1024 * 1024,
        mimeType: 'application/pdf',
        pageCount: 100
      });
      
      expect(largeDoc.confidence).toBeLessThan(smallDoc.confidence);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Section 5 Integration Tests', () => {
  
  it('should process complete PDF import workflow', async () => {
    // 1. Select parser
    const parserSelection = selectParser({
      fileName: 'inspection-report.pdf',
      fileSize: 2 * 1024 * 1024,
      mimeType: 'application/pdf',
      isScanned: false,
      pageCount: 25
    });
    
    expect(parserSelection.recommendedParser).toBe('manus_llm');
    
    // 2. Parse and validate
    const parser = new EnhancedPdfParser();
    const extractedData: ExtractedPdfData = {
      vesselData: {
        vesselTagNumber: 'V-54-11-005',
        vesselName: 'Amine Contactor',
        designPressure: 150,
        designTemperature: 500,
        materialSpec: 'SA-516 Grade 70',
        insideDiameter: 48,
        jointEfficiency: 1.0,
        vesselConfiguration: 'Horizontal'
      },
      inspectionData: {
        inspectionDate: '2025-01-15',
        inspector: 'Jerry Hartfield',
        inspectorCertification: 'API-510-12345',
        reportNumber: 'INS-2025-001'
      },
      thicknessMeasurements: [
        { cml: '1-0', component: 'Vessel Shell', location: 'Slice 1, 0°', readings: [0.350, 0.352, 0.348], minThickness: 0.348, nominalThickness: 0.500, previousThickness: 0.375 },
        { cml: '1-90', component: 'Vessel Shell', location: 'Slice 1, 90°', readings: [0.355, 0.358, 0.352], minThickness: 0.352, nominalThickness: 0.500, previousThickness: 0.380 },
        { cml: 'H1', component: 'West Head', location: 'Head center', readings: [0.375, 0.378], minThickness: 0.375, nominalThickness: 0.500, previousThickness: 0.400 }
      ],
      nozzles: [
        { nozzleNumber: 'N1', service: 'Inlet', size: 4, actualThickness: 0.237, minimumRequired: 0.200, acceptable: true },
        { nozzleNumber: 'N2', service: 'Outlet', size: 6, actualThickness: 0.280, minimumRequired: 0.250, acceptable: true },
        { nozzleNumber: 'MW', service: 'Manway', size: 18, actualThickness: 0.375, minimumRequired: 0.300, acceptable: true }
      ]
    };
    
    const result = await parser.parseAndValidate(extractedData, {
      fileName: 'inspection-report.pdf',
      fileUrl: 'https://storage.example.com/reports/inspection-report.pdf',
      inspectionId: 'insp-001',
      userId: 'user-jerry'
    });
    
    // 3. Verify results
    expect(result.success).toBe(true);
    expect(result.validation.overallStatus).toBe('valid');
    expect(result.validation.validFields).toBeGreaterThan(0);
    expect(result.auditEntries.length).toBeGreaterThan(0);
    
    // 4. Verify vessel data validation
    const vesselFields = result.parsedFields.filter(f => 
      ['vesselTagNumber', 'designPressure', 'designTemperature', 'materialSpec', 'insideDiameter'].includes(f.fieldName)
    );
    expect(vesselFields.every(f => f.validationStatus === 'valid')).toBe(true);
    
    // 5. Verify TML validation
    const tmlFields = result.parsedFields.filter(f => f.fieldName.startsWith('tml_'));
    expect(tmlFields.length).toBe(3);
    expect(tmlFields.every(f => f.validationStatus === 'valid')).toBe(true);
    
    // 6. Verify nozzle validation
    const nozzleFields = result.parsedFields.filter(f => f.fieldName.startsWith('nozzle_'));
    expect(nozzleFields.length).toBe(3);
    expect(nozzleFields.every(f => f.validationStatus === 'valid')).toBe(true);
  });
});
