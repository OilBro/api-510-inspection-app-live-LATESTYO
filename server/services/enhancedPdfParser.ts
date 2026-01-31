/**
 * Enhanced PDF Parser Service
 * 
 * Gold-standard PDF import with validation, audit trail, and location matching.
 * Integrates with:
 * - Extraction Validation Engine (physical reasonableness checks)
 * - Extraction Audit Service (provenance tracking)
 * - Location Matching Engine (TML correlation)
 * 
 * Code References:
 * - API 510 §7.1.1: Thickness Measurement Requirements
 * - ASME VIII-1: Pressure Vessel Design Standards
 */

import { nanoid } from 'nanoid';
import { 
  FieldValidation,
  ValidationResult,
  validateVesselData as validateVesselDataEngine,
  validateTMLReading,
  validateThickness,
  validateDesignPressure,
  validateDesignTemperature,
  validateJointEfficiency
} from '../extractionValidationEngine';
import {
  ExtractionAuditEntry,
  DataConflict,
  createExtractionAuditEntry
} from '../extractionAuditService';
import {
  matchTmlReadings,
  TmlLocation,
  TmlReading,
  MatchResult,
  parseCmlNamingConvention,
  normalizeComponentType
} from '../locationMatchingEngine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ExtractedPdfData {
  vesselData: {
    vesselTagNumber: string;
    vesselName?: string;
    manufacturer?: string;
    yearBuilt?: number;
    designPressure?: number;
    designTemperature?: number;
    operatingPressure?: number;
    operatingTemperature?: number;
    mdmt?: number;
    serialNumber?: string;
    materialSpec?: string;
    allowableStress?: number;
    jointEfficiency?: number;
    insideDiameter?: number;
    overallLength?: number;
    vesselConfiguration?: string;
    headType?: string;
    crownRadius?: number;
    knuckleRadius?: number;
  };
  inspectionData: {
    inspectionDate: string;
    inspector?: string;
    inspectorCertification?: string;
    reportNumber?: string;
    client?: string;
    clientLocation?: string;
    inspectionType?: string;
  };
  thicknessMeasurements: Array<{
    cml: string;
    component: string;
    location?: string;
    readings: number[];
    minThickness: number;
    nominalThickness?: number;
    previousThickness?: number;
    angle0?: number;
    angle90?: number;
    angle180?: number;
    angle270?: number;
  }>;
  nozzles: Array<{
    nozzleNumber: string;
    service?: string;
    size?: number;
    material?: string;
    schedule?: string;
    actualThickness?: number;
    minimumRequired?: number;
    corrosionRate?: number;
    remainingLife?: number;
    acceptable?: boolean;
  }>;
  tableA?: {
    components: Array<{
      componentName: string;
      material?: string;
      nominalThickness?: number;
      actualThickness?: number;
      minimumRequiredThickness?: number;
      corrosionRate?: number;
      calculatedMAWP?: number;
      remainingLife?: number;
    }>;
  };
  findings?: Array<{
    section: string;
    finding: string;
    severity: string;
  }>;
  checklistItems?: Array<{
    category?: string;
    itemText: string;
    status: string;
    notes?: string;
  }>;
  executiveSummary?: string;
  inspectionResults?: string;
  recommendations?: string;
}

export interface ParsedField {
  fieldName: string;
  rawValue: string | number | null;
  parsedValue: any;
  confidence: number;
  sourceLocation: string;
  validationStatus: 'valid' | 'warning' | 'error' | 'pending';
  validationMessages: string[];
}

export interface EnhancedParseResult {
  success: boolean;
  extractionJobId: string;
  importedFileId: string;
  
  // Validated data
  validatedData: ExtractedPdfData;
  
  // Field-level tracking
  parsedFields: ParsedField[];
  
  // Validation summary
  validation: {
    overallStatus: 'valid' | 'warnings' | 'errors';
    totalFields: number;
    validFields: number;
    warningFields: number;
    errorFields: number;
    criticalErrors: string[];
    warnings: string[];
  };
  
  // Location matching results
  locationMatching?: {
    matched: number;
    unmatched: number;
    conflicts: number;
    cmlNumberChanges: Array<{
      oldCml: string;
      newCml: string;
      location: string;
    }>;
  };
  
