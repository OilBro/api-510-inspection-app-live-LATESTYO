import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { generateExcelTemplate } from "../generateExcelTemplate";
import { inspections, tmlReadings, inspectionFindings, nozzleEvaluations, professionalReports, componentCalculations, checklistItems } from "../../drizzle/schema";
import { sql, eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "../_core/logger";
import { getAllowableStress } from "../asmeMaterialsDatabase";
import { getPipeSchedule, getNozzleMinThickness } from "../pipeScheduleDatabase";

/**
 * PDF Import Router
 * Handles uploading and extracting data from inspection report PDFs
 * Enhanced with comprehensive field extraction and proper data population
 * 
 * CRITICAL: This router extracts ALL data from API 510 inspection reports including:
 * - Vessel data (design parameters, materials, dimensions)
 * - Thickness measurements (TML readings)
 * - Nozzle evaluations (ALL nozzles with thickness data)
 * - Component calculations (TABLE A data)
 * - Findings and recommendations
 * - Checklist items
 */

// Comprehensive extraction prompt for API 510 reports
const COMPREHENSIVE_EXTRACTION_PROMPT = `You are an expert at extracting data from API 510 pressure vessel inspection reports. Your job is to extract EVERY piece of compliance and technical data from the PDF.

ANALYZE THIS PDF THOROUGHLY AND EXTRACT ALL INFORMATION IN JSON FORMAT:

{
  "vesselData": {
    "vesselTagNumber": "string - vessel tag/ID (REQUIRED) - look for 'Tag No', 'Equipment ID', 'Unit ID'",
    "vesselName": "string - vessel description/name",
    "manufacturer": "string - vessel manufacturer",
    "yearBuilt": "number - year vessel was built - look for 'Date Built', 'Mfg Date'",
    "designPressure": "number (psig) - design/MAWP pressure",
    "designTemperature": "number (°F) - design temperature",
    "operatingPressure": "number (psig) - operating pressure - often on nameplate",
    "operatingTemperature": "number (°F) - operating temperature - often on nameplate",
    "mdmt": "number (°F) - Minimum Design Metal Temperature - CRITICAL for compliance",
    "serialNumber": "string - vessel serial number - look for 'Serial No', 'S/N'",
    "materialSpec": "string - material specification (e.g., SA-516 Gr 70, SA-240 Type 304) - from Vessel/Material section",
    "allowableStress": "number (psi) - allowable stress at design temperature - use ASME Section II Part D if not stated",
    "jointEfficiency": "number (0.6-1.0) - weld joint efficiency factor (E value) - CRITICAL, look in calculations or vessel spec",
    "radiographyType": "string (RT-1, RT-2, RT-3, or RT-4) - radiographic examination type - from construction code",
    "specificGravity": "number - specific gravity of vessel contents - for hydrostatic head calcs",
    "vesselType": "string - type of vessel (Horizontal/Vertical, Pressure/Storage)",
    "insideDiameter": "number (inches) - inside diameter - labeled as 'ID' or 'Inside Diameter'",
    "overallLength": "number (inches) - overall length/height",
    "product": "string - vessel contents/service - look for 'Product', 'Service', 'Contents'",
    "constructionCode": "string (e.g., ASME Section VIII Div 1) - construction standard code",
    "vesselConfiguration": "string (Horizontal or Vertical)",
    "headType": "string (2:1 Ellipsoidal, Hemispherical, Torispherical, Flat) - TYPE for EACH head",
    "insulationType": "string (None, Fiberglass, Foam, etc.) - from vessel spec",
    "nbNumber": "string - National Board Number",
    "crownRadius": "number - L parameter for torispherical heads (inches)",
    "knuckleRadius": "number - r parameter for torispherical heads (inches)"
  },
  "inspectionData": {
    "inspectionDate": "YYYY-MM-DD - date inspection was performed",
    "inspector": "string - inspector name",
    "inspectorCertification": "string - inspector certification number - look for 'Cert No', 'API-510'",
    "reportNumber": "string - report/inspection number",
    "reportDate": "YYYY-MM-DD - date report was issued",
    "client": "string - client/owner company name",
    "clientLocation": "string - facility/plant location",
    "inspectionType": "string - type of inspection (Internal, External, On-Stream, General)"
  },
  "executiveSummary": "string - complete executive summary from beginning of report",
  "inspectionResults": "string - Section 3.0 Inspection Results - ALL findings and observations from entire section",
  "recommendations": "string - Section 4.0 Recommendations - ALL recommendations from entire section",
  "thicknessMeasurements": [
    {
      "cml": "string - CML number (e.g., '1', '2', 'CML-1') - from Measurement Location column",
      "component": "string - FULL component name (e.g., 'Vessel Shell', '2 inch East Head Seam - Head Side', 'Nozzle A-1')",
      "location": "string - specific location description (e.g., 'East End, 12 o'clock')",
      "readings": [0.000] - array of ALL thickness readings for this CML in inches - ALL angles (0°, 90°, 180°, 270° if present)",
      "minThickness": "number - minimum of all readings",
      "nominalThickness": "number - nominal/design thickness if available - from specification",
      "previousThickness": "number - previous inspection thickness if available - from prior inspection column"
    }
  ],
  "findings": [
    {
      "section": "string - section of report (e.g., Shell, Heads, Nozzles, Supports)",
      "finding": "string - detailed finding description",
      "severity": "acceptable|monitor|critical"
    }
  ],
  "checklistItems": [
    {
      "category": "string - category (External Visual, Internal Visual, Foundation, etc.)",
      "itemNumber": "string - item number if available (e.g., '1.1', '1.2')",
      "itemText": "string - checklist item description - FULL text",
      "status": "string - Satisfactory, Unsatisfactory, N/A, Not Checked - EXACT status from report",
      "notes": "string - any notes or comments"
    }
  ],
  "nozzles": [
    {
      "cml": "string - CML number for this nozzle if available",
      "nozzleNumber": "string - nozzle identifier (N1, N2, MW-1, Vent-1, etc.)",
      "service": "string - nozzle service (Manway, Relief, Inlet, Outlet, Vent, Drain, Gauge, Thermowell, etc.)",
      "size": "number - nozzle size in inches (e.g., 18, 2, 24, 0.75)",
      "material": "string - nozzle material specification (e.g., CS-A516-70, SS-A312, SA-106-B)",
      "schedule": "string - pipe schedule (STD, 40, 80, XS, etc.)",
      "age": "number - age in years",
      "previousThickness": "number - previous thickness reading in inches (t_prev)",
      "actualThickness": "number - current measured thickness in inches (t_act)",
      "minimumRequired": "number - minimum required thickness in inches (t_min)",
      "corrosionAllowance": "number - corrosion allowance in inches (Ca = t_act - t_min)",
      "corrosionRate": "number - corrosion rate in inches per year (Cr)",
      "remainingLife": "number or string - remaining life in years (RL) - may be '>20' for long life",
      "acceptable": "boolean - true if passes evaluation, false if failed"
    }
  ],
  "tableA": {
    "description": "Executive Summary TABLE A - Component Calculations",
    "components": [
      {
        "cml": "string - CML number for this component",
        "componentName": "string - component name (Vessel Shell, Shell 1, East Head, West Head, North Head, South Head, etc.)",
        "material": "string - material specification",
        "age": "number - age in years",
        "nominalThickness": "number - nominal thickness (inches)",
        "previousThickness": "number - previous thickness (inches)",
        "actualThickness": "number - actual measured thickness (inches)",
        "minimumRequiredThickness": "number - minimum required thickness (inches)",
        "corrosionAllowance": "number - corrosion allowance (inches)",
        "corrosionRate": "number - corrosion rate (inches per year)",
        "designMAWP": "number - design MAWP (psi)",
        "calculatedMAWP": "number - calculated MAWP at current thickness (psi)",
        "remainingLife": "number or string - remaining life (years) - may be '>20' for long life"
      }
    ]
  }
}

CRITICAL EXTRACTION RULES AND REQUIREMENTS:

1. VESSEL DATA COMPLETENESS:
   - designPressure, designTemperature, operatingPressure, operatingTemperature are ALL required
   - MDMT is CRITICAL for API 510 compliance - SEARCH THOROUGHLY (often in construction code or material section)
   - Product/Service and Configuration (Horizontal/Vertical) MUST be extracted
   - Head Type: Extract for BOTH heads if applicable (e.g., "2:1 Ellipsoidal" for both, or mix)
   - Construction Code must specify ASME Section, Division, and type

2. THICKNESS MEASUREMENTS - CRITICAL:
   - Each UNIQUE CML gets ONE entry with ALL readings in the 'readings' array
   - DEDUPLICATE: If CML-1 appears in multiple places, combine all readings
   - Do NOT create separate entries for 0°, 90°, 180°, 270° - COMBINE into one 'readings' array
   - Extract FULL component names: '2 inch East Head Seam - Head Side' not just 'East Head'
   - Location must be specific: '12 o'clock position' or 'Top weld seam' not just 'East End'
   - Include ALL thickness data from ALL tables in document

3. MULTI-PAGE TABLE HANDLING:
   - Tables may span multiple pages - collect ALL rows even if split across pages
   - Look for "Continued from previous page" or similar indicators
   - Combine nozzle data from multiple sections
   - Ensure no data is lost due to page breaks

4. JOINT EFFICIENCY (E value):
   - CRITICAL for calculations - search everywhere
   - Look in: Vessel Data section, Construction Code section, Calculation tables
   - Values typically: 1.0 (Full RT), 0.85 (Spot RT), 0.70 (No RT)
   - If not explicitly stated, infer from radiography type

5. NOZZLES - EXTRACT ALL:
   - Extract EVERY nozzle from nozzle evaluation tables
   - Look for tables titled "Nozzle Evaluation", "Appendix B", "TABLE B"
   - Include ALL sizes mentioned (18", 2", 24", etc.)
   - Include service type for identification
   - Extract ALL columns: CML, Noz ID, Size, Material, Age, t_prev, t_act, t_min, Ca, Cr, RL
   - If remaining life shows ">20", use 999 as the number
   - Extract acceptability status clearly
   - CRITICAL: Do not miss any nozzles - count them and verify

6. CHECKLIST:
   - Extract ALL checklist items with their EXACT status from report
   - Do not infer or assume - use exact text from document
   - Include all categories present

7. TABLE A - COMPONENT CALCULATIONS:
   - Extract data exactly as shown in Executive Summary table
   - Include ALL components listed (Shell, Shell 1, Head 1, Head 2, etc.)
   - Preserve all calculation results
   - Extract CML numbers for each component
   - Extract material specifications for each component

8. GENERAL RULES:
   - For missing values: use null, NOT zeros or guesses
   - Search ENTIRE document - data scattered across multiple pages
   - If a field exists in document, extract it regardless of completeness
   - Dates must be in YYYY-MM-DD format
   - Numbers should be actual values without units in JSON
   - PRESERVE ALL DATA EXACTLY as it appears

9. SECTION EXTRACTION:
   - inspectionResults: COMPLETE Section 3.0 text - all findings for Shell, Heads, Nozzles, Supports
   - recommendations: COMPLETE Section 4.0 text - all recommendations
   - executiveSummary: Full summary including governing component`;

export const pdfImportRouter = router({
  /**
   * Upload UT results PDF and add readings to an existing inspection
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
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      logger.info("[UT Upload] Starting extraction from:", input.fileName, "for inspection:", input.targetInspectionId);

      // Verify the inspection exists and belongs to user
      const existingInspection = await db
        .select()
        .from(inspections)
        .where(
          and(
            eq(inspections.id, input.targetInspectionId),
            eq(inspections.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existingInspection.length === 0) {
        throw new Error("Inspection not found or access denied");
      }

      // Extract UT readings from PDF using LLM
      const UT_EXTRACTION_PROMPT = `You are an expert at extracting ultrasonic thickness (UT) measurement data from inspection PDFs.

Extract ALL thickness readings from this UT results document in JSON format:

{
  "inspectionDate": "YYYY-MM-DD - date the UT readings were taken",
  "technician": "string - name of technician who performed measurements",
  "thicknessMeasurements": [
    {
      "cml": "string - CML number (e.g., '1', '2', 'CML-1', '171')",
      "component": "string - component name (e.g., 'Shell', 'East Head', 'N1 Manway')",
      "location": "string - specific location (e.g., '12 o'clock', 'Top')",
      "readings": [0.000] - array of ALL readings at this location in inches,
      "minThickness": "number - minimum reading value"
    }
  ],
  "nozzleReadings": [
    {
      "nozzleNumber": "string - nozzle ID (N1, N2, etc.)",
      "service": "string - nozzle service/description",
      "size": "number - nozzle size in inches",
      "readings": [0.000] - array of readings,
      "minThickness": "number - minimum reading"
    }
  ]
}

CRITICAL RULES:
1. Extract EVERY thickness reading from the document
2. Include ALL CML locations
3. Include ALL nozzle readings if present
4. Readings should be in inches
5. If multiple readings at same location, include all in the readings array
6. Use null for missing values, not zeros`;

      const response = await invokeLLM({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: UT_EXTRACTION_PROMPT,
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
            name: "ut_readings",
            strict: true,
            schema: {
              type: "object",
              properties: {
                inspectionDate: { type: "string" },
                technician: { type: "string" },
                thicknessMeasurements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      cml: { type: "string" },
                      component: { type: "string" },
                      location: { type: "string" },
                      readings: { type: "array", items: { type: "number" } },
                      minThickness: { type: "number" },
                    },
                    required: ["cml", "component", "readings", "minThickness"],
                    additionalProperties: false,
                  },
                },
                nozzleReadings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nozzleNumber: { type: "string" },
                      service: { type: "string" },
                      size: { type: "number" },
                      readings: { type: "array", items: { type: "number" } },
                      minThickness: { type: "number" },
                    },
                    required: ["nozzleNumber", "readings", "minThickness"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["thicknessMeasurements", "nozzleReadings"],
              additionalProperties: false,
            },
          },
        },
      });

      const messageContent = response.choices[0].message.content;
      const extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");

      logger.info("[UT Upload] Extracted:", {
        tmlCount: extractedData.thicknessMeasurements?.length || 0,
        nozzleCount: extractedData.nozzleReadings?.length || 0,
      });

      // Get existing TML readings for this inspection to set previous thickness values
      const existingReadings = await db
        .select()
        .from(tmlReadings)
        .where(eq(tmlReadings.inspectionId, input.targetInspectionId));
      
      // Create a map of CML number to existing reading for quick lookup
      const existingReadingsMap = new Map<string, typeof existingReadings[0]>();
      for (const reading of existingReadings) {
        const cmlKey = (reading.cmlNumber || reading.tmlId || '').toString().toLowerCase().trim();
        if (cmlKey) {
          existingReadingsMap.set(cmlKey, reading);
        }
      }
      
      logger.info("[UT Upload] Found existing readings:", existingReadingsMap.size);

      // Add new TML readings to the inspection
      // T-previous = existing T-current (from last report)
      // T-current = new imported readings
      let tmlAdded = 0;
      let tmlUpdated = 0;
      if (extractedData.thicknessMeasurements && extractedData.thicknessMeasurements.length > 0) {
        for (const measurement of extractedData.thicknessMeasurements) {
          const readings = measurement.readings || [];
          const newThickness = measurement.minThickness?.toString() || readings[0]?.toString() || null;
          const cmlKey = (measurement.cml || '').toString().toLowerCase().trim();
          
          // Check if we have an existing reading for this CML
          const existingReading = existingReadingsMap.get(cmlKey);
          
          if (existingReading) {
            // UPDATE existing reading:
            // - Move current thickness to previous thickness
            // - Set new current thickness from imported data
            const previousThickness = existingReading.currentThickness || existingReading.tActual || null;
            const previousDate = existingReading.currentInspectionDate || null;
            
            await db.execute(sql`
              UPDATE tmlReadings 
              SET 
                previousThickness = ${previousThickness},
                previousInspectionDate = ${previousDate},
                currentThickness = ${newThickness},
                tActual = ${newThickness},
                tml1 = ${readings[0]?.toString() || null},
                tml2 = ${readings[1]?.toString() || null},
                tml3 = ${readings[2]?.toString() || null},
                tml4 = ${readings[3]?.toString() || null},
                currentInspectionDate = ${extractedData.inspectionDate ? new Date(extractedData.inspectionDate) : new Date()},
                updatedAt = NOW()
              WHERE id = ${existingReading.id}
            `);
            tmlUpdated++;
            logger.info(`[UT Upload] Updated CML ${measurement.cml}: prev=${previousThickness}, curr=${newThickness}`);
          } else {
            // INSERT new reading (no previous data exists)
            await db.execute(sql`
              INSERT INTO tmlReadings (
                id, inspectionId, cmlNumber, componentType, location, service,
                tml1, tml2, tml3, tml4, tActual, currentThickness,
                currentInspectionDate, status, tmlId, component
              ) VALUES (
                ${nanoid()}, ${input.targetInspectionId}, ${String(measurement.cml || 'N/A')}, 
                ${String(measurement.component || 'Unknown')}, ${String(measurement.location || 'N/A')}, ${null},
                ${readings[0]?.toString() || null}, ${readings[1]?.toString() || null}, 
                ${readings[2]?.toString() || null}, ${readings[3]?.toString() || null},
                ${newThickness}, ${newThickness},
                ${extractedData.inspectionDate ? new Date(extractedData.inspectionDate) : new Date()},
                ${'good'}, ${measurement.cml || null}, ${measurement.component || null}
              )
            `);
            tmlAdded++;
            logger.info(`[UT Upload] Added new CML ${measurement.cml}: curr=${newThickness}`);
          }
        }
      }

      // Update nozzle readings if present
      let nozzlesUpdated = 0;
      if (extractedData.nozzleReadings && extractedData.nozzleReadings.length > 0) {
        for (const nozzle of extractedData.nozzleReadings) {
          // Try to update existing nozzle
          const result = await db.execute(sql`
            UPDATE nozzleEvaluations 
            SET actualThickness = ${nozzle.minThickness?.toString() || null},
                updatedAt = NOW()
            WHERE inspectionId = ${input.targetInspectionId}
              AND nozzleNumber = ${nozzle.nozzleNumber}
          `);
          
          // If no existing nozzle, create new one
          if ((result as any).affectedRows === 0) {
            await db.insert(nozzleEvaluations).values({
              id: nanoid(),
              inspectionId: input.targetInspectionId,
              nozzleNumber: nozzle.nozzleNumber,
              nozzleDescription: nozzle.service || null,
              nominalSize: nozzle.size?.toString() || '1',
              actualThickness: nozzle.minThickness?.toString() || null,
              acceptable: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          nozzlesUpdated++;
        }
      }

      // Update inspection date if provided
      if (extractedData.inspectionDate) {
        await db.execute(sql`
          UPDATE inspections 
          SET inspectionDate = ${new Date(extractedData.inspectionDate)},
              updatedAt = NOW()
          WHERE id = ${input.targetInspectionId}
        `);
      }

      return {
        success: true,
        message: `Added ${tmlAdded} new readings, updated ${tmlUpdated} existing readings, and updated ${nozzlesUpdated} nozzles`,
        tmlCount: tmlAdded,
        tmlUpdated: tmlUpdated,
        nozzleCount: nozzlesUpdated,
      };
    }),


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
                        cml: { type: "string" },
                        nozzleNumber: { type: "string" },
                        service: { type: "string" },
                        size: { type: "number" },
                        material: { type: "string" },
                        schedule: { type: "string" },
                        age: { type: "number" },
                        previousThickness: { type: "number" },
                        actualThickness: { type: "number" },
                        minimumRequired: { type: "number" },
                        corrosionAllowance: { type: "number" },
                        corrosionRate: { type: "number" },
                        remainingLife: { type: "number" },
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
                            cml: { type: "string" },
                            componentName: { type: "string" },
                            material: { type: "string" },
                            age: { type: "number" },
                            nominalThickness: { type: "number" },
                            previousThickness: { type: "number" },
                            actualThickness: { type: "number" },
                            minimumRequiredThickness: { type: "number" },
                            corrosionAllowance: { type: "number" },
                            corrosionRate: { type: "number" },
                            designMAWP: { type: "number" },
                            calculatedMAWP: { type: "number" },
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

        // Log nozzle details for debugging
        if (extractedData.nozzles && extractedData.nozzles.length > 0) {
          logger.info("[PDF Import] Nozzles extracted:", extractedData.nozzles.map((n: any) => ({
            number: n.nozzleNumber,
            size: n.size,
            service: n.service,
            actualThickness: n.actualThickness,
            minimumRequired: n.minimumRequired,
          })));
        } else {
          logger.warn("[PDF Import] NO NOZZLES EXTRACTED - Check PDF content");
        }

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
              cml: z.string().optional(),
              nozzleNumber: z.string(),
              service: z.string().optional(),
              size: z.number().optional(),
              material: z.string().optional(),
              schedule: z.string().optional(),
              age: z.number().optional(),
              previousThickness: z.number().optional(),
              actualThickness: z.number().optional(),
              minimumRequired: z.number().optional(),
              corrosionAllowance: z.number().optional(),
              corrosionRate: z.number().optional(),
              remainingLife: z.number().optional(),
              acceptable: z.boolean().optional(),
            })
          )
          .optional(),
        tableA: z
          .object({
            description: z.string().optional(),
            components: z.array(
              z.object({
                cml: z.string().optional(),
                componentName: z.string(),
                material: z.string().optional(),
                age: z.number().optional(),
                nominalThickness: z.number().optional(),
                previousThickness: z.number().optional(),
                actualThickness: z.number().optional(),
                minimumRequiredThickness: z.number().optional(),
                corrosionAllowance: z.number().optional(),
                corrosionRate: z.number().optional(),
                designMAWP: z.number().optional(),
                calculatedMAWP: z.number().optional(),
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
      logger.info("[PDF Import] Nozzles to save:", input.nozzles?.length || 0);

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

      // Import nozzle evaluations - CRITICAL SECTION
      if (input.nozzles && input.nozzles.length > 0) {
        logger.info("[PDF Import] Processing", input.nozzles.length, "nozzles");
        
        for (const nozzle of input.nozzles) {
          // Calculate minimum required thickness if not provided
          let minimumRequired = nozzle.minimumRequired;
          if (!minimumRequired && nozzle.size) {
            // Use pipe schedule database to get tmin
            const tmin = getNozzleMinThickness(nozzle.size, nozzle.schedule || 'STD');
            if (tmin) {
              minimumRequired = tmin;
            }
          }
          
          // Get pipe schedule data for nominal thickness
          let pipeNominalThickness = nozzle.previousThickness;
          if (!pipeNominalThickness && nozzle.size) {
            const pipeData = getPipeSchedule(nozzle.size, nozzle.schedule || 'STD');
            if (pipeData) {
              pipeNominalThickness = pipeData.wallThickness;
            }
          }
          
          const nozzleRecord = {
            id: nanoid(),
            inspectionId: inspectionId,
            nozzleNumber: nozzle.nozzleNumber,
            nozzleDescription: nozzle.service || null,
            location: null as string | null,
            nominalSize: nozzle.size?.toString() || '1',
            schedule: nozzle.schedule || null,
            actualThickness: nozzle.actualThickness?.toString() || null,
            pipeNominalThickness: pipeNominalThickness?.toString() || null,
            pipeMinusManufacturingTolerance: pipeNominalThickness ? (pipeNominalThickness * 0.875).toString() : null,
            shellHeadRequiredThickness: null as string | null,
            minimumRequired: minimumRequired?.toString() || null,
            acceptable: nozzle.acceptable !== false,
            notes: nozzle.material ? `Material: ${nozzle.material}, Age: ${nozzle.age || 'N/A'} yrs, Ca: ${nozzle.corrosionAllowance || 'N/A'}", Cr: ${nozzle.corrosionRate || 'N/A'} in/yr, RL: ${nozzle.remainingLife || 'N/A'} yrs` : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          logger.info("[PDF Import] Inserting nozzle:", {
            number: nozzleRecord.nozzleNumber,
            size: nozzleRecord.nominalSize,
            actualThickness: nozzleRecord.actualThickness,
            minimumRequired: nozzleRecord.minimumRequired,
          });

          await db.insert(nozzleEvaluations).values(nozzleRecord);
        }
        logger.info("[PDF Import] Created", input.nozzles.length, "nozzle evaluation records");
      } else {
        logger.warn("[PDF Import] No nozzles to import");
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
            componentType: comp.componentName.toLowerCase().includes('head') ? 'head' as const : 'shell' as const,
            materialCode: comp.material || input.vesselData.materialSpec || null,
            materialName: comp.material || input.vesselData.materialSpec || null,
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
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        logger.info("[PDF Import] Created", input.tableA.components.length, "component calculations from TABLE A");
      } else {
        // Generate default calculations if no TABLE A
        const defaultComponents = [
          { name: 'Shell', type: 'shell' },
          { name: 'Head 1', type: 'head' },
          { name: 'Head 2', type: 'head' },
        ];

        for (const comp of defaultComponents) {
          // Calculate minimum thickness based on component type
          let tMin = 0;
          if (comp.type === 'shell' && P > 0 && R > 0 && S > 0 && E > 0) {
            tMin = (P * R) / (S * E - 0.6 * P);
          } else if (comp.type === 'head' && P > 0 && R > 0 && S > 0 && E > 0) {
            tMin = (P * R * 2) / (2 * S * E - 0.2 * P);
          }

          await db.insert(componentCalculations).values({
            id: nanoid(),
            reportId: reportId,
            componentName: comp.name,
            componentType: comp.type as 'shell' | 'head',
            materialCode: input.vesselData.materialSpec || null,
            materialName: input.vesselData.materialSpec || null,
            designTemp: input.vesselData.designTemperature?.toString() || null,
            designMAWP: input.vesselData.designPressure?.toString() || null,
            insideDiameter: input.vesselData.insideDiameter?.toString() || null,
            nominalThickness: null,
            actualThickness: null,
            minimumThickness: tMin > 0 ? tMin.toFixed(4) : null,
            corrosionRate: null,
            remainingLife: null,
            calculatedMAWP: null,
            allowableStress: S.toString(),
            jointEfficiency: E.toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        logger.info("[PDF Import] Created default component calculations");
      }

      return {
        success: true,
        inspectionId,
        message: `Inspection imported successfully with ${input.thicknessMeasurements?.length || 0} TML readings, ${input.nozzles?.length || 0} nozzles, and ${input.tableA?.components?.length || 0} component calculations`,
      };
    }),

  /**
   * Download Excel template for data import
   */
  downloadTemplate: protectedProcedure
    .query(async () => {
      const buffer = generateExcelTemplate();
      const base64 = buffer.toString('base64');
      return {
        data: base64,
        filename: 'API_510_Import_Template.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),
});

