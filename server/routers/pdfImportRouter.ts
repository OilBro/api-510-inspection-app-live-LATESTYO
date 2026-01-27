import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { jsonrepair } from 'jsonrepair';
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
      "angle0": "number - thickness reading at 0° position in inches (if available)",
      "angle90": "number - thickness reading at 90° position in inches (if available)",
      "angle180": "number - thickness reading at 180° position in inches (if available)",
      "angle270": "number - thickness reading at 270° position in inches (if available)",
      "readings": [0.000] - array of ALL thickness readings for this CML in inches - ALL angles combined",
      "minThickness": "number - minimum of all readings (t-actual)",
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
      // Normalize CML keys to handle variations like "1", "01", "001", "CML-1", "CML 1", etc.
      const normalizeCmlKey = (cml: string | null | undefined): string => {
        if (!cml) return '';
        const str = cml.toString().toLowerCase().trim();
        // Remove common prefixes like "cml", "tml", "#"
        const cleaned = str.replace(/^(cml|tml|#|no\.?|number)?[-\s]*/i, '').trim();
        // Try to extract just the numeric part for comparison
        const numMatch = cleaned.match(/^(\d+)/);
        return numMatch ? numMatch[1] : cleaned;
      };
      
      const existingReadingsMap = new Map<string, typeof existingReadings[0]>();
      for (const reading of existingReadings) {
        const cmlKey = normalizeCmlKey(reading.cmlNumber || reading.tmlId);
        if (cmlKey) {
          existingReadingsMap.set(cmlKey, reading);
        }
      }
      
      logger.info("[UT Upload] Found existing readings:", existingReadingsMap.size);
      logger.info("[UT Upload] Existing CML keys:", Array.from(existingReadingsMap.keys()).slice(0, 20));

      // Add new TML readings to the inspection
      // T-previous = existing T-current (from last report)
      // T-current = new imported readings
      let tmlAdded = 0;
      let tmlUpdated = 0;
      if (extractedData.thicknessMeasurements && extractedData.thicknessMeasurements.length > 0) {
        for (const measurement of extractedData.thicknessMeasurements) {
          const readings = measurement.readings || [];
          const newThickness = measurement.minThickness?.toString() || readings[0]?.toString() || null;
          const cmlKey = normalizeCmlKey(measurement.cml);
          
          // Check if we have an existing reading for this CML
          const existingReading = existingReadingsMap.get(cmlKey);
          logger.info(`[UT Upload] Looking up CML '${measurement.cml}' -> normalized key '${cmlKey}' -> found: ${!!existingReading}`);
          
          if (existingReading) {
            // UPDATE existing reading:
            // - Move current thickness to previous thickness
            // - Set new current thickness from imported data
            // - Calculate corrosion rate based on actual time between inspections
            const previousThickness = existingReading.currentThickness || existingReading.tActual || null;
            const previousDate = existingReading.currentInspectionDate || null;
            const newDate = extractedData.inspectionDate ? new Date(extractedData.inspectionDate) : new Date();
            
            // Calculate corrosion rate: Cr = (T-previous - T-current) / Years
            // Per API 510 §7.1.1: Corrosion rate shall be calculated from actual thickness measurements
            let corrosionRate: string | null = null;
            let remainingLife: string | null = null;
            
            if (previousThickness && newThickness && previousDate) {
              const prevThick = parseFloat(previousThickness);
              const currThick = parseFloat(newThickness);
              const prevDateObj = new Date(previousDate);
              
              // Calculate years between inspections
              const yearsBetween = (newDate.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
              
              if (yearsBetween > 0 && prevThick > currThick) {
                // Corrosion rate in mils per year (mpy) = (thickness loss in inches * 1000) / years
                const thicknessLoss = prevThick - currThick;
                const crMpy = (thicknessLoss * 1000) / yearsBetween;
                corrosionRate = crMpy.toFixed(2);
                
                // Calculate remaining life if we have minimum thickness
                // RL = (T-current - T-min) / Cr (in years)
                // For now, use a default t-min of 0.1" if not specified
                const tMin = 0.1; // Default minimum, should be from component calculations
                if (currThick > tMin && crMpy > 0) {
                  const rlYears = ((currThick - tMin) * 1000) / crMpy;
                  remainingLife = rlYears.toFixed(1);
                }
                
                logger.info(`[UT Upload] CML ${measurement.cml}: Cr=${crMpy.toFixed(2)} mpy over ${yearsBetween.toFixed(2)} years`);
              } else if (yearsBetween > 0 && prevThick <= currThick) {
                // No corrosion or thickness increased (measurement variation)
                corrosionRate = '0.00';
                remainingLife = null; // Cannot calculate if no corrosion
                logger.info(`[UT Upload] CML ${measurement.cml}: No corrosion detected (prev=${prevThick}, curr=${currThick})`);
              }
            }
            
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
                currentInspectionDate = ${newDate},
                corrosionRate = ${corrosionRate},
                remainingLife = ${remainingLife},
                updatedAt = NOW()
              WHERE id = ${existingReading.id}
            `);
            tmlUpdated++;
            logger.info(`[UT Upload] Updated CML ${measurement.cml}: prev=${previousThickness}, curr=${newThickness}, Cr=${corrosionRate} mpy`);
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
                        angle0: { type: "number" },
                        angle90: { type: "number" },
                        angle180: { type: "number" },
                        angle270: { type: "number" },
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
                required: ["vesselData", "inspectionData", "thicknessMeasurements", "findings", "checklistItems", "nozzles", "tableA", "recommendations", "inspectionResults"],
                additionalProperties: false,
              },
            },
          },
        });

        const messageContent = response.choices[0].message.content;
        let extractedData;
        try {
          extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");
        } catch (parseError) {
          // Try to repair JSON using jsonrepair library
          logger.warn("[PDF Import] JSON parse failed, attempting repair with jsonrepair...");
          try {
            let content = typeof messageContent === 'string' ? messageContent : "{}";
            
            // Remove any markdown code blocks first
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Use jsonrepair to fix malformed JSON
            const repaired = jsonrepair(content);
            extractedData = JSON.parse(repaired);
            logger.info("[PDF Import] JSON repair successful with jsonrepair");
          } catch (repairError) {
            logger.error("[PDF Import] JSON repair failed:", repairError);
            throw parseError;
          }
        }

        logger.info("[PDF Import] Extraction complete:", {
          vesselTag: extractedData.vesselData?.vesselTagNumber,
          tmlCount: extractedData.thicknessMeasurements?.length || 0,
          findingsCount: extractedData.findings?.length || 0,
          checklistCount: extractedData.checklistItems?.length || 0,
          nozzleCount: extractedData.nozzles?.length || 0,
          tableACount: extractedData.tableA?.components?.length || 0,
          hasRecommendations: !!extractedData.recommendations,
          recommendationsLength: extractedData.recommendations?.length || 0,
          hasInspectionResults: !!extractedData.inspectionResults,
          inspectionResultsLength: extractedData.inspectionResults?.length || 0,
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
              angle0: z.number().optional(),
              angle90: z.number().optional(),
              angle180: z.number().optional(),
              angle270: z.number().optional(),
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
      logger.info("[PDF Import] Recommendations:", input.recommendations ? `HAS DATA (${input.recommendations.length} chars)` : "NULL/EMPTY");
      logger.info("[PDF Import] Inspection Results:", input.inspectionResults ? `HAS DATA (${input.inspectionResults.length} chars)` : "NULL/EMPTY");
      
      // Debug: Log first 200 chars of each if present
      if (input.recommendations) {
        logger.info("[PDF Import] Recommendations preview:", input.recommendations.substring(0, 200));
      }
      if (input.inspectionResults) {
        logger.info("[PDF Import] Inspection Results preview:", input.inspectionResults.substring(0, 200));
      }

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
        // Determine extraction quality based on what was extracted
        extractionQuality: (() => {
          const hasResults = !!(input.inspectionResults && input.inspectionResults.trim().length > 10);
          const hasRecommendations = !!(input.recommendations && input.recommendations.trim().length > 10);
          if (!hasResults && !hasRecommendations) return 'missing_both';
          if (!hasResults) return 'missing_results';
          if (!hasRecommendations) return 'missing_recommendations';
          return 'complete';
        })(),
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
          
          // Use explicit angle fields if available, otherwise fall back to readings array
          const tml1 = measurement.angle0?.toString() || readings[0]?.toString() || null;
          const tml2 = measurement.angle90?.toString() || readings[1]?.toString() || null;
          const tml3 = measurement.angle180?.toString() || readings[2]?.toString() || null;
          const tml4 = measurement.angle270?.toString() || readings[3]?.toString() || null;
          
          const record = {
            id: nanoid(),
            inspectionId: inspectionId,
            cmlNumber: String(measurement.cml || 'N/A'),
            componentType: String(measurement.component || 'Unknown'),
            location: String(measurement.location || 'N/A'),
            service: null as string | null,
            tml1,
            tml2,
            tml3,
            tml4,
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
   * Extract photos from PDF and identify them using AI
   */
  extractPhotosFromPDF: protectedProcedure
    .input(z.object({
      pdfUrl: z.string(),
      inspectionId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      logger.info("[Photo Extract] Starting photo extraction from PDF", { url: input.pdfUrl });
      
      try {
        // Use LLM to analyze the PDF and identify photos with their descriptions
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert at analyzing API 510 pressure vessel inspection report PDFs to identify and describe photographs.

Your task is to:
1. Identify ALL photographs/images in the PDF (excluding diagrams, charts, and tables)
2. For each photo, determine:
   - Page number where it appears
   - What vessel component is shown (Shell, East Head, West Head, Nozzle, Foundation, Nameplate, etc.)
   - Description of what the photo shows (corrosion, pitting, weld condition, general condition, etc.)
   - Any caption or label from the report

Return JSON with an array of photo descriptions. If no photos are found, return an empty array.

IMPORTANT: Only include actual photographs, not:
- Diagrams or schematics
- Charts or graphs
- Tables
- Logos or headers`
            },
            {
              role: "user",
              content: [
                {
                  type: "file_url" as const,
                  file_url: {
                    url: input.pdfUrl,
                    mime_type: "application/pdf" as const
                  }
                },
                {
                  type: "text" as const,
                  text: "Analyze this API 510 inspection report PDF and identify all photographs. Return a JSON array describing each photo found."
                }
              ]
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "photo_extraction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  photos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        pageNumber: { type: "number", description: "Page number where photo appears" },
                        component: { type: "string", description: "Vessel component shown (Shell, East Head, West Head, Nozzle, Foundation, Nameplate, etc.)" },
                        category: { type: "string", description: "Photo category: General, Corrosion, Pitting, Weld, Coating, Nameplate, Foundation, Nozzle, Internal, External" },
                        description: { type: "string", description: "Detailed description of what the photo shows" },
                        caption: { type: "string", description: "Original caption from the report if present" },
                        condition: { type: "string", description: "Condition assessment: Good, Fair, Poor, Critical" }
                      },
                      required: ["pageNumber", "component", "category", "description", "caption", "condition"],
                      additionalProperties: false
                    }
                  },
                  totalPhotosFound: { type: "number", description: "Total number of photos identified" }
                },
                required: ["photos", "totalPhotosFound"],
                additionalProperties: false
              }
            }
          }
        });

        const messageContent = response.choices[0].message.content;
        let extractedData;
        
        try {
          extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");
        } catch (parseError) {
          logger.warn("[Photo Extract] JSON parse failed, attempting repair...");
          try {
            const repaired = jsonrepair(typeof messageContent === 'string' ? messageContent : "{}");
            extractedData = JSON.parse(repaired);
          } catch (repairError) {
            logger.error("[Photo Extract] JSON repair failed", repairError);
            return { success: false, photos: [], error: "Failed to parse photo extraction results" };
          }
        }

        logger.info("[Photo Extract] Found photos:", extractedData.totalPhotosFound);
        
        return {
          success: true,
          photos: extractedData.photos || [],
          totalPhotosFound: extractedData.totalPhotosFound || 0,
          message: `Found ${extractedData.totalPhotosFound || 0} photos in the PDF`
        };
      } catch (error) {
        logger.error("[Photo Extract] Error extracting photos:", error);
        return {
          success: false,
          photos: [],
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
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

  /**
   * Upload UT Results with Location-Based Matching
   * Uses LOCATION-BASED MATCHING to match new readings to existing CMLs
   * This is critical because CML numbers may change between reports, but locations remain the same
   */
  uploadUTResultsWithLocationMatching: protectedProcedure
    .input(z.object({
      targetInspectionId: z.string(),
      pdfUrl: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      logger.info("[Upload UT Results] Starting upload", {
        inspectionId: input.targetInspectionId,
        fileName: input.fileName,
      });

      // 1. Verify the inspection exists and belongs to user (or user is admin)
      const [inspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.id, input.targetInspectionId));

      if (!inspection) {
        throw new Error("Inspection not found");
      }

      const isAdmin = ctx.user?.role === 'admin';
      if (!isAdmin && inspection.userId !== ctx.user?.id) {
        throw new Error("You don't have permission to update this inspection");
      }

      // 2. Get existing TML readings for this inspection
      const existingTMLs = await db
        .select()
        .from(tmlReadings)
        .where(eq(tmlReadings.inspectionId, input.targetInspectionId));

      logger.info("[Upload UT Results] Found existing TMLs", { count: existingTMLs.length });

      // 3. Extract new readings from the uploaded PDF using LLM
      const extractionPrompt = `You are extracting ultrasonic thickness (UT) measurement data from a PDF.

EXTRACT ALL THICKNESS READINGS in this exact JSON format:
{
  "inspectionDate": "YYYY-MM-DD - date of inspection if found",
  "technician": "string - technician name if found",
  "readings": [
    {
      "cmlNumber": "string - CML number from the report",
      "location": "string - FULL location description (e.g., '2\"', '4\"', 'East Head 12 O\'Clock', '2\" East Head Seam - Head Side')",
      "component": "string - component type (Shell, East Head, West Head, Nozzle, etc.)",
      "angularReadings": {
        "0": "number or null - reading at 0 degrees",
        "45": "number or null - reading at 45 degrees",
        "90": "number or null - reading at 90 degrees",
        "135": "number or null - reading at 135 degrees",
        "180": "number or null - reading at 180 degrees",
        "224": "number or null - reading at 224 degrees",
        "270": "number or null - reading at 270 degrees",
        "315": "number or null - reading at 315 degrees"
      },
      "singleReading": "number or null - for head readings that have only one value",
      "tmin": "number or null - minimum required thickness if shown"
    }
  ]
}

CRITICAL RULES:
1. The LOCATION field is the most important - it must match exactly what's in the 'Desc.' or 'Description' column
2. For shell readings with 8 angular positions (0, 45, 90, 135, 180, 224, 270, 315), extract ALL readings
3. For nozzle readings with 4 angular positions (0, 90, 180, 270), extract ALL readings
4. For head readings (East Head 12 O'Clock, etc.), use singleReading
5. Extract EVERY row from the table - do not skip any
6. Location examples: "2'", "4'", "6'", "East Head 12 O'Clock", "2\" East Head Seam - Shell Side"`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: extractionPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all thickness readings from this UT report PDF:" },
              { type: "file_url", file_url: { url: input.pdfUrl, mime_type: "application/pdf" } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ut_readings",
            strict: true,
            schema: {
              type: "object",
              properties: {
                inspectionDate: { type: ["string", "null"] },
                technician: { type: ["string", "null"] },
                readings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      cmlNumber: { type: "string" },
                      location: { type: "string" },
                      component: { type: "string" },
                      angularReadings: {
                        type: ["object", "null"],
                        properties: {
                          "0": { type: ["number", "null"] },
                          "45": { type: ["number", "null"] },
                          "90": { type: ["number", "null"] },
                          "135": { type: ["number", "null"] },
                          "180": { type: ["number", "null"] },
                          "224": { type: ["number", "null"] },
                          "270": { type: ["number", "null"] },
                          "315": { type: ["number", "null"] }
                        },
                        additionalProperties: false
                      },
                      singleReading: { type: ["number", "null"] },
                      tmin: { type: ["number", "null"] }
                    },
                    required: ["cmlNumber", "location", "component"],
                    additionalProperties: false
                  }
                }
              },
              required: ["readings"],
              additionalProperties: false
            }
          }
        }
      });

      const messageContent = response.choices[0].message.content;
      let extractedData: { readings: Array<{ cmlNumber: string; location: string; component: string; angularReadings?: Record<string, number | null> | null; singleReading?: number | null; tmin?: number | null }> };
      
      try {
        extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");
      } catch (parseError) {
        logger.warn("[Upload UT Results] JSON parse failed, attempting repair...");
        try {
          const repaired = jsonrepair(typeof messageContent === 'string' ? messageContent : "{}");
          extractedData = JSON.parse(repaired);
        } catch (repairError) {
          throw new Error("Failed to parse extracted UT data");
        }
      }

      const newReadings = extractedData.readings || [];
      logger.info("[Upload UT Results] Extracted readings", { count: newReadings.length });

      // 4. Match new readings to existing CMLs by LOCATION
      const { matchReadingsByLocation } = await import("../locationMatcher");

      // Prepare existing CMLs for matching
      const existingForMatching = existingTMLs.map(tml => ({
        id: tml.id,
        cmlNumber: tml.cmlNumber || '',
        location: tml.location || tml.componentType || '',
        component: tml.componentType || '',
        angularPosition: tml.angle ? parseInt(tml.angle.replace('°', ''), 10) : undefined,
        currentThickness: tml.tActual ? parseFloat(String(tml.tActual)) : (tml.currentThickness ? parseFloat(String(tml.currentThickness)) : undefined),
      }));

      // Prepare new readings for matching - expand angular readings into individual TMLs
      interface ExpandedReading {
        cmlNumber: string;
        location: string;
        component: string;
        angularPosition?: number;
        thickness: number;
        tmin?: number;
      }
      const expandedNewReadings: ExpandedReading[] = [];

      for (const reading of newReadings) {
        // Handle single readings (head readings)
        if (reading.singleReading !== null && reading.singleReading !== undefined) {
          expandedNewReadings.push({
            cmlNumber: reading.cmlNumber || '',
            location: reading.location || '',
            component: reading.component || '',
            thickness: reading.singleReading,
            tmin: reading.tmin || undefined,
          });
        }

        // Handle angular readings
        if (reading.angularReadings) {
          const angles = ['0', '45', '90', '135', '180', '224', '270', '315'];
          for (const angle of angles) {
            const value = reading.angularReadings[angle];
            if (value !== null && value !== undefined) {
              expandedNewReadings.push({
                cmlNumber: reading.cmlNumber || '',
                location: reading.location || '',
                component: reading.component || '',
                angularPosition: parseInt(angle, 10),
                thickness: value,
                tmin: reading.tmin || undefined,
              });
            }
          }
        }
      }

      logger.info("[Upload UT Results] Expanded to individual readings", { count: expandedNewReadings.length });

      // Perform location-based matching
      const matchResult = matchReadingsByLocation(existingForMatching, expandedNewReadings, {
        minConfidence: 0.6,
        allowFuzzyMatch: true,
      });

      logger.info("[Upload UT Results] Matching results", {
        matched: matchResult.matched.length,
        unmatched: matchResult.unmatched.length,
        matchRate: (matchResult.summary.matchRate * 100).toFixed(1) + '%',
      });

      // 5. Update matched CMLs with new readings
      let updatedCount = 0;
      let createdCount = 0;

      for (const match of matchResult.matched) {
        // Update existing TML with new reading
        // Move current thickness to previous thickness
        const existingTML = existingTMLs.find(t => t.id === match.existingCmlId);
        const previousThickness = existingTML?.currentThickness;

        await db
          .update(tmlReadings)
          .set({
            previousThickness: previousThickness ? String(previousThickness) : null,
            currentThickness: String(match.newReading.thickness),
            tActual: String(match.newReading.thickness),
            updatedAt: new Date(),
          })
          .where(eq(tmlReadings.id, match.existingCmlId));

        updatedCount++;
      }

      // 6. Create new TMLs for unmatched readings (optional - add as new CMLs)
      for (const unmatched of matchResult.unmatched) {
        const reading = unmatched.reading;
        
        // Create a new TML record
        const newTmlId = nanoid();
        await db.insert(tmlReadings).values({
          id: newTmlId,
          inspectionId: input.targetInspectionId,
          cmlNumber: reading.cmlNumber || `NEW-${createdCount + 1}`,
          location: reading.location,
          componentType: reading.component || 'Unknown',
          angle: reading.angularPosition !== undefined ? `${reading.angularPosition}°` : null,
          tActual: String(reading.thickness),
          currentThickness: String(reading.thickness),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        createdCount++;
      }

      logger.info("[Upload UT Results] Complete", {
        updatedCount,
        createdCount,
        totalProcessed: updatedCount + createdCount,
      });

      return {
        success: true,
        message: `Updated ${updatedCount} existing CMLs and created ${createdCount} new CMLs`,
        summary: {
          extractedReadings: newReadings.length,
          expandedReadings: expandedNewReadings.length,
          matchedByLocation: matchResult.matched.length,
          unmatchedNewCMLs: matchResult.unmatched.length,
          updatedCMLs: updatedCount,
          createdCMLs: createdCount,
          matchRate: matchResult.summary.matchRate,
        },
      };
    }),
});

