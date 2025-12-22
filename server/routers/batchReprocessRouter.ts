import { logger } from "../_core/logger";
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { importedFiles, inspections, tmlReadings, nozzleEvaluations, professionalReports, componentCalculations, checklistItems, inspectionFindings } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { parseAndStandardizeWithManus } from "../manusParser";
import { nanoid } from "nanoid";

/**
 * Batch Re-Process Router
 * Handles re-processing of previously imported PDFs with improved extraction
 */
export const batchReprocessRouter = router({
  /**
   * List all imported PDFs with their status
   */
  listImportedFiles: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get all imported files for this user
      const files = await db
        .select({
          id: importedFiles.id,
          inspectionId: importedFiles.inspectionId,
          fileName: importedFiles.fileName,
          fileType: importedFiles.fileType,
          fileUrl: importedFiles.fileUrl,
          parserType: importedFiles.parserType,
          processingStatus: importedFiles.processingStatus,
          createdAt: importedFiles.createdAt,
          processedAt: importedFiles.processedAt,
        })
        .from(importedFiles)
        .where(eq(importedFiles.userId, ctx.user.id))
        .orderBy(desc(importedFiles.createdAt));

      // Get inspection details for each file
      const filesWithInspections = await Promise.all(
        files.map(async (file) => {
          const [inspection] = await db
            .select({
              vesselTagNumber: inspections.vesselTagNumber,
              vesselName: inspections.vesselName,
              status: inspections.status,
            })
            .from(inspections)
            .where(eq(inspections.id, file.inspectionId))
            .limit(1);

          return {
            ...file,
            vesselTagNumber: inspection?.vesselTagNumber || "Unknown",
            vesselName: inspection?.vesselName || null,
            inspectionStatus: inspection?.status || "unknown",
          };
        })
      );

      return filesWithInspections;
    }),

  /**
   * Re-process a single imported PDF with improved extraction
   */
  reprocessSingle: protectedProcedure
    .input(z.object({
      importedFileId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get the imported file record
      const [importedFile] = await db
        .select()
        .from(importedFiles)
        .where(
          and(
            eq(importedFiles.id, input.importedFileId),
            eq(importedFiles.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!importedFile) {
        throw new Error("Imported file not found or access denied");
      }

      if (!importedFile.fileUrl) {
        throw new Error("Original PDF file URL not available for re-processing");
      }

      logger.info(`[Batch Reprocess] Starting re-process for file ${importedFile.fileName} (${importedFile.id})`);

      // Update status to processing
      await db
        .update(importedFiles)
        .set({ processingStatus: "processing" })
        .where(eq(importedFiles.id, input.importedFileId));

      try {
        // Download the PDF from storage
        const pdfResponse = await fetch(importedFile.fileUrl);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
        }
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

        // Re-parse with improved extraction
        logger.info(`[Batch Reprocess] Re-parsing PDF with improved extraction...`);
        const extractedData = await parseAndStandardizeWithManus(pdfBuffer, importedFile.fileName);

        // Get the inspection ID
        const inspectionId = importedFile.inspectionId;

        // Delete existing TML readings for this inspection
        await db.delete(tmlReadings).where(eq(tmlReadings.inspectionId, inspectionId));
        logger.info(`[Batch Reprocess] Deleted existing TML readings`);

        // Delete existing nozzle evaluations
        await db.delete(nozzleEvaluations).where(eq(nozzleEvaluations.inspectionId, inspectionId));
        logger.info(`[Batch Reprocess] Deleted existing nozzle evaluations`);

        // Delete existing component calculations and checklist
        const [existingReport] = await db
          .select()
          .from(professionalReports)
          .where(eq(professionalReports.inspectionId, inspectionId))
          .limit(1);

        if (existingReport) {
          await db.delete(componentCalculations).where(eq(componentCalculations.reportId, existingReport.id));
          await db.delete(checklistItems).where(eq(checklistItems.reportId, existingReport.id));
          logger.info(`[Batch Reprocess] Deleted existing calculations and checklist`);
        }

        // Re-create TML readings from new extraction
        let tmlCount = 0;
        let nozzleCount = 0;

        if (extractedData.tmlReadings && extractedData.tmlReadings.length > 0) {
          const nozzleKeywords = ['manway', 'relief', 'vapor', 'sight', 'gauge', 'reactor', 'feed', 'inlet', 'outlet', 'drain', 'vent', 'nozzle'];

          for (const tml of extractedData.tmlReadings) {
            const tmlId = nanoid();
            const component = tml.component || tml.location || 'Unknown';
            const isNozzle = nozzleKeywords.some(keyword => component.toLowerCase().includes(keyword));

            // Insert TML reading
            await db.insert(tmlReadings).values({
              id: tmlId,
              inspectionId: inspectionId,
              cmlNumber: tml.cmlNumber || `CML-${tmlCount + 1}`,
              componentType: component,
              component: component,
              location: tml.location || component,
              tActual: tml.currentThickness?.toString() || null,
              currentThickness: tml.currentThickness?.toString() || null,
              nominalThickness: tml.nominalThickness?.toString() || null,
              previousThickness: tml.previousThickness?.toString() || null,
              status: "good",
            });
            tmlCount++;

            // Create nozzle evaluation if it's a nozzle
            if (isNozzle) {
              const sizeMatch = component.match(/(\d+(?:\.\d+)?)\s*["']/);
              const nominalSize = sizeMatch ? sizeMatch[1] : '1';
              const description = component.replace(/\d+\s*["']/g, '').trim();

                await db.insert(nozzleEvaluations).values({
                  id: nanoid(),
                  inspectionId: inspectionId,
                  nozzleNumber: tml.cmlNumber || `N${nozzleCount + 1}`,
                  nozzleDescription: description,
                  location: tml.location || null,
                  nominalSize: nominalSize,
                  actualThickness: tml.currentThickness?.toString() || null,
                  acceptable: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              nozzleCount++;
            }
          }
        }

        // Re-create nozzles from extracted nozzle data
        if (extractedData.nozzles && extractedData.nozzles.length > 0) {
          for (const nozzle of extractedData.nozzles) {
            // Check if we already created this nozzle from TML readings
            const existingNozzle = await db
              .select()
              .from(nozzleEvaluations)
              .where(
                and(
                  eq(nozzleEvaluations.inspectionId, inspectionId),
                  eq(nozzleEvaluations.nozzleNumber, nozzle.nozzleNumber || '')
                )
              )
              .limit(1);

            if (existingNozzle.length === 0) {
              await db.insert(nozzleEvaluations).values({
                id: nanoid(),
                inspectionId: inspectionId,
                nozzleNumber: nozzle.nozzleNumber || `N${nozzleCount + 1}`,
                nozzleDescription: nozzle.service || nozzle.nozzleNumber || 'Unknown',
                nominalSize: nozzle.size?.replace(/[^0-9.]/g, '') || '1',
                schedule: nozzle.schedule || null,
                actualThickness: nozzle.actualThickness?.toString() || null,
                pipeNominalThickness: nozzle.nominalThickness?.toString() || null,
                minimumRequired: nozzle.minimumRequired?.toString() || null,
                acceptable: nozzle.acceptable !== false,
                notes: nozzle.notes || null,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              nozzleCount++;
            }
          }
        }

        // Update vessel data if extracted
        if (extractedData.vesselData) {
          const vesselUpdates: Record<string, any> = {};
          
          if (extractedData.vesselData.vesselTagNumber) vesselUpdates.vesselTagNumber = extractedData.vesselData.vesselTagNumber;
          if (extractedData.vesselData.vesselName) vesselUpdates.vesselName = extractedData.vesselData.vesselName;
          if (extractedData.vesselData.manufacturer) vesselUpdates.manufacturer = extractedData.vesselData.manufacturer;
          if (extractedData.vesselData.yearBuilt) vesselUpdates.yearBuilt = extractedData.vesselData.yearBuilt;
          if (extractedData.vesselData.designPressure) vesselUpdates.designPressure = extractedData.vesselData.designPressure;
          if (extractedData.vesselData.designTemperature) vesselUpdates.designTemperature = extractedData.vesselData.designTemperature;
          if (extractedData.vesselData.materialSpec) vesselUpdates.materialSpec = extractedData.vesselData.materialSpec;
          if (extractedData.vesselData.insideDiameter) vesselUpdates.insideDiameter = extractedData.vesselData.insideDiameter;
          if (extractedData.vesselData.overallLength) vesselUpdates.overallLength = extractedData.vesselData.overallLength;
          if (extractedData.vesselData.headType) vesselUpdates.headType = extractedData.vesselData.headType;
          if (extractedData.vesselData.allowableStress) vesselUpdates.allowableStress = extractedData.vesselData.allowableStress;
          if (extractedData.vesselData.jointEfficiency) vesselUpdates.jointEfficiency = extractedData.vesselData.jointEfficiency;

          if (Object.keys(vesselUpdates).length > 0) {
            vesselUpdates.updatedAt = new Date();
            await db.update(inspections).set(vesselUpdates).where(eq(inspections.id, inspectionId));
          }
        }

        // Re-generate component calculations
        if (existingReport) {
          const { generateDefaultCalculationsForInspection, initializeDefaultChecklist } = await import('../professionalReportDb');
          await generateDefaultCalculationsForInspection(inspectionId, existingReport.id);
          await initializeDefaultChecklist(existingReport.id);
          logger.info(`[Batch Reprocess] Re-generated calculations and checklist`);
        }

        // Update the imported file record with new extracted data
        await db
          .update(importedFiles)
          .set({
            extractedData: JSON.stringify(extractedData),
            processingStatus: "completed",
            processedAt: new Date(),
            errorMessage: null,
          })
          .where(eq(importedFiles.id, input.importedFileId));

        logger.info(`[Batch Reprocess] Completed re-processing: ${tmlCount} TMLs, ${nozzleCount} nozzles`);

        return {
          success: true,
          inspectionId,
          tmlCount,
          nozzleCount,
          message: `Re-processed successfully: ${tmlCount} TML readings, ${nozzleCount} nozzle evaluations`,
        };
      } catch (error) {
        logger.error(`[Batch Reprocess] Failed:`, error);

        // Update status to failed
        await db
          .update(importedFiles)
          .set({
            processingStatus: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(importedFiles.id, input.importedFileId));

        throw new Error(`Re-processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),

  /**
   * Batch re-process all imported PDFs
   */
  reprocessAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get all PDF files for this user
      const files = await db
        .select()
        .from(importedFiles)
        .where(
          and(
            eq(importedFiles.userId, ctx.user.id),
            eq(importedFiles.fileType, "pdf")
          )
        );

      if (files.length === 0) {
        return {
          success: true,
          totalFiles: 0,
          processedFiles: 0,
          failedFiles: 0,
          results: [],
          message: "No PDF files found to re-process",
        };
      }

      logger.info(`[Batch Reprocess] Starting batch re-process of ${files.length} files`);

      const results: Array<{
        fileId: string;
        fileName: string;
        success: boolean;
        message: string;
      }> = [];

      let processedCount = 0;
      let failedCount = 0;

      for (const file of files) {
        try {
          if (!file.fileUrl) {
            results.push({
              fileId: file.id,
              fileName: file.fileName,
              success: false,
              message: "No file URL available",
            });
            failedCount++;
            continue;
          }

          // Update status to processing
          await db
            .update(importedFiles)
            .set({ processingStatus: "processing" })
            .where(eq(importedFiles.id, file.id));

          // Download and re-parse
          const pdfResponse = await fetch(file.fileUrl);
          if (!pdfResponse.ok) {
            throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
          }
          const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

          const extractedData = await parseAndStandardizeWithManus(pdfBuffer, file.fileName);

          // Delete and recreate data (same logic as reprocessSingle)
          const inspectionId = file.inspectionId;

          await db.delete(tmlReadings).where(eq(tmlReadings.inspectionId, inspectionId));
          await db.delete(nozzleEvaluations).where(eq(nozzleEvaluations.inspectionId, inspectionId));

          const [existingReport] = await db
            .select()
            .from(professionalReports)
            .where(eq(professionalReports.inspectionId, inspectionId))
            .limit(1);

          if (existingReport) {
            await db.delete(componentCalculations).where(eq(componentCalculations.reportId, existingReport.id));
            await db.delete(checklistItems).where(eq(checklistItems.reportId, existingReport.id));
          }

          // Re-create TML readings
          let tmlCount = 0;
          let nozzleCount = 0;
          const nozzleKeywords = ['manway', 'relief', 'vapor', 'sight', 'gauge', 'reactor', 'feed', 'inlet', 'outlet', 'drain', 'vent', 'nozzle'];

          if (extractedData.tmlReadings) {
            for (const tml of extractedData.tmlReadings) {
              const component = tml.component || tml.location || 'Unknown';
              const isNozzle = nozzleKeywords.some(keyword => component.toLowerCase().includes(keyword));

              await db.insert(tmlReadings).values({
                id: nanoid(),
                inspectionId: inspectionId,
                cmlNumber: tml.cmlNumber || `CML-${tmlCount + 1}`,
                componentType: component,
                component: component,
                location: tml.location || component,
                tActual: tml.currentThickness?.toString() || null,
                currentThickness: tml.currentThickness?.toString() || null,
                nominalThickness: tml.nominalThickness?.toString() || null,
                previousThickness: tml.previousThickness?.toString() || null,
                status: "good",
              });
              tmlCount++;

              if (isNozzle) {
                const sizeMatch = component.match(/(\d+(?:\.\d+)?)\s*["']/);
                const nominalSize = sizeMatch ? sizeMatch[1] : '1';

                await db.insert(nozzleEvaluations).values({
                  id: nanoid(),
                  inspectionId: inspectionId,
                  nozzleNumber: tml.cmlNumber || `N${nozzleCount + 1}`,
                  nozzleDescription: component.replace(/\d+\s*["']/g, '').trim(),
                  nominalSize: nominalSize,
                  actualThickness: tml.currentThickness?.toString() || null,
                  acceptable: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
                nozzleCount++;
              }
            }
          }

          // Re-create nozzles from extracted data
          if (extractedData.nozzles) {
            for (const nozzle of extractedData.nozzles) {
              await db.insert(nozzleEvaluations).values({
                id: nanoid(),
                inspectionId: inspectionId,
                nozzleNumber: nozzle.nozzleNumber || `N${nozzleCount + 1}`,
                nozzleDescription: nozzle.service || 'Unknown',
                nominalSize: nozzle.size?.replace(/[^0-9.]/g, '') || '1',
                schedule: nozzle.schedule || null,
                actualThickness: nozzle.actualThickness?.toString() || null,
                minimumRequired: nozzle.minimumRequired?.toString() || null,
                acceptable: nozzle.acceptable !== false,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              nozzleCount++;
            }
          }

          // Re-generate calculations
          if (existingReport) {
            const { generateDefaultCalculationsForInspection, initializeDefaultChecklist } = await import('../professionalReportDb');
            await generateDefaultCalculationsForInspection(inspectionId, existingReport.id);
            await initializeDefaultChecklist(existingReport.id);
          }

          // Update file record
          await db
            .update(importedFiles)
            .set({
              extractedData: JSON.stringify(extractedData),
              processingStatus: "completed",
              processedAt: new Date(),
              errorMessage: null,
            })
            .where(eq(importedFiles.id, file.id));

          results.push({
            fileId: file.id,
            fileName: file.fileName,
            success: true,
            message: `${tmlCount} TMLs, ${nozzleCount} nozzles`,
          });
          processedCount++;

        } catch (error) {
          logger.error(`[Batch Reprocess] Failed for ${file.fileName}:`, error);

          await db
            .update(importedFiles)
            .set({
              processingStatus: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            })
            .where(eq(importedFiles.id, file.id));

          results.push({
            fileId: file.id,
            fileName: file.fileName,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          failedCount++;
        }
      }

      logger.info(`[Batch Reprocess] Completed: ${processedCount} succeeded, ${failedCount} failed`);

      return {
        success: true,
        totalFiles: files.length,
        processedFiles: processedCount,
        failedFiles: failedCount,
        results,
        message: `Batch re-process completed: ${processedCount} succeeded, ${failedCount} failed`,
      };
    }),
});
