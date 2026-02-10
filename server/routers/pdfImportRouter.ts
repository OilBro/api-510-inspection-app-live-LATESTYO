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
   - Extract FULL component names: '2 inch East Head Seam - Head Side' not just 'East Head' - DO NOT TRUNCATE
   - Location must be specific: '12 o'clock position' or 'Top weld seam' not just 'East End'
   - Include ALL thickness data from ALL tables in document
   - PREVIOUS THICKNESS: Search for "Previous", "Prior", "t_prev", "Baseline" columns - CRITICAL for corrosion rate
   - If no previous thickness found, use null (NOT 0.000)

3. MULTI-PAGE TABLE HANDLING:
   - Tables may span multiple pages - collect ALL rows even if split across pages
   - Look for "Continued from previous page" or similar indicators
   - Count row numbers (e.g., if CML goes 001-177, you MUST extract ALL 177 rows)
   - Combine nozzle data from multiple sections
   - Ensure no data is lost due to page breaks
   - VERIFICATION: Before finishing, count total rows extracted and verify against expected count

4. JOINT EFFICIENCY (E value):
   - CRITICAL for calculations - search everywhere
   - Look in: Vessel Data section, Construction Code section, Calculation tables
   - Values typically: 1.0 (Full RT), 0.85 (Spot RT), 0.70 (No RT)
   - If not explicitly stated, infer from radiography type

5. NOZZLES - EXTRACT ALL (CRITICAL):
   - Extract EVERY nozzle from ALL nozzle-related tables in the document
   - Search for tables titled: "Nozzle Evaluation", "Appendix B", "TABLE B", "Nozzle Schedule", "Nozzle Data", "Nozzle Thickness", "Nozzle RL", "Remaining Life Calculations"
   - Look in Section 7.0 (Nozzle Evaluation), Appendix sections, and any tables with nozzle data
   - Common nozzle identifiers: N1, N2, N3, MW (Manway), RV (Relief Valve), Inlet, Outlet, Drain, Vent, Level, Gauge, Thermowell
   - NOZZLE SIZE EXTRACTION: Parse sizes from descriptions - extract NUMERIC VALUE separately
     * "24\" Manway" → size: 24 (number)
     * "N1 Manway 24" → size: 24 (number)
     * "3\" Relief" → size: 3 (number)
     * "2\" Inlet" → size: 2 (number)
     * "1\" Drain" → size: 1 (number)
   - Extract ALL columns: CML, Noz ID/Number, Size, Material, Schedule, Age, t_prev, t_act, t_min, Ca, Cr, RL
   - If remaining life shows ">20" or "20+", use 999 as the number
   - Extract acceptability status (Pass/Fail, Acceptable/Unacceptable, Yes/No)
   - MANDATORY: Count all nozzles found and ensure EVERY one is extracted
   - If you see "12 nozzles" mentioned, you MUST extract 12 nozzle records
   - Look for nozzle thickness readings in TML tables too (component = "Nozzle")

6. CHECKLIST - EXTRACT ALL ITEMS:
   - Extract EVERY checklist item from the inspection checklist section
   - Look for tables titled: "Inspection Checklist", "Checklist", "Inspection Items", "Section 2.0"
   - Common checklist categories: External Visual, Internal Visual, Nozzles, Supports, Nameplate, Insulation, Coating, Corrosion, Erosion, Cracking, Deformation
   - Extract item description/name EXACTLY as written
   - Extract status: Pass/Fail, Yes/No, Acceptable/Unacceptable, Satisfactory/Unsatisfactory, N/A, Not Inspected
   - Extract any notes or comments for each item
   - MANDATORY: Count all checklist items and ensure EVERY one is extracted
   - If checklist has 25 items, you MUST extract 25 checklist records

7. TABLE A - COMPONENT CALCULATIONS:
   - Extract data exactly as shown in Executive Summary table
   - Include ALL components listed (Shell, Shell 1, Head 1, Head 2, etc.)
   - Preserve all calculation results
   - Extract CML numbers for each component
   - Extract material specifications for each component

