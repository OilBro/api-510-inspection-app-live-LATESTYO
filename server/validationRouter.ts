import { z } from "zod";
import { logger } from "./_core/logger";
import { protectedProcedure, router } from "./_core/trpc";
import { getInspection, getTmlReadings, getDb } from "./db";
import { getComponentCalculations, getProfessionalReportByInspection } from "./professionalReportDb";
import { extractionJobs, importedFiles } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ============================================================================
// Validation Router - Compare app calculations vs PDF original values
// Dynamically reads components from DB and auto-populates PDF values
// from extraction data (tableA) when pdfOriginal* columns are empty
// ============================================================================

export const validationRouter = router({
  // Get comparison data for an inspection
  getValidationData: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ input }) => {
      logger.info('[Validation] Getting validation data for inspection:', input.inspectionId);
      
      // Get inspection data
      const inspection = await getInspection(input.inspectionId);
      if (!inspection) {
        throw new Error('Inspection not found');
      }

      // Get professional report to get component calculations
      const professionalReport = await getProfessionalReportByInspection(input.inspectionId);
      if (!professionalReport) {
        throw new Error('Professional report not found for this inspection');
      }
      
      // Get component calculations (app-calculated values + PDF original values)
      const componentCalculations = await getComponentCalculations(professionalReport.id) as any[];
      
      // Get TML readings to calculate averages
      const tmlReadings = await getTmlReadings(input.inspectionId) as any[];

      // Try to get extraction data (tableA) for PDF original values fallback
      // The extractionJobs table doesn't have inspectionId, so we find the extraction
      // by looking at importedFiles for this inspection, then finding the extraction job
      // by matching the filename or by getting the most recent completed job for this user
      let extractionTableA: any[] = [];
      try {
        const db = await getDb();
        if (db) {
          // First try: get imported files for this inspection to find the extraction job
          const imported = await db
            .select()
            .from(importedFiles)
            .where(eq(importedFiles.inspectionId, input.inspectionId))
            .limit(1);
          
          let jobs: any[] = [];
          if (imported.length > 0) {
            // Find extraction job by matching filename
            jobs = await db
              .select()
              .from(extractionJobs)
              .where(eq(extractionJobs.filename, imported[0].fileName))
              .orderBy(desc(extractionJobs.createdAt))
              .limit(1);
          }
          
          if (jobs.length > 0 && jobs[0].extractedData) {
            const extractedData = typeof jobs[0].extractedData === 'string' 
              ? JSON.parse(jobs[0].extractedData) 
              : jobs[0].extractedData;
            // Handle both tableA formats: { components: [...] } or direct array
            const tableAData = extractedData?.tableA || extractedData?.data?.tableA;
            if (tableAData) {
              extractionTableA = Array.isArray(tableAData) 
                ? tableAData 
                : (tableAData.components || []);
            }
          }
        }
      } catch (err) {
        logger.warn('[Validation] Could not retrieve extraction data:', err);
      }

      // Build PDF original values from component calculations table
      // with fallback to extraction tableA data
      const pdfOriginalValues: Record<string, any> = {};
      
      // First, populate from pdfOriginal* columns in component_calculations
      componentCalculations.forEach((calc: any) => {
        if (calc.componentName) {
          pdfOriginalValues[calc.componentName] = {
            actualThickness: calc.pdfOriginalActualThickness ? parseFloat(calc.pdfOriginalActualThickness) : null,
            minimumThickness: calc.pdfOriginalMinimumThickness ? parseFloat(calc.pdfOriginalMinimumThickness) : null,
            mawp: calc.pdfOriginalCalculatedMAWP ? parseFloat(calc.pdfOriginalCalculatedMAWP) : null,
            corrosionRate: calc.pdfOriginalCorrosionRate ? parseFloat(calc.pdfOriginalCorrosionRate) : null,
            remainingLife: calc.pdfOriginalRemainingLife ? parseFloat(calc.pdfOriginalRemainingLife) : null,
            source: 'component_calculations',
          };
        }
      });

      // Fallback: if pdfOriginal values are all null, try to populate from extraction tableA
      const hasPdfFromCalcs = Object.values(pdfOriginalValues).some((v: any) =>
        v.actualThickness !== null || v.minimumThickness !== null || v.mawp !== null
      );

      if (!hasPdfFromCalcs && extractionTableA.length > 0) {
        extractionTableA.forEach((row: any) => {
          const compName = row.component || row.componentName || row.name || '';
          if (compName) {
            pdfOriginalValues[compName] = {
              actualThickness: parseFloatSafe(row.actualThickness || row.actual_thickness || row.tActual),
              minimumThickness: parseFloatSafe(row.minimumThickness || row.minimum_thickness || row.tMin || row.tRequired),
              mawp: parseFloatSafe(row.mawp || row.MAWP || row.calculatedMAWP),
              corrosionRate: parseFloatSafe(row.corrosionRate || row.corrosion_rate || row.cr),
              remainingLife: parseFloatSafe(row.remainingLife || row.remaining_life || row.rl),
              source: 'extraction_tableA',
            };
          }
        });
      }

      // DYNAMIC: Build component list from actual component_calculations in DB
      // instead of hardcoding ['Shell', 'East Head', 'West Head']
      const comparisonData = componentCalculations.map((calc: any) => {
        const componentName = calc.componentName || 'Unknown';

        const componentTMLs = tmlReadings.filter((tml: any) => {
          const tmlComp = (tml.componentType || '').toLowerCase();
          const calcComp = componentName.toLowerCase();
          return tmlComp.includes(calcComp) || calcComp.includes(tmlComp) ||
            matchComponentFuzzy(tmlComp, calcComp);
        });

        // Calculate actual thickness average from TML readings
        const actualThicknessAvg = componentTMLs.length > 0
          ? componentTMLs.reduce((sum: number, tml: any) => {
              const readings = [tml.tml1, tml.tml2, tml.tml3, tml.tml4].filter(v => v !== null && v !== undefined);
              const avg = readings.length > 0 
                ? readings.reduce((a: number, b: number) => (a || 0) + (b || 0), 0) / readings.length 
                : tml.actualThickness || 0;
              return sum + avg;
            }, 0) / componentTMLs.length
          : 0;

        // Get PDF original values for this component (try exact match, then fuzzy)
        let pdfValues = pdfOriginalValues[componentName] || {};
        if (!pdfValues.actualThickness && !pdfValues.minimumThickness && !pdfValues.mawp) {
          // Try fuzzy match against extraction tableA component names
          const fuzzyKey = Object.keys(pdfOriginalValues).find(k => 
            matchComponentFuzzy(k.toLowerCase(), componentName.toLowerCase())
          );
          if (fuzzyKey) {
            pdfValues = pdfOriginalValues[fuzzyKey];
          }
        }

        // App calculated values
        const appValues = {
          componentName,
          componentType: calc.componentType || 'shell',
          actualThickness: calc.actualThickness || actualThicknessAvg,
          minimumThickness: calc.minimumThickness || 0,
          mawp: calc.mawp || 0,
          corrosionRate: calc.corrosionRate || 0,
          corrosionRateLongTerm: calc.corrosionRateLongTerm || null,
          corrosionRateShortTerm: calc.corrosionRateShortTerm || null,
          governingRateType: calc.governingRateType || null,
          governingRateReason: calc.governingRateReason || null,
          dataQualityStatus: calc.dataQualityStatus || null,
          dataQualityNotes: calc.dataQualityNotes || null,
          remainingLife: calc.remainingLife || 0,
          nextInspectionDate: calc.nextInspectionDate,
          headType: calc.headType || null,
          nominalThickness: calc.nominalThickness || null,
        };

        // Calculate discrepancies
        const discrepancies = {
          actualThickness: calculateDiscrepancy(appValues.actualThickness, pdfValues.actualThickness),
          minimumThickness: calculateDiscrepancy(appValues.minimumThickness, pdfValues.minimumThickness),
          mawp: calculateDiscrepancy(appValues.mawp, pdfValues.mawp),
          corrosionRate: calculateDiscrepancy(appValues.corrosionRate, pdfValues.corrosionRate),
          remainingLife: calculateDiscrepancy(appValues.remainingLife, pdfValues.remainingLife),
        };

        return {
          componentName,
          componentType: calc.componentType || 'shell',
          appValues,
          pdfValues: {
            ...pdfValues,
            source: pdfValues.source || 'none',
          },
          discrepancies,
          status: getOverallStatus(discrepancies),
          tmlCount: componentTMLs.length,
        };
      });

      // Check if any PDF original values exist
      const hasPdfOriginalValues = Object.values(pdfOriginalValues).some((values: any) => 
        values.actualThickness !== null || 
        values.minimumThickness !== null || 
        values.mawp !== null
      );

      return {
        inspectionId: input.inspectionId,
        vesselTag: inspection.vesselTagNumber,
        inspectionDate: inspection.inspectionDate,
        comparisonData,
        hasPdfOriginalValues,
        pdfDataSource: hasPdfOriginalValues 
          ? (hasPdfFromCalcs ? 'component_calculations' : 'extraction_tableA')
          : 'none',
      };
    }),
});

