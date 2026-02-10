import { z } from "zod";
import { logger } from "./_core/logger";
import { nanoid } from "nanoid";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";

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
import {
  createProfessionalReport,
  getProfessionalReport,
  getProfessionalReportByInspection,
  updateProfessionalReport,
  createComponentCalculation,
  getComponentCalculations,
  updateComponentCalculation,
  deleteComponentCalculation,
  createInspectionFinding,
  getInspectionFindings,
  updateInspectionFinding,
  deleteInspectionFinding,
  createRecommendation,
  getRecommendations,
  updateRecommendation,
  deleteRecommendation,
  generateDefaultCalculationsForInspection,
  createInspectionPhoto,
  getInspectionPhotos,
  updateInspectionPhoto,
  deleteInspectionPhoto,
  createAppendixDocument,
  getAppendixDocuments,
  deleteAppendixDocument,
  createChecklistItem,
  getChecklistItems,
  updateChecklistItem,
  initializeDefaultChecklist,
  createFfsAssessment,
  getFfsAssessmentsByInspection,
  updateFfsAssessment,
  deleteFfsAssessment,
  createInLieuOfAssessment,
  getInLieuOfAssessmentsByInspection,
  updateInLieuOfAssessment,
  deleteInLieuOfAssessment,
} from "./professionalReportDb";
import { generateProfessionalPDF } from "./professionalPdfGenerator";
import { evaluateShell, evaluateHead, ShellCalculationInputs, HeadCalculationInputs } from "./professionalCalculations";
import { performFullCalculation, CALCULATION_ENGINE_VERSION, type CalculationInput, type FullCalculationResult } from "./lockedCalculationEngine";
import { resolveNominalThickness, type NominalResolution } from "./nominalThicknessResolver";

// ============================================================================
// Professional Report Router
// ============================================================================

