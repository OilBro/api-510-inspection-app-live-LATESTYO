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
  
  // Corrosion allowance
  corrosionAllowance: z.number().min(0),
  
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
});
