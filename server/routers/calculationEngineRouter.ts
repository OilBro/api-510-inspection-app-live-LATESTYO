/**
 * Calculation Engine Router
 * 
 * Provides tRPC endpoints for the locked calculation engine with full traceability.
 * All calculations are performed server-side using the locked calculation module.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  calculateTRequiredShell,
  calculateTRequiredEllipsoidalHead,
  calculateTRequiredTorisphericalHead,
  calculateTRequiredHemisphericalHead,
  calculateMAWPShell,
  calculateCorrosionRateLongTerm,
  calculateCorrosionRateShortTerm,
  calculateRemainingLife,
  calculateNextInspectionInterval,
  performFullCalculation,
  getEngineInfo,
  type CalculationInput,
} from "../lockedCalculationEngine";
import {
  getAllowableStress,
  getAllowableStressNormalized,
  getMaterialProperties,
  listAvailableMaterials,
  getDatabaseInfo,
  normalizeMaterialSpec,
} from "../asmeMaterialDatabase";
import { logCalculation, type AuditContext } from "../auditService";
import { nanoid } from "nanoid";
import {
  validateComponentData,
  validateInspectorCertification,
  validateReportForFinalization,
  hashCalculationInputs,
  createCalculationAuditRecord,
  generateComplianceDeterminationBasis,
  hashReportContent,
  APP_VERSION,
} from "../validationService";

// Input schema for calculation requests
const calculationInputSchema = z.object({
  // Vessel geometry
  insideDiameter: z.number().positive(),
  insideRadius: z.number().positive().optional(),
  
  // Design conditions
  designPressure: z.number().positive(),
  designTemperature: z.number(),
  
  // Material
  materialSpec: z.string().min(1),
  allowableStress: z.number().positive().optional(),
  
  // Joint efficiency
  jointEfficiency: z.number().min(0).max(1),
  
  // Thickness data
  nominalThickness: z.number().positive(),
  currentThickness: z.number().positive(),
  previousThickness: z.number().positive().optional(),
  
  // Corrosion allowance (optional - derived as t_actual - t_required when omitted)
  corrosionAllowance: z.number().min(0).optional(),
  
  // Head-specific parameters
  headType: z.enum(['2:1 Ellipsoidal', 'Torispherical', 'Hemispherical', 'Flat']).optional(),
  crownRadius: z.number().positive().optional(),
  knuckleRadius: z.number().positive().optional(),
  
  // Dates for corrosion rate calculation
  yearBuilt: z.number().int().optional(),
  currentYear: z.number().int().optional(),
  previousInspectionDate: z.string().optional(),
  currentInspectionDate: z.string().optional(),
  
  // Static head (for horizontal vessels)
  specificGravity: z.number().positive().optional(),
  liquidHeight: z.number().positive().optional(),
});

export const calculationEngineRouter = router({
  /**
   * Get calculation engine information
   */
  getEngineInfo: protectedProcedure
    .query(() => {
      return getEngineInfo();
    }),

  /**
   * Get ASME material database information
   */
  getMaterialDatabaseInfo: protectedProcedure
    .query(() => {
      return getDatabaseInfo();
    }),

  /**
   * List all available materials in the database
   */
  listMaterials: protectedProcedure
    .query(() => {
      return listAvailableMaterials();
    }),

  /**
   * Validate a material specification
   */
  validateMaterial: protectedProcedure
    .input(z.object({
      materialSpec: z.string(),
    }))
    .query(({ input }) => {
      const normalizedSpec = normalizeMaterialSpec(input.materialSpec);
      const isValid = normalizedSpec !== null;
      const properties = normalizedSpec ? getMaterialProperties(normalizedSpec) : null;
      
      return {
        isValid,
        normalizedSpec,
        properties,
        availableMaterials: isValid ? undefined : listAvailableMaterials(),
      };
    }),

  /**
   * Look up allowable stress from ASME database
   */
  getAllowableStress: protectedProcedure
    .input(z.object({
      materialSpec: z.string(),
      temperatureF: z.number(),
    }))
    .query(({ input }) => {
      return getAllowableStressNormalized(input.materialSpec, input.temperatureF);
    }),

  /**
   * Calculate minimum required thickness for shell
   */
  calculateTRequiredShell: protectedProcedure
    .input(calculationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const calcInput: CalculationInput = {
        ...input,
        previousInspectionDate: input.previousInspectionDate ? new Date(input.previousInspectionDate) : undefined,
        currentInspectionDate: input.currentInspectionDate ? new Date(input.currentInspectionDate) : undefined,
      };
      
      const result = calculateTRequiredShell(calcInput);
      
      // Log calculation for audit trail
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          't_required_shell',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Calculate minimum required thickness for ellipsoidal head
   */
  calculateTRequiredEllipsoidalHead: protectedProcedure
    .input(calculationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const calcInput: CalculationInput = {
        ...input,
        previousInspectionDate: input.previousInspectionDate ? new Date(input.previousInspectionDate) : undefined,
        currentInspectionDate: input.currentInspectionDate ? new Date(input.currentInspectionDate) : undefined,
      };
      
      const result = calculateTRequiredEllipsoidalHead(calcInput);
      
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          't_required_head_ellipsoidal',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Calculate minimum required thickness for torispherical head
   */
  calculateTRequiredTorisphericalHead: protectedProcedure
    .input(calculationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const calcInput: CalculationInput = {
        ...input,
        previousInspectionDate: input.previousInspectionDate ? new Date(input.previousInspectionDate) : undefined,
        currentInspectionDate: input.currentInspectionDate ? new Date(input.currentInspectionDate) : undefined,
      };
      
      const result = calculateTRequiredTorisphericalHead(calcInput);
      
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          't_required_head_torispherical',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Calculate minimum required thickness for hemispherical head
   */
  calculateTRequiredHemisphericalHead: protectedProcedure
    .input(calculationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const calcInput: CalculationInput = {
        ...input,
        previousInspectionDate: input.previousInspectionDate ? new Date(input.previousInspectionDate) : undefined,
        currentInspectionDate: input.currentInspectionDate ? new Date(input.currentInspectionDate) : undefined,
      };
      
      const result = calculateTRequiredHemisphericalHead(calcInput);
      
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          't_required_head_hemispherical',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Calculate MAWP for shell
   */
  calculateMAWPShell: protectedProcedure
    .input(calculationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const calcInput: CalculationInput = {
        ...input,
        previousInspectionDate: input.previousInspectionDate ? new Date(input.previousInspectionDate) : undefined,
        currentInspectionDate: input.currentInspectionDate ? new Date(input.currentInspectionDate) : undefined,
      };
      
      const result = calculateMAWPShell(calcInput);
      
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          'mawp_shell',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Calculate long-term corrosion rate
   */
  calculateCorrosionRateLT: protectedProcedure
    .input(calculationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const calcInput: CalculationInput = {
        ...input,
        previousInspectionDate: input.previousInspectionDate ? new Date(input.previousInspectionDate) : undefined,
        currentInspectionDate: input.currentInspectionDate ? new Date(input.currentInspectionDate) : undefined,
      };
      
      const result = calculateCorrosionRateLongTerm(calcInput);
      
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          'corrosion_rate_lt',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Calculate short-term corrosion rate
   */
  calculateCorrosionRateST: protectedProcedure
    .input(calculationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const calcInput: CalculationInput = {
        ...input,
        previousInspectionDate: input.previousInspectionDate ? new Date(input.previousInspectionDate) : undefined,
        currentInspectionDate: input.currentInspectionDate ? new Date(input.currentInspectionDate) : undefined,
      };
      
      const result = calculateCorrosionRateShortTerm(calcInput);
      
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          'corrosion_rate_st',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Calculate remaining life
   */
  calculateRemainingLife: protectedProcedure
    .input(z.object({
      currentThickness: z.number().positive(),
      tRequired: z.number().positive(),
      corrosionRate: z.number().positive(),
      corrosionRateType: z.enum(['LT', 'ST', 'GOVERNING']),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = calculateRemainingLife(
        input.currentThickness,
        input.tRequired,
        input.corrosionRate,
        input.corrosionRateType
      );
      
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          'remaining_life',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Calculate next inspection interval
   */
  calculateNextInspection: protectedProcedure
    .input(z.object({
      remainingLife: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = calculateNextInspectionInterval(input.remainingLife);
      
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          'next_inspection',
          input,
          result.intermediateValues,
          result.codeReference
        );
      }
      
      return result;
    }),

  /**
   * Perform full calculation suite for a component
   */
  performFullCalculation: protectedProcedure
    .input(z.object({
      componentType: z.enum(['Shell', 'Head']),
      ...calculationInputSchema.shape,
    }))
    .mutation(async ({ input, ctx }) => {
      const { componentType, ...calcParams } = input;
      
      const calcInput: CalculationInput = {
        ...calcParams,
        previousInspectionDate: calcParams.previousInspectionDate ? new Date(calcParams.previousInspectionDate) : undefined,
        currentInspectionDate: calcParams.currentInspectionDate ? new Date(calcParams.currentInspectionDate) : undefined,
      };
      
      const result = performFullCalculation(calcInput, componentType);
      
      // Log the full calculation for audit trail
      if (result.success && ctx.user) {
        const auditContext: AuditContext = {
          userId: String(ctx.user.id),
          userName: ctx.user.name || undefined,
        };
        
        await logCalculation(
          auditContext,
          'calculationResults',
          nanoid(),
          `full_calculation_${componentType.toLowerCase()}`,
          input,
          {
            tRequired: result.summary.tRequired,
            mawp: result.summary.mawp,
            corrosionRate: result.summary.corrosionRate,
            remainingLife: result.summary.remainingLife,
            status: result.summary.status,
          },
          'ASME VIII-1 + API 510'
        );
      }
      
      return result;
    }),

  /**
   * Validate component calculation data
   */
  validateComponentData: protectedProcedure
    .input(z.object({
      actualThickness: z.number().optional(),
      nominalThickness: z.number().optional(),
      minimumThickness: z.number().optional(),
      corrosionRate: z.number().optional(),
      jointEfficiency: z.number().optional(),
      allowableStress: z.number().optional(),
    }))
    .query(({ input }) => {
      return validateComponentData({
        actualThickness: input.actualThickness?.toString(),
        nominalThickness: input.nominalThickness?.toString(),
        minimumThickness: input.minimumThickness?.toString(),
        corrosionRate: input.corrosionRate?.toString(),
        jointEfficiency: input.jointEfficiency?.toString(),
        allowableStress: input.allowableStress?.toString(),
      });
    }),

  /**
   * Validate inspector certification
   */
  validateInspectorCertification: protectedProcedure
    .input(z.object({
      inspectorCertExpiry: z.string().optional(),
      reportDate: z.string().optional(),
    }))
    .query(({ input }) => {
      return validateInspectorCertification({
        inspectorCertExpiry: input.inspectorCertExpiry,
        reportDate: input.reportDate,
      });
    }),

  /**
   * Validate report for finalization
   */
  validateReportForFinalization: protectedProcedure
    .input(z.object({
      inspectorName: z.string().optional(),
      inspectorCertification: z.string().optional(),
      inspectorCertExpiry: z.string().optional(),
      reportDate: z.string().optional(),
      api510Compliant: z.boolean().optional(),
      nonComplianceDetails: z.string().optional(),
    }))
    .query(({ input }) => {
      return validateReportForFinalization(input);
    }),

  /**
   * Generate calculation audit record
   */
  generateAuditRecord: protectedProcedure
    .input(z.object({
      P: z.number(),
      R: z.number().optional(),
      D: z.number().optional(),
      S: z.number(),
      E: z.number(),
      t: z.number(),
      L: z.number().optional(),
      r: z.number().optional(),
      vesselOrientation: z.string().optional(),
      componentType: z.string().optional(),
      headType: z.string().optional(),
      codeReference: z.string(),
      intermediateValues: z.record(z.string(), z.union([z.number(), z.string()])),
    }))
    .mutation(({ input, ctx }) => {
      const { codeReference, intermediateValues, ...calcInputs } = input;
      // Convert intermediateValues to the correct type
      const typedIntermediates: Record<string, number | string> = {};
      for (const [key, value] of Object.entries(intermediateValues)) {
        typedIntermediates[key] = value;
      }
      return createCalculationAuditRecord(
        calcInputs,
        codeReference,
        typedIntermediates,
        ctx.user ? String(ctx.user.id) : 'anonymous'
      );
    }),

  /**
   * Hash report content for signature verification
   */
  hashReportContent: protectedProcedure
    .input(z.object({
      reportContent: z.string(),
    }))
    .mutation(({ input }) => {
      return {
        hash: hashReportContent(input.reportContent),
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
      };
    }),

  /**
   * Get application version for audit trail
   */
  getAppVersion: protectedProcedure
    .query(() => {
      return {
        version: APP_VERSION,
        engineInfo: getEngineInfo(),
        materialDbInfo: getDatabaseInfo(),
      };
    }),

  /**
   * Recompute all calculations for an inspection using the locked calculation engine.
   * 
   * This is the CORRECT way to recalculate after UT data import.
   * The UT import router stores raw thickness data only - this endpoint
   * runs the locked calculation engine to derive:
   * - Corrosion rates (long-term and short-term)
   * - Remaining life (API 510 §7.1.1)
   * - Next inspection interval
   * - Status determination
   * 
   * COMPLIANCE: All calculations go through the locked engine with full audit trail.
   * Each TML's stationKey is logged for traceability.
   */
  recomputeInspection: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../../server/db");
      const { inspections, tmlReadings } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { logger } = await import("../../server/_core/logger");
      
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Load the inspection
      const [inspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.id, input.inspectionId));

      if (!inspection) {
        throw new Error("Inspection not found");
      }

      // 2. Load all TML readings for this inspection
      const tmls = await db
        .select()
        .from(tmlReadings)
        .where(eq(tmlReadings.inspectionId, input.inspectionId));

      if (tmls.length === 0) {
        return { success: false, message: "No TML readings found for this inspection" };
      }

      logger.info(`[RecomputeInspection] Processing ${tmls.length} TMLs for inspection ${input.inspectionId}`);

      // 3. Get vessel parameters needed for calculation
      const designPressure = inspection.designPressure ? parseFloat(String(inspection.designPressure)) : 0;
      const designTemperature = inspection.designTemperature ? parseFloat(String(inspection.designTemperature)) : 0;
      const insideDiameter = inspection.insideDiameter ? parseFloat(String(inspection.insideDiameter)) : 0;
      const jointEfficiency = inspection.jointEfficiency ? parseFloat(String(inspection.jointEfficiency)) : 0.85;
      const materialSpec = inspection.materialSpec || 'SA-516 Gr 70';
      const yearBuilt = inspection.yearBuilt ? parseInt(String(inspection.yearBuilt), 10) : undefined;

      if (designPressure <= 0 || insideDiameter <= 0) {
        return {
          success: false,
          message: "Inspection missing required vessel parameters (designPressure, insideDiameter). Please complete vessel data first.",
        };
      }

      // 4. Process each TML through the locked calculation engine
      let updatedCount = 0;
      const errors: string[] = [];
      const auditEntries: Array<{ stationKey: string; cr: number | null; rl: number | null; status: string }> = [];

      for (const tml of tmls) {
        try {
          const currentThickness = tml.tActual ? parseFloat(String(tml.tActual)) : (tml.currentThickness ? parseFloat(String(tml.currentThickness)) : 0);
          const previousThickness = tml.previousThickness ? parseFloat(String(tml.previousThickness)) : undefined;
          const nominalThickness = tml.nominalThickness ? parseFloat(String(tml.nominalThickness)) : currentThickness;

          if (currentThickness <= 0) {
            errors.push(`TML ${tml.stationKey || tml.id}: No current thickness`);
            continue;
          }

          // Build calculation input
          const calcInput: CalculationInput = {
            insideDiameter,
            designPressure,
            designTemperature,
            materialSpec,
            jointEfficiency,
            nominalThickness,
            currentThickness,
            previousThickness,
            yearBuilt,
            currentYear: new Date().getFullYear(),
            previousInspectionDate: tml.previousInspectionDate ? new Date(tml.previousInspectionDate) : undefined,
            currentInspectionDate: tml.currentInspectionDate ? new Date(tml.currentInspectionDate) : undefined,
          };

          // Determine component type
          const componentGroup = (tml.componentGroup || 'SHELL').toUpperCase();
          const componentType: 'Shell' | 'Head' = componentGroup.includes('HEAD') ? 'Head' : 'Shell';

          // Set head type if applicable
          if (componentType === 'Head' && inspection.headType) {
            calcInput.headType = inspection.headType as any;
          }

          // Run the locked calculation engine
          const result = performFullCalculation(calcInput, componentType);

          if (!result.success) {
            errors.push(`TML ${tml.stationKey || tml.id}: Calculation failed`);
            continue;
          }

          // Extract results
          const governingRate = result.summary.corrosionRate;
          const remainingLife = result.summary.remainingLife;
          const tRequired = result.summary.tRequired;
          const status = result.summary.status;

          // Determine corrosion rate type
          let corrosionRateType: 'LT' | 'ST' | 'GOVERNING' | null = null;
          if (result.summary.corrosionRateType) {
            corrosionRateType = result.summary.corrosionRateType;
          }

          // Calculate long-term and short-term rates individually
          const ltRate = result.corrosionRateLT?.resultValue ?? null;
          const stRate = result.corrosionRateST?.resultValue ?? null;

          // Update the TML record with calculated values
          const updateData: Record<string, any> = {
            tRequired: tRequired !== null ? String(tRequired) : null,
            corrosionRate: governingRate !== null ? String(governingRate) : null,
            corrosionRateType: corrosionRateType,
            longTermRate: ltRate !== null ? String(ltRate) : null,
            shortTermRate: stRate !== null ? String(stRate) : null,
            corrosionRateMpy: governingRate !== null ? String(governingRate * 1000) : null,
            remainingLife: remainingLife !== null ? String(remainingLife) : null,
            status: status === 'unacceptable' ? 'critical' : status === 'marginal' ? 'monitor' : 'good',
            updatedAt: new Date(),
          };

          // Calculate loss fields
          if (nominalThickness > 0 && currentThickness > 0) {
            const loss = nominalThickness - currentThickness;
            updateData.loss = String(Math.max(0, loss));
            updateData.lossPercent = String(((loss / nominalThickness) * 100).toFixed(2));
          }

          // Calculate next inspection date
          if (remainingLife !== null && remainingLife > 0) {
            const halfLife = remainingLife / 2;
            const intervalYears = Math.min(halfLife, 10);
            updateData.nextInspectionInterval = String(intervalYears);
            const nextDate = new Date();
            nextDate.setFullYear(nextDate.getFullYear() + Math.floor(intervalYears));
            updateData.nextInspectionDate = nextDate;
          }

          await db.update(tmlReadings).set(updateData).where(eq(tmlReadings.id, tml.id));
          updatedCount++;

          auditEntries.push({
            stationKey: tml.stationKey || tml.id,
            cr: governingRate,
            rl: remainingLife,
            status,
          });

          // Log audit with stationKey
          await logCalculation(
            {
              userId: String(ctx.user.id),
              userName: ctx.user.name || undefined,
              stationKey: tml.stationKey || undefined,
            },
            'tmlReadings',
            tml.id,
            `recompute_${componentType.toLowerCase()}`,
            {
              currentThickness,
              previousThickness,
              nominalThickness,
              designPressure,
              insideDiameter,
              jointEfficiency,
              materialSpec,
              stationKey: tml.stationKey,
            },
            {
              tRequired,
              governingRate,
              ltRate,
              stRate,
              remainingLife,
              status,
              corrosionRateType,
            },
            'API 510 §7.1.1 + ASME VIII-1'
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`TML ${tml.stationKey || tml.id}: ${msg}`);
          logger.error(`[RecomputeInspection] Error processing TML ${tml.id}:`, err);
        }
      }

      logger.info(`[RecomputeInspection] Complete: ${updatedCount}/${tmls.length} TMLs updated, ${errors.length} errors`);

      return {
        success: true,
        message: `Recomputed ${updatedCount} of ${tmls.length} TMLs using locked calculation engine v${getEngineInfo().version}`,
        summary: {
          totalTMLs: tmls.length,
          updatedTMLs: updatedCount,
          errors: errors.length,
          errorDetails: errors.slice(0, 20), // Limit error details
          engineVersion: getEngineInfo().version,
          auditSummary: auditEntries.slice(0, 10), // Sample for response
        },
      };
    }),
});