  // Audit trail
  auditEntries: Array<{
    timestamp: Date;
    action: string;
    details: string;
  }>;
}

// ============================================================================
// PARSER CONFIGURATION
// ============================================================================

export interface ParserConfig {
  strictValidation: boolean;
  autoResolveConflicts: boolean;
  confidenceThreshold: number;
  enableLocationMatching: boolean;
  existingTmlLocations?: TmlLocation[];
}

const DEFAULT_CONFIG: ParserConfig = {
  strictValidation: true,
  autoResolveConflicts: false,
  confidenceThreshold: 0.7,
  enableLocationMatching: true
};

// ============================================================================
// ENHANCED PARSER CLASS
// ============================================================================

export class EnhancedPdfParser {
  private config: ParserConfig;
  
  constructor(config: Partial<ParserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Parse and validate extracted PDF data
   */
  async parseAndValidate(
    rawExtractedData: ExtractedPdfData,
    metadata: {
      fileName: string;
      fileUrl: string;
      inspectionId?: string;
      userId: string;
    }
  ): Promise<EnhancedParseResult> {
    const extractionJobId = `job_${nanoid(12)}`;
    const importedFileId = `file_${nanoid(12)}`;
    const auditEntries: Array<{ timestamp: Date; action: string; details: string }> = [];
    const parsedFields: ParsedField[] = [];
    
    // Log extraction start
    auditEntries.push({
      timestamp: new Date(),
      action: 'EXTRACTION_STARTED',
      details: `Started parsing ${metadata.fileName}`
    });
    
    // Step 1: Validate vessel data
    const vesselValidation = this.validateVesselDataFields(rawExtractedData.vesselData, parsedFields);
    auditEntries.push({
      timestamp: new Date(),
      action: 'VESSEL_DATA_VALIDATED',
      details: `Vessel data validation: ${vesselValidation.validFields}/${vesselValidation.totalFields} fields valid`
    });
    
    // Step 2: Validate thickness measurements
    const tmlValidation = this.validateThicknessMeasurements(
      rawExtractedData.thicknessMeasurements,
      rawExtractedData.vesselData,
      parsedFields
    );
    auditEntries.push({
      timestamp: new Date(),
      action: 'TML_DATA_VALIDATED',
      details: `TML validation: ${tmlValidation.validReadings}/${tmlValidation.totalReadings} readings valid`
    });
    
    // Step 3: Location matching (if enabled and existing data provided)
    let locationMatchingResult: EnhancedParseResult['locationMatching'];
    if (this.config.enableLocationMatching && this.config.existingTmlLocations) {
      const matchResult = this.performLocationMatching(
        rawExtractedData.thicknessMeasurements,
        this.config.existingTmlLocations
      );
      locationMatchingResult = {
        matched: matchResult.summary.exactMatches + matchResult.summary.locationMatches + matchResult.summary.fuzzyMatches,
        unmatched: matchResult.summary.unmatched,
        conflicts: matchResult.summary.conflicts,
        cmlNumberChanges: matchResult.matched
          .filter(m => m.cmlNumberChanged)
          .map(m => ({
            oldCml: m.oldCmlNumber || '',
            newCml: m.newCmlNumber || '',
            location: m.newReading.location.locationDescription
          }))
      };
      auditEntries.push({
        timestamp: new Date(),
        action: 'LOCATION_MATCHING_COMPLETED',
        details: `Matched ${locationMatchingResult.matched} locations, ${locationMatchingResult.unmatched} unmatched, ${locationMatchingResult.conflicts} conflicts`
      });
    }
    
    // Step 4: Validate nozzles
    const nozzleValidation = this.validateNozzles(rawExtractedData.nozzles, parsedFields);
    auditEntries.push({
      timestamp: new Date(),
      action: 'NOZZLE_DATA_VALIDATED',
      details: `Nozzle validation: ${nozzleValidation.validNozzles}/${nozzleValidation.totalNozzles} nozzles valid`
    });
    
    // Step 5: Compile validation summary
    const criticalErrors: string[] = [];
    const warnings: string[] = [];
    
    parsedFields.forEach(field => {
      if (field.validationStatus === 'error') {
        criticalErrors.push(...field.validationMessages);
      } else if (field.validationStatus === 'warning') {
        warnings.push(...field.validationMessages);
      }
    });
    
    const validFields = parsedFields.filter(f => f.validationStatus === 'valid').length;
    const warningFields = parsedFields.filter(f => f.validationStatus === 'warning').length;
    const errorFields = parsedFields.filter(f => f.validationStatus === 'error').length;
    
    let overallStatus: 'valid' | 'warnings' | 'errors' = 'valid';
    if (errorFields > 0) overallStatus = 'errors';
    else if (warningFields > 0) overallStatus = 'warnings';
    
    auditEntries.push({
      timestamp: new Date(),
      action: 'EXTRACTION_COMPLETED',
      details: `Extraction complete: ${overallStatus} (${validFields} valid, ${warningFields} warnings, ${errorFields} errors)`
    });
    
    return {
      success: overallStatus !== 'errors' || !this.config.strictValidation,
      extractionJobId,
      importedFileId,
      validatedData: rawExtractedData,
      parsedFields,
      validation: {
        overallStatus,
        totalFields: parsedFields.length,
        validFields,
        warningFields,
        errorFields,
        criticalErrors,
        warnings
      },
      locationMatching: locationMatchingResult,
      auditEntries
    };
  }
  
  /**
   * Validate vessel data fields
   */
  private validateVesselDataFields(
    vesselData: ExtractedPdfData['vesselData'],
    parsedFields: ParsedField[]
  ): { totalFields: number; validFields: number } {
    let validFields = 0;
    
    // Required fields
    const requiredFields = [
      { name: 'vesselTagNumber', value: vesselData.vesselTagNumber },
      { name: 'designPressure', value: vesselData.designPressure },
      { name: 'designTemperature', value: vesselData.designTemperature },
      { name: 'materialSpec', value: vesselData.materialSpec },
      { name: 'insideDiameter', value: vesselData.insideDiameter }
    ];
    
    for (const field of requiredFields) {
      const validation = this.validateField(field.name, field.value, 'required');
      parsedFields.push(validation);
      if (validation.validationStatus === 'valid') validFields++;
    }
    
    // Use the validation engine for physical reasonableness checks
    if (vesselData.designPressure !== undefined) {
      const pressureResult = validateDesignPressure(vesselData.designPressure);
      if (pressureResult.status === 'failed') {
        const existing = parsedFields.find(f => f.fieldName === 'designPressure');
        if (existing) {
          existing.validationStatus = 'error';
          existing.validationMessages.push(pressureResult.message);
        }
      } else if (pressureResult.status === 'warning') {
        const existing = parsedFields.find(f => f.fieldName === 'designPressure');
        if (existing && existing.validationStatus === 'valid') {
          existing.validationStatus = 'warning';
          existing.validationMessages.push(pressureResult.message);
        }
      }
    }
    
    if (vesselData.designTemperature !== undefined) {
      const tempResult = validateDesignTemperature(vesselData.designTemperature);
      if (tempResult.status === 'failed') {
        const existing = parsedFields.find(f => f.fieldName === 'designTemperature');
        if (existing) {
          existing.validationStatus = 'error';
          existing.validationMessages.push(tempResult.message);
        }
      } else if (tempResult.status === 'warning') {
        const existing = parsedFields.find(f => f.fieldName === 'designTemperature');
        if (existing && existing.validationStatus === 'valid') {
          existing.validationStatus = 'warning';
          existing.validationMessages.push(tempResult.message);
        }
      }
    }
    
    // Joint efficiency validation
    if (vesselData.jointEfficiency !== undefined) {
      const jeValidation = this.validateField('jointEfficiency', vesselData.jointEfficiency, 'range', { min: 0.6, max: 1.0 });
      parsedFields.push(jeValidation);
      if (jeValidation.validationStatus === 'valid') validFields++;
    }
    
    return {
      totalFields: parsedFields.filter(f => f.fieldName.startsWith('vessel') || requiredFields.some(r => r.name === f.fieldName)).length,
      validFields
    };
  }
  
  /**
   * Validate thickness measurements
   */
  private validateThicknessMeasurements(
    measurements: ExtractedPdfData['thicknessMeasurements'],
    vesselData: ExtractedPdfData['vesselData'],
    parsedFields: ParsedField[]
  ): { totalReadings: number; validReadings: number } {
    let validReadings = 0;
    
    for (const measurement of measurements) {
      const fieldName = `tml_${measurement.cml}_thickness`;
      const field: ParsedField = {
        fieldName,
        rawValue: measurement.minThickness,
        parsedValue: measurement.minThickness,
        confidence: 0.9,
        sourceLocation: `TML ${measurement.cml}`,
        validationStatus: 'valid',
        validationMessages: []
      };
      
      // Validate using the validation engine
      const thicknessResult = validateThickness(measurement.minThickness, `TML ${measurement.cml}`);
      
      if (thicknessResult.status === 'failed') {
        field.validationStatus = 'error';
        field.validationMessages.push(thicknessResult.message);
      } else if (thicknessResult.status === 'warning') {
        field.validationStatus = 'warning';
        field.validationMessages.push(thicknessResult.message);
      }
      
      // Additional cross-checks
      if (measurement.nominalThickness !== undefined && measurement.minThickness > measurement.nominalThickness * 1.05) {
        field.validationStatus = 'warning';
        field.validationMessages.push(`Actual thickness ${measurement.minThickness}" exceeds nominal ${measurement.nominalThickness}" - verify data`);
      }
      
      if (measurement.previousThickness !== undefined && measurement.minThickness > measurement.previousThickness * 1.01) {
        field.validationStatus = 'warning';
        field.validationMessages.push(`Actual thickness ${measurement.minThickness}" exceeds previous ${measurement.previousThickness}" - possible measurement error`);
      }
      
      parsedFields.push(field);
      if (field.validationStatus === 'valid') validReadings++;
    }
    
    return {
      totalReadings: measurements.length,
      validReadings
    };
  }
  
  /**
   * Perform location matching for TML readings
   */
  private performLocationMatching(
    measurements: ExtractedPdfData['thicknessMeasurements'],
    existingLocations: TmlLocation[]
  ): MatchResult {
    // Convert measurements to TmlReading format
    const newReadings: TmlReading[] = measurements.map(m => {
      const parsed = parseCmlNamingConvention(m.cml);
      return {
        location: {
          cmlNumber: m.cml,
          componentType: this.inferComponentType(m.component),
          locationDescription: m.location || m.component,
          sliceNumber: parsed.sliceNumber ?? undefined,
          circumferentialPosition: parsed.circumferentialPosition ?? undefined
        },
        thickness: m.minThickness,
        thicknessUnit: 'inches',
        measurementDate: new Date()
      };
    });
    
    return matchTmlReadings(existingLocations, newReadings, {
      exactMatchThreshold: 0.95,
      fuzzyMatchThreshold: this.config.confidenceThreshold,
      allowCmlOnlyMatch: true
    });
  }
  
  /**
   * Validate nozzle data
   */
  private validateNozzles(
    nozzles: ExtractedPdfData['nozzles'],
    parsedFields: ParsedField[]
  ): { totalNozzles: number; validNozzles: number } {
    let validNozzles = 0;
    
    for (const nozzle of nozzles) {
      const field: ParsedField = {
        fieldName: `nozzle_${nozzle.nozzleNumber}`,
        rawValue: nozzle.actualThickness || null,
        parsedValue: nozzle,
        confidence: 0.85,
        sourceLocation: `Nozzle ${nozzle.nozzleNumber}`,
        validationStatus: 'valid',
        validationMessages: []
      };
      
      // Validate nozzle size
      if (nozzle.size !== undefined && (nozzle.size < 0.25 || nozzle.size > 48)) {
        field.validationStatus = 'warning';
        field.validationMessages.push(`Unusual nozzle size: ${nozzle.size}" (typical range 0.25"-48")`);
      }
      
      // Validate thickness if provided
      if (nozzle.actualThickness !== undefined) {
        if (nozzle.actualThickness < 0.01 || nozzle.actualThickness > 2.0) {
          field.validationStatus = 'warning';
          field.validationMessages.push(`Unusual nozzle thickness: ${nozzle.actualThickness}" (typical range 0.01"-2.0")`);
        }
        
        // Check against minimum required
        if (nozzle.minimumRequired !== undefined && nozzle.actualThickness < nozzle.minimumRequired) {
          field.validationStatus = 'error';
          field.validationMessages.push(`Nozzle thickness ${nozzle.actualThickness}" is below minimum required ${nozzle.minimumRequired}"`);
        }
      }
      
      parsedFields.push(field);
      if (field.validationStatus === 'valid') validNozzles++;
    }
    
    return {
      totalNozzles: nozzles.length,
      validNozzles
    };
  }
  
  /**
   * Validate a single field
   */
  private validateField(
    name: string,
    value: any,
    type: 'required' | 'range' | 'pattern',
    options?: { min?: number; max?: number; pattern?: RegExp }
  ): ParsedField {
    const field: ParsedField = {
      fieldName: name,
      rawValue: value,
      parsedValue: value,
      confidence: value !== undefined && value !== null ? 0.9 : 0,
      sourceLocation: 'Vessel Data',
      validationStatus: 'valid',
      validationMessages: []
    };
    
    if (type === 'required' && (value === undefined || value === null || value === '')) {
      field.validationStatus = 'error';
      field.validationMessages.push(`Required field '${name}' is missing`);
    }
    
    if (type === 'range' && value !== undefined && options) {
      if (options.min !== undefined && value < options.min) {
        field.validationStatus = 'error';
        field.validationMessages.push(`${name} value ${value} is below minimum ${options.min}`);
      }
      if (options.max !== undefined && value > options.max) {
        field.validationStatus = 'error';
        field.validationMessages.push(`${name} value ${value} exceeds maximum ${options.max}`);
      }
    }
    
    return field;
  }
  
  /**
   * Infer component type from component name
   */
  private inferComponentType(componentName: string): string {
    const lower = componentName.toLowerCase();
    
    if (lower.includes('shell') || lower.includes('body') || lower.includes('cylinder')) {
      return 'shell';
    }
    if (lower.includes('head')) {
      if (lower.includes('north') || lower.includes('top')) return 'north_head';
      if (lower.includes('south') || lower.includes('bottom')) return 'south_head';
      if (lower.includes('east')) return 'east_head';
      if (lower.includes('west')) return 'west_head';
      return 'head';
    }
    if (lower.includes('nozzle')) return 'nozzle';
    if (lower.includes('manway')) return 'manway';
    
    return 'unknown';
  }
}

// ============================================================================
// PARSER SELECTION ENGINE
// ============================================================================

export type ParserType = 'manus_llm' | 'docupipe' | 'manual';

export interface ParserSelectionResult {
  recommendedParser: ParserType;
  confidence: number;
  reasons: string[];
  fallbackParser?: ParserType;
}

/**
 * Select the best parser based on document characteristics
 */
export function selectParser(documentInfo: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  isScanned?: boolean;
  hasOcr?: boolean;
  pageCount?: number;
}): ParserSelectionResult {
  const reasons: string[] = [];
  let recommendedParser: ParserType = 'manus_llm';
  let confidence = 0.8;
  let fallbackParser: ParserType | undefined;
  
  // Check if it's a PDF
  if (!documentInfo.mimeType.includes('pdf')) {
    return {
      recommendedParser: 'manual',
      confidence: 0.5,
      reasons: ['Non-PDF document - manual entry recommended']
    };
  }
  
  // Text-based PDFs prefer Manus LLM
  if (!documentInfo.isScanned) {
    recommendedParser = 'manus_llm';
    confidence = 0.9;
    reasons.push('Text-based PDF detected - Manus LLM recommended for accurate extraction');
    fallbackParser = 'docupipe';
  }
  
  // Scanned documents may need OCR
  if (documentInfo.isScanned) {
    recommendedParser = 'docupipe';
    confidence = 0.75;
    reasons.push('Scanned document detected - Docupipe OCR recommended');
    fallbackParser = 'manus_llm';
  }
  
  // Large documents may need chunked processing
  if (documentInfo.pageCount && documentInfo.pageCount > 50) {
    confidence -= 0.1;
    reasons.push('Large document - may require chunked processing');
  }
  
  // File size considerations
  if (documentInfo.fileSize > 10 * 1024 * 1024) { // > 10MB
    confidence -= 0.1;
    reasons.push('Large file size - processing may take longer');
  }
  
  return {
    recommendedParser,
    confidence,
    reasons,
    fallbackParser
  };
}

// ============================================================================
// EXPORT DEFAULT INSTANCE
// ============================================================================

export const enhancedPdfParser = new EnhancedPdfParser();