8. GENERAL RULES:
   - For missing values: use null, NOT zeros or guesses
   - Zero thickness (0.000) is INVALID - use null instead
   - Search ENTIRE document - data scattered across multiple pages
   - If a field exists in document, extract it regardless of completeness
   - Dates must be in YYYY-MM-DD format
   - Numbers should be actual values without units in JSON
   - PRESERVE ALL DATA EXACTLY as it appears - DO NOT TRUNCATE TEXT FIELDS
   - Component names, locations, and descriptions must be COMPLETE, not abbreviated

9. SECTION EXTRACTION:
   - inspectionResults: COMPLETE Section 3.0 text - all findings for Shell, Heads, Nozzles, Supports - FULL TEXT
   - recommendations: COMPLETE Section 4.0 text - all recommendations - FULL TEXT
   - executiveSummary: Full summary including governing component - FULL TEXT`;

export const pdfImportRouter = router({
  /**
   * Upload UT Results - CONSOLIDATED SINGLE PATH
   * 
   * Uses STATIONKEY-BASED MATCHING to pair new readings with existing TMLs.
   * This is the ONLY UT upload endpoint. All Cr/RL calculations are deferred
   * to the locked calculation engine (via recomputeInspection).
   * 
   * MATCHING PRIORITY (per stationKey system):
   * 1. stationKey exact match (highest confidence - same physical location)
   * 2. Correlation mapping (handles renumbered CMLs via cmlCorrelations table)
   * 3. legacyLocationId fallback (backward compatibility)
   * 
   * COMPLIANCE: API 510 §7.1.1 - Thickness measurements traceable to specific locations
   */
  uploadUTResults: protectedProcedure
    .input(
      z.object({
        targetInspectionId: z.string(),
        pdfUrl: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      logger.info("[UT Upload] Starting stationKey-based extraction from:", input.fileName, "for inspection:", input.targetInspectionId);

      // 1. Verify the inspection exists and user has access
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

      // 2. Get existing TML readings for stationKey matching
      const existingTMLs = await db
        .select()
        .from(tmlReadings)
        .where(eq(tmlReadings.inspectionId, input.targetInspectionId));

      logger.info("[UT Upload] Found existing TMLs for stationKey matching:", existingTMLs.length);

      // Build stationKey lookup map for O(1) matching
      const stationKeyMap = new Map<string, typeof existingTMLs[0]>();
      const legacyIdMap = new Map<string, typeof existingTMLs[0]>();
      for (const tml of existingTMLs) {
        if (tml.stationKey) {
          stationKeyMap.set(tml.stationKey, tml);
        }
        if (tml.legacyLocationId) {
          legacyIdMap.set(tml.legacyLocationId.trim().toUpperCase(), tml);
        }
      }

      // 3. Extract new readings from PDF using LLM
      // The prompt is designed to handle the STANDARD API 510 thickness record format:
      // CML | Comp ID | Location | Service | tml-1 | tml-2 | tml-3 | tml-4 | t act
      const extractionPrompt = `You are extracting ultrasonic thickness (UT) measurement data from an API 510 Pressure Vessel Component Thickness Record PDF.

The PDF contains a table with these columns:
- CML: Sequential CML number (e.g., 001, 002, ... 177)
- Comp ID: Component identifier. For SHELL readings this is the ANGLE IN DEGREES (0, 45, 90, 135, 180, 225, 270, 315). For HEAD readings this is "South Head" or "North Head". For NOZZLE readings this is the nozzle size/type (e.g., "18\" MW", "2\" Nozzle", "1\" Nozzle", "3\" Nozzle").
- Location: Physical position number. For heads: 1-5 (or similar sequential). For shell: a number representing the axial station along the vessel (e.g., 7, 8, 9, ..., 26). For nozzles: N1, N2, N3, etc.
- Service: Service description (for nozzles: Manway, Vent, Temp. Indicator, Site Glass, Inlet, Outlet, Pressure Gauge, etc.)
- tml-1, tml-2, tml-3, tml-4: Individual thickness readings (some may be empty)
- t act: Actual thickness (minimum of the tml readings)

