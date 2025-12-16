import { eq, or, and } from "drizzle-orm";
import { logger } from "./_core/logger";
import { getDb } from "./db";
import {
  professionalReports,
  componentCalculations,
  inspectionFindings,
  recommendations,
  inspectionPhotos,
  appendixDocuments,
  checklistItems,
  ffsAssessments,
  inLieuOfAssessments,
  inspections,
  tmlReadings,
  InsertProfessionalReport,
  InsertComponentCalculation,
  InsertInspectionFinding,
  InsertRecommendation,
  InsertInspectionPhoto,
  InsertAppendixDocument,
  InsertChecklistItem,
} from "../drizzle/schema";
import { nanoid } from "nanoid";

// ============================================================================
// Professional Report CRUD
// ============================================================================

export async function createProfessionalReport(data: InsertProfessionalReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(professionalReports).values(data);
  return data.id;
}

export async function getProfessionalReport(reportId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(professionalReports)
    .where(eq(professionalReports.id, reportId))
    .limit(1);
  
  return result[0] || null;
}

export async function getProfessionalReportByInspection(inspectionId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(professionalReports)
    .where(eq(professionalReports.inspectionId, inspectionId))
    .limit(1);
  
  return result[0] || null;
}

export async function updateProfessionalReport(
  reportId: string,
  data: Partial<InsertProfessionalReport>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(professionalReports)
    .set(data)
    .where(eq(professionalReports.id, reportId));
}

// ============================================================================
// Component Calculations
// ============================================================================

export async function createComponentCalculation(data: InsertComponentCalculation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(componentCalculations).values(data);
  return data.id;
}

export async function getComponentCalculations(reportId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(componentCalculations)
    .where(eq(componentCalculations.reportId, reportId));
}

export async function updateComponentCalculation(
  calcId: string,
  data: Partial<InsertComponentCalculation>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(componentCalculations)
    .set(data)
    .where(eq(componentCalculations.id, calcId));
}

export async function deleteComponentCalculation(calcId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(componentCalculations)
    .where(eq(componentCalculations.id, calcId));
}

// ============================================================================
// Inspection Findings
// ============================================================================

export async function createInspectionFinding(data: InsertInspectionFinding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(inspectionFindings).values(data);
  return data.id;
}

/**
 * Get findings by Report ID OR Inspection ID
 * This fixes the issue where imported findings (linked to inspectionId) don't show up in the report
 */
export async function getInspectionFindings(reportId: string, inspectionId?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (inspectionId) {
    return await db
      .select()
      .from(inspectionFindings)
      .where(or(
        eq(inspectionFindings.reportId, reportId),
        eq(inspectionFindings.reportId, inspectionId) // Check if saved under inspectionId
      ));
  }
  
  return await db
    .select()
    .from(inspectionFindings)
    .where(eq(inspectionFindings.reportId, reportId));
}

export async function updateInspectionFinding(
  findingId: string,
  data: Partial<InsertInspectionFinding>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(inspectionFindings)
    .set(data)
    .where(eq(inspectionFindings.id, findingId));
}

// ============================================================================
// Recommendations
// ============================================================================

export async function createRecommendation(data: InsertRecommendation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(recommendations).values(data);
  return data.id;
}

/**
 * Get recommendations by Report ID OR Inspection ID
 */
export async function getRecommendations(reportId: string, inspectionId?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (inspectionId) {
    return await db
      .select()
      .from(recommendations)
      .where(or(
        eq(recommendations.reportId, reportId),
        eq(recommendations.reportId, inspectionId)
      ));
  }
  
  return await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.reportId, reportId));
}

export async function updateRecommendation(
  recommendationId: string,
  data: Partial<InsertRecommendation>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(recommendations)
    .set(data)
    .where(eq(recommendations.id, recommendationId));
}

// ============================================================================
// Photos
// ============================================================================

export async function createInspectionPhoto(data: InsertInspectionPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(inspectionPhotos).values(data);
  return data.id;
}

export async function getInspectionPhotos(reportId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(inspectionPhotos)
    .where(eq(inspectionPhotos.reportId, reportId));
}

export async function updateInspectionPhoto(photoId: string, data: Partial<InsertInspectionPhoto>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(inspectionPhotos)
    .set(data)
    .where(eq(inspectionPhotos.id, photoId));
}

export async function deleteInspectionPhoto(photoId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(inspectionPhotos)
    .where(eq(inspectionPhotos.id, photoId));
}

