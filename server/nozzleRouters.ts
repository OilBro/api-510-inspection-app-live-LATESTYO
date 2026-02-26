/**
 * tRPC routers for nozzle evaluations
 */

import { z } from 'zod';
import { nanoid } from 'nanoid';
import { protectedProcedure, router } from './_core/trpc.js';
import {
  getNozzlesByInspection,
  getNozzleById,
  createNozzle,
  updateNozzle,
  deleteNozzle,
  deleteAllNozzles,
  getPipeSchedule,
  getPipeSchedulesBySize,
  getAllNominalSizes,
  getAllSchedules,
} from './nozzleDb.js';
import { calculateNozzleWithSchedule } from './nozzleCalculations.js';
import { calculateNozzlePressureThickness } from './nozzlePressureCalc.js';
import { parseNozzleExcel, generateNozzleExcel, generateNozzleTemplate, NozzleExcelRow, NozzleExportRow } from './nozzleExcel.js';
import { getInspection } from './db.js';

export const nozzleRouter = router({
  /**
   * Get all nozzles for an inspection
   */
  list: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ input }) => {
      return await getNozzlesByInspection(input.inspectionId);
    }),

  /**
   * Get a single nozzle by ID
   */
  get: protectedProcedure
    .input(z.object({ nozzleId: z.string() }))
    .query(async ({ input }) => {
      return await getNozzleById(input.nozzleId);
    }),

  /**
   * Create a new nozzle evaluation
   */
  create: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        nozzleNumber: z.string(),
        nozzleDescription: z.string().optional(),
        location: z.string().optional(),
        nominalSize: z.string(),
        schedule: z.string(),
        actualThickness: z.number().optional(),
        shellHeadRequiredThickness: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      // Get pipe schedule data
      const pipeScheduleData = await getPipeSchedule(input.nominalSize, input.schedule);

      if (!pipeScheduleData) {
        throw new Error(`Pipe schedule not found for ${input.nominalSize}" ${input.schedule}`);
      }

      // Calculate minimum required thickness
      const calculation = calculateNozzleWithSchedule({
        nozzleNumber: input.nozzleNumber,
        nominalSize: input.nominalSize,
        schedule: input.schedule,
        shellHeadRequiredThickness: input.shellHeadRequiredThickness,
        actualThickness: input.actualThickness,
        pipeScheduleData: {
          outsideDiameter: parseFloat(pipeScheduleData.outsideDiameter),
          wallThickness: parseFloat(pipeScheduleData.wallThickness),
        },
      });

      if (!calculation) {
        throw new Error('Failed to calculate nozzle minimum thickness');
      }

      // Create nozzle record
      const nozzle = await createNozzle({
        id: nanoid(),
        inspectionId: input.inspectionId,
        nozzleNumber: input.nozzleNumber,
        nozzleDescription: input.nozzleDescription,
        location: input.location,
        nominalSize: input.nominalSize,
        schedule: input.schedule,
        actualThickness: input.actualThickness?.toString(),
        pipeNominalThickness: calculation.pipeNominalThickness.toString(),
        pipeMinusManufacturingTolerance: calculation.pipeMinusManufacturingTolerance.toString(),
        shellHeadRequiredThickness: calculation.shellHeadRequiredThickness.toString(),
        minimumRequired: calculation.minimumRequired.toString(),
        acceptable: calculation.acceptable,
      });

      return nozzle;
    }),

  /**
   * Update a nozzle evaluation
   */
  update: protectedProcedure
    .input(
      z.object({
        nozzleId: z.string(),
        nozzleNumber: z.string().optional(),
        nozzleDescription: z.string().optional(),
        location: z.string().optional(),
        nominalSize: z.string().optional(),
        schedule: z.string().optional(),
        actualThickness: z.number().optional(),
        shellHeadRequiredThickness: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { nozzleId, ...updates } = input;

      // Get existing nozzle
      const existing = await getNozzleById(nozzleId);
      if (!existing) {
        throw new Error('Nozzle not found');
      }

      // If size/schedule/thickness changed, recalculate
      const needsRecalc =
        updates.nominalSize ||
        updates.schedule ||
        updates.actualThickness !== undefined ||
        updates.shellHeadRequiredThickness !== undefined;

      if (needsRecalc) {
        const nominalSize = updates.nominalSize || existing.nominalSize;
        const schedule = updates.schedule || existing.schedule;
        const shellRequired = updates.shellHeadRequiredThickness !== undefined
          ? updates.shellHeadRequiredThickness
          : parseFloat(existing.shellHeadRequiredThickness || '0');

        if (!schedule) {
          throw new Error('Schedule is required for nozzle calculations');
        }

        // Get pipe schedule data
        const pipeScheduleData = await getPipeSchedule(nominalSize, schedule);

        if (!pipeScheduleData) {
          throw new Error(`Pipe schedule not found for ${nominalSize}" ${schedule}`);
        }

        // Calculate minimum required thickness
        const calculation = calculateNozzleWithSchedule({
          nozzleNumber: updates.nozzleNumber || existing.nozzleNumber,
          nominalSize,
          schedule,
          shellHeadRequiredThickness: shellRequired,
          actualThickness: updates.actualThickness,
          pipeScheduleData: {
            outsideDiameter: parseFloat(pipeScheduleData.outsideDiameter),
            wallThickness: parseFloat(pipeScheduleData.wallThickness),
          },
        });

        if (calculation) {
          // Update with calculated values
          return await updateNozzle(nozzleId, {
            ...updates,
            actualThickness: updates.actualThickness?.toString(),
            shellHeadRequiredThickness: shellRequired.toString(),
            pipeNominalThickness: calculation.pipeNominalThickness.toString(),
            pipeMinusManufacturingTolerance: calculation.pipeMinusManufacturingTolerance.toString(),
            minimumRequired: calculation.minimumRequired.toString(),
            acceptable: calculation.acceptable,
          });
        }
      }

      // Simple update without recalculation
      return await updateNozzle(nozzleId, {
        ...updates,
        actualThickness: updates.actualThickness?.toString(),
        shellHeadRequiredThickness: updates.shellHeadRequiredThickness?.toString(),
      });
    }),

  /**
   * Delete a nozzle evaluation
   */
  delete: protectedProcedure
    .input(z.object({ nozzleId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteNozzle(input.nozzleId);
      return { success: true };
    }),

  /**
   * Delete ALL nozzles for an inspection (bulk delete)
   */
  deleteAll: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteAllNozzles(input.inspectionId);
      return { success: true };
    }),

  /**
   * Get pipe schedule by size and schedule
   */
  getPipeSchedule: protectedProcedure
    .input(
      z.object({
        nominalSize: z.string(),
        schedule: z.string(),
      })
    )
    .query(async ({ input }) => {
      return await getPipeSchedule(input.nominalSize, input.schedule);
    }),

  /**
   * Get all schedules for a nominal size
   */
  getSchedulesBySize: protectedProcedure
    .input(z.object({ nominalSize: z.string() }))
    .query(async ({ input }) => {
      return await getPipeSchedulesBySize(input.nominalSize);
    }),

  /**
   * Get all available nominal sizes
   */
  getNominalSizes: protectedProcedure.query(async () => {
    return await getAllNominalSizes();
  }),

  /**
   * Get all available schedules
   */
  getSchedules: protectedProcedure.query(async () => {
    return await getAllSchedules();
  }),

  /**
   * Download blank Excel template for nozzle import
   */
  downloadTemplate: protectedProcedure.query(async () => {
    const buffer = generateNozzleTemplate();
    return {
      data: buffer.toString('base64'),
      filename: 'Nozzle_Import_Template.xlsx',
    };
  }),

  /**
   * Import nozzles from Excel file
   */
  importExcel: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        fileData: z.string(), // Base64 encoded Excel file
      })
    )
    .mutation(async ({ input }) => {
      // Get inspection data for design parameters
      const inspection = await getInspection(input.inspectionId);
      if (!inspection) {
        throw new Error('Inspection not found');
      }

      const designPressure = parseFloat(inspection.designPressure || '0');
      const designTemp = parseFloat(inspection.designTemperature || '650');

      if (designPressure <= 0) {
        throw new Error('Design pressure is required for nozzle calculations. Please set it in vessel data.');
      }
      // Decode base64 to buffer
      const buffer = Buffer.from(input.fileData, 'base64');

      // Parse Excel file
      const excelRows = parseNozzleExcel(buffer);

      // Create nozzles from Excel data
      const createdNozzles = [];
      const errors = [];

      for (let i = 0; i < excelRows.length; i++) {
        const row = excelRows[i];

        try {
          // Get pipe schedule data
          const pipeScheduleData = await getPipeSchedule(row.size, row.schedule);

          if (!pipeScheduleData) {
            errors.push(`Row ${i + 2}: Pipe schedule not found for ${row.size}" ${row.schedule}`);
            continue;
          }

          // Calculate minimum required thickness using pressure design
          const pressureCalc = calculateNozzlePressureThickness({
            nominalSize: row.size,
            outsideDiameter: parseFloat(pipeScheduleData.outsideDiameter),
            wallThickness: parseFloat(pipeScheduleData.wallThickness),
            designPressure,
            designTemperature: designTemp,
            materialSpec: inspection.materialSpec || undefined,
          });

          const minimumRequired = pressureCalc.minimumRequired;
          const actualThickness = row.actualThickness;
          const acceptable = actualThickness >= minimumRequired;

          const calculation = {
            pipeNominalThickness: pressureCalc.pipeNominalThickness,
            pipeMinusManufacturingTolerance: pressureCalc.pipeMinusTolerance,
            shellHeadRequiredThickness: pressureCalc.requiredThickness, // Store pressure design thickness
            minimumRequired,
            acceptable,
          };

          // Create nozzle record
          const nozzle = await createNozzle({
            id: nanoid(),
            inspectionId: input.inspectionId,
            nozzleNumber: row.nozzleNumber,
            nozzleDescription: row.notes,
            location: row.location,
            nominalSize: row.size,
            schedule: row.schedule,
            actualThickness: row.actualThickness.toString(),
            pipeNominalThickness: calculation.pipeNominalThickness.toString(),
            pipeMinusManufacturingTolerance: calculation.pipeMinusManufacturingTolerance.toString(),
            shellHeadRequiredThickness: calculation.shellHeadRequiredThickness.toString(),
            minimumRequired: calculation.minimumRequired.toString(),
            acceptable: calculation.acceptable,
          });

          createdNozzles.push(nozzle);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Row ${i + 2} (${row.nozzleNumber}): ${errorMsg}`);
        }
      }

      return {
        success: createdNozzles.length,
        failed: errors.length,
        errors,
        nozzles: createdNozzles,
      };
    }),

  /**
   * Export nozzles to Excel file
   */
  exportExcel: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ input }) => {
      // Get all nozzles for the inspection
      const nozzles = await getNozzlesByInspection(input.inspectionId);

      if (nozzles.length === 0) {
        throw new Error('No nozzles found for this inspection');
      }

      // Map to export format
      const exportData: NozzleExportRow[] = nozzles.map(n => {
        const actual = parseFloat(n.actualThickness || '0');
        const minRequired = parseFloat(n.minimumRequired || '0');
        const margin = actual - minRequired;

        return {
          nozzleNumber: n.nozzleNumber,
          size: n.nominalSize,
          schedule: n.schedule || '',
          location: n.location || '',
          nominalThickness: parseFloat(n.pipeNominalThickness || '0'),
          minusManufacturingTolerance: parseFloat(n.pipeMinusManufacturingTolerance || '0'),
          actualThickness: actual,
          minimumRequired: minRequired,
          margin,
          status: n.acceptable ? 'ACCEPTABLE' : 'NOT ACCEPTABLE',
          notes: n.nozzleDescription || '',
        };
      });

      // Generate Excel file
      const buffer = generateNozzleExcel(exportData);

      return {
        data: buffer.toString('base64'),
        filename: `Nozzle_Evaluation_${input.inspectionId}.xlsx`,
      };
    }),
});

