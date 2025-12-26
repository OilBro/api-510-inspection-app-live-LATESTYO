import { COOKIE_NAME } from "@shared/const";
import { logger } from "./_core/logger";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { nanoid } from "nanoid";
import { parseExcelFile, parsePDFFile } from "./fileParser";
import { storagePut } from "./storage";
import { fieldMappingRouter, unmatchedDataRouter } from "./fieldMappingRouters";
import { professionalReportRouter } from "./professionalReportRouters";
import { nozzleRouter } from "./nozzleRouters";
import { reportComparisonRouter } from "./routers/reportComparisonRouter";
import { pdfImportRouter } from "./routers/pdfImportRouter";
import { validationRouter } from "./validationRouter";
import { materialStressRouter } from "./materialStressRouter";
import { validationWarningsRouter } from "./validationWarningsRouter";
import { anomalyRouter } from "./anomalyRouter";
import { actionPlanRouter } from "./actionPlanRouter";
import { trendAnalysisRouter } from "./trendAnalysisRouter";
import { hierarchyRouter } from "./hierarchyRouter";
import { batchReprocessRouter } from "./routers/batchReprocessRouter";
import { convertToJpeg } from "./_core/freeconvert";
import * as fieldMappingDb from "./fieldMappingDb";
import * as professionalReportDb from "./professionalReportDb";
import { consolidateTMLReadings } from "./cmlDeduplication";
import { organizeReadingsByComponent, getFullComponentName } from "./componentOrganizer";

/**
 * Calculate time span in years between two dates
 * @param previousDate - Previous inspection date
 * @param currentDate - Current inspection date
 * @param defaultYears - Default value if dates are invalid
 * @returns Time span in years
 */
function calculateTimeSpanYears(
  previousDate: Date | string | null | undefined,
  currentDate: Date | string | null | undefined,
  defaultYears: number = 10
): number {
  if (!previousDate || !currentDate) return defaultYears;
  
  const prev = new Date(previousDate);
  const curr = new Date(currentDate);
  
  if (isNaN(prev.getTime()) || isNaN(curr.getTime())) return defaultYears;
  
  const diffMs = curr.getTime() - prev.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  
  return diffYears > 0 ? diffYears : defaultYears;
}