EXTRACT ALL ROWS into this JSON format:
{
  "inspectionDate": "YYYY-MM-DD",
  "technician": "string or null",
  "vesselId": "string or null - vessel number if found",
  "reportNo": "string or null - report number if found",
  "readings": [
    {
      "cml": "string - the CML number exactly as shown (e.g., '001', '002')",
      "compId": "string - the Comp ID exactly as shown (e.g., 'South Head', '0', '45', '135', '18\" MW', '2\" Nozzle')",
      "location": "string - the Location value exactly as shown (e.g., '1', '7', 'N1')",
      "service": "string or null - the Service description if present",
      "tml1": "number or null",
      "tml2": "number or null",
      "tml3": "number or null",
      "tml4": "number or null",
      "tAct": "number or null - actual thickness"
    }
  ]
}

CRITICAL RULES:
1. Extract EVERY row from the thickness table - do not skip any, even if all tml values are empty
2. For shell CMLs: the Comp ID column contains the ANGLE (0, 45, 90, 135, 180, 225, 270, 315) - NOT a component name
3. For shell CMLs: the Location column contains the AXIAL STATION number along the vessel
4. Preserve the exact CML number with leading zeros (e.g., "001" not "1")
5. If a tml column is empty/blank, set it to null
6. The t act column is the minimum thickness - extract it if present
7. Look for the inspection date, inspector name, vessel number, and report number in the header section
8. There may be notes about axis orientation (e.g., "tml-1 N., tml-2 E., tml-3 S., tml-4 W.") - ignore these for extraction but they define the measurement positions`;

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
                vesselId: { type: ["string", "null"] },
                reportNo: { type: ["string", "null"] },
                readings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      cml: { type: "string" },
                      compId: { type: "string" },
                      location: { type: "string" },
                      service: { type: ["string", "null"] },
                      tml1: { type: ["number", "null"] },
                      tml2: { type: ["number", "null"] },
                      tml3: { type: ["number", "null"] },
                      tml4: { type: ["number", "null"] },
                      tAct: { type: ["number", "null"] }
                    },
                    required: ["cml", "compId", "location"],
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
      interface RawExtractedReading {
        cml: string;
        compId: string;
        location: string;
        service?: string | null;
        tml1?: number | null;
        tml2?: number | null;
        tml3?: number | null;
        tml4?: number | null;
        tAct?: number | null;
      }
      let extractedData: {
        inspectionDate?: string | null;
        technician?: string | null;
        vesselId?: string | null;
        reportNo?: string | null;
        readings: RawExtractedReading[];
      };
      
      try {
        extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");
      } catch (parseError) {
        logger.warn("[UT Upload] JSON parse failed, attempting repair...");
        try {
          const repaired = jsonrepair(typeof messageContent === 'string' ? messageContent : "{}");
          extractedData = JSON.parse(repaired);
        } catch (repairError) {
          throw new Error("Failed to parse extracted UT data");
        }
      }

      const rawReadings = extractedData.readings || [];
      logger.info("[UT Upload] Raw extracted rows from PDF:", rawReadings.length);

      // 4. Import stationKey generator
      const { generateStationKey } = await import("../lib/stationKeyNormalization");
      const { normalizeComponentGroup } = await import("../lib/componentGroupNormalizer");

      // 5. Classify each row and generate proper stationKeys
      // The PDF table format is: CML | Comp ID | Location | Service | tml-1..4 | t act
      // For SHELL: CompID = angle (0,45,90,...315), Location = axial station (7,8,...26)
      // For HEAD: CompID = "South Head" or "North Head", Location = position (1-5)
      // For NOZZLE: CompID = nozzle type ("18\" MW", etc.), Location = N1, N2, etc.
      interface ExpandedReading {
        legacyLocationId: string; // CML number from PDF
        location: string;        // Full location description
        component: string;       // Component type (Shell, South Head, North Head, Nozzle)
        componentGroup: string;  // Normalized group
        angleDeg: number | null; // Angle for shell/nozzle readings
        thickness: number;       // t_act or individual tml reading
        service?: string;        // Service description for nozzles
        stationKey: string;      // Canonical location key
        tmlReadings?: { tml1?: number | null; tml2?: number | null; tml3?: number | null; tml4?: number | null };
      }
      const expandedNewReadings: ExpandedReading[] = [];

      for (const row of rawReadings) {
        const compIdUpper = (row.compId || '').trim().toUpperCase();
        const locationStr = (row.location || '').trim();
        const cml = (row.cml || '').trim();
        
        // Determine the actual thickness: prefer tAct, fallback to min of tml readings
        const tmlValues = [row.tml1, row.tml2, row.tml3, row.tml4].filter(
          (v): v is number => v !== null && v !== undefined && v > 0
        );
        const thickness = row.tAct ?? (tmlValues.length > 0 ? Math.min(...tmlValues) : null);
        
        // Skip rows with no thickness data at all
        if (thickness === null || thickness === undefined) {
          logger.info(`[UT Upload] Skipping CML ${cml} - no thickness data`);
          continue;
        }

        // CLASSIFY the row based on Comp ID content
        const isAngle = /^\d+$/.test(compIdUpper) && [0, 45, 90, 135, 180, 225, 270, 315].includes(parseInt(compIdUpper, 10));
        const isHead = compIdUpper.includes('HEAD');
        const isNozzle = locationStr.toUpperCase().startsWith('N') && /^N\d+$/i.test(locationStr);

        if (isAngle) {
          // SHELL reading: CompID is the angle, Location is the axial station
          const angleDeg = parseInt(compIdUpper, 10);
          const axialStation = locationStr;
          const component = 'Shell';
          const componentGroup = 'SHELL';
          
          // stationKey: SHELL-SLICE-{station}-A{angle}
          const skResult = generateStationKey({
            component: 'Shell',
            sliceNumber: parseInt(axialStation, 10) || null,
            angleDeg,
          });
          
          expandedNewReadings.push({
            legacyLocationId: cml,
            location: `Station ${axialStation}, ${angleDeg}°`,
            component,
            componentGroup,
            angleDeg,
            thickness,
            stationKey: skResult.stationKey,
            tmlReadings: { tml1: row.tml1, tml2: row.tml2, tml3: row.tml3, tml4: row.tml4 },
          });
          
        } else if (isHead) {
          // HEAD reading: CompID is "South Head" or "North Head", Location is position number
          const headName = compIdUpper.includes('SOUTH') ? 'South Head' : 
                          compIdUpper.includes('NORTH') ? 'North Head' :
                          compIdUpper.includes('EAST') ? 'East Head' :
                          compIdUpper.includes('WEST') ? 'West Head' : row.compId;
          const componentGroup = normalizeComponentGroup(headName);
          const position = locationStr;
          
          // stationKey: {HEADGROUP}-POS-{position}
          const headPrefix = componentGroup || 'HEAD';
          const stationKey = `${headPrefix}-POS-${position}`;
          
          expandedNewReadings.push({
            legacyLocationId: cml,
            location: `${headName} Position ${position}`,
            component: headName,
            componentGroup,
            angleDeg: null,
            thickness,
            stationKey,
            tmlReadings: { tml1: row.tml1, tml2: row.tml2, tml3: row.tml3, tml4: row.tml4 },
          });
          
        } else if (isNozzle) {
          // NOZZLE reading: CompID is nozzle type, Location is N1/N2/etc.
          // Nozzles have 4 tml readings (tml-1 through tml-4) representing 4 angular positions
          const nozzleId = locationStr.toUpperCase(); // N1, N2, etc.
          const nozzleType = row.compId; // "18\" MW", "2\" Nozzle", etc.
          const service = row.service || '';
          const componentGroup = 'NOZZLE';
          
          // For nozzles, each tml column represents a different angular position
          // tml-1 = 0° (or Top/N), tml-2 = 90° (or E), tml-3 = 180° (or S/Bottom), tml-4 = 270° (or W)
          const nozzleAngles: Array<{ angle: number; value: number | null | undefined }> = [
            { angle: 0, value: row.tml1 },
            { angle: 90, value: row.tml2 },
            { angle: 180, value: row.tml3 },
            { angle: 270, value: row.tml4 },
          ];
          
          for (const na of nozzleAngles) {
            if (na.value !== null && na.value !== undefined && na.value > 0) {
              const stationKey = `NOZZLE-${nozzleId}-A${na.angle}`;
              expandedNewReadings.push({
                legacyLocationId: cml,
                location: `${nozzleType} (${nozzleId}) ${service}`.trim(),
                component: nozzleType,
                componentGroup,
                angleDeg: na.angle,
                thickness: na.value,
                service: service || undefined,
                stationKey,
              });
            }
          }
          
          // Also create a t_act summary record for the nozzle (minimum reading)
          const stationKey = `NOZZLE-${nozzleId}-TACT`;
          expandedNewReadings.push({
            legacyLocationId: cml,
            location: `${nozzleType} (${nozzleId}) ${service}`.trim(),
            component: nozzleType,
            componentGroup,
            angleDeg: null,
            thickness,
            service: service || undefined,
            stationKey,
            tmlReadings: { tml1: row.tml1, tml2: row.tml2, tml3: row.tml3, tml4: row.tml4 },
          });
          
        } else {
          // UNKNOWN/OTHER: Use fallback stationKey generation
          const componentGroup = normalizeComponentGroup(row.compId);
          const skResult = generateStationKey({
            component: row.compId,
            location: locationStr,
            legacyLocationId: cml,
          });
          
          expandedNewReadings.push({
            legacyLocationId: cml,
            location: `${row.compId} ${locationStr}`.trim(),
            component: row.compId || 'Unknown',
            componentGroup,
            angleDeg: null,
            thickness,
            stationKey: skResult.stationKey,
            tmlReadings: { tml1: row.tml1, tml2: row.tml2, tml3: row.tml3, tml4: row.tml4 },
          });
        }
      }

      logger.info("[UT Upload] Expanded to angle-per-row readings:", expandedNewReadings.length);

      // 6. Get correlation mappings for this inspection (if any)
      const { cmlCorrelations: cmlCorrelationsTable } = await import("../../drizzle/schema");
      let correlationMap = new Map<string, string>(); // currentCML → baselineCML
      try {
        const correlations = await db
          .select()
          .from(cmlCorrelationsTable)
          .where(eq(cmlCorrelationsTable.inspectionId, input.targetInspectionId));
        for (const c of correlations) {
          correlationMap.set(c.currentCML.trim().toUpperCase(), c.baselineCML.trim().toUpperCase());
        }
      } catch (e) {
        // cmlCorrelations table may not exist yet - that's OK
        logger.info("[UT Upload] No correlation mappings found (table may not exist)");
      }

      // 7. Match and upsert readings using stationKey priority system
      let updatedCount = 0;
      let createdCount = 0;
      const matchStats = { stationKey: 0, correlation: 0, legacyLocationId: 0, newRecord: 0 };
      const newInspectionDate = extractedData.inspectionDate ? new Date(extractedData.inspectionDate) : new Date();

      for (const newReading of expandedNewReadings) {
        let existingTML: typeof existingTMLs[0] | undefined;
        let matchMethod = 'new';

        // PRIORITY 1: stationKey exact match
        existingTML = stationKeyMap.get(newReading.stationKey);
        if (existingTML) {
          matchMethod = 'stationKey';
          matchStats.stationKey++;
        }

        // PRIORITY 2: Correlation mapping
        if (!existingTML && correlationMap.size > 0) {
          const normalizedLegacyId = newReading.legacyLocationId.trim().toUpperCase();
          const baselineCML = correlationMap.get(normalizedLegacyId);
          if (baselineCML) {
            existingTML = legacyIdMap.get(baselineCML);
            if (existingTML) {
              matchMethod = 'correlation';
              matchStats.correlation++;
            }
          }
        }

        // PRIORITY 3: legacyLocationId fallback
        if (!existingTML && newReading.legacyLocationId) {
          const normalizedId = newReading.legacyLocationId.trim().toUpperCase();
          existingTML = legacyIdMap.get(normalizedId);
          if (existingTML) {
            matchMethod = 'legacyLocationId';
            matchStats.legacyLocationId++;
          }
        }

        if (existingTML) {
          // UPDATE existing TML: move current → previous, set new current
          // CRITICAL: Do NOT calculate Cr/RL here - defer to locked calculation engine
          const previousThickness = existingTML.tActual || existingTML.currentThickness || null;
          const previousDate = existingTML.currentInspectionDate || null;

          await db
            .update(tmlReadings)
            .set({
              previousThickness: previousThickness ? String(previousThickness) : null,
              previousInspectionDate: previousDate,
              tActual: String(newReading.thickness),
              currentThickness: String(newReading.thickness),
              currentInspectionDate: newInspectionDate,
              stationKey: newReading.stationKey, // Ensure stationKey is set/updated
              componentGroup: newReading.componentGroup,
              angleDeg: newReading.angleDeg,
              updatedAt: new Date(),
            })
            .where(eq(tmlReadings.id, existingTML.id));

          updatedCount++;
          logger.info(`[UT Upload] MATCHED (${matchMethod}): ${newReading.stationKey} prev=${previousThickness} → curr=${newReading.thickness}`);
        } else {
          // INSERT new reading with stationKey
          matchStats.newRecord++;
          const newTmlId = nanoid();
          await db.insert(tmlReadings).values({
            id: newTmlId,
            inspectionId: input.targetInspectionId,
            legacyLocationId: newReading.legacyLocationId || `NEW-${createdCount + 1}`,
            componentType: newReading.component || 'Unknown',
            location: newReading.location,
            component: newReading.component || null,
            stationKey: newReading.stationKey,
            componentGroup: newReading.componentGroup,
            angleDeg: newReading.angleDeg,
            tActual: String(newReading.thickness),
            currentThickness: String(newReading.thickness),
            currentInspectionDate: newInspectionDate,
            status: 'good',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          createdCount++;
          logger.info(`[UT Upload] NEW: ${newReading.stationKey} = ${newReading.thickness}`);
        }
      }

      // 8. Update inspection date if provided
      if (extractedData.inspectionDate) {
        await db.execute(sql`
          UPDATE inspections 
          SET inspectionDate = ${newInspectionDate},
              updatedAt = NOW()
          WHERE id = ${input.targetInspectionId}
        `);
      }

      // 9. Log audit trail
      const { logDataImport } = await import("../auditService");
      await logDataImport(
        { userId: String(ctx.user.id), userName: ctx.user.name || undefined },
        'tmlReadings',
        input.targetInspectionId,
        input.fileName,
        {
          extractedReadings: rawReadings.length,
          expandedReadings: expandedNewReadings.length,
          updatedCMLs: updatedCount,
          createdCMLs: createdCount,
          matchStats,
        },
        'stationKey_UT_import'
      );

      logger.info("[UT Upload] Complete", {
        updatedCount,
        createdCount,
        matchStats,
        totalProcessed: updatedCount + createdCount,
      });

      return {
        success: true,
        message: `Updated ${updatedCount} existing readings and created ${createdCount} new readings (stationKey: ${matchStats.stationKey}, correlation: ${matchStats.correlation}, legacy: ${matchStats.legacyLocationId}, new: ${matchStats.newRecord})`,
        summary: {
          extractedReadings: rawReadings.length,
          expandedReadings: expandedNewReadings.length,
          updatedCMLs: updatedCount,
          createdCMLs: createdCount,
          matchStats,
          matchRate: expandedNewReadings.length > 0
            ? ((updatedCount / expandedNewReadings.length) * 100).toFixed(1) + '%'
            : '0%',
        },
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
            legacyLocationId: String(measurement.cml || 'N/A'),
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
              id, inspectionId, legacyLocationId, componentType, location, service,
              tml1, tml2, tml3, tml4, tActual, nominalThickness, previousThickness,
              previousInspectionDate, currentInspectionDate, loss, lossPercent, corrosionRate,
              status, tmlId, component, currentThickness
            ) VALUES (
              ${record.id}, ${record.inspectionId}, ${record.legacyLocationId}, ${record.componentType}, ${record.location}, ${record.service},
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

  // NOTE: uploadUTResultsWithLocationMatching has been REMOVED.
  // All UT uploads now go through the consolidated uploadUTResults endpoint
  // which uses stationKey-based matching (Priority 1 fix).
  // Legacy references to this endpoint should be updated to use uploadUTResults.
});