// ============================================================================
// Appendix Documents
// ============================================================================

export async function createAppendixDocument(data: InsertAppendixDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(appendixDocuments).values(data);
  return data.id;
}

export async function getAppendixDocuments(reportId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(appendixDocuments)
    .where(eq(appendixDocuments.reportId, reportId));
}

export async function deleteAppendixDocument(docId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(appendixDocuments)
    .where(eq(appendixDocuments.id, docId));
}

// ============================================================================
// Checklist Items
// ============================================================================

export async function createChecklistItem(data: InsertChecklistItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(checklistItems).values(data);
  return data.id;
}

export async function getChecklistItems(reportId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.reportId, reportId));
}

export async function updateChecklistItem(
  itemId: string,
  data: Partial<InsertChecklistItem>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(checklistItems)
    .set(data)
    .where(eq(checklistItems.id, itemId));
}

// ============================================================================
// Initialize Default Checklist
// ============================================================================

export async function initializeDefaultChecklist(reportId: string) {
  // Check if items already exist
  const existing = await getChecklistItems(reportId);
  if (existing.length > 0) return;

  const defaultItems: Omit<InsertChecklistItem, "id" | "reportId">[] = [
    // Foundation
    { category: "foundation", itemNumber: "3.1.1", itemText: "Vessel foundation supports attached and in satisfactory condition", sequenceNumber: 1, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "foundation", itemNumber: "3.1.2", itemText: "Supports coating in satisfactory condition", sequenceNumber: 2, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    
    // Shell
    { category: "shell", itemNumber: "3.2.1", itemText: "Shell material and coating condition", sequenceNumber: 3, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "shell", itemNumber: "3.2.2", itemText: "External surface profile smooth and clean", sequenceNumber: 4, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "shell", itemNumber: "3.2.3", itemText: "Exposed surface profile relatively smooth with no significant oxidation", sequenceNumber: 5, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "shell", itemNumber: "3.2.4", itemText: "Longitudinal and circumferential welds in satisfactory condition", sequenceNumber: 6, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "shell", itemNumber: "3.2.5", itemText: "Shell nozzle penetration welds in satisfactory condition", sequenceNumber: 7, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    
    // Heads
    { category: "heads", itemNumber: "3.3.1", itemText: "Head material and condition", sequenceNumber: 8, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "heads", itemNumber: "3.3.2", itemText: "Head-to-shell welds in satisfactory condition", sequenceNumber: 9, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "heads", itemNumber: "3.3.3", itemText: "Head nozzle penetrations in satisfactory condition", sequenceNumber: 10, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    
    // Appurtenances
    { category: "appurtenances", itemNumber: "3.4.1", itemText: "Nozzles and flanges in satisfactory condition", sequenceNumber: 11, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "appurtenances", itemNumber: "3.4.2", itemText: "Manways and access openings in satisfactory condition", sequenceNumber: 12, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "appurtenances", itemNumber: "3.4.3", itemText: "Support lugs and attachments in satisfactory condition", sequenceNumber: 13, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
    { category: "appurtenances", itemNumber: "3.4.4", itemText: "Piping connections and valves in satisfactory condition", sequenceNumber: 14, checked: false, status: "not_checked", createdAt: new Date(), updatedAt: new Date() },
  ];
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const item of defaultItems) {
    await createChecklistItem({
      id: nanoid(),
      reportId,
      ...item,
    });
  }
}



export async function deleteInspectionFinding(findingId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(inspectionFindings)
    .where(eq(inspectionFindings.id, findingId));
}

export async function deleteRecommendation(recommendationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(recommendations)
    .where(eq(recommendations.id, recommendationId));
}


// ============================================================================
// Auto-Generate Calculations (Shared Logic)
// ============================================================================

export async function generateDefaultCalculationsForInspection(inspectionId: string, reportId: string) {
  const db = await getDb();
  if (!db) return;

  // Get inspection details
  const inspectionResult = await db.select().from(inspections).where(eq(inspections.id, inspectionId)).limit(1);
  const inspection = inspectionResult[0];
  if (!inspection) return;

  // Get TML readings
  const tmlResults = await db.select().from(tmlReadings).where(eq(tmlReadings.inspectionId, inspectionId));
  
  // Clear existing calculations to prevent duplicates
  await db.delete(componentCalculations).where(eq(componentCalculations.reportId, reportId));

  // Helper: Create Calculation
  const createCalc = async (type: 'shell' | 'head', name: string, keyword: string) => {
    // Filter TMLs for this component with improved head detection
    // IMPORTANT: Check component, componentType, AND location fields
    const relevantTMLs = tmlResults.filter(t => {
      const compType = (t.componentType || '').toLowerCase();
      const comp = (t.component || '').toLowerCase();
      const loc = (t.location || '').toLowerCase();
      
      if (keyword === 'shell') {
        // Shell: match 'shell' but exclude heads
        return (compType.includes('shell') || comp.includes('shell')) && 
               !compType.includes('head') && !comp.includes('head') &&
               !loc.includes('head');
      } else if (keyword === 'east') {
        // East Head: match 'east head', 'e head', 'head 1', 'head-1', 'left head'
        // Also check location field for 'east head'
        if (compType.includes('east') || comp.includes('east') || loc.includes('east head')) return true;
        if (compType.includes('e head') || comp.includes('e head')) return true;
        if (compType.includes('head 1') || comp.includes('head 1')) return true;
        if (compType.includes('head-1') || comp.includes('head-1')) return true;
        if (compType.includes('left head') || comp.includes('left head')) return true;
        // If only one head mentioned and it's the first occurrence (exclude west)
        if ((compType.includes('head') || comp.includes('head')) && 
            !compType.includes('west') && !comp.includes('west') &&
            !compType.includes('w head') && !comp.includes('w head') &&
            !compType.includes('right') && !comp.includes('right') &&
            !loc.includes('west')) return true;
        return false;
      } else if (keyword === 'west') {
        // West Head: match 'west head', 'w head', 'head 2', 'head-2', 'right head'
        // Also check location field for 'west head'
        if (compType.includes('west') || comp.includes('west') || loc.includes('west head')) return true;
        if (compType.includes('w head') || comp.includes('w head')) return true;
        if (compType.includes('head 2') || comp.includes('head 2')) return true;
        if (compType.includes('head-2') || comp.includes('head-2')) return true;
        if (compType.includes('right head') || comp.includes('right head')) return true;
        return false;
      }
      return compType.includes(keyword) || comp.includes(keyword);
    });
    
    // Determine thicknesses (MINIMUM of relevant TMLs for conservative API 510 calculations)
    const validCurrent = relevantTMLs.map(t => parseFloat(t.tActual || t.currentThickness || '0')).filter(v => v > 0);
    const validPrev = relevantTMLs.map(t => parseFloat(t.previousThickness || '0')).filter(v => v > 0);
    const validNominal = relevantTMLs.map(t => parseFloat(t.nominalThickness || '0')).filter(v => v > 0);
    
    // Use MINIMUM thickness (most conservative for safety calculations)
    const avgCurrent = validCurrent.length ? Math.min(...validCurrent) : (type === 'shell' ? 0.652 : 0.555);
    // For previous/nominal: prefer actual previous readings, then nominal, then defaults
    const avgPrev = validPrev.length ? Math.min(...validPrev) : 
                    (validNominal.length ? Math.min(...validNominal) : (type === 'shell' ? 0.625 : 0.500));
    const avgNominal = validNominal.length ? Math.min(...validNominal) : avgPrev;
    
    // Default design params
    const P = parseFloat(inspection.designPressure || '250');
    const D = parseFloat(inspection.insideDiameter || '70.75');
    const R = D / 2;
    const S = parseFloat(inspection.allowableStress || '20000');
    const E = parseFloat(inspection.jointEfficiency || '0.85');
    
    // Calculate static head pressure for horizontal vessels
    // P_static = (ρ × g × h) / 144 where ρ = specific gravity × 62.4 lb/ft³, g = 1, h = vessel height in inches
    let staticHead = 0;
    const vesselConfig = inspection.vesselConfiguration?.toLowerCase() || 'horizontal';
    if (vesselConfig.includes('horizontal')) {
      // Use inspection-specific gravity if available, otherwise default to 0.92 (methylchloride)
      // Common values: Water = 1.0, Methylchloride = 0.92, Gasoline = 0.72
      const specificGravity = inspection.specificGravity ? parseFloat(inspection.specificGravity.toString()) : 0.92;
      const heightInches = D; // For horizontal vessel, height = diameter
      const heightFeet = heightInches / 12;
      const density = specificGravity * 62.4; // lb/ft³
      staticHead = (density * heightFeet) / 144; // Convert to psi
    }
    
    // Total design pressure including static head
    const totalP = P + staticHead;
    
    // Calculate Min Thickness using total pressure (design + static head)
    let tMin = 0;
    let headTypeUsed = 'ellipsoidal'; // Default
    let headFactor = null;
    
    if (type === 'shell') {
      tMin = (totalP * R) / (S * E - 0.6 * totalP);
    } else {
      // Head calculation - detect head type
      const headTypeStr = (inspection.headType || '').toLowerCase();
      
      if (headTypeStr.includes('torispherical')) {
        // Torispherical Head: t = PLM / (2SE - 0.2P)
        headTypeUsed = 'torispherical';
        
        // Get crown radius (L) and knuckle radius (r) from inspection
        // Common defaults: L = D (inside diameter), r = 0.06D (6% of diameter)
        const L = parseFloat(inspection.crownRadius as any) || D;
        const r = parseFloat(inspection.knuckleRadius as any) || (0.06 * D);
        
        // Calculate M factor: M = 0.25 * (3 + sqrt(L/r))
        const M = 0.25 * (3 + Math.sqrt(L / r));
        headFactor = M;
        
        tMin = (totalP * L * M) / (2 * S * E - 0.2 * totalP);
        
        logger.info(`[Calc] Torispherical head: L=${L.toFixed(2)}, r=${r.toFixed(2)}, M=${M.toFixed(4)}, t_min=${tMin.toFixed(4)}`);
      } else if (headTypeStr.includes('hemispherical')) {
        // Hemispherical Head: t = PR / (2SE - 0.2P)
        headTypeUsed = 'hemispherical';
        tMin = (totalP * R) / (2 * S * E - 0.2 * totalP);
      } else {
        // Default: 2:1 Ellipsoidal Head: t = PD / (2SE - 0.2P)
        headTypeUsed = 'ellipsoidal';
        tMin = (totalP * D) / (2 * S * E - 0.2 * totalP);
      }
    }
    
    const tMinStr = tMin.toFixed(4);
    const CA = (avgCurrent - tMin).toFixed(3);
    
    // Calculate time between inspections from dates (if available)
    let yearsBetween = 10; // Default assumption
    if (inspection.inspectionDate && inspection.previousInspectionId) {
      try {
        const prevInspectionResult = await db.select().from(inspections)
          .where(eq(inspections.id, inspection.previousInspectionId)).limit(1);
        if (prevInspectionResult[0]?.inspectionDate) {
          const current = new Date(inspection.inspectionDate);
          const previous = new Date(prevInspectionResult[0].inspectionDate);
          const diffMs = current.getTime() - previous.getTime();
          yearsBetween = diffMs / (1000 * 60 * 60 * 24 * 365.25);
          logger.info(`[Calc] Time between inspections: ${yearsBetween.toFixed(2)} years`);
        }
      } catch (e) {
        logger.error('[Calc] Error fetching previous inspection date:', e);
      }
    }
    
    const CR = validPrev.length ? ((avgPrev - avgCurrent) / yearsBetween).toFixed(6) : '0.00000';
    let RL: string;
    if (parseFloat(CR) > 0) {
      const calculatedRL = parseFloat(CA) / parseFloat(CR);
      RL = calculatedRL > 20 ? '20.00' : calculatedRL.toFixed(2);
    } else {
      RL = '20.00'; // Use 20.00 instead of >20 for database compatibility
    }
    
    // Calculate MAWP at current thickness
    // Per ASME VIII-1 UG-27(c), evaluate BOTH stress cases and use minimum
    let calculatedMAWP = 0;
    if (type === 'shell') {
      // UG-27(c)(1): Circumferential (hoop) stress: P = S*E*t / (R + 0.6*t)
      const P_hoop = (S * E * avgCurrent) / (R + 0.6 * avgCurrent);
      
      // UG-27(c)(2): Longitudinal stress: P = 2*S*E*t / (R - 0.4*t)
      const denom_long = R - 0.4 * avgCurrent;
      const P_long = denom_long > 0 ? (2 * S * E * avgCurrent) / denom_long : P_hoop;
      
      // Use minimum (governing) MAWP, then subtract static head
      calculatedMAWP = Math.min(P_hoop, P_long) - staticHead;
    } else {
      // Head MAWP calculations per ASME UG-32
      if (headTypeUsed === 'torispherical' && headFactor) {
        // Torispherical: MAWP = (2 × S × E × t) / (L × M + 0.2t) - static head
        const L = parseFloat(inspection.crownRadius as any) || D;
        calculatedMAWP = (2 * S * E * avgCurrent) / (L * headFactor + 0.2 * avgCurrent) - staticHead;
      } else if (headTypeUsed === 'hemispherical') {
        // Hemispherical: MAWP = (2 × S × E × t) / (R + 0.2t) - static head
        calculatedMAWP = (2 * S * E * avgCurrent) / (R + 0.2 * avgCurrent) - staticHead;
      } else {
        // Ellipsoidal (2:1): MAWP = (2 × S × E × t) / (D + 0.2t) - static head
        calculatedMAWP = (2 * S * E * avgCurrent) / (D + 0.2 * avgCurrent) - staticHead;
      }
    }
    const calculatedMAWPStr = calculatedMAWP.toFixed(2);
    
    // Check if component is below minimum thickness
    const isBelowMinimum = avgCurrent < parseFloat(tMinStr);
    const dataQualityStatus = isBelowMinimum ? 'below_minimum' : 'good';
    const dataQualityNotes = isBelowMinimum 
      ? `Component thickness (${avgCurrent.toFixed(4)}") is below minimum required (${tMinStr}"). Immediate attention required.`
      : null;
    
    // API 510 requirement: Next inspection at lesser of 10 years OR 1/2 remaining life
    let nextInspectionYears = '10.00';
    if (RL !== '>20') {
      const remainingLifeNum = parseFloat(RL);
      const halfLife = remainingLifeNum / 2;
      nextInspectionYears = Math.min(10, halfLife).toFixed(2);
    }

    await createComponentCalculation({
      id: nanoid(),
      reportId,
      componentName: name,
      componentType: type,
      materialCode: inspection.materialSpec || 'SA-516-70',
      designMAWP: inspection.designPressure || '250',
      designTemp: inspection.designTemperature || '200',
      insideDiameter: inspection.insideDiameter || '70.75',
      allowableStress: inspection.allowableStress || '20000',
      jointEfficiency: inspection.jointEfficiency || '0.85',
      staticHead: staticHead.toFixed(2),
      headType: type === 'head' ? headTypeUsed : null,
      headFactor: headFactor ? headFactor.toFixed(4) : null,
      crownRadius: type === 'head' && inspection.crownRadius ? parseFloat(inspection.crownRadius as any).toFixed(3) : null,
      knuckleRadius: type === 'head' && inspection.knuckleRadius ? parseFloat(inspection.knuckleRadius as any).toFixed(3) : null,
      nominalThickness: avgNominal.toFixed(3),
      previousThickness: avgPrev.toFixed(3),
      actualThickness: avgCurrent.toFixed(3),
      minimumThickness: tMinStr,
      corrosionAllowance: CA,
      corrosionRate: CR,
      remainingLife: RL,
      calculatedMAWP: calculatedMAWPStr,
      nextInspectionYears: nextInspectionYears,
      dataQualityStatus: dataQualityStatus as any,
      dataQualityNotes: dataQualityNotes,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  // Generate 3 standard components
  await createCalc('shell', 'Vessel Shell', 'shell');
  await createCalc('head', 'East Head', 'east');
  await createCalc('head', 'West Head', 'west');
  
  logger.info('[Calculations] Generated default calculations for report', reportId);
}

// ============================================================================
// FFS Assessment CRUD
// ============================================================================

export async function createFfsAssessment(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(ffsAssessments).values(data);
  return data.id;
}

export async function getFfsAssessmentsByInspection(inspectionId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(ffsAssessments)
    .where(eq(ffsAssessments.inspectionId, inspectionId));
}

export async function updateFfsAssessment(id: string, data: Partial<any>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(ffsAssessments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(ffsAssessments.id, id));
}

export async function deleteFfsAssessment(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(ffsAssessments).where(eq(ffsAssessments.id, id));
}

// ============================================================================
// In-Lieu-Of Assessment CRUD
// ============================================================================

export async function createInLieuOfAssessment(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(inLieuOfAssessments).values(data);
  return data.id;
}

export async function getInLieuOfAssessmentsByInspection(inspectionId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(inLieuOfAssessments)
    .where(eq(inLieuOfAssessments.inspectionId, inspectionId));
}

export async function updateInLieuOfAssessment(id: string, data: Partial<any>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(inLieuOfAssessments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(inLieuOfAssessments.id, id));
}

export async function deleteInLieuOfAssessment(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(inLieuOfAssessments).where(eq(inLieuOfAssessments.id, id));
}