export const appRouter = router({
  system: systemRouter,
  pdfImport: pdfImportRouter,
  materialStress: materialStressRouter,
  validationWarnings: validationWarningsRouter,
  anomalies: anomalyRouter,
  actionPlans: actionPlanRouter,
  trendAnalysis: trendAnalysisRouter,
  hierarchy: hierarchyRouter,
  batchReprocess: batchReprocessRouter,

  images: router({
    convertToJpeg: protectedProcedure
      .input(z.object({
        sourceUrl: z.string().url(),
        outputFilename: z.string().optional(),
        backgroundColor: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        quality: z.number().min(1).max(100).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await convertToJpeg(input);
        return result;
      }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  inspections: router({
      // Get original uploaded PDF for an inspection
  getOriginalPdf: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await import('./db');
      
      // Get inspection to verify ownership
      const inspection = await db.getInspection(input.inspectionId);
      if (!inspection) {
        throw new Error('Inspection not found');
      }
      
      if (inspection.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }
      
      // Get imported files for this inspection
      const files = await db.getInspectionImportedFiles(input.inspectionId);
      
      // Find the first PDF file
      const pdfFile = files.find((f: any) => f.fileType === 'pdf' || f.fileName?.endsWith('.pdf'));
      
      if (!pdfFile) {
        return null;
      }
      
      return {
        url: pdfFile.fileUrl,
        fileName: pdfFile.fileName,
      };
    }),

  // Get all inspections for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
      const db = await import('./db');
      return await db.getUserInspections(ctx.user.id);
    }),

    // Get a single inspection by ID
    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return await db.getInspection(input.id);
      }),

    // Create a new inspection
    create: protectedProcedure
      .input(z.object({
        vesselTagNumber: z.string(),
        vesselName: z.string().optional(),
        manufacturer: z.string().optional(),
        serialNumber: z.string().optional(),
        yearBuilt: z.number().optional(),
        designPressure: z.string().optional(),
        designTemperature: z.string().optional(),
        operatingPressure: z.string().optional(),
        materialSpec: z.string().optional(),
        allowableStress: z.string().optional(),
        jointEfficiency: z.string().optional(),
        radiographyType: z.string().optional(),
        specificGravity: z.string().optional(),
        vesselType: z.string().optional(),
        insideDiameter: z.string().optional(),
        overallLength: z.string().optional(),
        inspectionDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { inspectionDate, ...restInput } = input;
        const inspection = {
          id: nanoid(),
          userId: ctx.user.id,
          ...restInput,
          ...(inspectionDate ? { inspectionDate: new Date(inspectionDate) } : {}),
          status: "draft" as const,
        };
        await db.createInspection(inspection);
        return inspection;
      }),

    // Update an inspection
    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        vesselTagNumber: z.string().optional(),
        vesselName: z.string().optional(),
        manufacturer: z.string().optional(),
        serialNumber: z.string().optional(),
        yearBuilt: z.number().optional(),
        designPressure: z.string().optional(),
        designTemperature: z.string().optional(),
        operatingPressure: z.string().optional(),
        materialSpec: z.string().optional(),
        allowableStress: z.string().optional(),
        jointEfficiency: z.string().optional(),
        radiographyType: z.string().optional(),
        specificGravity: z.string().optional(),
        vesselType: z.string().optional(),
        insideDiameter: z.string().optional(),
        overallLength: z.string().optional(),
        status: z.enum(["draft", "in_progress", "completed", "archived"]).optional(),
        inspectionDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, inspectionDate, ...data } = input;
        const updateData = {
          ...data,
          ...(inspectionDate ? { inspectionDate: new Date(inspectionDate) } : {}),
        };
        await db.updateInspection(id, updateData);
        return { success: true };
      }),

    // Delete an inspection
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteInspection(input.id);
        return { success: true };
      }),
  }),

  calculations: router({
    // Get calculations for an inspection
    get: protectedProcedure
      .input(z.object({ inspectionId: z.string() }))
      .query(async ({ input }) => {
        return await db.getCalculation(input.inspectionId);
      }),

    // Save calculation results
    save: protectedProcedure
      .input(z.object({
        inspectionId: z.string(),
        // Minimum thickness fields
        minThicknessDesignPressure: z.string().optional(),
        minThicknessInsideRadius: z.string().optional(),
        minThicknessAllowableStress: z.string().optional(),
        minThicknessJointEfficiency: z.string().optional(),
        minThicknessCorrosionAllowance: z.string().optional(),
        minThicknessResult: z.string().optional(),
        // MAWP fields
        mawpActualThickness: z.string().optional(),
        mawpInsideRadius: z.string().optional(),
        mawpAllowableStress: z.string().optional(),
        mawpJointEfficiency: z.string().optional(),
        mawpCorrosionAllowance: z.string().optional(),
        mawpResult: z.string().optional(),
        // Remaining life fields
        remainingLifeCurrentThickness: z.string().optional(),
        remainingLifeRequiredThickness: z.string().optional(),
        remainingLifeCorrosionRate: z.string().optional(),
        remainingLifeSafetyFactor: z.string().optional(),
        remainingLifeResult: z.string().optional(),
        remainingLifeNextInspection: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Check if calculation exists
        const existing = await db.getCalculation(input.inspectionId);
        
        if (existing) {
          // Update existing
          await db.updateCalculation(existing.id, input);
          return { success: true, id: existing.id };
        } else {
          // Create new
          const calculation = {
            id: nanoid(),
            ...input,
          };
          await db.saveCalculation(calculation);
          return { success: true, id: calculation.id };
        }
      }),
  }),

  tmlReadings: router({
    // Get all TML readings for an inspection
    list: protectedProcedure
      .input(z.object({ inspectionId: z.string() }))
      .query(async ({ input }) => {
        return await db.getTmlReadings(input.inspectionId);
      }),

    // Get TML readings organized by component
    listOrganized: protectedProcedure
      .input(z.object({ inspectionId: z.string() }))
      .query(async ({ input }) => {
        const readings = await db.getTmlReadings(input.inspectionId);
        return organizeReadingsByComponent(readings);
      }),

    // Create a new TML reading
    create: protectedProcedure
      .input(z.object({
        inspectionId: z.string(),
        // New grid-based fields
        cmlNumber: z.string(),
        componentType: z.string(),
        location: z.string(),
        service: z.string().optional(),
        tml1: z.string().optional(),
        tml2: z.string().optional(),
        tml3: z.string().optional(),
        tml4: z.string().optional(),
        // Legacy fields for backward compatibility
        tmlId: z.string().optional(),
        component: z.string().optional(),
        currentThickness: z.string().optional(),
        previousThickness: z.string().optional(),
        nominalThickness: z.string().optional(),
        loss: z.string().optional(),
        corrosionRate: z.string().optional(),
        status: z.enum(["good", "monitor", "critical"]).optional(),
      }))
      .mutation(async ({ input }) => {
        // Auto-calculate loss and corrosion rate
        let calculatedLoss: string | undefined = input.loss;
        let calculatedCorrosionRate: string | undefined = input.corrosionRate;
        
        const current = input.currentThickness ? parseFloat(input.currentThickness) : null;
        const previous = input.previousThickness ? parseFloat(input.previousThickness) : null;
        const nominal = input.nominalThickness ? parseFloat(input.nominalThickness) : null;
        
        // Calculate loss percentage: (Nominal - Current) / Nominal * 100
        if (nominal && current && nominal > 0) {
          const lossPercent = ((nominal - current) / nominal) * 100;
          calculatedLoss = lossPercent.toFixed(2);
        }
        
        // Calculate corrosion rate in mpy (mils per year)
        // Use actual time interval from inspection dates
        if (previous && current) {
          // Note: TML readings don't have inspection dates in input
          // Time span calculation happens at inspection level
          const timeSpanYears = 1; // Default for TML-level calculations
          
          const thicknessLoss = previous - current;
          const corrosionRateMpy = (thicknessLoss / timeSpanYears) * 1000; // Convert inches to mils
          calculatedCorrosionRate = corrosionRateMpy.toFixed(2);
        }
        
        const reading = {
          id: nanoid(),
          ...input,
          loss: calculatedLoss,
          corrosionRate: calculatedCorrosionRate,
        };
        await db.createTmlReading(reading);
        return reading;
      }),

    // Update a TML reading
    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        // New grid-based fields
        cmlNumber: z.string().optional(),
        componentType: z.string().optional(),
        location: z.string().optional(),
        service: z.string().optional(),
        tml1: z.string().optional(),
        tml2: z.string().optional(),
        tml3: z.string().optional(),
        tml4: z.string().optional(),
        // Legacy fields for backward compatibility
        tmlId: z.string().optional(),
        component: z.string().optional(),
        currentThickness: z.string().optional(),
        previousThickness: z.string().optional(),
        nominalThickness: z.string().optional(),
        loss: z.string().optional(),
        corrosionRate: z.string().optional(),
        status: z.enum(["good", "monitor", "critical"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        
        // Get existing reading to merge values for calculation
        const existingReadings = await db.getTmlReadings('');
        const existing = existingReadings.find(r => r.id === id);
        
        // Merge existing and new values
        const current = data.currentThickness ? parseFloat(data.currentThickness) : 
                       (existing?.currentThickness ? parseFloat(String(existing.currentThickness)) : null);
        const previous = data.previousThickness ? parseFloat(data.previousThickness) : 
                        (existing?.previousThickness ? parseFloat(String(existing.previousThickness)) : null);
        const nominal = data.nominalThickness ? parseFloat(data.nominalThickness) : 
                       (existing?.nominalThickness ? parseFloat(String(existing.nominalThickness)) : null);
        
        // Auto-calculate loss and corrosion rate if not explicitly provided
        let calculatedLoss = data.loss;
        let calculatedCorrosionRate = data.corrosionRate;
        
        // Calculate loss in inches: Nominal - Current
        let calculatedLossPercent;
        if (!calculatedLoss && nominal !== null && current !== null) {
          const lossInches = nominal - current;
          calculatedLoss = lossInches.toFixed(4);
          
          // Also calculate percentage
          if (nominal > 0) {
            const lossPercent = (lossInches / nominal) * 100;
            calculatedLossPercent = lossPercent.toFixed(2);
          }
        }
        
        // Calculate corrosion rate in mpy (mils per year)
        if (!calculatedCorrosionRate && previous && current) {
          let timeSpanYears = 1; // Default to 1 year if dates not available
          
          // Calculate time span from inspection dates
          const prevDate = existing?.previousInspectionDate;
          const currDate = existing?.currentInspectionDate;
          
          if (prevDate && currDate) {
            const prevTime = new Date(prevDate).getTime();
            const currTime = new Date(currDate).getTime();
            const diffMs = currTime - prevTime;
            const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
            if (diffYears > 0) {
              timeSpanYears = diffYears;
            }
          }
          
          const thicknessLoss = previous - current;
          const corrosionRateMpy = (thicknessLoss / timeSpanYears) * 1000;
          calculatedCorrosionRate = corrosionRateMpy.toFixed(2);
        }
        
        // Auto-calculate status if not provided
        let calculatedStatus = data.status;
        if (!calculatedStatus && current !== null && nominal !== null) {
          // Get inspection data for status calculation
          const inspection = await db.getInspection(existing?.inspectionId || '');
          if (inspection && inspection.designPressure && inspection.insideDiameter && 
              inspection.materialSpec && inspection.designTemperature) {
            const { calculateTMLStatus } = require('./tmlStatusCalculator');
            try {
              calculatedStatus = calculateTMLStatus({
                currentThickness: current,
                nominalThickness: nominal,
                designPressure: parseFloat(String(inspection.designPressure)),
                insideDiameter: parseFloat(String(inspection.insideDiameter)),
                materialSpec: String(inspection.materialSpec),
                designTemperature: parseFloat(String(inspection.designTemperature)),
                corrosionAllowance: undefined, // Optional: defaults to 0.125 in calculateTMLStatus
                jointEfficiency: inspection.jointEfficiency ? parseFloat(String(inspection.jointEfficiency)) : undefined
              });
            } catch (error) {
              logger.error('[TML Update] Status calculation failed:', error);
            }
          }
        }
        
        const updateData = {
          ...data,
          loss: calculatedLoss,
          lossPercent: calculatedLossPercent,
          corrosionRate: calculatedCorrosionRate,
          status: calculatedStatus,
        };
        
        await db.updateTmlReading(id, updateData);
        return { success: true };
      }),

    // Delete a TML reading
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteTmlReading(input.id);
        return { success: true };
      }),
  }),

  externalInspection: router({
    // Get external inspection data
    get: protectedProcedure
      .input(z.object({ inspectionId: z.string() }))
      .query(async ({ input }) => {
        return await db.getExternalInspection(input.inspectionId);
      }),

    // Save external inspection data
    save: protectedProcedure
      .input(z.object({
        inspectionId: z.string(),
        visualCondition: z.string().optional(),
        corrosionObserved: z.boolean().optional(),
        damageMechanism: z.string().optional(),
        findings: z.string().optional(),
        recommendations: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getExternalInspection(input.inspectionId);
        
        if (existing) {
          // FIX: Now actually updating!
          await db.updateExternalInspection(existing.id, {
            visualCondition: input.visualCondition,
            corrosionObserved: input.corrosionObserved,
            damageMechanism: input.damageMechanism,
            findings: input.findings,
            recommendations: input.recommendations,
          });
          return { success: true, id: existing.id };
        } else {
          const inspection = {
            id: nanoid(),
            ...input,
          };
          await db.saveExternalInspection(inspection);
          return { success: true, id: inspection.id };
        }
      }),
  }),

  internalInspection: router({
    // Get internal inspection data
    get: protectedProcedure
      .input(z.object({ inspectionId: z.string() }))
      .query(async ({ input }) => {
        return await db.getInternalInspection(input.inspectionId);
      }),

    // Save internal inspection data
    save: protectedProcedure
      .input(z.object({
        inspectionId: z.string(),
        internalCondition: z.string().optional(),
        corrosionPattern: z.string().optional(),
        findings: z.string().optional(),
        recommendations: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getInternalInspection(input.inspectionId);
        
        if (existing) {
          // FIX: Now actually updating!
          await db.updateInternalInspection(existing.id, {
            internalCondition: input.internalCondition,
            corrosionPattern: input.corrosionPattern,
            findings: input.findings,
            recommendations: input.recommendations,
          });
          return { success: true, id: existing.id };
        } else {
          const inspection = {
            id: nanoid(),
            ...input,
          };
          await db.saveInternalInspection(inspection);
          return { success: true, id: inspection.id };
        }
      }),
  }),

  importedFiles: router({
    // Get imported files for an inspection
    list: protectedProcedure
      .input(z.object({ inspectionId: z.string() }))
      .query(async ({ input }) => {
        return await db.getInspectionImportedFiles(input.inspectionId);
      }),

    // Create imported file record
    create: protectedProcedure
      .input(z.object({
        inspectionId: z.string(),
        fileName: z.string(),
        fileType: z.enum(["pdf", "excel"]),
        fileUrl: z.string().optional(),
        fileSize: z.number().optional(),
        extractedData: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const file = {
          id: nanoid(),
          userId: ctx.user.id,
          ...input,
          processingStatus: "pending" as const,
        };
        await db.createImportedFile(file);
        return file;
      }),

    // Update imported file status
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.string(),
        processingStatus: z.enum(["pending", "processing", "completed", "failed"]),
        extractedData: z.string().optional(),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateImportedFile(id, {
          ...data,
          processedAt: new Date(),
        });
        return { success: true };
      }),

    // Parse and import file
    parseFile: protectedProcedure
      .input(z.object({
        fileData: z.string(), // Base64 encoded file
        fileName: z.string(),
        fileType: z.enum(["pdf", "excel"]),
        parserType: z.enum(["docupipe", "manus", "vision"]).optional(), // Optional parser selection
        inspectionId: z.string().optional(), // Optional: append to existing inspection
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Decode base64 file data
          const buffer = Buffer.from(input.fileData, "base64");

          // Parse based on file type
          let parsedData;
          if (input.fileType === "excel") {
            parsedData = await parseExcelFile(buffer);
          } else {
            parsedData = await parsePDFFile(buffer, input.parserType);
          }

          // Upload file to S3
          const { url: fileUrl } = await storagePut(
            `imports/${ctx.user.id}/${Date.now()}-${input.fileName}`,
            buffer,
            input.fileType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );

          // Helper function to parse numeric values
          const parseNumeric = (value: any): string | null => {
            if (value === null || value === undefined || value === '') return null;
            const str = String(value).trim();
            // Extract first number from string (e.g., "250 psig" -> "250")
            const match = str.match(/([0-9]+\.?[0-9]*)/);
            return match ? match[1] : null;
          };
          
          const parseInt = (value: any): number | null => {
            if (value === null || value === undefined || value === '') return null;
            const num = Number(value);
            return isNaN(num) ? null : Math.floor(num);
          };

          // Create inspection from pars          // Check for existing field mappings to auto-apply
          const existingMappings = await fieldMappingDb.getFieldMappings(String(ctx.user.id));
          const mappingLookup = new Map<string, any>();
          existingMappings.forEach((m: any) => {
            mappingLookup.set(m.sourceField, { targetSection: m.targetSection, targetField: m.targetField, id: m.id });
          });

          // Get or create inspection record
          let inspection: any;
          let isNewInspection = false;
          
          if (input.inspectionId) {
            // Append to existing inspection
            inspection = await db.getInspection(input.inspectionId);
            if (!inspection) {
              throw new Error(`Inspection ${input.inspectionId} not found`);
            }
            // Verify ownership
            if (inspection.userId !== ctx.user.id) {
              throw new Error("Unauthorized: Cannot modify another user's inspection");
            }
            logger.info(`[Multi-Source Import] Appending to existing inspection: ${input.inspectionId}`);
          } else {
            // Try to find existing inspection by vessel tag number
            let existingInspection = null;
            if (parsedData.vesselTagNumber) {
              const userInspections = await db.getInspections(ctx.user.id);
              existingInspection = userInspections.find(
                (insp: any) => insp.vesselTagNumber === parsedData.vesselTagNumber
              );
            }
            
            if (existingInspection) {
              // Update existing inspection with same vessel tag
              isNewInspection = false;
              inspection = existingInspection;
              logger.info(`[Multi-Source Import] Found existing vessel ${parsedData.vesselTagNumber}, updating inspection: ${inspection.id}`);
            } else {
              // Create new inspection
              isNewInspection = true;
              inspection = {
                id: nanoid(),
                userId: ctx.user.id,
                vesselTagNumber: parsedData.vesselTagNumber || `IMPORT-${Date.now()}`,
                status: "draft" as const,
              };
              logger.info(`[Multi-Source Import] Creating new inspection: ${inspection.id}`);
            }
          }

          // Track successfully mapped fields for learning
          const successfulMappings: Array<{sourceField: string, targetSection: string, targetField: string, sourceValue: string}> = [];
          
          // Helper to track successful mapping
          const trackMapping = (sourceField: string, targetField: string, value: any) => {
            successfulMappings.push({
              sourceField,
              targetSection: 'inspection',
              targetField,
              sourceValue: String(value)
            });
          };
          
          // Merge optional fields (only update if new value exists and old doesn't, or if creating new)
          if (parsedData.vesselName && (isNewInspection || !inspection.vesselName)) {
            inspection.vesselName = String(parsedData.vesselName).substring(0, 500);
            trackMapping('vesselName', 'vesselName', parsedData.vesselName);
          }
          if (parsedData.manufacturer && (isNewInspection || !inspection.manufacturer)) {
            inspection.manufacturer = String(parsedData.manufacturer).substring(0, 500);
            trackMapping('manufacturer', 'manufacturer', parsedData.manufacturer);
          }
          if (parsedData.yearBuilt && (isNewInspection || !inspection.yearBuilt)) {
            const year = parseInt(parsedData.yearBuilt);
            if (year) {
              inspection.yearBuilt = year;
              trackMapping('yearBuilt', 'yearBuilt', parsedData.yearBuilt);
            }
          }
          if (parsedData.designPressure && (isNewInspection || !inspection.designPressure)) {
            const val = parseNumeric(parsedData.designPressure);
            if (val) {
              inspection.designPressure = val;
              trackMapping('designPressure', 'designPressure', parsedData.designPressure);
            }
          }
          if (parsedData.designTemperature && (isNewInspection || !inspection.designTemperature)) {
            const val = parseNumeric(parsedData.designTemperature);
            if (val) {
              inspection.designTemperature = val;
              trackMapping('designTemperature', 'designTemperature', parsedData.designTemperature);
            }
          }
          if (parsedData.operatingPressure && (isNewInspection || !inspection.operatingPressure)) {
            const val = parseNumeric(parsedData.operatingPressure);
            if (val) {
              inspection.operatingPressure = val;
              trackMapping('operatingPressure', 'operatingPressure', parsedData.operatingPressure);
            }
          }
          if (parsedData.materialSpec && (isNewInspection || !inspection.materialSpec)) {
            inspection.materialSpec = String(parsedData.materialSpec).substring(0, 255);
            trackMapping('materialSpec', 'materialSpec', parsedData.materialSpec);
          }
          if (parsedData.vesselType && (isNewInspection || !inspection.vesselType)) {
            inspection.vesselType = String(parsedData.vesselType).substring(0, 255);
            trackMapping('vesselType', 'vesselType', parsedData.vesselType);
          }
          if (parsedData.insideDiameter && (isNewInspection || !inspection.insideDiameter)) {
            const val = parseNumeric(parsedData.insideDiameter);
            if (val) {
              inspection.insideDiameter = val;
              trackMapping('insideDiameter', 'insideDiameter', parsedData.insideDiameter);
            }
          }
          if (parsedData.overallLength && (isNewInspection || !inspection.overallLength)) {
            const val = parseNumeric(parsedData.overallLength);
            if (val) {
              inspection.overallLength = val;
              trackMapping('overallLength', 'overallLength', parsedData.overallLength);
            }
          }
          
          // Additional vessel parameters for calculations
          if (parsedData.headType && (isNewInspection || !inspection.headType)) {
            inspection.headType = String(parsedData.headType).substring(0, 255);
            trackMapping('headType', 'headType', parsedData.headType);
          }
          if (parsedData.vesselConfiguration && (isNewInspection || !inspection.vesselConfiguration)) {
            inspection.vesselConfiguration = String(parsedData.vesselConfiguration).substring(0, 255);
            trackMapping('vesselConfiguration', 'vesselConfiguration', parsedData.vesselConfiguration);
          }
          if (parsedData.allowableStress && (isNewInspection || !inspection.allowableStress)) {
            const val = parseNumeric(parsedData.allowableStress);
            if (val) {
              inspection.allowableStress = val;
              trackMapping('allowableStress', 'allowableStress', parsedData.allowableStress);
            }
          }
          if (parsedData.jointEfficiency && (isNewInspection || !inspection.jointEfficiency)) {
            const val = parseNumeric(parsedData.jointEfficiency);
            if (val) {
              inspection.jointEfficiency = val;
              trackMapping('jointEfficiency', 'jointEfficiency', parsedData.jointEfficiency);
            }
          }
          if (parsedData.specificGravity && (isNewInspection || !inspection.specificGravity)) {
            const val = parseNumeric(parsedData.specificGravity);
            if (val) {
              inspection.specificGravity = val;
              trackMapping('specificGravity', 'specificGravity', parsedData.specificGravity);
            }
          }
          
          // Save inspection date if available
          if (parsedData.inspectionDate) {
            try {
              const dateStr = String(parsedData.inspectionDate);
              // Try to parse various date formats
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) {
                inspection.inspectionDate = parsedDate;
                trackMapping('inspectionDate', 'inspectionDate', parsedData.inspectionDate);
              }
            } catch (e) {
              logger.warn('[PDF Import] Failed to parse inspection date:', parsedData.inspectionDate);
            }
          }

          // Extract inspection results and recommendations
          if (parsedData.inspectionResults && (isNewInspection || !inspection.inspectionResults)) {
            inspection.inspectionResults = String(parsedData.inspectionResults);
            trackMapping('inspectionResults', 'inspectionResults', parsedData.inspectionResults);
          }
          if (parsedData.recommendations && (isNewInspection || !inspection.recommendations)) {
            inspection.recommendations = String(parsedData.recommendations);
            trackMapping('recommendations', 'recommendations', parsedData.recommendations);
          }

          // Create or update inspection
          if (isNewInspection) {
            await db.createInspection(inspection);
          } else {
            await db.updateInspection(inspection.id, inspection);
          }

          // Save field mappings for successfully imported fields
          for (const mapping of successfulMappings) {
            // Check if mapping already exists
            const existing = await fieldMappingDb.findSimilarMapping(ctx.user.id.toString(), mapping.sourceField);
            if (existing) {
              // Update usage count
              await fieldMappingDb.updateFieldMappingUsage(existing.id);
            } else {
              // Create new mapping
              await fieldMappingDb.createFieldMapping({
                id: nanoid(),
                userId: ctx.user.id.toString(),
                sourceField: mapping.sourceField,
                sourceValue: mapping.sourceValue,
                targetSection: mapping.targetSection,
                targetField: mapping.targetField,
                confidence: "1.00",
                usageCount: 1,
              });
            }
          }

          // Create TML readings if available - with deduplication
          const createdTMLs: any[] = [];
          if (parsedData.tmlReadings && parsedData.tmlReadings.length > 0) {
            logger.info(`[PDF Import] Processing ${parsedData.tmlReadings.length} TML readings with deduplication`);
            
            // Consolidate duplicate readings into single records
            const consolidatedReadings = consolidateTMLReadings(parsedData.tmlReadings);
            logger.info(`[PDF Import] Consolidated to ${consolidatedReadings.length} unique CML records`);
            
            for (const consolidated of consolidatedReadings) {
              const tmlRecord: any = {
                id: nanoid(),
                inspectionId: inspection.id,
                // Required fields
                cmlNumber: consolidated.cmlNumber,
                componentType: consolidated.componentType,
                location: consolidated.location,
                status: 'good' as const,
                // Legacy fields for backward compatibility
                tmlId: `TML-${nanoid()}`,
                component: consolidated.componentType,
              };
              
              // Add metadata fields
              if (consolidated.readingType) tmlRecord.readingType = consolidated.readingType;
              if (consolidated.nozzleSize) tmlRecord.nozzleSize = consolidated.nozzleSize;
              if (consolidated.service) tmlRecord.service = consolidated.service;
              if (consolidated.angles.length > 0) {
                // Store first angle as representative (or "Multi" if multiple)
                tmlRecord.angle = consolidated.angles.length === 1 ? consolidated.angles[0] : 'Multi';
              }
              
              // Add thickness readings (tml1-4)
              if (consolidated.tml1 !== undefined) tmlRecord.tml1 = consolidated.tml1.toString();
              if (consolidated.tml2 !== undefined) tmlRecord.tml2 = consolidated.tml2.toString();
              if (consolidated.tml3 !== undefined) tmlRecord.tml3 = consolidated.tml3.toString();
              if (consolidated.tml4 !== undefined) tmlRecord.tml4 = consolidated.tml4.toString();
              if (consolidated.tActual !== undefined) tmlRecord.tActual = consolidated.tActual.toString();
              
              // Add historical data
              if (consolidated.nominalThickness !== undefined) {
                tmlRecord.nominalThickness = consolidated.nominalThickness.toString();
              }
              if (consolidated.previousThickness !== undefined) {
                tmlRecord.previousThickness = consolidated.previousThickness.toString();
              }
              
              // Legacy currentThickness field (use tActual)
              if (consolidated.tActual !== undefined) {
                tmlRecord.currentThickness = consolidated.tActual.toString();
              }
              
              await db.createTmlReading(tmlRecord);
              createdTMLs.push(tmlRecord);
            }
            
            logger.info(`[PDF Import] Created ${createdTMLs.length} TML records (eliminated ${parsedData.tmlReadings.length - createdTMLs.length} duplicates)`);
          }

          // Prepare checklist items for review (don't create yet)
          let checklistPreview: any[] = [];
          if (parsedData.checklistItems && parsedData.checklistItems.length > 0) {
            checklistPreview = parsedData.checklistItems.map(item => {
              const preview: any = {
                category: item.category || 'General',
                itemNumber: item.itemNumber,
                itemText: item.itemText || item.description || 'Imported checklist item',
                notes: item.notes,
                checkedBy: item.checkedBy,
                checkedDate: item.checkedDate,
              };
              
              // Auto-map checked status for preview
              if (item.checked !== undefined) {
                preview.checked = Boolean(item.checked);
              } else if (item.status) {
                preview.checked = item.status === 'satisfactory' || item.status === 'completed' || item.status === 'yes';
                preview.originalStatus = item.status;
              } else {
                preview.checked = false;
              }
              
              return preview;
            });
          }

          // Create imported file record
          const importedFileId = nanoid();
          await db.createImportedFile({
            id: importedFileId,
            inspectionId: inspection.id,
            userId: ctx.user.id,
            fileName: input.fileName,
            fileType: input.fileType,
            fileUrl,
            fileSize: buffer.length,
            parserType: input.parserType || "manus",
            extractedData: JSON.stringify(parsedData),
            processingStatus: "completed",
          });

          // Identify and store unmatched data
          const mappedFields = new Set([
            'vesselTagNumber', 'vesselName', 'manufacturer', 'yearBuilt', 'designPressure',
            'designTemperature', 'operatingPressure', 'materialSpec', 'vesselType',
            'insideDiameter', 'overallLength', 'product', 'nbNumber', 'constructionCode',
            'vesselConfiguration', 'headType', 'insulationType', 'reportNumber',
            'inspectionDate', 'reportDate', 'inspectionType', 'inspectionCompany',
            'inspectorName', 'inspectorCert', 'clientName', 'clientLocation',
            'executiveSummary', 'thicknessReadings'
          ]);

          const unmatchedFields: any[] = [];
          
          // Flatten parsed data and find unmatched fields
          const flattenObject = (obj: any, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
              if (value && typeof value === 'object' && !Array.isArray(value)) {
                flattenObject(value, prefix + key + '.');
              } else if (!mappedFields.has(key) && value !== null && value !== undefined && value !== '') {
                unmatchedFields.push({
                  id: nanoid(),
                  inspectionId: inspection.id,
                  importedFileId,
                  fieldName: prefix + key,
                  fieldValue: String(value),
                  fieldPath: prefix + key,
                  status: "pending" as const,
                });
              }
            }
          };

          flattenObject(parsedData);

          // Store unmatched data
          if (unmatchedFields.length > 0) {
            await fieldMappingDb.bulkCreateUnmatchedData(unmatchedFields);
          }

          // Auto-create calculations record with vessel data
          if (isNewInspection) {
            const calculationRecord: any = {
              id: nanoid(),
              inspectionId: inspection.id,
            };
            
            // Populate calculation fields from imported vessel data (only fields that exist in schema)
            if (inspection.designPressure) {
              calculationRecord.minThicknessDesignPressure = inspection.designPressure;
            }
            if (inspection.insideDiameter) {
              const radius = parseFloat(inspection.insideDiameter) / 2;
              calculationRecord.minThicknessInsideRadius = radius;
              calculationRecord.mawpInsideRadius = radius;
            }
            if (parsedData.corrosionAllowance) {
              const ca = parseNumeric(parsedData.corrosionAllowance);
              if (ca) {
                calculationRecord.minThicknessCorrosionAllowance = ca;
                calculationRecord.mawpCorrosionAllowance = ca;
              }
            }
            
            // Set default values for calculation fields
            calculationRecord.minThicknessAllowableStress = 15000; // Default allowable stress (psi)
            calculationRecord.minThicknessJointEfficiency = 1.0; // Default joint efficiency
            calculationRecord.mawpAllowableStress = 15000;
            calculationRecord.mawpJointEfficiency = 1.0;
            
            await db.saveCalculations(calculationRecord);
            logger.info(`[PDF Import] Auto-created calculations record for inspection ${inspection.id}`);
            
            // Also create component calculation for Professional Report
            let report = await professionalReportDb.getProfessionalReportByInspection(inspection.id);
            if (!report) {
              // Create professional report if it doesn't exist
              const reportId = nanoid();
              await professionalReportDb.createProfessionalReport({
                id: reportId,
                inspectionId: inspection.id,
                userId: ctx.user.id,
                reportNumber: parsedData.reportNumber || `RPT-${Date.now()}`,
                reportDate: parsedData.reportDate ? new Date(parsedData.reportDate) : new Date(),
                inspectorName: parsedData.inspectorName || ctx.user.name || "",
                employerName: "OilPro Consulting LLC",
                clientName: parsedData.clientName || inspection.clientName || "",
              });
              report = await professionalReportDb.getProfessionalReportByInspection(inspection.id);
              logger.info(`[PDF Import] Auto-created professional report ${reportId}`);
            }
            
            // Create shell component calculation with imported data if report exists
            if (report) {
              // Get average thickness values from TML readings for shell
              const shellTMLs = createdTMLs.filter((tml: any) => 
                tml.component && tml.component.toLowerCase().includes('shell')
              );
              
              let avgCurrentThickness, avgPreviousThickness, avgNominalThickness;
              if (shellTMLs.length > 0) {
                const currentThicknesses = shellTMLs
                  .map((t: any) => parseFloat(t.currentThickness))
                  .filter((v: number) => !isNaN(v));
                const previousThicknesses = shellTMLs
                  .map((t: any) => parseFloat(t.previousThickness))
                  .filter((v: number) => !isNaN(v));
                const nominalThicknesses = shellTMLs
                  .map((t: any) => parseFloat(t.nominalThickness))
                  .filter((v: number) => !isNaN(v));
                
                if (currentThicknesses.length > 0) {
                  avgCurrentThickness = (currentThicknesses.reduce((a: number, b: number) => a + b, 0) / currentThicknesses.length).toFixed(4);
                }
                if (previousThicknesses.length > 0) {
                  avgPreviousThickness = (previousThicknesses.reduce((a: number, b: number) => a + b, 0) / previousThicknesses.length).toFixed(4);
                }
                if (nominalThicknesses.length > 0) {
                  avgNominalThickness = (nominalThicknesses.reduce((a: number, b: number) => a + b, 0) / nominalThicknesses.length).toFixed(4);
                }
              }
              
              // Calculate derived values
              const P = parseFloat(inspection.designPressure || "0");
              const R = inspection.insideDiameter ? parseFloat(inspection.insideDiameter) / 2 : 0;
              const S = parseFloat(inspection.allowableStress || '20000'); // Allowable stress from inspection or default
              const E = parseFloat(inspection.jointEfficiency || '0.85'); // Joint efficiency from inspection or default
              const CA = 0.125; // Default corrosion allowance (1/8 inch)
              
              // Minimum thickness calculation (ASME Section VIII Div 1, UG-27)
              // t_min = PR/(SE - 0.6P) - DO NOT add CA here
              let minimumThickness;
              if (P && R && S && E) {
                const denominator = S * E - 0.6 * P;
                if (denominator > 0) {
                  minimumThickness = ((P * R) / denominator).toFixed(4);
                }
              }
              
              // Corrosion rate and remaining life calculation
              let corrosionRate, remainingLife, corrosionAllowance;
              if (avgPreviousThickness && avgCurrentThickness && minimumThickness) {
                const prevThick = parseFloat(avgPreviousThickness);
                const currThick = parseFloat(avgCurrentThickness);
                const minThick = parseFloat(minimumThickness);
                
                // Calculate actual time between inspections from inspection date
                const timeSpan = calculateTimeSpanYears(
                  inspection.inspectionDate,
                  new Date(),
                  10 // Default to 10 years if inspection date not available
                );
                
                // Corrosion rate: Cr = (t_prev - t_act) / Years
                corrosionRate = ((prevThick - currThick) / timeSpan).toFixed(6);
                
                // Corrosion allowance: Ca = t_act - t_min
                corrosionAllowance = (currThick - minThick).toFixed(4);
                
                // Remaining life: RL = Ca / Cr
                const cr = parseFloat(corrosionRate);
                const ca = parseFloat(corrosionAllowance);
                if (cr > 0 && ca > 0) {
                  remainingLife = (ca / cr).toFixed(2);
                } else if (ca <= 0) {
                  // Below minimum thickness - negative remaining life
                  remainingLife = "0.00";
                }
              }
              
              await professionalReportDb.createComponentCalculation({
                id: nanoid(),
                reportId: report.id,
                componentName: "Shell",
                componentType: "shell",
                materialCode: inspection.materialSpec,
                materialName: inspection.materialSpec,
                designTemp: inspection.designTemperature ? inspection.designTemperature.toString() : undefined,
                designMAWP: inspection.designPressure ? inspection.designPressure.toString() : undefined,
                insideDiameter: inspection.insideDiameter ? inspection.insideDiameter.toString() : undefined,
                nominalThickness: avgNominalThickness,
                previousThickness: avgPreviousThickness,
                actualThickness: avgCurrentThickness,
                minimumThickness: minimumThickness,
                corrosionRate: corrosionRate,
                remainingLife: remainingLife,
                timeSpan: calculateTimeSpanYears(
                  inspection.inspectionDate,
                  new Date(),
                  10
                ).toFixed(2),
                nextInspectionYears: remainingLife ? (parseFloat(remainingLife) * 0.5).toFixed(2) : "5", // Half of remaining life or 5 years
                allowableStress: inspection.allowableStress || '20000',
                jointEfficiency: inspection.jointEfficiency || '0.85',
                corrosionAllowance: CA.toString(),
              });
              logger.info(`[PDF Import] Auto-created shell component calculation for report ${report.id}`);
              
              // Create East Head component calculation with improved detection
              // Matches: 'east head', 'e head', 'head 1', 'head-1', 'left head', or any head without west/right keywords
              // IMPORTANT: Also check location field for head identification
              const eastHeadTMLs = createdTMLs.filter((tml: any) => {
                const comp = (tml.component || '').toLowerCase();
                const compType = (tml.componentType || '').toLowerCase();
                const loc = (tml.location || '').toLowerCase();
                const combined = `${comp} ${compType}`;
                
                // Explicit east head matches (check location too)
                if (combined.includes('east') || loc.includes('east head')) return true;
                if (combined.includes('e head')) return true;
                if (combined.includes('head 1') || combined.includes('head-1')) return true;
                if (combined.includes('left head')) return true;
                
                // If it's a head but not explicitly west/right, treat as east (first head)
                // Exclude if location indicates west head
                if ((combined.includes('head') && !combined.includes('shell')) &&
                    !combined.includes('west') && !combined.includes('w head') &&
                    !combined.includes('head 2') && !combined.includes('head-2') &&
                    !combined.includes('right') && !loc.includes('west')) {
                  return true;
                }
                return false;
              });
              
              if (eastHeadTMLs.length > 0) {
                const eastCurrentThicknesses = eastHeadTMLs
                  .map((t: any) => parseFloat(t.currentThickness))
                  .filter((v: number) => !isNaN(v));
                const eastPreviousThicknesses = eastHeadTMLs
                  .map((t: any) => parseFloat(t.previousThickness))
                  .filter((v: number) => !isNaN(v));
                const eastNominalThicknesses = eastHeadTMLs
                  .map((t: any) => parseFloat(t.nominalThickness))
                  .filter((v: number) => !isNaN(v));
                
                const eastAvgCurrent = eastCurrentThicknesses.length > 0 ? 
                  (eastCurrentThicknesses.reduce((a, b) => a + b, 0) / eastCurrentThicknesses.length).toFixed(4) : undefined;
                const eastAvgPrevious = eastPreviousThicknesses.length > 0 ? 
                  (eastPreviousThicknesses.reduce((a, b) => a + b, 0) / eastPreviousThicknesses.length).toFixed(4) : undefined;
                const eastAvgNominal = eastNominalThicknesses.length > 0 ? 
                  (eastNominalThicknesses.reduce((a, b) => a + b, 0) / eastNominalThicknesses.length).toFixed(4) : undefined;
                
                // Calculate East Head minimum thickness (2:1 ellipsoidal head)
                let eastMinThickness;
                if (P && R && S && E) {
                  const denominator = 2 * S * E - 0.2 * P;
                  if (denominator > 0) {
                    eastMinThickness = ((P * R) / denominator).toFixed(4);
                  }
                }
                
                // Calculate East Head corrosion rate and remaining life
                let eastCorrosionRate, eastRemainingLife, eastCorrosionAllowance;
                if (eastAvgPrevious && eastAvgCurrent && eastMinThickness) {
                  const prevThick = parseFloat(eastAvgPrevious);
                  const currThick = parseFloat(eastAvgCurrent);
                  const minThick = parseFloat(eastMinThickness);
                  const timeSpan = 10;
                  
                  eastCorrosionRate = ((prevThick - currThick) / timeSpan).toFixed(6);
                  eastCorrosionAllowance = (currThick - minThick).toFixed(4);
                  
                  const cr = parseFloat(eastCorrosionRate);
                  const ca = parseFloat(eastCorrosionAllowance);
                  if (cr > 0 && ca > 0) {
                    eastRemainingLife = (ca / cr).toFixed(2);
                  } else if (ca <= 0) {
                    eastRemainingLife = "0.00";
                  }
                }
                
                await professionalReportDb.createComponentCalculation({
                  id: nanoid(),
                  reportId: report.id,
                  componentName: "East Head",
                  componentType: "head",
                  materialCode: inspection.materialSpec,
                  materialName: inspection.materialSpec,
                  designTemp: inspection.designTemperature ? inspection.designTemperature.toString() : undefined,
                  designMAWP: inspection.designPressure ? inspection.designPressure.toString() : undefined,
                  insideDiameter: inspection.insideDiameter ? inspection.insideDiameter.toString() : undefined,
                  nominalThickness: eastAvgNominal,
                  previousThickness: eastAvgPrevious,
                  actualThickness: eastAvgCurrent,
                  minimumThickness: eastMinThickness,
                  corrosionRate: eastCorrosionRate,
                  remainingLife: eastRemainingLife,
                  timeSpan: calculateTimeSpanYears(
                    inspection.inspectionDate,
                    new Date(),
                    10
                  ).toFixed(2),
                  nextInspectionYears: eastRemainingLife ? (parseFloat(eastRemainingLife) * 0.5).toFixed(2) : "5",
                  allowableStress: inspection.allowableStress || '20000',
                  jointEfficiency: inspection.jointEfficiency || '0.85',
                  corrosionAllowance: CA.toString(),
                });
                logger.info(`[PDF Import] Auto-created East Head component calculation for report ${report.id}`);
              }
              
              // Create West Head component calculation with improved detection
              // Matches: 'west head', 'w head', 'head 2', 'head-2', 'right head'
              // IMPORTANT: Also check location field for head identification
              const westHeadTMLs = createdTMLs.filter((tml: any) => {
                const comp = (tml.component || '').toLowerCase();
                const compType = (tml.componentType || '').toLowerCase();
                const loc = (tml.location || '').toLowerCase();
                const combined = `${comp} ${compType}`;
                
                // Explicit west head matches (check location too)
                if (combined.includes('west') || loc.includes('west head')) return true;
                if (combined.includes('w head')) return true;
                if (combined.includes('head 2') || combined.includes('head-2')) return true;
                if (combined.includes('right head')) return true;
                
                return false;
              });
              
              if (westHeadTMLs.length > 0) {
                const westCurrentThicknesses = westHeadTMLs
                  .map((t: any) => parseFloat(t.currentThickness))
                  .filter((v: number) => !isNaN(v));
                const westPreviousThicknesses = westHeadTMLs
                  .map((t: any) => parseFloat(t.previousThickness))
                  .filter((v: number) => !isNaN(v));
                const westNominalThicknesses = westHeadTMLs
                  .map((t: any) => parseFloat(t.nominalThickness))
                  .filter((v: number) => !isNaN(v));
                
                const westAvgCurrent = westCurrentThicknesses.length > 0 ? 
                  (westCurrentThicknesses.reduce((a, b) => a + b, 0) / westCurrentThicknesses.length).toFixed(4) : undefined;
                const westAvgPrevious = westPreviousThicknesses.length > 0 ? 
                  (westPreviousThicknesses.reduce((a, b) => a + b, 0) / westPreviousThicknesses.length).toFixed(4) : undefined;
                const westAvgNominal = westNominalThicknesses.length > 0 ? 
                  (westNominalThicknesses.reduce((a, b) => a + b, 0) / westNominalThicknesses.length).toFixed(4) : undefined;
                
                // Calculate West Head minimum thickness (2:1 ellipsoidal head)
                let westMinThickness;
                if (P && R && S && E) {
                  const denominator = 2 * S * E - 0.2 * P;
                  if (denominator > 0) {
                    westMinThickness = ((P * R) / denominator).toFixed(4);
                  }
                }
                
                // Calculate West Head corrosion rate and remaining life
                let westCorrosionRate, westRemainingLife, westCorrosionAllowance;
                if (westAvgPrevious && westAvgCurrent && westMinThickness) {
                  const prevThick = parseFloat(westAvgPrevious);
                  const currThick = parseFloat(westAvgCurrent);
                  const minThick = parseFloat(westMinThickness);
                  const timeSpan = 10;
                  
                  westCorrosionRate = ((prevThick - currThick) / timeSpan).toFixed(6);
                  westCorrosionAllowance = (currThick - minThick).toFixed(4);
                  
                  const cr = parseFloat(westCorrosionRate);
                  const ca = parseFloat(westCorrosionAllowance);
                  if (cr > 0 && ca > 0) {
                    westRemainingLife = (ca / cr).toFixed(2);
                  } else if (ca <= 0) {
                    westRemainingLife = "0.00";
                  }
                }
                
                await professionalReportDb.createComponentCalculation({
                  id: nanoid(),
                  reportId: report.id,
                  componentName: "West Head",
                  componentType: "head",
                  materialCode: inspection.materialSpec,
                  materialName: inspection.materialSpec,
                  designTemp: inspection.designTemperature ? inspection.designTemperature.toString() : undefined,
                  designMAWP: inspection.designPressure ? inspection.designPressure.toString() : undefined,
                  insideDiameter: inspection.insideDiameter ? inspection.insideDiameter.toString() : undefined,
                  nominalThickness: westAvgNominal,
                  previousThickness: westAvgPrevious,
                  actualThickness: westAvgCurrent,
                  minimumThickness: westMinThickness,
                  corrosionRate: westCorrosionRate,
                  remainingLife: westRemainingLife,
                  timeSpan: calculateTimeSpanYears(
                    inspection.inspectionDate,
                    new Date(),
                    10
                  ).toFixed(2),
                  nextInspectionYears: westRemainingLife ? (parseFloat(westRemainingLife) * 0.5).toFixed(2) : "5",
                  allowableStress: inspection.allowableStress || '20000',
                  jointEfficiency: inspection.jointEfficiency || '0.85',
                  corrosionAllowance: CA.toString(),
                });
                logger.info(`[PDF Import] Auto-created West Head component calculation for report ${report.id}`);
              }
            }
          }
          
          // Create nozzle evaluations if available
          if (parsedData.nozzles && parsedData.nozzles.length > 0) {
            logger.info(`[PDF Import] Creating ${parsedData.nozzles.length} nozzle evaluations...`);
            for (const nozzle of parsedData.nozzles) {
              const nozzleRecord: any = {
                id: nanoid(),
                inspectionId: inspection.id,
                nozzleNumber: nozzle.nozzleNumber,
                nozzleDescription: nozzle.nozzleDescription,
                location: nozzle.location,
                nominalSize: nozzle.nominalSize,
                schedule: nozzle.schedule,
                notes: nozzle.notes,
              };
              
              // Add optional numeric fields
              if (nozzle.actualThickness) {
                const val = typeof nozzle.actualThickness === 'number' ? nozzle.actualThickness : parseFloat(String(nozzle.actualThickness));
                if (!isNaN(val)) nozzleRecord.actualThickness = val.toString();
              }
              if (nozzle.pipeNominalThickness) {
                const val = typeof nozzle.pipeNominalThickness === 'number' ? nozzle.pipeNominalThickness : parseFloat(String(nozzle.pipeNominalThickness));
                if (!isNaN(val)) nozzleRecord.pipeNominalThickness = val.toString();
              }
              if (nozzle.minimumRequired) {
                const val = typeof nozzle.minimumRequired === 'number' ? nozzle.minimumRequired : parseFloat(String(nozzle.minimumRequired));
                if (!isNaN(val)) nozzleRecord.minimumRequired = val.toString();
              }
              if (nozzle.acceptable !== undefined) {
                nozzleRecord.acceptable = Boolean(nozzle.acceptable);
              }
              
              await db.createNozzleEvaluation(nozzleRecord);
            }
            logger.info(`[PDF Import] Created ${parsedData.nozzles.length} nozzle evaluations`);
          }

          return {
            success: true,
            inspectionId: inspection.id,
            isNewInspection,
            parsedData,
            unmatchedCount: unmatchedFields.length,
            checklistPreview, // Send checklist items for review
            requiresChecklistReview: checklistPreview.length > 0,
            message: isNewInspection 
              ? `Created new inspection ${inspection.id}` 
              : `Added data to existing inspection ${inspection.id}`,
          };
        } catch (error) {
          logger.error("Error parsing file:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          logger.error("Full error details:", {
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            fileName: input.fileName,
            fileType: input.fileType,
          });
          throw new Error(`Failed to parse ${input.fileType} file: ${errorMessage}`);
        }
      }),

    // Finalize checklist import after user review
    finalizeChecklistImport: protectedProcedure
      .input(z.object({
        inspectionId: z.string(),
        checklistItems: z.array(z.object({
          category: z.string(),
          itemNumber: z.string().optional(),
          itemText: z.string(),
          checked: z.boolean(),
          notes: z.string().optional(),
          checkedBy: z.string().optional(),
          checkedDate: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Create professional report if it doesn't exist
          const reportId = nanoid();
          await professionalReportDb.createProfessionalReport({
            id: reportId,
            inspectionId: input.inspectionId,
            userId: ctx.user.id,
            reportNumber: `RPT-${Date.now()}`,
            reportDate: new Date(),
          });

          // Create checklist items
          for (const item of input.checklistItems) {
            const checklistRecord: any = {
              id: nanoid(),
              reportId,
              category: item.category,
              itemText: item.itemText,
              checked: item.checked,
            };
            
            if (item.itemNumber) checklistRecord.itemNumber = item.itemNumber;
            if (item.notes) checklistRecord.notes = item.notes;
            if (item.checkedBy) checklistRecord.checkedBy = item.checkedBy;
            if (item.checkedDate) checklistRecord.checkedDate = new Date(item.checkedDate);
            
            await professionalReportDb.createChecklistItem(checklistRecord);
          }

          return {
            success: true,
            reportId,
            itemsCreated: input.checklistItems.length,
          };
        } catch (error) {
          logger.error("Error finalizing checklist import:", error);
          throw new Error("Failed to finalize checklist import");
        }
      }),
  }),

  // Field mappings for machine learning
  fieldMappings: fieldMappingRouter,
  
  // Unmatched data management
  unmatchedData: unmatchedDataRouter,
  
  // Professional report generation
  professionalReport: professionalReportRouter,
  
  // Nozzle evaluations
  nozzles: nozzleRouter,
  
  // Report comparison
  reportComparison: reportComparisonRouter,
  
  // Calculation validation
  validation: validationRouter,
});

export type AppRouter = typeof appRouter;

