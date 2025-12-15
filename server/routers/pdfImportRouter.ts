import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { inspections, tmlReadings, inspectionFindings, nozzleEvaluations, professionalReports, componentCalculations } from "../../drizzle/schema";
import { sql, eq, and } from "drizzle-orm";
import { getDb } from "../db";

/**
 * PDF Import Router
 * Handles uploading and extracting data from inspection report PDFs
 */
export const pdfImportRouter = router({
  /**
   * Upload PDF and extract inspection data using AI
   */
  extractFromPDF: protectedProcedure
    .input(
      z.object({
        pdfUrl: z.string().url(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Use LLM with vision to extract data from PDF
        const extractionPrompt = `You are an expert at extracting data from API 510 pressure vessel inspection reports.

Analyze this inspection report PDF and extract ALL the following information in JSON format:

{
  "vesselData": {
    "vesselTagNumber": "string",
    "vesselName": "string",
    "manufacturer": "string",
    "yearBuilt": "number",
    "designPressure": "number (psig)",
    "designTemperature": "number (°F)",
    "operatingPressure": "number (psig)",
    "operatingTemperature": "number (°F)",
    "mdmt": "number (°F) - Minimum Design Metal Temperature",
    "serialNumber": "string - vessel serial number",
    "materialSpec": "string",
    "allowableStress": "number (psi) - allowable stress at design temperature",
    "jointEfficiency": "number (0.6-1.0) - weld joint efficiency factor",
    "radiographyType": "string (RT-1, RT-2, RT-3, or RT-4) - radiographic examination type",
    "specificGravity": "number - specific gravity of vessel contents",
    "vesselType": "string",
    "insideDiameter": "number (inches)",
    "overallLength": "number (inches)",
    "product": "string - vessel contents/service",
    "constructionCode": "string (e.g., ASME S8 D1)",
    "vesselConfiguration": "string (Horizontal or Vertical)",
    "headType": "string (e.g., 2:1 Ellipsoidal, Hemispherical)",
    "insulationType": "string (e.g., None, Fiberglass)",
    "nbNumber": "string - National Board Number"
  },
  "inspectionData": {
    "inspectionDate": "YYYY-MM-DD",
    "inspector": "string",
    "reportNumber": "string",
    "client": "string"
  },
  "thicknessMeasurements": [
    {
      "cml": "string (CML number, e.g., '6', '7', 'Shell 1')",
      "component": "string (FULL component name, e.g., '2\" East Head Seam - Head Side', 'Vessel Shell', 'Manway')",
      "location": "string (specific location description)",
      "readings": [
        "number (all thickness readings for this CML in inches, e.g., [0.663, 0.666, 0.679, 0.656])"
      ],
      "minThickness": "number (minimum of all readings)",
      "nominalThickness": "number (tmin or nominal design thickness if available)"
    }
  ],
  "findings": [
    {
      "section": "string",
      "finding": "string",
      "severity": "acceptable|monitor|critical"
    }
  ],
  "tableA": {
    "description": "Executive Summary TABLE A - Component Calculations (if present)",
    "components": [
      {
        "componentName": "string (e.g., 'Vessel Shell', 'East Head', 'West Head')",
        "nominalThickness": "number (inches)",
        "actualThickness": "number (inches)",
        "minimumRequiredThickness": "number (inches)",
        "designMAWP": "number (psi)",
        "calculatedMAWP": "number (psi)",
        "corrosionRate": "number (inches per year)",
        "remainingLife": "number (years, or 999 if >20 years)"
      }
    ]
  }
}

IMPORTANT: For thickness measurements:
- Each CML should be ONE entry with ALL its readings in the 'readings' array
- Do NOT create separate entries for each angle measurement (0°, 90°, 180°, 270°)
- Extract the FULL component name (e.g., '2\" East Head Seam - Head Side', not just 'East Head')
- minThickness should be the minimum of all readings for that CML
- Include nominal/design thickness (tmin) if shown in the table

Extract ALL thickness measurements from tables. Be thorough and accurate.

IMPORTANT EXTRACTION GUIDELINES:
1. Vessel data is typically on the first few pages in a summary table or header section
2. Look for "Vessel Specifications", "Design Data", or similar sections
3. MDMT, Operating Temperature, and Product are critical - search the entire document if not in the first section
4. Construction Code is often listed as "ASME S8 D1" or similar
5. If a field is not explicitly stated, try to infer from context (e.g., vessel orientation from drawings)
6. For missing numeric values, use null rather than guessing
7. Thickness measurements are usually in appendices or dedicated UT measurement sections
8. Extract inspector name, report number, and client from the cover page or header

Do NOT leave fields empty if the information exists anywhere in the document. Search thoroughly.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: extractionPrompt,
                },
                {
                  type: "file_url",
                  file_url: {
                    url: input.pdfUrl,
                    mime_type: "application/pdf",
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "inspection_data",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  vesselData: {
                    type: "object",
                    properties: {
                      vesselTagNumber: { type: "string" },
                      vesselName: { type: "string" },
                      manufacturer: { type: "string" },
                      yearBuilt: { type: "number" },
                      designPressure: { type: "number" },
                      designTemperature: { type: "number" },
                      operatingPressure: { type: "number" },
                      operatingTemperature: { type: "number" },
                      mdmt: { type: "number" },
                      serialNumber: { type: "string" },
                      materialSpec: { type: "string" },
                      allowableStress: { type: "number" },
                      jointEfficiency: { type: "number" },
                      radiographyType: { type: "string" },
                      specificGravity: { type: "number" },
                      vesselType: { type: "string" },
                      insideDiameter: { type: "number" },
                      overallLength: { type: "number" },
                      product: { type: "string" },
                      constructionCode: { type: "string" },
                      vesselConfiguration: { type: "string" },
                      headType: { type: "string" },
                      insulationType: { type: "string" },
                      nbNumber: { type: "string" },
                    },
                    required: ["vesselTagNumber"],
                    additionalProperties: false,
                  },
                  inspectionData: {
                    type: "object",
                    properties: {
                      inspectionDate: { type: "string" },
                      inspector: { type: "string" },
                      reportNumber: { type: "string" },
                      client: { type: "string" },
                    },
                    required: ["inspectionDate"],
                    additionalProperties: false,
                  },
                  thicknessMeasurements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        cml: { type: "string" },
                        component: { type: "string" },
                        location: { type: "string" },
                        readings: {
                          type: "array",
                          items: { type: "number" },
                        },
                        minThickness: { type: "number" },
                        nominalThickness: { type: "number" },
                      },
                      required: ["cml", "component", "readings", "minThickness"],
                      additionalProperties: false,
                    },
                  },
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        section: { type: "string" },
                        finding: { type: "string" },
                        severity: { type: "string", enum: ["acceptable", "monitor", "critical"] },
                      },
                      required: ["section", "finding", "severity"],
                      additionalProperties: false,
                    },
                  },
                  tableA: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      components: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            componentName: { type: "string" },
                            nominalThickness: { type: "number" },
                            actualThickness: { type: "number" },
                            minimumRequiredThickness: { type: "number" },
                            designMAWP: { type: "number" },
                            calculatedMAWP: { type: "number" },
                            corrosionRate: { type: "number" },
                            remainingLife: { type: "number" },
                          },
                          required: ["componentName"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["components"],
                    additionalProperties: false,
                  },
                },
                required: ["vesselData", "inspectionData"],
                additionalProperties: false,
              },
            },
          },
        });

        const messageContent = response.choices[0].message.content;
        const extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");

        return {
          success: true,
          data: extractedData,
        };
      } catch (error) {
        console.error("PDF extraction failed:", error);
        throw new Error(`Failed to extract data from PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),

  /**
   * Save extracted data as a new inspection
   */
  saveExtractedData: protectedProcedure
    .input(
      z.object({
        vesselData: z.object({
          vesselTagNumber: z.string(),
          vesselName: z.string().optional(),
          manufacturer: z.string().optional(),
          yearBuilt: z.number().optional(),
          designPressure: z.number().optional(),
          designTemperature: z.number().optional(),
          operatingPressure: z.number().optional(),
          operatingTemperature: z.number().optional(),
          mdmt: z.number().optional(),
          serialNumber: z.string().optional(),
          materialSpec: z.string().optional(),
          allowableStress: z.number().optional(),
          jointEfficiency: z.number().optional(),
          radiographyType: z.string().optional(),
          specificGravity: z.number().optional(),
          vesselType: z.string().optional(),
          insideDiameter: z.number().optional(),
          overallLength: z.number().optional(),
          product: z.string().optional(),
          constructionCode: z.string().optional(),
          vesselConfiguration: z.string().optional(),
          headType: z.string().optional(),
          insulationType: z.string().optional(),
          nbNumber: z.string().optional(),
        }),
        inspectionData: z.object({
          inspectionDate: z.string(),
          inspector: z.string().optional(),
          reportNumber: z.string().optional(),
          client: z.string().optional(),
        }),
        thicknessMeasurements: z
          .array(
            z.object({
              cml: z.string(),
              component: z.string(),
              location: z.string().optional(),
              readings: z.array(z.number()),
              minThickness: z.number(),
              nominalThickness: z.number().optional(),
              previousThickness: z.number().optional(),
            })
          )
          .optional(),
        findings: z
          .array(
            z.object({
              section: z.string(),
              finding: z.string(),
              severity: z.enum(["acceptable", "monitor", "critical"]),
            })
          )
          .optional(),
        tableA: z
          .object({
            description: z.string().optional(),
            components: z.array(
              z.object({
                componentName: z.string(),
                nominalThickness: z.number().optional(),
                actualThickness: z.number().optional(),
                minimumRequiredThickness: z.number().optional(),
                designMAWP: z.number().optional(),
                calculatedMAWP: z.number().optional(),
                corrosionRate: z.number().optional(),
                remainingLife: z.number().optional(),
              })
            ),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Check for existing inspection with same vessel tag and report number
      // If found, delete it and all related data to prevent duplicates
      if (input.inspectionData.reportNumber) {
        const existingInspections = await db
          .select()
          .from(inspections)
          .where(
            and(
              eq(inspections.vesselTagNumber, input.vesselData.vesselTagNumber),
              eq(inspections.userId, ctx.user.id)
            )
          );

        for (const existing of existingInspections) {
          console.log('[PDF Import] Found existing inspection', existing.id, 'for vessel', input.vesselData.vesselTagNumber, '- deleting to prevent duplicates');
          
          // Delete related data
          await db.delete(tmlReadings).where(eq(tmlReadings.inspectionId, existing.id));
          await db.delete(nozzleEvaluations).where(eq(nozzleEvaluations.inspectionId, existing.id));
          await db.delete(inspectionFindings).where(eq(inspectionFindings.reportId, existing.id));
          
          // Find and delete professional reports
          const reports = await db.select().from(professionalReports).where(eq(professionalReports.inspectionId, existing.id));
          for (const report of reports) {
            await db.delete(componentCalculations).where(eq(componentCalculations.reportId, report.id));
            await db.delete(professionalReports).where(eq(professionalReports.id, report.id));
          }
          
          // Delete the inspection itself
          await db.delete(inspections).where(eq(inspections.id, existing.id));
        }
      }

      const inspectionId = nanoid();

      // Create inspection record
      await db.insert(inspections).values({
        id: inspectionId,
        userId: ctx.user.id,
        vesselTagNumber: input.vesselData.vesselTagNumber,
        vesselName: input.vesselData.vesselName || null,
        manufacturer: input.vesselData.manufacturer || null,
        yearBuilt: input.vesselData.yearBuilt || null,
        designPressure: input.vesselData.designPressure?.toString() || null,
        designTemperature: input.vesselData.designTemperature?.toString() || null,
        operatingPressure: input.vesselData.operatingPressure?.toString() || null,
        operatingTemperature: input.vesselData.operatingTemperature?.toString() || null,
        mdmt: input.vesselData.mdmt?.toString() || null,
        serialNumber: input.vesselData.serialNumber || null,
        materialSpec: input.vesselData.materialSpec || null,
        allowableStress: input.vesselData.allowableStress?.toString() || null,
        jointEfficiency: input.vesselData.jointEfficiency?.toString() || null,
        radiographyType: input.vesselData.radiographyType || null,
        specificGravity: input.vesselData.specificGravity?.toString() || null,
        vesselType: input.vesselData.vesselType || null,
        insideDiameter: input.vesselData.insideDiameter?.toString() || null,
        overallLength: input.vesselData.overallLength?.toString() || null,
        product: input.vesselData.product || null,
        constructionCode: input.vesselData.constructionCode || null,
        vesselConfiguration: input.vesselData.vesselConfiguration || null,
        headType: input.vesselData.headType || null,
        insulationType: input.vesselData.insulationType || null,
        nbNumber: input.vesselData.nbNumber || null,
        status: "completed",
        inspectionDate: new Date(input.inspectionData.inspectionDate),
        completedAt: new Date(input.inspectionData.inspectionDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Import thickness measurements
      if (input.thicknessMeasurements && input.thicknessMeasurements.length > 0) {
        const tmlRecords = input.thicknessMeasurements.map((measurement) => {
          // Distribute readings across tml1, tml2, tml3, tml4
          const readings = measurement.readings || [];
          const record = {
            id: nanoid(),
            inspectionId: inspectionId,
            cmlNumber: String(measurement.cml || 'N/A'),
            componentType: String(measurement.component || 'Unknown'),
            location: String(measurement.location || 'N/A'),
            service: null as string | null,
            tml1: readings[0]?.toString() || null,
            tml2: readings[1]?.toString() || null,
            tml3: readings[2]?.toString() || null,
            tml4: readings[3]?.toString() || null,
            tActual: measurement.minThickness?.toString() || null,
            nominalThickness: measurement.nominalThickness?.toString() || null,
            previousThickness: null as string | null,
            previousInspectionDate: null as Date | null,
            currentInspectionDate: null as Date | null,
            loss: null as string | null,
            lossPercent: null as string | null,
            corrosionRate: null as string | null,
            status: "good" as const,
            tmlId: measurement.cml || null,
            component: measurement.component || null,
            currentThickness: measurement.minThickness?.toString() || null,
          };
          console.log('[PDF Import] TML record to insert:', JSON.stringify(record, null, 2));
          return record;
        });

        console.log('[PDF Import] About to insert', tmlRecords.length, 'TML records');
        
        // Identify nozzle TMLs and create nozzle evaluation records
        const nozzleKeywords = ['manway', 'relief', 'vapor', 'sight', 'gauge', 'reactor', 'feed', 'inlet', 'outlet', 'drain', 'vent'];
        const nozzleTMLs = tmlRecords.filter(record => {
          const comp = (record.componentType || '').toLowerCase();
          return nozzleKeywords.some(keyword => comp.includes(keyword));
        });
        
        console.log('[PDF Import] Identified', nozzleTMLs.length, 'nozzle TMLs');
        
        // Use raw SQL to bypass Drizzle ORM issue with defaults
        for (const record of tmlRecords) {
          await db.execute(sql`
            INSERT INTO tmlReadings (
              id, inspectionId, cmlNumber, componentType, location, service,
              tml1, tml2, tml3, tml4, tActual, nominalThickness, previousThickness,
              previousInspectionDate, currentInspectionDate, loss, lossPercent, corrosionRate,
              status, tmlId, component, currentThickness
            ) VALUES (
              ${record.id}, ${record.inspectionId}, ${record.cmlNumber}, ${record.componentType}, ${record.location}, ${record.service},
              ${record.tml1}, ${record.tml2}, ${record.tml3}, ${record.tml4}, ${record.tActual}, ${record.nominalThickness}, ${record.previousThickness},
              ${record.previousInspectionDate}, ${record.currentInspectionDate}, ${record.loss}, ${record.lossPercent}, ${record.corrosionRate},
              ${record.status}, ${record.tmlId}, ${record.component}, ${record.currentThickness}
            )
          `);
        }
        
        // Create nozzle evaluation records for identified nozzles
        if (nozzleTMLs.length > 0) {
          console.log('[PDF Import] Creating nozzle evaluation records...');
          const { nozzleEvaluations } = await import('../../drizzle/schema.js');
          
          for (const nozzleTML of nozzleTMLs) {
            // Extract nozzle size from component name (e.g., "24\" Manway" -> "24")
            const sizeMatch = nozzleTML.componentType.match(/(\d+(?:\.\d+)?)\s*["']/);
            const nominalSize = sizeMatch ? sizeMatch[1] : '1';
            
            // Extract nozzle description (e.g., "Manway", "Relief", "Vapor Out")
            const description = nozzleTML.componentType.replace(/\d+\s*["']/g, '').trim();
            
            // Determine minimum required thickness based on size
            const sizeNum = parseFloat(nominalSize);
            let minimumRequired = 0.116; // Default for 1" nozzle
            if (sizeNum >= 24) minimumRequired = 0.328;
            else if (sizeNum >= 12) minimumRequired = 0.328;
            else if (sizeNum >= 10) minimumRequired = 0.319;
            else if (sizeNum >= 8) minimumRequired = 0.282;
            else if (sizeNum >= 6) minimumRequired = 0.245;
            else if (sizeNum >= 4) minimumRequired = 0.207;
            else if (sizeNum >= 3) minimumRequired = 0.189;
            else if (sizeNum >= 2) minimumRequired = 0.135;
            else if (sizeNum >= 1.5) minimumRequired = 0.127;
            
            const nozzleRecord = {
              id: nanoid(),
              inspectionId: inspectionId,
              nozzleNumber: nozzleTML.cmlNumber || `N${nozzleTMLs.indexOf(nozzleTML) + 1}`,
              nozzleDescription: description,
              location: nozzleTML.location || null,
              nominalSize: nominalSize,
              schedule: null,
              actualThickness: nozzleTML.tActual,
              pipeNominalThickness: null,
              pipeMinusManufacturingTolerance: null,
              shellHeadRequiredThickness: null,
              minimumRequired: minimumRequired.toString(),
              material: 'SS A - 304',
              status: 'acceptable',
              notes: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            await db.insert(nozzleEvaluations).values(nozzleRecord);
          }
          
          console.log('[PDF Import] Created', nozzleTMLs.length, 'nozzle evaluation records');
        }
      }

      // Import findings
      if (input.findings && input.findings.length > 0) {
        const findingRecords = input.findings.map((finding) => ({
          id: nanoid(),
          reportId: inspectionId,
          section: finding.section,
          severity: finding.severity,
          description: finding.finding,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await db.insert(inspectionFindings).values(findingRecords);
      }

      // Auto-generate component calculations after import
      try {
        const { generateDefaultCalculationsForInspection, createProfessionalReport, getProfessionalReportByInspection } = await import('../professionalReportDb');
        
        // Check if professional report exists, create if not
        let report = await getProfessionalReportByInspection(inspectionId);
        let reportId: string;
        
        if (!report) {
          reportId = nanoid();
          await createProfessionalReport({
            id: reportId,
            inspectionId: inspectionId,
            userId: ctx.user.id,
            reportNumber: input.inspectionData.reportNumber || `RPT-${Date.now()}`,
            reportDate: new Date(input.inspectionData.inspectionDate),
            inspectorName: input.inspectionData.inspector || 'Unknown',
            clientName: input.inspectionData.client || null,
            employerName: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          reportId = report.id;
        }
        
        await generateDefaultCalculationsForInspection(inspectionId, reportId);
        console.log('[PDF Import] Auto-generated component calculations for inspection', inspectionId);
        
        // If TABLE A data was extracted from PDF, store as PDF original values
        if (input.tableA && input.tableA.components && input.tableA.components.length > 0) {
          console.log('[PDF Import] Storing TABLE A original values for validation');
          
          for (const tableAComponent of input.tableA.components) {
            // Find matching component calculation by name
            const [existingCalc] = await db.select()
              .from(componentCalculations)
              .where(
                and(
                  eq(componentCalculations.reportId, reportId),
                  sql`LOWER(${componentCalculations.componentName}) = LOWER(${tableAComponent.componentName})`
                )
              )
              .limit(1);
            
            if (existingCalc) {
              // Update with PDF original values
              await db.update(componentCalculations)
                .set({
                  pdfOriginalActualThickness: tableAComponent.actualThickness?.toString(),
                  pdfOriginalMinimumThickness: tableAComponent.minimumRequiredThickness?.toString(),
                  pdfOriginalCalculatedMAWP: tableAComponent.calculatedMAWP?.toString(),
                  pdfOriginalCorrosionRate: tableAComponent.corrosionRate?.toString(),
                  pdfOriginalRemainingLife: tableAComponent.remainingLife?.toString(),
                })
                .where(eq(componentCalculations.id, existingCalc.id));
              
              console.log(`[PDF Import] Stored TABLE A values for ${tableAComponent.componentName}`);
            }
          }
        }
      } catch (calcError) {
        console.error('[PDF Import] Failed to auto-generate calculations:', calcError);
        // Don't fail the entire import if calculation generation fails
      }

      // Run anomaly detection
      try {
        const { detectAnomalies, saveAnomalies } = await import('../anomalyDetection');
        const { notifyOwner } = await import('../_core/notification');
        const anomalies = await detectAnomalies(inspectionId);
        await saveAnomalies(inspectionId, anomalies);
        console.log(`[PDF Import] Detected ${anomalies.length} anomalies for inspection ${inspectionId}`);

        // Send notification if critical anomalies detected
        const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
        if (criticalAnomalies.length > 0) {
          try {
            await notifyOwner({
              title: `Critical Anomalies Detected: ${input.vesselData.vesselTagNumber}`,
              content: `${criticalAnomalies.length} critical ${criticalAnomalies.length === 1 ? 'anomaly' : 'anomalies'} detected during PDF import for vessel ${input.vesselData.vesselTagNumber}.\n\nIssues:\n${criticalAnomalies.slice(0, 5).map(a => `• ${a.title}`).join('\n')}${criticalAnomalies.length > 5 ? `\n• ...and ${criticalAnomalies.length - 5} more` : ''}\n\nPlease review the inspection report.`,
            });
            console.log(`[PDF Import] Sent notification for ${criticalAnomalies.length} critical anomalies`);
          } catch (notifyError) {
            console.error('[PDF Import] Failed to send anomaly notification:', notifyError);
            // Don't fail the import if notification fails
          }
        }
      } catch (anomalyError) {
        console.error('[PDF Import] Anomaly detection failed:', anomalyError);
        // Don't fail the entire import if anomaly detection fails
      }

      return {
        success: true,
        inspectionId: inspectionId,
      };
    }),

  /**
   * Upload new UT results to an existing inspection/report
   */
  uploadUTResults: protectedProcedure
    .input(
      z.object({
        targetInspectionId: z.string(),
        pdfUrl: z.string().url(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        // Verify the target inspection exists and belongs to the user
        const [existingInspection] = await db
          .select()
          .from(inspections)
          .where(
            and(
              eq(inspections.id, input.targetInspectionId),
              eq(inspections.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!existingInspection) {
          throw new Error("Inspection not found or access denied");
        }

        // Extract UT data from PDF
        const extractionPrompt = `You are an expert at extracting ultrasonic thickness (UT) measurement data from API 510 pressure vessel inspection reports.

Analyze this UT report PDF and extract ALL thickness measurements in JSON format.

IMPORTANT INSTRUCTIONS:
1. CML numbers: Extract the exact CML identifier (e.g., "CML-1", "CML-2", "1", "2", etc.)
2. Component: Identify the vessel component (e.g., "Vessel Shell", "Shell", "East Head", "West Head", "Nozzle N1")
3. Location: Extract specific location description if available (e.g., "12 o'clock", "Top", "Bottom")
4. Thickness: Current measured thickness in inches (decimal format)
5. Previous Thickness: If shown in the report, extract the previous inspection thickness

Format:
{
  "inspectionDate": "YYYY-MM-DD",
  "thicknessMeasurements": [
    {
      "cml": "CML identifier (e.g., 'CML-1', '1', 'A-1')",
      "component": "Component name (e.g., 'Vessel Shell', 'East Head')",
      "location": "Specific location (e.g., '12 o'clock', 'Top')",
      "thickness": 0.XXX (current thickness in inches),
      "previousThickness": 0.XXX (previous thickness if available)
    }
  ]
}

Extract ALL thickness measurements from tables. Be thorough and accurate. Match CML numbers exactly as they appear in the document.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: extractionPrompt,
                },
                {
                  type: "file_url",
                  file_url: {
                    url: input.pdfUrl,
                    mime_type: "application/pdf",
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "ut_results",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  inspectionDate: { type: "string" },
                  thicknessMeasurements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        cml: { type: "string" },
                        component: { type: "string" },
                        location: { type: "string" },
                        thickness: { type: "number" },
                        previousThickness: { type: "number" },
                      },
                      required: ["cml", "component", "thickness"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["inspectionDate", "thicknessMeasurements"],
                additionalProperties: false,
              },
            },
          },
        });

        const messageContent = response.choices[0].message.content;
        const extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");

        if (!extractedData.thicknessMeasurements || extractedData.thicknessMeasurements.length === 0) {
          throw new Error("No thickness measurements found in the uploaded file");
        }

        // Update inspection date if provided
        if (extractedData.inspectionDate) {
          await db
            .update(inspections)
            .set({
              inspectionDate: new Date(extractedData.inspectionDate),
              updatedAt: new Date(),
            })
            .where(sql`id = ${input.targetInspectionId}`);
        }

        // Get existing TML readings for this inspection
        const existingTmlReadings = await db
          .select()
          .from(tmlReadings)
          .where(eq(tmlReadings.inspectionId, input.targetInspectionId));

        let updatedCount = 0;
        let addedCount = 0;
        const newInspectionDate = extractedData.inspectionDate ? new Date(extractedData.inspectionDate) : new Date();

        // Process each measurement
        for (const measurement of extractedData.thicknessMeasurements) {
          const cmlNumber = String(measurement.cml || "N/A");
          const componentType = String(measurement.component || "Unknown");
          const location = String(measurement.location || "N/A");
          const newThickness = measurement.thickness?.toString() || null;

          // Try to find matching existing TML record by CML number and component
          const existingRecord = existingTmlReadings.find(
            (tml) =>
              tml.cmlNumber === cmlNumber &&
              (tml.componentType === componentType || tml.component === componentType)
          );

          if (existingRecord && newThickness) {
            // Update existing record: move current to previous, set new as current
            const previousThickness = existingRecord.currentThickness || existingRecord.tActual;
            const previousDate = existingRecord.currentInspectionDate || existingRecord.previousInspectionDate || existingInspection.inspectionDate;

            // Calculate corrosion rate if we have both dates and thicknesses
            let corrosionRate = null;
            if (previousThickness && previousDate) {
              const prevThick = parseFloat(previousThickness);
              const currThick = parseFloat(newThickness);
              const timeSpanMs = newInspectionDate.getTime() - new Date(previousDate).getTime();
              const timeSpanYears = timeSpanMs / (1000 * 60 * 60 * 24 * 365.25);

              if (timeSpanYears > 0) {
                const thicknessLoss = prevThick - currThick;
                const corrosionRateMpy = (thicknessLoss / timeSpanYears) * 1000; // Convert to mils per year
                corrosionRate = corrosionRateMpy.toFixed(4);
              }
            }

            // Update the existing record
            await db.execute(sql`
              UPDATE tmlReadings
              SET
                previousThickness = ${previousThickness},
                previousInspectionDate = ${previousDate},
                currentThickness = ${newThickness},
                tActual = ${newThickness},
                currentInspectionDate = ${newInspectionDate},
                corrosionRate = ${corrosionRate},
                tml1 = ${newThickness}
              WHERE id = ${existingRecord.id}
            `);
            updatedCount++;
          } else {
            // Create new TML record
            const record = {
              id: nanoid(),
              inspectionId: input.targetInspectionId,
              cmlNumber,
              componentType,
              location,
              service: null as string | null,
              tml1: newThickness,
              tml2: null as string | null,
              tml3: null as string | null,
              tml4: null as string | null,
              tActual: newThickness,
              nominalThickness: null as string | null,
              previousThickness: measurement.previousThickness?.toString() || null,
              previousInspectionDate: existingInspection.inspectionDate || null,
              currentInspectionDate: newInspectionDate,
              loss: null as string | null,
              lossPercent: null as string | null,
              corrosionRate: null as string | null,
              status: "good" as const,
              tmlId: measurement.cml || null,
              component: measurement.component || null,
              currentThickness: newThickness,
            };

            await db.execute(sql`
              INSERT INTO tmlReadings (
                id, inspectionId, cmlNumber, componentType, location, service,
                tml1, tml2, tml3, tml4, tActual, nominalThickness, previousThickness,
                previousInspectionDate, currentInspectionDate, loss, lossPercent, corrosionRate,
                status, tmlId, component, currentThickness
              ) VALUES (
                ${record.id}, ${record.inspectionId}, ${record.cmlNumber}, ${record.componentType}, ${record.location}, ${record.service},
                ${record.tml1}, ${record.tml2}, ${record.tml3}, ${record.tml4}, ${record.tActual}, ${record.nominalThickness}, ${record.previousThickness},
                ${record.previousInspectionDate}, ${record.currentInspectionDate}, ${record.loss}, ${record.lossPercent}, ${record.corrosionRate},
                ${record.status}, ${record.tmlId}, ${record.component}, ${record.currentThickness}
              )
            `);
            addedCount++;
          }
        }

        return {
          success: true,
          inspectionId: input.targetInspectionId,
          addedMeasurements: addedCount,
          updatedMeasurements: updatedCount,
          message: `Successfully processed ${addedCount + updatedCount} thickness measurements (${updatedCount} updated, ${addedCount} new)`,
        };
      } catch (error) {
        console.error("UT upload failed:", error);
        throw new Error(`Failed to upload UT results: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),
});