export const professionalReportRouter = router({
  // Create or get professional report for an inspection
  getOrCreate: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ input, ctx }) => {
      logger.info('[Professional Report] getOrCreate called for inspection:', input.inspectionId);
      try {
        let report = await getProfessionalReportByInspection(input.inspectionId);
        logger.info('[Professional Report] Existing report found:', !!report);
      
        if (!report) {
        const reportId = nanoid();
        await createProfessionalReport({
          id: reportId,
          inspectionId: input.inspectionId,
          userId: ctx.user.id,
          reportNumber: `RPT-${Date.now()}`,
          reportDate: new Date(),
          inspectorName: ctx.user.name || '',
          employerName: 'OilPro Consulting LLC',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        // Initialize default checklist
        await initializeDefaultChecklist(reportId);
        
        // Generate default component calculations
        await generateDefaultCalculationsForInspection(input.inspectionId, reportId);
        
          report = await getProfessionalReport(reportId);
        }
      
        return report;
      } catch (error) {
        logger.error('[Professional Report] Error in getOrCreate:', error);
        throw error;
      }
    }),
  
  // Update professional report
  update: protectedProcedure
    .input(z.object({
      reportId: z.string(),
      data: z.object({
        reportNumber: z.string().optional(),
        reportDate: z.string().optional(),
        inspectorName: z.string().optional(),
        inspectorCertification: z.string().optional(),
        employerName: z.string().optional(),
        clientName: z.string().optional(),
        clientLocation: z.string().optional(),
        clientContact: z.string().optional(),
        clientApprovalName: z.string().optional(),
        clientApprovalTitle: z.string().optional(),
        executiveSummary: z.string().optional(),
        nextExternalInspectionClient: z.string().optional(),
        nextExternalInspectionAPI: z.string().optional(),
        nextInternalInspection: z.string().optional(),
        nextUTInspection: z.string().optional(),
        governingComponent: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      // Convert date strings to Date objects
      const updateData: any = { ...input.data };
      if (updateData.reportDate) updateData.reportDate = new Date(updateData.reportDate);
      if (updateData.nextExternalInspectionClient) updateData.nextExternalInspectionClient = new Date(updateData.nextExternalInspectionClient);
      if (updateData.nextExternalInspectionAPI) updateData.nextExternalInspectionAPI = new Date(updateData.nextExternalInspectionAPI);
      if (updateData.nextInternalInspection) updateData.nextInternalInspection = new Date(updateData.nextInternalInspection);
      if (updateData.nextUTInspection) updateData.nextUTInspection = new Date(updateData.nextUTInspection);
      
      await updateProfessionalReport(input.reportId, updateData);
      return { success: true };
    }),
  
  // Component calculations
  componentCalculations: router({
    list: protectedProcedure
      .input(z.object({ reportId: z.string() }))
      .query(async ({ input }) => {
        return await getComponentCalculations(input.reportId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        reportId: z.string(),
        componentName: z.string(),
        componentType: z.enum(['shell', 'head']),
        materialCode: z.string().optional(),
        materialName: z.string().optional(),
        designTemp: z.string().optional(),
        designMAWP: z.string().optional(),
        staticHead: z.string().optional(),
        specificGravity: z.string().optional(),
        insideDiameter: z.string().optional(),
        nominalThickness: z.string().optional(),
        allowableStress: z.string().optional(),
        jointEfficiency: z.string().optional(),
        headType: z.string().optional(),
        crownRadius: z.string().optional(),
        knuckleRadius: z.string().optional(),
        previousThickness: z.string().optional(),
        actualThickness: z.string().optional(),
        timeSpan: z.string().optional(),
        nextInspectionYears: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { reportId, componentType, ...data } = input;
        
        // Calculate values based on component type
        let calculatedData: any = { ...data };
        
        if (componentType === 'shell') {
          const inputs: ShellCalculationInputs = {
            P: parseFloat(data.designMAWP || '0'),
            R: parseFloat(data.insideDiameter || '0') / 2,
            S: parseFloat(data.allowableStress || '0'),
            E: parseFloat(data.jointEfficiency || '1'),
            t_nom: parseFloat(data.nominalThickness || '0'),
            t_prev: parseFloat(data.previousThickness || '0'),
            t_act: parseFloat(data.actualThickness || '0'),
            Y: parseFloat(data.timeSpan || '1'),
            Yn: parseFloat(data.nextInspectionYears || '5'),
            SH: parseFloat(data.staticHead || '0'),
            SG: parseFloat(data.specificGravity || '1'),
          };
          
          const results = evaluateShell(inputs);
          
          // Helper to safely format numbers, returning undefined for invalid values
          const safeFormat = (value: number, decimals: number) => {
            if (!isFinite(value) || isNaN(value)) return undefined;
            return value.toFixed(decimals);
          };
          
          calculatedData = {
            ...calculatedData,
            minimumThickness: safeFormat(results.t_min, 4),
            corrosionAllowance: safeFormat(results.Ca, 4),
            corrosionRate: safeFormat(results.Cr, 6),
            remainingLife: safeFormat(results.RL, 2),
            thicknessAtNextInspection: safeFormat(results.t_next, 4),
            pressureAtNextInspection: safeFormat(results.P_next, 2),
            mawpAtNextInspection: safeFormat(results.MAWP, 2),
          };
        } else if (componentType === 'head') {
          const D = parseFloat(data.insideDiameter || '0');
          const R = D / 2;
          const L = parseFloat(data.crownRadius || R.toString());
          const r = parseFloat(data.knuckleRadius || (R * 0.06).toString());
          
          const inputs: HeadCalculationInputs = {
            headType: (data.headType as any) || 'torispherical',
            P: parseFloat(data.designMAWP || '0'),
            S: parseFloat(data.allowableStress || '0'),
            E: parseFloat(data.jointEfficiency || '1'),
            D,
            t_nom: parseFloat(data.nominalThickness || '0'),
            t_prev: parseFloat(data.previousThickness || '0'),
            t_act: parseFloat(data.actualThickness || '0'),
            Y: parseFloat(data.timeSpan || '1'),
            Yn: parseFloat(data.nextInspectionYears || '5'),
            SH: parseFloat(data.staticHead || '0'),
            SG: parseFloat(data.specificGravity || '1'),
            L,
            r,
          };
          
          const results = evaluateHead(inputs);
          
          // Helper to safely format numbers, returning undefined for invalid values
          const safeFormat = (value: number, decimals: number) => {
            if (!isFinite(value) || isNaN(value)) return undefined;
            return value.toFixed(decimals);
          };
          
          calculatedData = {
            ...calculatedData,
            headFactor: results.M && isFinite(results.M) ? results.M.toFixed(4) : undefined,
            minimumThickness: safeFormat(results.t_min, 4),
            corrosionAllowance: safeFormat(results.Ca, 4),
            corrosionRate: safeFormat(results.Cr, 6),
            remainingLife: safeFormat(results.RL, 2),
            thicknessAtNextInspection: safeFormat(results.t_next, 4),
            pressureAtNextInspection: safeFormat(results.P_next, 2),
            mawpAtNextInspection: safeFormat(results.MAWP, 2),
          };
        }
        
        const id = nanoid();
        await createComponentCalculation({
          id,
          reportId,
          componentName: data.componentName,
          componentType,
          ...calculatedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        return { id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        calcId: z.string(),
        data: z.any(),
      }))
      .mutation(async ({ input }) => {
        await updateComponentCalculation(input.calcId, input.data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ calcId: z.string() }))
      .mutation(async ({ input }) => {
        await deleteComponentCalculation(input.calcId);
        return { success: true };
      }),
  }),
  
  // Inspection findings
  findings: router({
    list: protectedProcedure
      .input(z.object({ reportId: z.string() }))
      .query(async ({ input }) => {
        return await getInspectionFindings(input.reportId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        reportId: z.string(),
        section: z.string(),
        findingType: z.enum(['observation', 'defect', 'recommendation']).default('observation'),
        severity: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
        description: z.string(),
        location: z.string().optional(),
        measurements: z.string().optional(),
        photos: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = nanoid();
        await createInspectionFinding({
          id,
          ...input,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        findingId: z.string(),
        section: z.string().optional(),
        findingType: z.enum(['observation', 'defect', 'recommendation']).optional(),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        measurements: z.string().optional(),
        photos: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { findingId, ...data } = input;
        await updateInspectionFinding(findingId, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ findingId: z.string() }))
      .mutation(async ({ input }) => {
        await deleteInspectionFinding(input.findingId);
        return { success: true };
      }),
  }),
  
  // Recommendations
  recommendations: router({
    list: protectedProcedure
      .input(z.object({ reportId: z.string() }))
      .query(async ({ input }) => {
        return await getRecommendations(input.reportId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        reportId: z.string(),
        section: z.string(),
        subsection: z.string().optional(),
        recommendation: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = nanoid();
        await createRecommendation({
          id,
          ...input,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        recommendationId: z.string(),
        data: z.object({
          recommendation: z.string().optional(),
          priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        await updateRecommendation(input.recommendationId, input.data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ recommendationId: z.string() }))
      .mutation(async ({ input }) => {
        await deleteRecommendation(input.recommendationId);
        return { success: true };
      }),
  }),
  
  // Photos
  photos: router({
    list: protectedProcedure
      .input(z.object({ reportId: z.string() }))
      .query(async ({ input }) => {
        return await getInspectionPhotos(input.reportId);
      }),
    
    upload: protectedProcedure
      .input(z.object({
        base64Data: z.string(),
        filename: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Remove data URL prefix if present
        const base64Match = input.base64Data.match(/^data:([^;]+);base64,(.+)$/);
        const base64String = base64Match ? base64Match[2] : input.base64Data;
        let buffer = Buffer.from(base64String, 'base64');
        let contentType = input.contentType;
        let ext = input.filename.split('.').pop()?.toLowerCase() || 'jpg';
        
        // Convert HEIC to JPEG (PDFKit doesn't support HEIC)
        if (ext === 'heic' || ext === 'heif' || contentType.includes('heic') || contentType.includes('heif')) {
          try {
            const convert = require('heic-convert');
            logger.info('[Photo Upload] Starting HEIC conversion...');
            const jpegBuffer = await convert({
              buffer,
              format: 'JPEG',
              quality: 0.9,
            });
            buffer = Buffer.from(jpegBuffer);
            contentType = 'image/jpeg';
            ext = 'jpg';
            logger.info('[Photo Upload] Successfully converted HEIC to JPEG');
          } catch (error) {
            logger.error('[Photo Upload] HEIC conversion failed:', error);
            logger.info('[Photo Upload] Uploading original HEIC file as fallback (may not display in PDF)');
            // Fallback: upload original file anyway, but warn user
            // Don't throw error - let upload continue
          }
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const key = `inspection-photos/${timestamp}-${nanoid()}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(key, buffer, contentType);
        
        return { url };
      }),
    
    create: protectedProcedure
      .input(z.object({
        reportId: z.string(),
        photoUrl: z.string(),
        caption: z.string().optional(),
        section: z.string().optional(),
        sequenceNumber: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = nanoid();
        await createInspectionPhoto({
          id,
          ...input,
          createdAt: new Date(),
        });
        return { id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        photoId: z.string(),
        photoUrl: z.string().optional(),
        caption: z.string().optional(),
        section: z.string().optional(),
        sequenceNumber: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { photoId, ...data } = input;
        await updateInspectionPhoto(photoId, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ photoId: z.string() }))
      .mutation(async ({ input }) => {
        await deleteInspectionPhoto(input.photoId);
        return { success: true };
      }),
  }),
  
  // Checklist
  checklist: router({
    list: protectedProcedure
      .input(z.object({ reportId: z.string() }))
      .query(async ({ input }) => {
        return await getChecklistItems(input.reportId);
      }),
    
    initialize: protectedProcedure
      .input(z.object({ reportId: z.string() }))
      .mutation(async ({ input }) => {
        await initializeDefaultChecklist(input.reportId);
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        itemId: z.string(),
        checked: z.boolean().optional(),
        checkedBy: z.string().optional().nullable(),
        checkedDate: z.date().optional().nullable(),
        notes: z.string().optional(),
        status: z.enum(['satisfactory', 'unsatisfactory', 'not_applicable', 'not_checked']).optional(),
        comments: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { itemId, ...data } = input;
        await updateChecklistItem(itemId, data);
        return { success: true };
      }),
  }),
  
  // Generate PDF
  generatePDF: protectedProcedure
    .input(z.object({
      reportId: z.string(),
      inspectionId: z.string(),
      sectionConfig: z.object({
        coverPage: z.boolean().optional(),
        tableOfContents: z.boolean().optional(),
        executiveSummary: z.boolean().optional(),
        vesselData: z.boolean().optional(),
        componentCalculations: z.boolean().optional(),
        inspectionFindings: z.boolean().optional(),
        recommendations: z.boolean().optional(),
        thicknessReadings: z.boolean().optional(),
        checklist: z.boolean().optional(),
        ffsAssessment: z.boolean().optional(),
        inLieuOfQualification: z.boolean().optional(),
        photos: z.boolean().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        logger.info('[PDF Generation] Starting for inspection:', input.inspectionId);
        
        const pdfBuffer = await generateProfessionalPDF({
          reportId: input.reportId,
          inspectionId: input.inspectionId,
          sectionConfig: input.sectionConfig,
        });
        
        logger.info('[PDF Generation] PDF generated successfully, size:', pdfBuffer.length, 'bytes');
        
        // Convert buffer to base64 for transmission
        const base64 = pdfBuffer.toString('base64');
        
        logger.info('[PDF Generation] Base64 encoded, size:', base64.length, 'characters');
        
        return {
          success: true,
          pdf: base64,
        };
      } catch (error: any) {
        logger.error('[PDF Generation] Error:', error);
        logger.error('[PDF Generation] Stack:', error.stack);
        throw new Error(`Failed to generate PDF: ${error.message}`);
      }
    }),
  
  // ============================================================================
  // FFS Assessment
  // ============================================================================
  
  ffsAssessment: router({
    list: protectedProcedure
      .input(z.object({ inspectionId: z.string() }))
      .query(async ({ input }) => {
        return await getFfsAssessmentsByInspection(input.inspectionId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        inspectionId: z.string(),
        assessmentLevel: z.enum(["level1", "level2", "level3"]),
        damageType: z.string().optional(),
        remainingThickness: z.string().optional(),
        minimumRequired: z.string().optional(),
        futureCorrosionAllowance: z.string().optional(),
        acceptable: z.boolean().optional(),
        remainingLife: z.string().optional(),
        nextInspectionDate: z.string().optional(),
        assessmentNotes: z.string().optional(),
        recommendations: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = nanoid();
        await createFfsAssessment({ id, ...input });
        return { id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        assessmentLevel: z.enum(["level1", "level2", "level3"]).optional(),
        damageType: z.string().optional(),
        remainingThickness: z.string().optional(),
        minimumRequired: z.string().optional(),
        futureCorrosionAllowance: z.string().optional(),
        acceptable: z.boolean().optional(),
        remainingLife: z.string().optional(),
        nextInspectionDate: z.string().optional(),
        assessmentNotes: z.string().optional(),
        recommendations: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateFfsAssessment(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await deleteFfsAssessment(input.id);
        return { success: true };
      }),
  }),
  
  // ============================================================================
  // In-Lieu-Of Assessment
  // ============================================================================
  
  inLieuOfAssessment: router({
    list: protectedProcedure
      .input(z.object({ inspectionId: z.string() }))
      .query(async ({ input }) => {
        return await getInLieuOfAssessmentsByInspection(input.inspectionId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        inspectionId: z.string(),
        cleanService: z.boolean().optional(),
        noCorrosionHistory: z.boolean().optional(),
        effectiveExternalInspection: z.boolean().optional(),
        processMonitoring: z.boolean().optional(),
        thicknessMonitoring: z.boolean().optional(),
        qualified: z.boolean().optional(),
        maxInterval: z.number().optional(),
        nextInternalDue: z.string().optional(),
        justification: z.string().optional(),
        monitoringPlan: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = nanoid();
        const { nextInternalDue, ...rest } = input;
        await createInLieuOfAssessment({ 
          id, 
          ...rest,
          nextInternalDue: nextInternalDue ? new Date(nextInternalDue) : undefined,
        });
        return { id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        cleanService: z.boolean().optional(),
        noCorrosionHistory: z.boolean().optional(),
        effectiveExternalInspection: z.boolean().optional(),
        processMonitoring: z.boolean().optional(),
        thicknessMonitoring: z.boolean().optional(),
        qualified: z.boolean().optional(),
        maxInterval: z.number().optional(),
        nextInternalDue: z.string().optional(),
        justification: z.string().optional(),
        monitoringPlan: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, nextInternalDue, ...data } = input;
        await updateInLieuOfAssessment(id, {
          ...data,
          nextInternalDue: nextInternalDue ? new Date(nextInternalDue) : undefined,
        });
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await deleteInLieuOfAssessment(input.id);
        return { success: true };
      }),
  }),
  
  // Recalculate component calculations from TML readings
  recalculate: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await import('./db');
      const professionalReportDb = await import('./professionalReportDb');
      
      // Get inspection data
      const inspection = await db.getInspection(input.inspectionId);
      if (!inspection) {
        throw new Error('Inspection not found');
      }
      
      // Verify ownership - admin can access any inspection
      if (ctx.user.role !== 'admin' && inspection.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }
      
      // Get or create professional report
      let report = await professionalReportDb.getProfessionalReportByInspection(input.inspectionId);
      if (!report) {
        const reportId = nanoid();
        await professionalReportDb.createProfessionalReport({
          id: reportId,
          inspectionId: input.inspectionId,
          userId: ctx.user.id,
          reportNumber: `RPT-${Date.now()}`,
          reportDate: new Date(),
          inspectorName: ctx.user.name || '',
          employerName: 'OilPro Consulting LLC',
        });
        
        // Generate default component calculations
        await professionalReportDb.generateDefaultCalculationsForInspection(input.inspectionId, reportId);
        
        report = await professionalReportDb.getProfessionalReport(reportId);
      }
      
      if (!report) {
        throw new Error('Failed to create professional report');
      }
      
      // Delete existing component calculations
      const existingCalcs = await professionalReportDb.getComponentCalculations(report.id);
      for (const calc of existingCalcs) {
        await professionalReportDb.deleteComponentCalculation(calc.id);
      }
      
      // Get TML readings
      const tmlReadings = await db.getTmlReadings(input.inspectionId);
      
      // Helper function to create component calculation
      // USES LOCKED CALCULATION ENGINE for audit traceability
      const createComponentCalc = async (componentType: 'shell' | 'head', componentName: string, filter: (tml: any) => boolean) => {
        const componentTMLs = tmlReadings.filter(filter);
        
        if (componentTMLs.length === 0) {
          logger.info(`[Recalculate] No TMLs found for ${componentName}`);
          return;
        }
        
        // CRITICAL FIX: Read tActual first (new field), fall back to currentThickness (legacy field)
        const currentThicknesses = componentTMLs
          .map((t: any) => parseFloat(t.tActual || t.currentThickness))
          .filter((v: number) => !isNaN(v));
        const previousThicknesses = componentTMLs
          .map((t: any) => parseFloat(t.previousThickness))
          .filter((v: number) => !isNaN(v));
        const nominalThicknesses = componentTMLs
          .map((t: any) => parseFloat(t.nominalThickness))
          .filter((v: number) => !isNaN(v));
        
        // API 510 COMPLIANCE: Use MINIMUM thickness (conservative)
        const minCurrent = currentThicknesses.length > 0 ? Math.min(...currentThicknesses) : NaN;
        const minPrevious = previousThicknesses.length > 0 ? Math.min(...previousThicknesses) : NaN;
        
        if (isNaN(minCurrent)) {
          logger.warn(`[Recalculate] ${componentName}: No valid current thickness readings — skipping`);
          return;
        }
        
        // ================================================================
        // FIX #1: Nominal Thickness Resolver — authority hierarchy
        // ================================================================
        const nominalResolution: NominalResolution = resolveNominalThickness({
          componentType,
          componentName,
          tmlNominals: nominalThicknesses,
          vesselNominal: componentType === 'shell'
            ? (inspection.shellNominalThickness ? parseFloat(String(inspection.shellNominalThickness)) : null)
            : (inspection.headNominalThickness ? parseFloat(String(inspection.headNominalThickness)) : null),
        });
        
        const resolvedNominal = nominalResolution.value;
        
        // ================================================================
        // FIX #3: Use LOCKED calculation engine for audit traceability
        // ================================================================
        const P = parseFloat(inspection.designPressure || '0');
        const insideDiameter = parseFloat(inspection.insideDiameter || '0');
        const S = parseFloat(inspection.allowableStress || '20000');
        const E = parseFloat(inspection.jointEfficiency || '1.0');
        const designTemp = parseFloat(inspection.designTemperature || '0');
        
        // Determine head type for head components
        let headTypeForEngine: '2:1 Ellipsoidal' | 'Torispherical' | 'Hemispherical' | undefined;
        if (componentType === 'head') {
          const headTypeStr = (inspection.headType || 'ellipsoidal').toLowerCase();
          if (headTypeStr.includes('torispherical')) headTypeForEngine = 'Torispherical';
          else if (headTypeStr.includes('hemispherical')) headTypeForEngine = 'Hemispherical';
          else headTypeForEngine = '2:1 Ellipsoidal';
        }
        
        // Get dates from TML readings
        const tmlWithDates = componentTMLs.find((t: any) => t.previousInspectionDate && t.currentInspectionDate);
        const previousDate = tmlWithDates?.previousInspectionDate ? new Date(tmlWithDates.previousInspectionDate) :
          (inspection.inspectionDate ? new Date(inspection.inspectionDate) : undefined);
        const currentDate = tmlWithDates?.currentInspectionDate ? new Date(tmlWithDates.currentInspectionDate) : new Date();
        const yearBuilt = inspection.yearBuilt ? parseInt(String(inspection.yearBuilt)) : undefined;
        
        // Build locked engine input
        const calcInput: CalculationInput = {
          insideDiameter,
          designPressure: P,
          designTemperature: designTemp || 100, // Default 100°F if not specified
          materialSpec: inspection.materialSpec || 'SA-516 Gr 70',
          allowableStress: S,
          jointEfficiency: E,
          nominalThickness: resolvedNominal || minCurrent, // Use current as fallback for engine (it will warn)
          currentThickness: minCurrent,
          previousThickness: isNaN(minPrevious) ? undefined : minPrevious,
          headType: headTypeForEngine,
          crownRadius: componentType === 'head' ? (parseFloat(inspection.crownRadius as any) || undefined) : undefined,
          knuckleRadius: componentType === 'head' ? (parseFloat(inspection.knuckleRadius as any) || undefined) : undefined,
          yearBuilt,
          currentYear: new Date().getFullYear(),
          previousInspectionDate: previousDate,
          currentInspectionDate: currentDate,
        };
        
        // Data quality tracking
        let dataQualityStatus: string = 'good';
        let dataQualityNotes: string = '';
        let minThickness: string | undefined;
        let calculatedMAWP: string | undefined;
        let corrosionRate: string | undefined;
        let corrosionRateLT: string | undefined;
        let corrosionRateST: string | undefined;
        let remainingLife: string | undefined;
        let corrosionAllowance: string | undefined;
        let governingRateType: string | undefined;
        let governingRateReason: string | undefined;
        let headTypeUsed = componentType === 'head' ? (headTypeForEngine || '2:1 Ellipsoidal') : undefined;
        let headFactorValue: number | null = null;
        
        // Nominal resolution audit trail
        dataQualityNotes += `Nominal: ${nominalResolution.source} (${nominalResolution.reason})`;
        if (!nominalResolution.calculationReady) {
          dataQualityStatus = 'incomplete';
          dataQualityNotes += ' | HARD STOP: Nominal thickness unresolved — RL/CR calculations blocked';
          logger.warn(`[Recalculate] ${componentName}: ${nominalResolution.reason}`);
        }
        
        // Run locked engine if vessel parameters are sufficient
        if (P > 0 && insideDiameter > 0 && S > 0 && E > 0) {
          try {
            const engineType = componentType === 'shell' ? 'Shell' : 'Head';
            const result: FullCalculationResult = performFullCalculation(calcInput, engineType);
            
            // Extract results from locked engine
            if (result.tRequired.success && result.tRequired.resultValue !== null) {
              minThickness = result.tRequired.resultValue.toFixed(4);
            }
            if (result.mawp.success && result.mawp.resultValue !== null) {
              calculatedMAWP = result.mawp.resultValue.toFixed(1);
            }
            
            // Corrosion rates from locked engine
            if (result.corrosionRateLT?.success && result.corrosionRateLT.resultValue !== null) {
              corrosionRateLT = result.corrosionRateLT.resultValue.toFixed(6);
            }
            if (result.corrosionRateST?.success && result.corrosionRateST.resultValue !== null) {
              corrosionRateST = result.corrosionRateST.resultValue.toFixed(6);
            }
            
            // Use summary for governing rate and remaining life
            if (result.summary.corrosionRate !== null) {
              corrosionRate = result.summary.corrosionRate.toFixed(6);
              governingRateType = result.summary.corrosionRateType;
              governingRateReason = `Locked engine ${CALCULATION_ENGINE_VERSION}: ${result.summary.corrosionRateType} rate governs`;
            }
            if (result.summary.remainingLife !== null) {
              remainingLife = result.summary.remainingLife.toFixed(2);
            }
            if (result.summary.tRequired !== null && minCurrent > 0) {
              corrosionAllowance = (minCurrent - result.summary.tRequired).toFixed(4);
            }
            
            // Head factor from torispherical calculation
            if (componentType === 'head' && result.tRequired.intermediateValues) {
              const mFactor = result.tRequired.intermediateValues['M'] || result.tRequired.intermediateValues['m'];
              if (typeof mFactor === 'number') headFactorValue = mFactor;
            }
            
            // Capture engine warnings
            if (result.warnings.length > 0) {
              dataQualityNotes += ` | Engine warnings: ${result.warnings.join('; ')}`;
            }
            
            logger.info(`[Recalculate] ${componentName}: Locked engine ${CALCULATION_ENGINE_VERSION} — tReq=${minThickness}, MAWP=${calculatedMAWP}, CR=${corrosionRate}, RL=${remainingLife}`);
          } catch (engineErr) {
            logger.error(`[Recalculate] ${componentName}: Locked engine error:`, engineErr);
            dataQualityStatus = 'incomplete';
            dataQualityNotes += ` | Engine error: ${engineErr instanceof Error ? engineErr.message : 'Unknown'}`;
          }
        } else {
          dataQualityStatus = 'incomplete';
          dataQualityNotes += ` | WARNING: Missing vessel parameters (P=${P}, D=${insideDiameter}, S=${S}, E=${E}) — cannot compute tRequired`;
          logger.warn(`[Recalculate] ${componentName}: Missing vessel parameters — calculations blocked`);
        }
        
        await professionalReportDb.createComponentCalculation({
          id: nanoid(),
          reportId: report.id,
          componentName,
          componentType,
          materialCode: inspection.materialSpec,
          materialName: inspection.materialSpec,
          designTemp: inspection.designTemperature ? inspection.designTemperature.toString() : undefined,
          designMAWP: inspection.designPressure ? inspection.designPressure.toString() : undefined,
          calculatedMAWP,
          insideDiameter: inspection.insideDiameter ? inspection.insideDiameter.toString() : undefined,
          nominalThickness: resolvedNominal?.toFixed(4),
          previousThickness: isNaN(minPrevious) ? undefined : minPrevious.toFixed(4),
          actualThickness: minCurrent.toFixed(4),
          minimumThickness: minThickness,
          
          // Dual corrosion rate system from locked engine
          corrosionRateLongTerm: corrosionRateLT,
          corrosionRateShortTerm: corrosionRateST,
          corrosionRate,
          governingRateType: governingRateType as 'long_term' | 'short_term' | 'nominal' | null | undefined,
          governingRateReason,
          
          // Data quality indicators
          dataQualityStatus: dataQualityStatus as 'good' | 'anomaly' | 'growth_error' | 'below_minimum' | 'confirmed' | null | undefined,
          dataQualityNotes,
          
          remainingLife,
          timeSpan: calculateTimeSpanYears(
            inspection.inspectionDate,
            new Date(),
            10
          ).toFixed(2),
          nextInspectionYears: remainingLife ? (parseFloat(remainingLife) * 0.5).toFixed(2) : '5',
          allowableStress: inspection.allowableStress || '20000',
          jointEfficiency: inspection.jointEfficiency || '0.85',
          corrosionAllowance: corrosionAllowance || '0',
          // Head type metadata for PDF report
          headType: componentType === 'head' ? headTypeUsed : undefined,
          headFactor: componentType === 'head' && headFactorValue ? headFactorValue.toFixed(4) : undefined,
          crownRadius: componentType === 'head' && inspection.crownRadius ? parseFloat(inspection.crownRadius as any).toFixed(3) : undefined,
          knuckleRadius: componentType === 'head' && inspection.knuckleRadius ? parseFloat(inspection.knuckleRadius as any).toFixed(3) : undefined,
        });
        
        logger.info(`[Recalculate] Created ${componentName} calculation via ${CALCULATION_ENGINE_VERSION}`);
      };
      
      // Create Shell calculation
      // CRITICAL FIX: Check BOTH component (legacy) and componentType (new) fields
      await createComponentCalc(
        'shell',
        'Shell',
        (tml: any) => {
          const comp = (tml.component || '').toLowerCase();
          const compType = (tml.componentType || '').toLowerCase();
          const combined = `${comp} ${compType}`;
          return combined.includes('shell') || combined.includes('cylinder') || combined.includes('body');
        }
      );
      
      // Create South Head calculation
      // Matches: 'south head', 'south', 'head 1', 'head-1', 'east head', 'e head', 'left head', 'top head'
      // Also matches componentGroup 'SOUTHHEAD'
      await createComponentCalc(
        'head',
        'South Head',
        (tml: any) => {
          const comp = (tml.component || '').toLowerCase();
          const compType = (tml.componentType || '').toLowerCase();
          const cg = (tml.componentGroup || '').toUpperCase();
          const loc = (tml.location || '').toLowerCase();
          const combined = `${comp} ${compType}`;
          
          // componentGroup is the canonical source of truth
          if (cg === 'SOUTHHEAD') return true;
          
          // Explicit south head matches
          if (combined.includes('south head') || loc.includes('south head')) return true;
          if (combined.includes('south') && combined.includes('head')) return true;
          // Legacy east head naming (mapped to south)
          if (combined.includes('east head') || combined.includes('e head')) return true;
          if (combined.includes('head 1') || combined.includes('head-1')) return true;
          if (combined.includes('left head') || combined.includes('top head')) return true;
          
          // Generic head without north/west/right/bottom keywords → default to south (first head)
          if ((combined.includes('head') && !combined.includes('shell')) &&
              !combined.includes('north') && !combined.includes('west') &&
              !combined.includes('w head') && !combined.includes('head 2') &&
              !combined.includes('head-2') && !combined.includes('right') &&
              !combined.includes('bottom') && !combined.includes('bttm') && !combined.includes('btm') &&
              !loc.includes('north') && !loc.includes('west') && !loc.includes('bottom') && !loc.includes('bttm') &&
              cg !== 'NORTHHEAD') {
            return true;
          }
          return false;
        }
      );
      
      // Create North Head calculation
      // Matches: 'north head', 'north', 'head 2', 'head-2', 'west head', 'w head', 'right head', 'bottom head'
      // Also matches componentGroup 'NORTHHEAD'
      await createComponentCalc(
        'head',
        'North Head',
        (tml: any) => {
          const comp = (tml.component || '').toLowerCase();
          const compType = (tml.componentType || '').toLowerCase();
          const cg = (tml.componentGroup || '').toUpperCase();
          const loc = (tml.location || '').toLowerCase();
          const combined = `${comp} ${compType}`;
          
          // componentGroup is the canonical source of truth
          if (cg === 'NORTHHEAD') return true;
          
          // Explicit north head matches
          if (combined.includes('north head') || loc.includes('north head')) return true;
          if (combined.includes('north') && combined.includes('head')) return true;
          // Legacy west head naming (mapped to north)
          if (combined.includes('west head') || combined.includes('w head')) return true;
          if (combined.includes('head 2') || combined.includes('head-2')) return true;
          if (combined.includes('right head')) return true;
          if (combined.includes('bottom head') || combined.includes('bttm head') || combined.includes('btm head')) return true;
          // Check location field for north indicators
          if (loc.includes('north') || loc.includes('west') || loc.includes('bottom') || loc.includes('bttm')) return true;
          
          return false;
        }
      );
      
      return { success: true, message: 'Component calculations regenerated successfully' };
    }),
  
  // Export inspection data as CSV
  exportCSV: protectedProcedure
    .input(z.object({ 
      reportId: z.string(),
      inspectionId: z.string(),
    }))
    .query(async ({ input }) => {
      const { reportId, inspectionId } = input;
      
      // Import CSV export helper
      const { generateInspectionCSV } = await import('./csvExport');
      const { getInspection, getTmlReadings } = await import('./db');
      
      // Fetch all data
      const inspection = await getInspection(inspectionId);
      if (!inspection) throw new Error('Inspection not found');
      
      const components = await getComponentCalculations(reportId);
      const tmlReadings = await getTmlReadings(inspectionId);
      
      // TODO: Add nozzle evaluations when getNozzlesByInspection is implemented
      const nozzles: any[] = [];
      
      // Generate CSV content
      const csvContent = generateInspectionCSV({
        inspection,
        components,
        tmlReadings,
        nozzles,
      });
      
      return {
        csvContent,
        filename: `inspection-${inspection.vesselTagNumber || inspectionId}-${new Date().toISOString().split('T')[0]}.csv`,
      };
    }),
});


// ============================================================================
// Vessel Drawings Router
// ============================================================================

export const drawingsRouter = router({
  // List drawings for a report
  list: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input }) => {
      const { getVesselDrawings } = await import('./professionalReportDb');
      return await getVesselDrawings(input.reportId);
    }),

  // List drawings by inspection ID
  listByInspection: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ input }) => {
      const { getVesselDrawingsByInspection } = await import('./professionalReportDb');
      return await getVesselDrawingsByInspection(input.inspectionId);
    }),

  // Create a new drawing
  create: protectedProcedure
    .input(z.object({
      reportId: z.string(),
      inspectionId: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      drawingNumber: z.string().optional(),
      revision: z.string().optional(),
      category: z.enum([
        // Inspection Drawings
        'fabrication', 'isometric', 'general_arrangement', 'detail', 'nameplate', 'nozzle_schedule', 'drawing_other',
        // P&IDs
        'pid', 'pfd', 'pid_markup',
        // U-1 Forms
        'u1_form', 'u1a_form', 'u2_form', 'mdr', 'partial_data_report',
        // Certs & Calibrations
        'api_inspector_cert', 'nde_tech_cert', 'ut_calibration', 'thickness_gauge_cal', 'pressure_gauge_cal', 'other_calibration', 'other_cert',
        // Legacy
        'other'
      ]).default('other'),
      fileUrl: z.string(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
      fileSize: z.number().optional(),
      sequenceNumber: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { createVesselDrawing } = await import('./professionalReportDb');
      const id = nanoid();
      await createVesselDrawing({
        id,
        ...input,
        uploadedBy: ctx.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { id };
    }),

  // Update a drawing
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      drawingNumber: z.string().optional(),
      revision: z.string().optional(),
      category: z.enum([
        'fabrication', 'isometric', 'general_arrangement', 'detail', 'nameplate', 'nozzle_schedule', 'drawing_other',
        'pid', 'pfd', 'pid_markup',
        'u1_form', 'u1a_form', 'u2_form', 'mdr', 'partial_data_report',
        'api_inspector_cert', 'nde_tech_cert', 'ut_calibration', 'thickness_gauge_cal', 'pressure_gauge_cal', 'other_calibration', 'other_cert',
        'other'
      ]).optional(),
      sequenceNumber: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { updateVesselDrawing } = await import('./professionalReportDb');
      const { id, ...data } = input;
      await updateVesselDrawing(id, data);
      return { success: true };
    }),

  // Delete a drawing
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { deleteVesselDrawing } = await import('./professionalReportDb');
      await deleteVesselDrawing(input.id);
      return { success: true };
    }),

  // Upload a drawing file
  upload: protectedProcedure
    .input(z.object({
      reportId: z.string(),
      inspectionId: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      drawingNumber: z.string().optional(),
      revision: z.string().optional(),
      category: z.enum([
        'fabrication', 'isometric', 'general_arrangement', 'detail', 'nameplate', 'nozzle_schedule', 'drawing_other',
        'pid', 'pfd', 'pid_markup',
        'u1_form', 'u1a_form', 'u2_form', 'mdr', 'partial_data_report',
        'api_inspector_cert', 'nde_tech_cert', 'ut_calibration', 'thickness_gauge_cal', 'pressure_gauge_cal', 'other_calibration', 'other_cert',
        'other'
      ]).default('other'),
      fileData: z.string(), // Base64 encoded file data
      fileName: z.string(),
      fileType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { createVesselDrawing } = await import('./professionalReportDb');
      
      // Decode base64 and upload to S3
      const buffer = Buffer.from(input.fileData, 'base64');
      const fileKey = `drawings/${input.reportId}/${nanoid()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, buffer, input.fileType);
      
      const id = nanoid();
      await createVesselDrawing({
        id,
        reportId: input.reportId,
        inspectionId: input.inspectionId,
        title: input.title,
        description: input.description,
        drawingNumber: input.drawingNumber,
        revision: input.revision,
        category: input.category,
        fileUrl: url,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: buffer.length,
        uploadedBy: ctx.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      return { id, url };
    }),
});