// Helper: safely parse float values
function parseFloatSafe(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? null : num;
}

// Helper: fuzzy match component names
function matchComponentFuzzy(a: string, b: string): boolean {
  // Normalize both strings
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = normalize(a);
  const nb = normalize(b);
  
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  
  // Match common patterns: "shell" ↔ "shell", "east head" ↔ "easthead", "head1" ↔ "east head"
  const shellPatterns = ['shell', 'cylinder', 'body'];
  const headPatterns = ['head', 'cap', 'dish', 'dome'];
  
  const aIsShell = shellPatterns.some(p => na.includes(p));
  const bIsShell = shellPatterns.some(p => nb.includes(p));
  const aIsHead = headPatterns.some(p => na.includes(p));
  const bIsHead = headPatterns.some(p => nb.includes(p));
  
  if (aIsShell && bIsShell) return true;
  if (aIsHead && bIsHead) {
    // For heads, also check directional qualifiers
    const aDir = na.includes('east') || na.includes('1') || na.includes('left') ? 'east' :
                 na.includes('west') || na.includes('2') || na.includes('right') ? 'west' : '';
    const bDir = nb.includes('east') || nb.includes('1') || nb.includes('left') ? 'east' :
                 nb.includes('west') || nb.includes('2') || nb.includes('right') ? 'west' : '';
    if (!aDir || !bDir) return true; // If either has no direction, match any head
    return aDir === bDir;
  }
  
  return false;
}

// Helper function to calculate discrepancy percentage
function calculateDiscrepancy(appValue: number | null | undefined, pdfValue: number | null | undefined) {
  if (!appValue || !pdfValue) {
    return {
      absolute: 0,
      percentage: 0,
      status: 'unknown' as const,
    };
  }

  const absolute = Math.abs(appValue - pdfValue);
  const percentage = pdfValue !== 0 ? (absolute / Math.abs(pdfValue)) * 100 : 0;

  let status: 'match' | 'minor' | 'major' | 'unknown';
  if (percentage < 1) {
    status = 'match'; // Green: < 1% difference
  } else if (percentage < 5) {
    status = 'minor'; // Yellow: 1-5% difference
  } else {
    status = 'major'; // Red: > 5% difference
  }

  return {
    absolute,
    percentage,
    status,
    appValue,
    pdfValue,
  };
}

// Helper function to get overall component status
function getOverallStatus(discrepancies: Record<string, { status: string }>) {
  const statuses = Object.values(discrepancies).map(d => d.status);
  
  if (statuses.includes('major')) return 'major';
  if (statuses.includes('minor')) return 'minor';
  if (statuses.every(s => s === 'match')) return 'match';
  return 'unknown';
}
