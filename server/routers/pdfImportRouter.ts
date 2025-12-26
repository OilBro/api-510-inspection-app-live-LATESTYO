import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { inspections, tmlReadings, inspectionFindings, nozzleEvaluations, professionalReports, componentCalculations, checklistItems } from "../../drizzle/schema";
import { sql, eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "../_core/logger";

/**
 * PDF Import Router
 * Handles uploading and extracting data from inspection report PDFs
 * Enhanced with comprehensive field extraction and proper data population
 */

// Comprehensive extraction prompt for API 510 reports
const COMPREHENSIVE_EXTRACTION_PROMPT = `You are an expert at extracting data from API 510 pressure vessel inspection reports.

Analyze this inspection report PDF and extract ALL the following information in JSON format:

{
  "vesselData": {
    "vesselTagNumber": "string - vessel tag/ID (REQUIRED)",
    "vesselName": "string - vessel description/name",
    "manufacturer": "string - vessel manufacturer",
    "yearBuilt": "number - year vessel was built",
    "designPressure": "number (psig) - design/MAWP pressure",
    "designTemperature": "number (°F) - design temperature",
    "operatingPressure": "number (psig) - operating pressure",
    "operatingTemperature": "number (°F) - operating temperature",
    "mdmt": "number (°F) - Minimum Design Metal Temperature",
    "serialNumber": "string - vessel serial number",
    "materialSpec": "string - material specification (e.g., SA-516 Gr 70, SA-240 Type 304)",
    "allowableStress": "number (psi) - allowable stress at design temperature",
    "jointEfficiency": "number (0.6-1.0) - weld joint efficiency factor (E value)",
    "radiographyType": "string (RT-1, RT-2, RT-3, or RT-4) - radiographic examination type",
    "specificGravity": "number - specific gravity of vessel contents",
    "vesselType": "string - type of vessel",
    "insideDiameter": "number (inches) - inside diameter",
    "overallLength": "number (inches) - overall length/height",
    "product": "string - vessel contents/service",
    "constructionCode": "string (e.g., ASME S8 D1)",
    "vesselConfiguration": "string (Horizontal or Vertical)",
    "headType": "string (e.g., 2:1 Ellipsoidal, Hemispherical, Torispherical)",
    "insulationType": "string (e.g., None, Fiberglass)",
    "nbNumber": "string - National Board Number",
    "crownRadius": "number - L parameter for torispherical heads (inches)",
    "knuckleRadius": "number - r parameter for torispherical heads (inches)"
  },
  "inspectionData": {
    "inspectionDate": "YYYY-MM-DD - date inspection was performed",
    "inspector": "string - inspector name",
    "inspectorCertification": "string - inspector certification number",
    "reportNumber": "string - report/inspection number",
    "reportDate": "YYYY-MM-DD - date report was issued",
    "client": "string - client/owner company name",
    "clientLocation": "string - facility/plant location",
    "inspectionType": "string - type of inspection (Internal, External, On-Stream)"
  },
  "executiveSummary": "string - full executive summary text",
  "inspectionResults": "string - Section 3.0 Inspection Results - all findings and observations",
  "recommendations": "string - Section 4.0 Recommendations - all recommendations",
  "thicknessMeasurements": [
    {
      "cml": "string - CML number (e.g., '1', '2', 'CML-1')",
      "component": "string - FULL component name (e.g., 'Vessel Shell', '2\" East Head Seam - Head Side')",
      "location": "string - specific location description",
      "readings": [0.000] - array of ALL thickness readings for this CML in inches,
      "minThickness": "number - minimum of all readings",
      "nominalThickness": "number - nominal/design thickness if available",
      "previousThickness": "number - previous inspection thickness if available"
    }
  ],
  "findings": [
    {
      "section": "string - section of report (e.g., Shell, Heads, Nozzles)",
      "finding": "string - detailed finding description",
      "severity": "acceptable|monitor|critical"
    }
  ],
  "checklistItems": [
    {
      "category": "string - category (External Visual, Internal Visual, Foundation, etc.)",
      "itemNumber": "string - item number if available",
      "itemText": "string - checklist item description",
      "status": "string - Satisfactory, Unsatisfactory, N/A, Not Checked",
      "notes": "string - any notes or comments"
    }
  ],
  "nozzles": [
    {
      "nozzleNumber": "string - nozzle identifier (N1, N2, MW-1, etc.)",
      "service": "string - nozzle service (Manway, Relief, Inlet, Outlet, etc.)",
      "size": "string - nozzle size (e.g., 18\", 2\", 24\" NPS)",
      "schedule": "string - pipe schedule (STD, 40, 80, etc.)",
      "actualThickness": "number - measured thickness in inches",
      "nominalThickness": "number - nominal pipe thickness in inches",
      "minimumRequired": "number - minimum required thickness in inches",
      "acceptable": "boolean - true if passes evaluation"
    }
  ],
  "tableA": {
    "description": "Executive Summary TABLE A - Component Calculations",
    "components": [
      {
        "componentName": "string - component name (Vessel Shell, East Head, West Head)",
        "nominalThickness": "number - nominal thickness (inches)",
        "actualThickness": "number - actual measured thickness (inches)",
        "minimumRequiredThickness": "number - minimum required thickness (inches)",
        "designMAWP": "number - design MAWP (psi)",
        "calculatedMAWP": "number - calculated MAWP at current thickness (psi)",
        "corrosionRate": "number - corrosion rate (inches per year)",
        "remainingLife": "number - remaining life (years)"
      }
    ]
  }
}

CRITICAL EXTRACTION RULES:
1. Extract EVERYTHING - search the entire document thoroughly
2. For thickness measurements: Each CML should be ONE entry with ALL readings in the 'readings' array
3. Do NOT create separate entries for each angle measurement (0°, 90°, 180°, 270°)
4. Extract the FULL component name (e.g., '2" East Head Seam - Head Side', not just 'East Head')
5. Joint Efficiency (E value) is CRITICAL - look in vessel metadata AND calculation tables
6. Extract ALL checklist items with their exact status
7. Extract ALL nozzle data from nozzle evaluation tables
8. For missing numeric values, use null rather than guessing
9. Search the ENTIRE document - data may be scattered across multiple pages`;

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
        logger.info("[PDF Import] Starting extraction from:", input.fileName);
        
        // Use LLM with vision to extract data from PDF
        const response = await invokeLLM({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: COMPREHENSIVE_EXTRACTION_PROMPT,
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
                      crownRadius: { type: "number" },
                      knuckleRadius: { type: "number" },
                    },
                    required: ["vesselTagNumber"],
                    additionalProperties: false,
                  },
                  inspectionData: {
                    type: "object",
                    properties: {
                      inspectionDate: { type: "string" },
                      inspector: { type: "string" },
                      inspectorCertification: { type: "string" },
                      reportNumber: { type: "string" },
                      reportDate: { type: "string" },
                      client: { type: "string" },
                      clientLocation: { type: "string" },
                      inspectionType: { type: "string" },
                    },
                    required: ["inspectionDate"],
                    additionalProperties: false,
                  },
                  executiveSummary: { type: "string" },
                  inspectionResults: { type: "string" },
                  recommendations: { type: "string" },
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
                        previousThickness: { type: "number" },
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
                  checklistItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        itemNumber: { type: "string" },
                        itemText: { type: "string" },
                        status: { type: "string" },
                        notes: { type: "string" },
                      },
                      required: ["itemText", "status"],
                      additionalProperties: false,
                    },
                  },
                  nozzles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nozzleNumber: { type: "string" },
                        service: { type: "string" },
                        size: { type: "string" },
                        schedule: { type: "string" },
                        actualThickness: { type: "number" },
                        nominalThickness: { type: "number" },
                        minimumRequired: { type: "number" },
                        acceptable: { type: "boolean" },
                      },
                      required: ["nozzleNumber"],
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
                required: ["vesselData", "inspectionData", "thicknessMeasurements", "findings", "checklistItems", "nozzles", "tableA"],
                additionalProperties: false,
              },
            },
          },
        });

        const messageContent = response.choices[0].message.content;
        const extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");

        logger.info("[PDF Import] Extraction complete:", {
          vesselTag: extractedData.vesselData?.vesselTagNumber,
          tmlCount: extractedData.thicknessMeasurements?.length || 0,
          findingsCount: extractedData.findings?.length || 0,
          checklistCount: extractedData.checklistItems?.length || 0,
          nozzleCount: extractedData.nozzles?.length || 0,
          tableACount: extractedData.tableA?.components?.length || 0,
        });

        return {
          success: true,
          data: extractedData,
        };
      } catch (error) {
        logger.error("[PDF Import] Extraction failed:", error);
        throw new Error(`Failed to extract data from PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),

  /**
   * Save extracted data as a new inspection with COMPLETE data population
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
          crownRadius: z.number().optional(),
          knuckleRadius: z.number().optional(),
        }),
        inspectionData: z.object({
          inspectionDate: z.string(),
          inspector: z.string().optional(),
          inspectorCertification: z.string().optional(),
          reportNumber: z.string().optional(),
          reportDate: z.string().optional(),
          client: z.string().optional(),
          clientLocation: z.string().optional(),
          inspectionType: z.string().optional(),
        }),
        executiveSummary: z.string().optional(),
        inspectionResults: z.string().optional(),
        recommendations: z.string().optional(),
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
        checklistItems: z
          .array(
            z.object({
              category: z.string().optional(),
              itemNumber: z.string().optional(),
              itemText: z.string(),
              status: z.string(),
              notes: z.string().optional(),
            })
          )
          .optional(),
        nozzles: z
          .array(
            z.object({
              nozzleNumber: z.string(),
              service: z.string().optional(),
              size: z.string().optional(),
              schedule: z.string().optional(),
              actualThickness: z.number().optional(),
              nominalThickness: z.number().optional(),
              minimumRequired: z.number().optional(),
              acceptable: z.boolean().optional(),
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

      logger.info("[PDF Import] Starting save for vessel:", input.vesselData.vesselTagNumber);

      // Delete existing inspection with same vessel tag to prevent duplicates
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
        logger.info("[PDF Import] Deleting existing inspection:", existing.id);
        
        // Delete all related data
        await db.delete(tmlReadings).where(eq(tmlReadings.inspectionId, existing.id));
        await db.delete(nozzleEvaluations).where(eq(nozzleEvaluations.inspectionId, existing.id));
        await db.delete(inspectionFindings).where(eq(inspectionFindings.reportId, existing.id));
        await db.delete(checklistItems).where(eq(checklistItems.reportId, existing.id));
        
        // Delete professional reports and component calculations
        const reports = await db.select().from(professionalReports).where(eq(professionalReports.inspectionId, existing.id));
        for (const report of reports) {
          await db.delete(componentCalculations).where(eq(componentCalculations.reportId, report.id));
          await db.delete(professionalReports).where(eq(professionalReports.id, report.id));
        }
        
        await db.delete(inspections).where(eq(inspections.id, existing.id));
      }

      const inspectionId = nanoid();

      // Create inspection record with ALL fields
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
        crownRadius: input.vesselData.crownRadius?.toString() || null,
        knuckleRadius: input.vesselData.knuckleRadius?.toString() || null,
        inspectionResults: input.inspectionResults || null,
        recommendations: input.recommendations || null,
        status: "completed",
        inspectionDate: new Date(input.inspectionData.inspectionDate),
        completedAt: new Date(input.inspectionData.inspectionDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info("[PDF Import] Created inspection record:", inspectionId);

      // Import thickness measurements
      if (input.thicknessMeasurements && input.thicknessMeasurements.length > 0) {
        for (const measurement of input.thicknessMeasurements) {
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
            previousThickness: measurement.previousThickness?.toString() || null,
            previousInspectionDate: null as Date | null,
            currentInspectionDate: new Date(input.inspectionData.inspectionDate),
            loss: null as string | null,
            lossPercent: null as string | null,
            corrosionRate: null as string | null,
            status: "good" as const,
            tmlId: measurement.cml || null,
            component: measurement.component || null,
            currentThickness: measurement.minThickness?.toString() || null,
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
        }
        logger.info("[PDF Import] Created", input.thicknessMeasurements.length, "TML records");
      }

      // Import nozzle evaluations
      if (input.nozzles && input.nozzles.length > 0) {
        for (const nozzle of input.nozzles) {
          const nozzleRecord = {
            id: nanoid(),
            inspectionId: inspectionId,
            nozzleNumber: nozzle.nozzleNumber,
            nozzleDescription: nozzle.service || null,
            location: null as string | null,
            nominalSize: nozzle.size || '1',
            schedule: nozzle.schedule || null,
            actualThickness: nozzle.actualThickness?.toString() || null,
            pipeNominalThickness: nozzle.nominalThickness?.toString() || null,
            pipeMinusManufacturingTolerance: null as string | null,
            shellHeadRequiredThickness: null as string | null,
            minimumRequired: nozzle.minimumRequired?.toString() || null,
            acceptable: nozzle.acceptable !== false,
            notes: null as string | null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await db.insert(nozzleEvaluations).values(nozzleRecord);
        }
        logger.info("[PDF Import] Created", input.nozzles.length, "nozzle evaluation records");
      }

      // Import findings
      if (input.findings && input.findings.length > 0) {
        const findingRecords = input.findings.map((finding) => ({
          id: nanoid(),
          reportId: inspectionId,
          section: finding.section,
          severity: finding.severity,
          description: finding.finding,
          findingType: "observation" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await db.insert(inspectionFindings).values(findingRecords);
        logger.info("[PDF Import] Created", findingRecords.length, "finding records");
      }

      // Create professional report
      const reportId = nanoid();
      await db.insert(professionalReports).values({
        id: reportId,
        inspectionId: inspectionId,
        userId: ctx.user.id,
        reportNumber: input.inspectionData.reportNumber || `RPT-${Date.now()}`,
        reportDate: input.inspectionData.reportDate ? new Date(input.inspectionData.reportDate) : new Date(),
        inspectorName: input.inspectionData.inspector || null,
        inspectorCertification: input.inspectionData.inspectorCertification || null,
        clientName: input.inspectionData.client || null,
        clientLocation: input.inspectionData.clientLocation || null,
        executiveSummary: input.executiveSummary || null,
        employerName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info("[PDF Import] Created professional report:", reportId);

      // Import checklist items
      if (input.checklistItems && input.checklistItems.length > 0) {
        for (const item of input.checklistItems) {
          const isChecked = ['satisfactory', 'completed', 'yes', 'pass', 'ok', 'good', 'acceptable'].includes(
            (item.status || '').toLowerCase().trim()
          );
          
          await db.insert(checklistItems).values({
            id: nanoid(),
            reportId: reportId,
            category: item.category || 'General',
            itemNumber: item.itemNumber || null,
            itemText: item.itemText,
            checked: isChecked,
            status: item.status?.toLowerCase().includes('satisfactory') ? 'satisfactory' :
                    item.status?.toLowerCase().includes('unsatisfactory') ? 'unsatisfactory' :
                    item.status?.toLowerCase().includes('n/a') ? 'not_applicable' : 'not_checked',
            notes: item.notes || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        logger.info("[PDF Import] Created", input.checklistItems.length, "checklist items");
      }

      // Create component calculations from TABLE A or generate defaults
      const P = input.vesselData.designPressure || 0;
      const R = (input.vesselData.insideDiameter || 0) / 2;
      const S = input.vesselData.allowableStress || 20000;
      const E = input.vesselData.jointEfficiency || 0.85;

      if (input.tableA && input.tableA.components && input.tableA.components.length > 0) {
        // Use TABLE A data from PDF
        for (const comp of input.tableA.components) {
          await db.insert(componentCalculations).values({
            id: nanoid(),
            reportId: reportId,
            componentName: comp.componentName,
            componentType: comp.componentName.toLowerCase().includes('head') ? 'head' : 'shell',
            materialCode: input.vesselData.materialSpec || null,
            materialName: input.vesselData.materialSpec || null,
            designTemp: input.vesselData.designTemperature?.toString() || null,
            designMAWP: comp.designMAWP?.toString() || input.vesselData.designPressure?.toString() || null,
            insideDiameter: input.vesselData.insideDiameter?.toString() || null,
            nominalThickness: comp.nominalThickness?.toString() || null,
            actualThickness: comp.actualThickness?.toString() || null,
            minimumThickness: comp.minimumRequiredThickness?.toString() || null,
            corrosionRate: comp.corrosionRate?.toString() || null,
            remainingLife: comp.remainingLife?.toString() || null,
            calculatedMAWP: comp.calculatedMAWP?.toString() || null,
            allowableStress: S.toString(),
            jointEfficiency: E.toString(),
            pdfOriginalActualThickness: comp.actualThickness?.toString() || null,
            pdfOriginalMinimumThickness: comp.minimumRequiredThickness?.toString() || null,
            pdfOriginalCalculatedMAWP: comp.calculatedMAWP?.toString() || null,
            pdfOriginalCorrosionRate: comp.corrosionRate?.toString() || null,
            pdfOriginalRemainingLife: comp.remainingLife?.toString() || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        logger.info("[PDF Import] Created", input.tableA.components.length, "component calculations from TABLE A");
      } else {
        // Generate default component calculations
        const shellTMLs = input.thicknessMeasurements?.filter(t => 
          t.component.toLowerCase().includes('shell')
        ) || [];
        
        if (shellTMLs.length > 0) {
          const avgThickness = shellTMLs.reduce((sum, t) => sum + (t.minThickness || 0), 0) / shellTMLs.length;
          const minThicknessCalc = P && R && S && E ? (P * R) / (S * E - 0.6 * P) : null;
          
          await db.insert(componentCalculations).values({
            id: nanoid(),
            reportId: reportId,
            componentName: "Vessel Shell",
            componentType: "shell",
            materialCode: input.vesselData.materialSpec || null,
            designTemp: input.vesselData.designTemperature?.toString() || null,
            designMAWP: input.vesselData.designPressure?.toString() || null,
            insideDiameter: input.vesselData.insideDiameter?.toString() || null,
            actualThickness: avgThickness.toFixed(4),
            minimumThickness: minThicknessCalc?.toFixed(4) || null,
            allowableStress: S.toString(),
            jointEfficiency: E.toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          logger.info("[PDF Import] Created default shell component calculation");
        }

        // Create head calculations
        const eastHeadTMLs = input.thicknessMeasurements?.filter(t => 
          t.component.toLowerCase().includes('east') || 
          (t.component.toLowerCase().includes('head') && !t.component.toLowerCase().includes('west'))
        ) || [];
        
        if (eastHeadTMLs.length > 0) {
          const avgThickness = eastHeadTMLs.reduce((sum, t) => sum + (t.minThickness || 0), 0) / eastHeadTMLs.length;
          const minThicknessCalc = P && R && S && E ? (P * R) / (2 * S * E - 0.2 * P) : null;
          
          await db.insert(componentCalculations).values({
            id: nanoid(),
            reportId: reportId,
            componentName: "East Head",
            componentType: "head",
            materialCode: input.vesselData.materialSpec || null,
            designTemp: input.vesselData.designTemperature?.toString() || null,
            designMAWP: input.vesselData.designPressure?.toString() || null,
            insideDiameter: input.vesselData.insideDiameter?.toString() || null,
            actualThickness: avgThickness.toFixed(4),
            minimumThickness: minThicknessCalc?.toFixed(4) || null,
            allowableStress: S.toString(),
            jointEfficiency: E.toString(),
            headType: input.vesselData.headType || '2:1 Ellipsoidal',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          logger.info("[PDF Import] Created East Head component calculation");
        }

        const westHeadTMLs = input.thicknessMeasurements?.filter(t => 
          t.component.toLowerCase().includes('west')
        ) || [];
        
        if (westHeadTMLs.length > 0) {
          const avgThickness = westHeadTMLs.reduce((sum, t) => sum + (t.minThickness || 0), 0) / westHeadTMLs.length;
          const minThicknessCalc = P && R && S && E ? (P * R) / (2 * S * E - 0.2 * P) : null;
          
          await db.insert(componentCalculations).values({
            id: nanoid(),
            reportId: reportId,
            componentName: "West Head",
            componentType: "head",
            materialCode: input.vesselData.materialSpec || null,
            designTemp: input.vesselData.designTemperature?.toString() || null,
            designMAWP: input.vesselData.designPressure?.toString() || null,
            insideDiameter: input.vesselData.insideDiameter?.toString() || null,
            actualThickness: avgThickness.toFixed(4),
            minimumThickness: minThicknessCalc?.toFixed(4) || null,
            allowableStress: S.toString(),
            jointEfficiency: E.toString(),
            headType: input.vesselData.headType || '2:1 Ellipsoidal',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          logger.info("[PDF Import] Created West Head component calculation");
        }
      }

      logger.info("[PDF Import] Save complete for inspection:", inspectionId);

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
        const newInspectionDate = extractedData.inspectionDate ? new Date(extractedData.inspectionDate) : new Date();
        if (extractedData.inspectionDate) {
          await db
            .update(inspections)
            .set({
              inspectionDate: newInspectionDate,
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
        logger.error("[PDF Import] UT upload failed:", error);
        throw new Error(`Failed to upload UT results: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),
});
