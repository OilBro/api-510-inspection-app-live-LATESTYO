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
        materialSpec: z.string().optional(),
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

      // Calculate minimum required thickness (UG-45 basic)
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

      // Also run pressure calc with material-specific allowable stress
      let pressureMinRequired = calculation.minimumRequired;
      let allowableStress: number | undefined;
      if (input.materialSpec) {
        try {
          const inspection = await getInspection(input.inspectionId);
          const designPressure = parseFloat(inspection?.designPressure || '0');
          const designTemp = parseFloat(inspection?.designTemperature || '650');
          if (designPressure > 0) {
            const pressureCalc = calculateNozzlePressureThickness({
              nominalSize: input.nominalSize,
              outsideDiameter: parseFloat(pipeScheduleData.outsideDiameter),
              wallThickness: parseFloat(pipeScheduleData.wallThickness),
              designPressure,
              designTemperature: designTemp,
              materialSpec: input.materialSpec,
            });
            pressureMinRequired = pressureCalc.minimumRequired;
            allowableStress = pressureCalc.allowableStress;
          }
        } catch (e) {
          // fallback to existing calculation
        }
      }

      const finalMinRequired = Math.max(calculation.minimumRequired, pressureMinRequired);
      const acceptable = input.actualThickness !== undefined
        ? input.actualThickness >= finalMinRequired
        : calculation.acceptable;

      // Create nozzle record
      const nozzle = await createNozzle({
        id: nanoid(),
        inspectionId: input.inspectionId,
        nozzleNumber: input.nozzleNumber,
        nozzleDescription: input.nozzleDescription,
        location: input.location,
        nominalSize: input.nominalSize,
        schedule: input.schedule,
        materialSpec: input.materialSpec,
        actualThickness: input.actualThickness?.toString(),
        pipeNominalThickness: calculation.pipeNominalThickness.toString(),
        pipeOutsideDiameter: pipeScheduleData.outsideDiameter,
        pipeMinusManufacturingTolerance: calculation.pipeMinusManufacturingTolerance.toString(),
        shellHeadRequiredThickness: calculation.shellHeadRequiredThickness.toString(),
        minimumRequired: finalMinRequired.toString(),
        acceptable,
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
        materialSpec: z.string().optional(),
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

      // If size/schedule/thickness/material changed, recalculate
      const needsRecalc =
        updates.nominalSize ||
        updates.schedule ||
        updates.materialSpec !== undefined ||
        updates.actualThickness !== undefined ||
        updates.shellHeadRequiredThickness !== undefined;

      if (needsRecalc) {
        const nominalSize = updates.nominalSize || existing.nominalSize;
        const schedule = updates.schedule || existing.schedule;
        const materialSpec = updates.materialSpec !== undefined
          ? updates.materialSpec
          : existing.materialSpec;
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

        // Calculate minimum required thickness (UG-45 basic)
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
          // Also run pressure calc with material-specific allowable stress
          let pressureMinRequired = calculation.minimumRequired;
          if (materialSpec) {
            try {
              const inspection = await getInspection(existing.inspectionId);
              const designPressure = parseFloat(inspection?.designPressure || '0');
              const designTemp = parseFloat(inspection?.designTemperature || '650');
              if (designPressure > 0) {
                const pressureCalc = calculateNozzlePressureThickness({
                  nominalSize,
                  outsideDiameter: parseFloat(pipeScheduleData.outsideDiameter),
                  wallThickness: parseFloat(pipeScheduleData.wallThickness),
                  designPressure,
                  designTemperature: designTemp,
                  materialSpec,
                });
                pressureMinRequired = pressureCalc.minimumRequired;
              }
            } catch (e) {
              // fallback to existing calculation
            }
          }

          const finalMinRequired = Math.max(calculation.minimumRequired, pressureMinRequired);
          const actual = updates.actualThickness !== undefined
            ? updates.actualThickness
            : parseFloat(existing.actualThickness || '0');
          const acceptable = actual > 0 ? actual >= finalMinRequired : calculation.acceptable;

          // Update with calculated values
          return await updateNozzle(nozzleId, {
            ...updates,
            materialSpec: materialSpec || undefined,
            actualThickness: updates.actualThickness?.toString(),
            shellHeadRequiredThickness: shellRequired.toString(),
            pipeNominalThickness: calculation.pipeNominalThickness.toString(),
            pipeMinusManufacturingTolerance: calculation.pipeMinusManufacturingTolerance.toString(),
            minimumRequired: finalMinRequired.toString(),
            acceptable,
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

  /**
   * Recalculate nozzles with U-1 data enrichment
   * SEPARATE from the component calculations recalculate
   * 
   * 1. Finds U-1 form attachments for this inspection
   * 2. Parses them to extract nozzle schedule data (size, material, nominal thickness)
   * 3. Cross-references with existing nozzle evaluations
   * 4. Updates missing/incorrect fields
   */
  recalculateNozzles: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ input }) => {
      const { logger } = await import('./_core/logger');
      logger.info(`[Nozzle Recalc] Starting for inspection: ${input.inspectionId}`);

      // Get inspection data
      const inspection = await getInspection(input.inspectionId);
      if (!inspection) {
        throw new Error('Inspection not found');
      }

      const designPressure = parseFloat(inspection.designPressure || '0');
      const designTemp = parseFloat(inspection.designTemperature || '650');

      // Get existing nozzles
      const existingNozzles = await getNozzlesByInspection(input.inspectionId);
      logger.info(`[Nozzle Recalc] Found ${existingNozzles.length} existing nozzles`);

      // Try to find and parse U-1 form attachments
      let u1NozzleData: any[] = [];
      try {
        const { getVesselDrawingsByInspection } = await import('./professionalReportDb');
        const drawings = await getVesselDrawingsByInspection(input.inspectionId);
        const u1Forms = drawings.filter((d: any) =>
          d.category === 'u1_form' || d.category === 'u1a_form' || d.category === 'mdr'
        );

        logger.info(`[Nozzle Recalc] Found ${u1Forms.length} U-1/MDR attachments`);

        if (u1Forms.length > 0) {
          const { parseU1ForNozzleData } = await import('./u1NozzleParser');

          for (const u1Form of u1Forms) {
            try {
              const fileUrl = u1Form.fileUrl;
              logger.info(`[Nozzle Recalc] Fetching U-1 form: ${u1Form.title} (${fileUrl})`);

              let buffer: Buffer;

              // Handle local storage paths (read from disk)
              if (fileUrl.startsWith('/local-storage/')) {
                const path = await import('path');
                const fs = await import('fs');
                const relativePath = fileUrl.replace('/local-storage/', '');
                const filePath = path.default.resolve(process.cwd(), 'local-storage', relativePath);
                if (!fs.default.existsSync(filePath)) {
                  logger.warn(`[Nozzle Recalc] Local file not found: ${filePath}`);
                  continue;
                }
                buffer = fs.default.readFileSync(filePath);
                logger.info(`[Nozzle Recalc] Read local file: ${filePath} (${buffer.length} bytes)`);
              } else if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
                // Handle full HTTP(S) URLs
                const response = await fetch(fileUrl);
                if (!response.ok) {
                  logger.warn(`[Nozzle Recalc] Failed to fetch U-1 form: ${response.status}`);
                  continue;
                }
                const arrayBuffer = await response.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
              } else {
                // Fallback: try reading as relative path from cwd
                const path = await import('path');
                const fs = await import('fs');
                const localPath = path.default.resolve(process.cwd(), fileUrl.replace(/^\//, ''));
                if (!fs.default.existsSync(localPath)) {
                  logger.warn(`[Nozzle Recalc] File not found at: ${localPath}`);
                  continue;
                }
                buffer = fs.default.readFileSync(localPath);
              }

              const fileName = u1Form.fileName || 'u1-form';
              const ext = fileName.split('.').pop()?.toLowerCase() || '';
              const mimeType = ext === 'pdf' ? 'application/pdf' :
                ['jpg', 'jpeg'].includes(ext) ? 'image/jpeg' :
                  ext === 'png' ? 'image/png' :
                    ext === 'tiff' || ext === 'tif' ? 'image/tiff' :
                      'application/pdf';

              const result = await parseU1ForNozzleData(buffer, u1Form.fileName || 'u1-form', mimeType);

              if (result.nozzles.length > 0) {
                logger.info(`[Nozzle Recalc] Extracted ${result.nozzles.length} nozzles from U-1 form "${u1Form.title}" (confidence: ${result.confidence})`);
                u1NozzleData = [...u1NozzleData, ...result.nozzles];
              }
            } catch (err: any) {
              logger.warn(`[Nozzle Recalc] Error parsing U-1 form "${u1Form.title}": ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[Nozzle Recalc] Error fetching U-1 forms: ${err.message}`);
      }

      logger.info(`[Nozzle Recalc] Total U-1 nozzle data extracted: ${u1NozzleData.length}`);

      // Cross-reference and update existing nozzles
      let updated = 0;
      let enriched = 0;

      for (const nozzle of existingNozzles) {
        const normalizedNum = nozzle.nozzleNumber.replace(/[-\s]/g, '').toUpperCase();

        const u1Match = u1NozzleData.find((u1: any) => {
          const u1Num = (u1.nozzleNumber || '').replace(/[-\s]/g, '').toUpperCase();
          return u1Num === normalizedNum;
        });

        const updateFields: any = {};

        if (u1Match) {
          logger.info(`[Nozzle Recalc] U-1 match for ${nozzle.nozzleNumber}: size=${u1Match.size} mat=${u1Match.material} nomThick=${u1Match.nominalThickness} sch=${u1Match.schedule}`);

          if (u1Match.material && !nozzle.materialSpec) {
            updateFields.materialSpec = u1Match.material;
            enriched++;
          }

          if (u1Match.nominalThickness > 0 && (!nozzle.nominalThickness || parseFloat(nozzle.nominalThickness) === 0)) {
            updateFields.nominalThickness = u1Match.nominalThickness.toString();
          }

          if (u1Match.size && u1Match.size !== nozzle.nominalSize) {
            logger.info(`[Nozzle Recalc] Size mismatch for ${nozzle.nozzleNumber}: DB=${nozzle.nominalSize} U1=${u1Match.size}`);
            updateFields.nominalSize = u1Match.size;
          }

          if (u1Match.schedule && u1Match.schedule !== nozzle.schedule) {
            updateFields.schedule = u1Match.schedule;
          }

          if (u1Match.service && !nozzle.nozzleDescription) {
            updateFields.nozzleDescription = u1Match.service;
          }
          if (u1Match.service && !nozzle.service) {
            updateFields.service = u1Match.service;
          }
        }

        // Recalculate pipe schedule data and min required thickness
        const nominalSize = updateFields.nominalSize || nozzle.nominalSize;
        const schedule = updateFields.schedule || nozzle.schedule || 'STD';

        try {
          const pipeScheduleData = await getPipeSchedule(nominalSize, schedule);

          if (pipeScheduleData) {
            if (!updateFields.nominalThickness && (!nozzle.nominalThickness || parseFloat(nozzle.nominalThickness) === 0)) {
              updateFields.nominalThickness = pipeScheduleData.wallThickness;
            }

            if (designPressure > 0) {
              const pressureCalc = calculateNozzlePressureThickness({
                nominalSize,
                outsideDiameter: parseFloat(pipeScheduleData.outsideDiameter),
                wallThickness: parseFloat(pipeScheduleData.wallThickness),
                designPressure,
                designTemperature: designTemp,
                materialSpec: u1Match?.material || inspection.materialSpec || undefined,
              });

              updateFields.pipeOutsideDiameter = pipeScheduleData.outsideDiameter;
              updateFields.pipeNominalThickness = pressureCalc.pipeNominalThickness.toString();
              updateFields.pipeMinusManufacturingTolerance = pressureCalc.pipeMinusTolerance.toString();
              updateFields.shellHeadRequiredThickness = pressureCalc.requiredThickness.toString();
              updateFields.minimumRequired = pressureCalc.minimumRequired.toString();

              const actual = parseFloat(nozzle.actualThickness || '0');
              if (actual > 0) {
                updateFields.acceptable = actual >= pressureCalc.minimumRequired;
              }
            }
          }
        } catch (err: any) {
          logger.warn(`[Nozzle Recalc] Pipe schedule lookup failed for ${nozzle.nozzleNumber}: ${err.message}`);
        }

        if (Object.keys(updateFields).length > 0) {
          logger.info(`[Nozzle Recalc] Updating ${nozzle.nozzleNumber}: ${JSON.stringify(updateFields)}`);
          await updateNozzle(nozzle.id, updateFields);
          updated++;
        }
      }

      logger.info(`[Nozzle Recalc] Complete: ${updated} nozzles updated, ${enriched} enriched with U-1 data`);

      return {
        success: true,
        totalNozzles: existingNozzles.length,
        updated,
        enrichedFromU1: enriched,
        u1NozzlesFound: u1NozzleData.length,
        message: u1NozzleData.length > 0
          ? `Updated ${updated} nozzles, enriched ${enriched} with U-1 data`
          : `Updated ${updated} nozzles (no U-1 forms found - used pipe schedule database)`
      };
    }),
});


