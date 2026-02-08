/**
 * Parser for Docupipe standardized API 510 inspection reports
 * Maps the standardized JSON format to our database schema
 */

export interface DocupipeStandardFormat {
  reportInfo: {
    reportNumber: string;
    reportDate: string;
    inspectionDate: string;
    inspectionType: string;
    inspectionCompany: string;
    inspector: {
      name: string;
      certificationNumber: string;
    };
  };
  clientInfo: {
    companyName: string;
    location: string;
  };
  vesselData: {
    tagNumber: string;
    location: string;
    product: string;
    yearBuilt: number;
    nbNumber: string;
    constructionCode: string;
    vesselConfiguration: string;
    designParameters: {
      mawp: number;
      mawpUnit: string;
      designTemperature: number;
      designTemperatureUnit: string;
      mdmt: number;
      mdmtUnit: string;
      operatingPressure: number;
      operatingPressureUnit: string;
      operatingTemperature: number;
      operatingTemperatureUnit: string;
    };
    materialType: string;
    dimensions: {
      insideDiameter: number;
      insideDiameterUnit: string;
      length: number;
      lengthUnit: string;
    };
    headType: string;
    insulationType: string;
  };
  executiveSummary: string;
  thicknessData: {
    summaryTable: Array<{
      component: string;
      nominalDesignThickness: number;
      actualMeasuredThickness: number;
      minimumRequiredThickness: number;
      designMAWP: number | null;
      calculatedMAWP: number;
      remainingLife: string;
      remainingLifeUnit: string;
    }>;
    thicknessReadings: Array<{
      legacyLocationId: string;
      componentId: string;
      location: string;
      actualThickness: number;
    }>;
  };
  inspectionChecklist?: Array<{
    category: string;
    itemNumber?: string;
    itemText: string;
    status: string;
    notes?: string;
    checkedBy?: string;
    checkedDate?: string;
  }>;
}

export interface ParsedInspectionData {
  // Vessel identification
  vesselTagNumber: string;
  vesselName?: string;
  manufacturer?: string;
  yearBuilt?: number;
  
  // Design specifications
  designPressure?: string;
  designTemperature?: string;
  operatingPressure?: string;
  materialSpec?: string;
  vesselType?: string;
  
  // Geometry
  insideDiameter?: string;
  overallLength?: string;
  
  // Additional metadata from Docupipe
  reportNumber?: string;
  reportDate?: string;
  inspectionDate?: string;
  inspectionType?: string;
  inspectionCompany?: string;
  inspectorName?: string;
  inspectorCert?: string;
  clientName?: string;
  clientLocation?: string;
  product?: string;
  nbNumber?: string;
  constructionCode?: string;
  vesselConfiguration?: string;
  headType?: string;
  insulationType?: string;
  executiveSummary?: string;
  
  // Thickness readings
  tmlReadings: Array<{
    legacyLocationId?: string;
    location: string;
    component: string;
    nominalThickness?: number;
    currentThickness: number;
    minimumRequired?: number;
    calculatedMAWP?: number;
  }>;
  
  // Checklist items
  checklistItems?: Array<{
    category: string;
    itemNumber?: string;
    itemText: string;
    checked: boolean;
    originalStatus?: string;
    notes?: string;
    checkedBy?: string;
    checkedDate?: string;
  }>;
}

/**
 * Parse Docupipe standardized format to our inspection data format
 */
export function parseDocupipeStandard(data: DocupipeStandardFormat): ParsedInspectionData {
  const vesselData = data.vesselData;
  const reportInfo = data.reportInfo;
  const clientInfo = data.clientInfo;
  
  // Map vessel data
  const result: ParsedInspectionData = {
    // Basic vessel info
    vesselTagNumber: vesselData.tagNumber,
    vesselName: vesselData.product,
    yearBuilt: vesselData.yearBuilt,
    
    // Design parameters
    designPressure: vesselData.designParameters.mawp?.toString(),
    designTemperature: vesselData.designParameters.designTemperature?.toString(),
    operatingPressure: vesselData.designParameters.operatingPressure?.toString(),
    materialSpec: vesselData.materialType,
    vesselType: vesselData.vesselConfiguration,
    
    // Dimensions
    insideDiameter: vesselData.dimensions.insideDiameter?.toString(),
    overallLength: (vesselData.dimensions.length / 12)?.toString(), // Convert inches to feet
    
    // Report metadata
    reportNumber: reportInfo.reportNumber,
    reportDate: reportInfo.reportDate,
    inspectionDate: reportInfo.inspectionDate,
    inspectionType: reportInfo.inspectionType,
    inspectionCompany: reportInfo.inspectionCompany,
    inspectorName: reportInfo.inspector.name,
    inspectorCert: reportInfo.inspector.certificationNumber,
    
    // Client info
    clientName: clientInfo.companyName,
    clientLocation: clientInfo.location,
    
    // Vessel details
    product: vesselData.product,
    nbNumber: vesselData.nbNumber,
    constructionCode: vesselData.constructionCode,
    vesselConfiguration: vesselData.vesselConfiguration,
    headType: vesselData.headType,
    insulationType: vesselData.insulationType,
    
    // Executive summary
    executiveSummary: data.executiveSummary,
    
    // Thickness readings - map from CML format
    tmlReadings: [],
  };
  
  // Map thickness readings from detailed CML data
  if (data.thicknessData?.thicknessReadings) {
    result.tmlReadings = data.thicknessData.thicknessReadings.map(reading => ({
      legacyLocationId: reading.legacyLocationId,
      location: reading.location,
      component: reading.componentId,
      currentThickness: reading.actualThickness,
    }));
  }
  
  // Add summary data for components (if detailed readings not available)
  if (data.thicknessData?.summaryTable && result.tmlReadings.length === 0) {
    result.tmlReadings = data.thicknessData.summaryTable.map((summary, index) => ({
      location: `Summary-${index + 1}`,
      component: summary.component,
      nominalThickness: summary.nominalDesignThickness,
      currentThickness: summary.actualMeasuredThickness,
      minimumRequired: summary.minimumRequiredThickness,
      calculatedMAWP: summary.calculatedMAWP,
    }));
  }
  
  // Map checklist items if present
  if (data.inspectionChecklist && data.inspectionChecklist.length > 0) {
    result.checklistItems = data.inspectionChecklist.map(item => ({
      category: item.category || 'General',
      itemNumber: item.itemNumber,
      itemText: item.itemText,
      checked: ['satisfactory', 'completed', 'yes', 'pass', 'ok', 'good'].includes(
        item.status?.toLowerCase()?.trim() || ''
      ),
      originalStatus: item.status, // Store original for review
      notes: item.notes,
      checkedBy: item.checkedBy,
      checkedDate: item.checkedDate,
    }));
  }
  
  return result;
}

