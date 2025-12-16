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
      
      // Verify ownership
      if (inspection.userId !== ctx.user.id) {
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
      const createComponentCalc = async (componentType: 'shell' | 'head', componentName: string, filter: (tml: any) => boolean) => {
        const componentTMLs = tmlReadings.filter(filter);
        
        if (componentTMLs.length === 0) {
          logger.info(`[Recalculate] No TMLs found for ${componentName}`);
          return;
        }
        
        const currentThicknesses = componentTMLs
          .map((t: any) => parseFloat(t.currentThickness))
          .filter((v: number) => !isNaN(v));
        const previousThicknesses = componentTMLs
          .map((t: any) => parseFloat(t.previousThickness))
          .filter((v: number) => !isNaN(v));
        const nominalThicknesses = componentTMLs
          .map((t: any) => parseFloat(t.nominalThickness))
          .filter((v: number) => !isNaN(v));
        
        const avgCurrent = currentThicknesses.length > 0 ? 
          (currentThicknesses.reduce((a: number, b: number) => a + b, 0) / currentThicknesses.length).toFixed(4) : undefined;
        const avgPrevious = previousThicknesses.length > 0 ? 
          (previousThicknesses.reduce((a: number, b: number) => a + b, 0) / previousThicknesses.length).toFixed(4) : undefined;
        const avgNominal = nominalThicknesses.length > 0 ? 
          (nominalThicknesses.reduce((a: number, b: number) => a + b, 0) / nominalThicknesses.length).toFixed(4) : undefined;
        
        // Calculate minimum thickness
        const P = parseFloat(inspection.designPressure || '0');
        const R = inspection.insideDiameter ? parseFloat(inspection.insideDiameter) / 2 : 0;
        const S = parseFloat(inspection.allowableStress || '20000'); // Allowable stress from inspection or default
        const E = parseFloat(inspection.jointEfficiency || '0.85'); // Joint efficiency from inspection or default
        const CA = 0.125; // Corrosion allowance
        
        let minThickness;
        let calculatedMAWP;
        if (P && R && S && E) {
          if (componentType === 'shell') {
            // Shell: t_min = PR/(SE - 0.6P) + CA
            const denominator = S * E - 0.6 * P;
            if (denominator > 0) {
              minThickness = ((P * R) / denominator + CA).toFixed(4);
            }
            // Shell MAWP: MAWP = SEt/(R + 0.6t)
            if (avgCurrent) {
              const t = parseFloat(avgCurrent) - CA;
              if (t > 0) {
                calculatedMAWP = ((S * E * t) / (R + 0.6 * t)).toFixed(1);
              }
            }
          } else {
            // Head (2:1 ellipsoidal): t_min = PD/(2SE - 0.2P) + CA
            const D = R * 2;
            const denominator = 2 * S * E - 0.2 * P;
            if (denominator > 0) {
              minThickness = ((P * D) / denominator + CA).toFixed(4);
            }
            // Head MAWP: MAWP = 2SEt/(D + 0.2t)
            if (avgCurrent) {
              const t = parseFloat(avgCurrent) - CA;
              if (t > 0) {
                calculatedMAWP = ((2 * S * E * t) / (D + 0.2 * t)).toFixed(1);
              }
            }
          }
        }
        
        // Calculate corrosion rate and remaining life using enhanced dual-rate system
        let corrosionRate, corrosionRateLT, corrosionRateST, remainingLife, corrosionAllowance;
        let governingRateType, governingRateReason, dataQualityStatus, dataQualityNotes;
        
        if (avgCurrent && minThickness) {
          const currThick = parseFloat(avgCurrent);
          const minThick = parseFloat(minThickness);
          const prevThick = avgPrevious ? parseFloat(avgPrevious) : undefined;
          const nomThick = avgNominal ? parseFloat(avgNominal) : undefined;
          
          // Import enhanced calculation engine
          const { calculateDualCorrosionRates, calculateRemainingLife, calculateInspectionInterval } = 
            await import('./enhancedCalculations');
          
          // Prepare thickness data for dual corrosion rate calculation
          const thicknessData = {
            initialThickness: nomThick, // Use nominal as baseline if available
            previousThickness: prevThick,
            actualThickness: currThick,
            minimumThickness: minThick,
            initialDate: inspection.createdAt ? new Date(inspection.createdAt) : undefined,
            previousDate: inspection.inspectionDate ? new Date(inspection.inspectionDate) : undefined,
            currentDate: new Date()
          };
          
          // Calculate dual corrosion rates with anomaly detection
          const rateResult = calculateDualCorrosionRates(thicknessData);
          
          corrosionRateLT = rateResult.corrosionRateLongTerm.toFixed(6);
          corrosionRateST = rateResult.corrosionRateShortTerm.toFixed(6);
          corrosionRate = rateResult.governingRate.toFixed(6);
          governingRateType = rateResult.governingRateType;
          governingRateReason = rateResult.governingRateReason;
          dataQualityStatus = rateResult.dataQualityStatus;
          dataQualityNotes = rateResult.dataQualityNotes;
          
          corrosionAllowance = (currThick - minThick).toFixed(4);
          
          // Calculate remaining life using governing rate
          const rl = calculateRemainingLife(currThick, minThick, rateResult.governingRate);
          remainingLife = rl.toFixed(2);
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
          nominalThickness: avgNominal,
          previousThickness: avgPrevious,
          actualThickness: avgCurrent,
          minimumThickness: minThickness,
          
          // Enhanced dual corrosion rate system
          corrosionRateLongTerm: corrosionRateLT,
          corrosionRateShortTerm: corrosionRateST,
          corrosionRate,
          governingRateType,
          governingRateReason,
          
          // Data quality indicators
          dataQualityStatus,
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
          corrosionAllowance: CA.toString(),
        });
        
        logger.info(`[Recalculate] Created ${componentName} calculation`);
      };
      
      // Create Shell calculation
      await createComponentCalc(
        'shell',
        'Shell',
        (tml: any) => tml.component && tml.component.toLowerCase().includes('shell')
      );
      
      // Create East Head calculation with improved detection
      // Matches: 'east head', 'e head', 'head 1', 'head-1', 'left head', or any head without west/right keywords
      await createComponentCalc(
        'head',
        'East Head',
        (tml: any) => {
          const comp = (tml.component || '').toLowerCase();
          const compType = (tml.componentType || '').toLowerCase();
          const combined = `${comp} ${compType}`;
          
          // Explicit east head matches
          if (combined.includes('east') && combined.includes('head')) return true;
          if (combined.includes('e head')) return true;
          if (combined.includes('head 1') || combined.includes('head-1')) return true;
          if (combined.includes('left head')) return true;
          
          // If it's a head but not explicitly west/right, treat as east (first head)
          if ((combined.includes('head') && !combined.includes('shell')) &&
              !combined.includes('west') && !combined.includes('w head') &&
              !combined.includes('head 2') && !combined.includes('head-2') &&
              !combined.includes('right')) {
            return true;
          }
          return false;
        }
      );
      
      // Create West Head calculation with improved detection
      // Matches: 'west head', 'w head', 'head 2', 'head-2', 'right head'
      await createComponentCalc(
        'head',
        'West Head',
        (tml: any) => {
          const comp = (tml.component || '').toLowerCase();
          const compType = (tml.componentType || '').toLowerCase();
          const combined = `${comp} ${compType}`;
          
          // Explicit west head matches
          if (combined.includes('west') && combined.includes('head')) return true;
          if (combined.includes('w head')) return true;
          if (combined.includes('head 2') || combined.includes('head-2')) return true;
          if (combined.includes('right head')) return true;
          
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

