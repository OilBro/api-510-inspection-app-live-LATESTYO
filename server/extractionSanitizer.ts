/**
 * Extraction Sanitizer / Post-Processor
 * 
 * Deterministic post-processing pipeline that runs AFTER LLM extraction
 * and BEFORE data reaches the preview/import pipeline.
 * 
 * Implements 7 critical fixes for audit defensibility:
 * 
 * 1. Report field sanitization (regex-based, prevents LLM thought-loop pollution)
 * 2. Checklist-to-vessel field hydration (mines checklist items for missing vessel data)
 * 3. Head type extraction from narrative text
 * 4. Seam-adjacent CML location handling (proper stationKey generation)
 * 5. Incomplete thickness record flagging (prevents bad RL/CR calculations)
 * 6. Checklist status normalization ("A" → acceptable, "N/A" → not_applicable)
 * 7. Document provenance tracking (audit trail for parser, overrides, confidence)
 * 
 * References:
 * - API 510 §7.1.1: Thickness Measurement Locations
 * - ASME BPVC Section VIII Division 1
 * - 40 CFR Part 264/265 (secondary containment)
 */

import { logger } from "./_core/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface FieldOverride {
  field: string;
  from: string;
  to: string;
  rule: string;
  timestamp: string;
}

export interface Provenance {
  parser: string;
  ocrApplied: boolean;
  extractionModel: string;
  fieldOverrides: FieldOverride[];
  validationWarnings: string[];
  confidence: {
    reportFields: number;
    vesselFields: number;
    tmlReadings: number;
    overall: number;
  };
  rawHeaderText?: string;
  sanitizerVersion: string;
}

export interface SanitizedResult {
  data: any;
  provenance: Provenance;
}

// ============================================================================
// FIX #1: REPORT FIELD SANITIZATION
// ============================================================================

/**
 * Sanitize report info fields using regex patterns.
 * Prevents LLM "thought loop" text from polluting canonical fields.
 * 
 * Each field has a specific expected pattern:
 * - reportNumber: XX-XX-XXX (e.g., 54-11-004)
 * - reportDate: date pattern (YYYY-MM-DD, MM/DD/YYYY, etc.)
 * - inspectorCert: 4-6 digit number (not a year)
 * - inspectorName: alphabetic name (no numbers except suffixes)
 */
function sanitizeReportFields(data: any, overrides: FieldOverride[]): void {
  const reportInfo = data.reportInfo || {};
  
  // --- reportNumber ---
  if (reportInfo.reportNumber) {
    const raw = String(reportInfo.reportNumber);
    // Pattern: XX-XX-XXX (e.g., 54-11-004, 54-11-001)
    const tagMatch = raw.match(/\b(\d{2}-\d{2}-\d{3})\b/);
    if (tagMatch && tagMatch[1] !== raw.trim()) {
      overrides.push({
        field: "reportInfo.reportNumber",
        from: raw.length > 100 ? raw.substring(0, 100) + "...[TRUNCATED]" : raw,
        to: tagMatch[1],
        rule: "regex_tag_XX-XX-XXX",
        timestamp: new Date().toISOString(),
      });
      reportInfo.reportNumber = tagMatch[1];
    } else if (!tagMatch && raw.length > 30) {
      // If no pattern match and field is suspiciously long, it's polluted
      // Try broader patterns
      const altMatch = raw.match(/\b([A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+)\b/i);
      if (altMatch) {
        overrides.push({
          field: "reportInfo.reportNumber",
          from: raw.substring(0, 100) + "...[TRUNCATED]",
          to: altMatch[1],
          rule: "regex_tag_fallback",
          timestamp: new Date().toISOString(),
        });
        reportInfo.reportNumber = altMatch[1];
      } else {
        // Store raw in separate field, clear canonical
        data._rawReportHeader = raw;
        overrides.push({
          field: "reportInfo.reportNumber",
          from: raw.substring(0, 100) + "...[TRUNCATED]",
          to: "",
          rule: "polluted_field_cleared",
          timestamp: new Date().toISOString(),
        });
        reportInfo.reportNumber = "";
      }
    }
  }

  // --- reportDate ---
  if (reportInfo.reportDate) {
    const raw = String(reportInfo.reportDate);
    const cleaned = extractDate(raw);
    if (cleaned && cleaned !== raw.trim()) {
      overrides.push({
        field: "reportInfo.reportDate",
        from: raw,
        to: cleaned,
        rule: "date_extraction",
        timestamp: new Date().toISOString(),
      });
      reportInfo.reportDate = cleaned;
    }
  }

  // --- inspectionDate ---
  if (reportInfo.inspectionDate) {
    const raw = String(reportInfo.inspectionDate);
    const cleaned = extractDate(raw);
    if (cleaned && cleaned !== raw.trim()) {
      overrides.push({
        field: "reportInfo.inspectionDate",
        from: raw,
        to: cleaned,
        rule: "date_extraction",
        timestamp: new Date().toISOString(),
      });
      reportInfo.inspectionDate = cleaned;
    }
  }

  // --- inspectorCert ---
  if (reportInfo.inspectorCert) {
    const raw = String(reportInfo.inspectorCert);
    // 4-6 digit certification number, NOT a year (1900-2099)
    const certMatches = raw.match(/\b(\d{4,6})\b/g);
    if (certMatches) {
      // Filter out years
      const nonYears = certMatches.filter(m => {
        const num = parseInt(m, 10);
        return !(num >= 1900 && num <= 2099) || m.length > 4;
      });
      if (nonYears.length > 0 && nonYears[0] !== raw.trim()) {
        overrides.push({
          field: "reportInfo.inspectorCert",
          from: raw,
          to: nonYears[0],
          rule: "cert_number_extraction",
          timestamp: new Date().toISOString(),
        });
        reportInfo.inspectorCert = nonYears[0];
      }
    }
  }

  // --- inspectorName ---
  if (reportInfo.inspectorName) {
    const raw = String(reportInfo.inspectorName);
    // If name contains numbers or is too long, it's likely polluted
    if (raw.length > 60 || /\d{3,}/.test(raw)) {
      // Try to extract a name pattern (First Last or First M. Last)
      const nameMatch = raw.match(/([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/);
      if (nameMatch) {
        overrides.push({
          field: "reportInfo.inspectorName",
          from: raw.substring(0, 80),
          to: nameMatch[1],
          rule: "name_extraction",
          timestamp: new Date().toISOString(),
        });
        reportInfo.inspectorName = nameMatch[1];
      }
    }
  }

  // --- inspectionType ---
  if (reportInfo.inspectionType) {
    const raw = String(reportInfo.inspectionType).toUpperCase().trim();
    // Normalize common inspection types
    const typeMap: Record<string, string> = {
      "IN-SERVICE": "IN-SERVICE",
      "IN SERVICE": "IN-SERVICE",
      "INSERVICE": "IN-SERVICE",
      "INTERNAL": "INTERNAL",
      "EXTERNAL": "EXTERNAL",
      "ON-STREAM": "ON-STREAM",
      "ONSTREAM": "ON-STREAM",
      "SHUTDOWN": "SHUTDOWN",
      "TURNAROUND": "TURNAROUND",
    };
    for (const [pattern, normalized] of Object.entries(typeMap)) {
      if (raw.includes(pattern)) {
        if (normalized !== reportInfo.inspectionType) {
          overrides.push({
            field: "reportInfo.inspectionType",
            from: reportInfo.inspectionType,
            to: normalized,
            rule: "inspection_type_normalization",
            timestamp: new Date().toISOString(),
          });
          reportInfo.inspectionType = normalized;
        }
        break;
      }
    }
  }

  data.reportInfo = reportInfo;
}

/**
 * Extract a date from a string that may contain extra text.
 * Supports: YYYY-MM-DD, MM/DD/YYYY, Month DD, YYYY, DD Month YYYY
 */
function extractDate(raw: string): string | null {
  // ISO format: 2025-12-02
  const isoMatch = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  // US format: 12/02/2025 or 12-02-2025
  const usMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    return `${usMatch[3]}-${month}-${day}`;
  }

  // Long format: December 2, 2025 or Dec 02, 2025
  const longMatch = raw.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (longMatch) {
    const monthNames: Record<string, string> = {
      january: "01", jan: "01", february: "02", feb: "02",
      march: "03", mar: "03", april: "04", apr: "04",
      may: "05", june: "06", jun: "06", july: "07", jul: "07",
      august: "08", aug: "08", september: "09", sep: "09",
      october: "10", oct: "10", november: "11", nov: "11",
      december: "12", dec: "12",
    };
    const month = monthNames[longMatch[1].toLowerCase()] || "01";
    const day = longMatch[2].padStart(2, "0");
    return `${longMatch[3]}-${month}-${day}`;
  }

  return null;
}

// ============================================================================
// FIX #2: CHECKLIST-TO-VESSEL FIELD HYDRATION
// ============================================================================

/**
 * Mine checklist items for vessel data that the LLM missed in vesselData.
 * Common patterns in inspection checklists:
 * - "NB / Board Number: 36715"
 * - "Serial: 1531-U"
 * - "MAWP: 100"
 * - "MDMT: -20"
 * - "Nominal shell: 5/16"
 * - "Manufacturer: OLD DOMINION FABRICATORS"
 */
function hydrateVesselFromChecklist(data: any, overrides: FieldOverride[]): void {
  const vesselData = data.vesselData || {};
  const checklist = data.inspectionChecklist || data.checklistItems || [];
  
  if (!checklist.length) return;

  // Build a combined text from all checklist items for searching
  const checklistTexts = checklist.map((item: any) => {
    const text = String(item.itemText || item.description || "");
    const notes = String(item.notes || "");
    const status = String(item.status || "");
    return `${text} ${notes} ${status}`;
  });

  // --- NB Number ---
  if (!vesselData.nbNumber || vesselData.nbNumber === "") {
    const nbValue = searchChecklistForValue(checklistTexts, [
      /(?:NB|National\s*Board|Board)\s*(?:Number|No\.?|#)?\s*:?\s*(\d{3,6})/i,
      /(?:NB|Board)\s*(?:Number|No\.?)?\s*[-:]?\s*(\d{3,6})/i,
    ]);
    if (nbValue) {
      overrides.push({
        field: "vesselData.nbNumber",
        from: "",
        to: nbValue,
        rule: "checklist_hydration_nb_number",
        timestamp: new Date().toISOString(),
      });
      vesselData.nbNumber = nbValue;
    }
  }

  // --- Serial Number ---
  if (!vesselData.serialNumber || vesselData.serialNumber === "") {
    const serialValue = searchChecklistForValue(checklistTexts, [
      /(?:Serial|Ser\.?)\s*(?:Number|No\.?|#)?\s*:?\s*([A-Z0-9]+-?[A-Z0-9]+)/i,
    ]);
    if (serialValue) {
      overrides.push({
        field: "vesselData.serialNumber",
        from: "",
        to: serialValue,
        rule: "checklist_hydration_serial",
        timestamp: new Date().toISOString(),
      });
      vesselData.serialNumber = serialValue;
    }
  }

  // --- Design Pressure / MAWP ---
  if (!vesselData.designPressure || vesselData.designPressure === "") {
    const mawpValue = searchChecklistForValue(checklistTexts, [
      /(?:MAWP|Design\s*Pressure|Max\.?\s*Allowable)\s*:?\s*(\d+\.?\d*)\s*(?:psi|psig)?/i,
    ]);
    if (mawpValue) {
      overrides.push({
        field: "vesselData.designPressure",
        from: "",
        to: mawpValue,
        rule: "checklist_hydration_mawp",
        timestamp: new Date().toISOString(),
      });
      vesselData.designPressure = mawpValue;
    }
  }

  // --- MDMT ---
  if (!vesselData.mdmt || vesselData.mdmt === "") {
    const mdmtValue = searchChecklistForValue(checklistTexts, [
      /(?:MDMT|Min\.?\s*Design\s*Metal\s*Temp)\s*:?\s*(-?\d+\.?\d*)\s*(?:°?F)?/i,
    ]);
    if (mdmtValue) {
      overrides.push({
        field: "vesselData.mdmt",
        from: "",
        to: mdmtValue,
        rule: "checklist_hydration_mdmt",
        timestamp: new Date().toISOString(),
      });
      vesselData.mdmt = mdmtValue;
    }
  }

  // --- Manufacturer ---
  if (!vesselData.manufacturer || vesselData.manufacturer === "") {
    const mfgValue = searchChecklistForValue(checklistTexts, [
      /(?:Manufacturer|Mfg\.?|Fabricator|Built\s*by)\s*:?\s*([A-Z][A-Z\s&.,]+?(?:INC|LLC|CORP|CO|LTD|FABRICATORS|INDUSTRIES|WORKS|MFG)(?:\s+(?:INC|LLC|CORP|CO|LTD))?)/i,
      /(?:Manufacturer|Mfg\.?|Fabricator|Built\s*by)\s*:?\s*([A-Z][A-Z\s&.,]{2,}?)\s*$/im,
    ]);
    if (mfgValue) {
      overrides.push({
        field: "vesselData.manufacturer",
        from: "",
        to: mfgValue.trim(),
        rule: "checklist_hydration_manufacturer",
        timestamp: new Date().toISOString(),
      });
      vesselData.manufacturer = mfgValue.trim();
    }
  }

  // --- Nominal Shell Thickness ---
  // Check for shell thickness in checklist (may be fraction like "5/16")
  const shellNomValue = searchChecklistForValue(checklistTexts, [
    /(?:Nominal|Nom\.?)\s*(?:Shell|Body|Cylinder)\s*(?:Thickness|Thk\.?)?\s*:?\s*(\d+\/\d+|\d+\.?\d*)/i,
    /(?:Shell|Body)\s*(?:Nominal|Nom\.?)?\s*(?:Thickness|Thk\.?)?\s*:?\s*(\d+\/\d+|\d+\.?\d*)/i,
  ]);
  if (shellNomValue) {
    const numericValue = convertFractionToDecimal(shellNomValue);
    if (numericValue) {
      // Store as a special field for downstream use
      if (!data._hydratedFields) data._hydratedFields = {};
      data._hydratedFields.nominalShellThickness = numericValue;
      overrides.push({
        field: "_hydratedFields.nominalShellThickness",
        from: shellNomValue,
        to: String(numericValue),
        rule: "checklist_hydration_shell_nominal",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // --- Nominal Head Thickness ---
  const headNomValue = searchChecklistForValue(checklistTexts, [
    /(?:Nominal|Nom\.?)\s*(?:Head)\s*(?:Thickness|Thk\.?)?\s*:?\s*(\d+\/\d+|\.\d+|\d+\.?\d*)/i,
    /(?:Head)\s*(?:Nominal|Nom\.?)?\s*(?:Thickness|Thk\.?)?\s*:?\s*(\d+\/\d+|\.\d+|\d+\.?\d*)/i,
  ]);
  if (headNomValue) {
    const numericValue = convertFractionToDecimal(headNomValue);
    if (numericValue) {
      if (!data._hydratedFields) data._hydratedFields = {};
      data._hydratedFields.nominalHeadThickness = numericValue;
      overrides.push({
        field: "_hydratedFields.nominalHeadThickness",
        from: headNomValue,
        to: String(numericValue),
        rule: "checklist_hydration_head_nominal",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // --- Year Built ---
  if (!vesselData.yearBuilt) {
    const yearValue = searchChecklistForValue(checklistTexts, [
      /(?:Year\s*Built|Year\s*of\s*Manufacture|Constructed|Built)\s*:?\s*(\d{4})/i,
    ]);
    if (yearValue) {
      const year = parseInt(yearValue, 10);
      if (year >= 1900 && year <= 2030) {
        overrides.push({
          field: "vesselData.yearBuilt",
          from: "",
          to: yearValue,
          rule: "checklist_hydration_year_built",
          timestamp: new Date().toISOString(),
        });
        vesselData.yearBuilt = year;
      }
    }
  }

  // --- Radiography Type ---
  if (!vesselData.radiographyType || vesselData.radiographyType === "") {
    const radValue = searchChecklistForValue(checklistTexts, [
      /(?:Radiography|Radiographic|RT|X-Ray)\s*(?:Type|Exam)?\s*:?\s*(Full|Spot|None|Partial|100%|Random)/i,
    ]);
    if (radValue) {
      overrides.push({
        field: "vesselData.radiographyType",
        from: "",
        to: radValue.trim(),
        rule: "checklist_hydration_radiography",
        timestamp: new Date().toISOString(),
      });
      vesselData.radiographyType = radValue.trim();
    }
  }

  // --- Material Spec ---
  if (!vesselData.materialSpec || vesselData.materialSpec === "") {
    const matValue = searchChecklistForValue(checklistTexts, [
      /(?:Shell\s*Material|Material\s*Spec|Material)\s*:?\s*(SA-\d+\s*(?:Gr\.?\s*\d+|Type\s*\d+[A-Za-z]*)?)/i,
    ]);
    if (matValue) {
      overrides.push({
        field: "vesselData.materialSpec",
        from: "",
        to: matValue.trim(),
        rule: "checklist_hydration_material",
        timestamp: new Date().toISOString(),
      });
      vesselData.materialSpec = matValue.trim();
    }
  }

  data.vesselData = vesselData;
}

/**
 * Search checklist text array for a value matching any of the given patterns.
 */
function searchChecklistForValue(texts: string[], patterns: RegExp[]): string | null {
  for (const text of texts) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return null;
}

/**
 * Convert fraction strings to decimal.
 * "5/16" → 0.3125, "3/8" → 0.375, ".450" → 0.45
 */
function convertFractionToDecimal(value: string): number | null {
  const trimmed = value.trim();
  
  // Already decimal
  if (/^\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  if (/^\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  
  // Fraction: 5/16, 3/8, 1/4, etc.
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const numerator = parseInt(fracMatch[1], 10);
    const denominator = parseInt(fracMatch[2], 10);
    if (denominator > 0) {
      return Math.round((numerator / denominator) * 10000) / 10000;
    }
  }
  
  // Mixed number: 1-1/2 or 1 1/2
  const mixedMatch = trimmed.match(/^(\d+)[\s-](\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den > 0) {
      return Math.round((whole + num / den) * 10000) / 10000;
    }
  }
  
  // Plain integer
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  
  return null;
}

// ============================================================================
// FIX #3: HEAD TYPE FROM NARRATIVE
// ============================================================================

/**
 * Extract head type from narrative text (executive summary, inspection results).
 * If vesselData.headType is empty but narrative explicitly states head type,
 * use the narrative assertion and flag a validation warning.
 */
function extractHeadTypeFromNarrative(data: any, overrides: FieldOverride[], warnings: string[]): void {
  const vesselData = data.vesselData || {};
  
  // Only hydrate if headType is missing
  if (vesselData.headType && vesselData.headType.trim() !== "") return;

  // Combine all narrative text
  const narrativeText = [
    data.executiveSummary || "",
    data.inspectionResults || "",
    data.recommendations || "",
  ].join(" ").toLowerCase();

  if (!narrativeText.trim()) return;

  // Look for explicit head type assertions
  const headTypePatterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /heads?\s+(?:are|is)\s+torispherical/i, type: "Torispherical" },
    { pattern: /torispherical\s+(?:heads?|design)/i, type: "Torispherical" },
    { pattern: /(?:F&D|flanged\s*(?:and|&)\s*dished)/i, type: "Torispherical" },
    { pattern: /heads?\s+(?:are|is)\s+(?:2:1\s+)?ellipsoidal/i, type: "2:1 Ellipsoidal" },
    { pattern: /(?:2:1\s+)?ellipsoidal\s+(?:heads?|design)/i, type: "2:1 Ellipsoidal" },
    { pattern: /heads?\s+(?:are|is)\s+hemispherical/i, type: "Hemispherical" },
    { pattern: /hemispherical\s+(?:heads?|design)/i, type: "Hemispherical" },
    { pattern: /heads?\s+(?:are|is)\s+(?:flat|blind)/i, type: "Flat" },
    { pattern: /(?:flat|blind)\s+(?:heads?|design)/i, type: "Flat" },
    { pattern: /heads?\s+(?:are|is)\s+conical/i, type: "Conical" },
  ];

  for (const { pattern, type } of headTypePatterns) {
    if (pattern.test(narrativeText)) {
      overrides.push({
        field: "vesselData.headType",
        from: "",
        to: type,
        rule: "narrative_head_type_extraction",
        timestamp: new Date().toISOString(),
      });
      vesselData.headType = type;

      // Flag validation warning
      warnings.push(
        `Head type "${type}" was extracted from narrative text (not from vesselData). ` +
        `Verify this matches nameplate/design data.`
      );

      // For torispherical, also warn about missing crown/knuckle radii
      if (type === "Torispherical") {
        if (!vesselData.crownRadius || vesselData.crownRadius === "") {
          warnings.push(
            `Torispherical head detected but crownRadius (L) is missing. ` +
            `Standard F&D assumption: L = OD of vessel. ` +
            `Calculations may be non-defensible without documented radii.`
          );
        }
        if (!vesselData.knuckleRadius || vesselData.knuckleRadius === "") {
          warnings.push(
            `Torispherical head detected but knuckleRadius (r) is missing. ` +
            `Standard F&D assumption: r = 0.06 × OD. ` +
            `Calculations may be non-defensible without documented radii.`
          );
        }
      }

      data.vesselData = vesselData;
      return; // Use first match
    }
  }
}

// ============================================================================
// FIX #4: SEAM-ADJACENT CML LOCATION HANDLING
// ============================================================================

/**
 * Fix CML location identifiers for seam-adjacent readings.
 * 
 * Problem: legacyLocationId "1-0" looks like a slice-angle key,
 * but location "2\" from Seam w/East Head" is a seam-adjacent descriptor.
 * 
 * Rule: If location contains "from Seam" or "seam" and an inch value,
 * treat as seam-adjacent regardless of legacyLocationId format.
 * Only treat X-Y as slice-angle when component is Shell AND location
 * does NOT indicate seam/nozzle/head.
 */
function fixSeamAdjacentLocations(data: any, overrides: FieldOverride[]): void {
  const tmlReadings = data.tmlReadings || [];
  if (!tmlReadings.length) return;

  let fixCount = 0;

  for (const tml of tmlReadings) {
    const location = String(tml.location || "").toLowerCase();
    const legacyId = String(tml.legacyLocationId || "");
    const component = String(tml.component || "").toLowerCase();

    // Detect seam-adjacent readings
    const isSeamAdjacent = /(?:from\s+)?seam/i.test(location) ||
                           /(?:weld|girth)\s*(?:seam|joint)/i.test(location);

    if (!isSeamAdjacent) continue;

    // Extract inch distance from location
    const inchMatch = location.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch)?|inches)/i);
    const distanceStr = inchMatch ? inchMatch[1] : "";

    // Determine which head/component the seam is adjacent to
    let seamRef = "SEAM";
    if (/east\s*head/i.test(location) || /e\.?\s*h\.?/i.test(location)) {
      seamRef = "SEAM-EH";
    } else if (/west\s*head/i.test(location) || /w\.?\s*h\.?/i.test(location)) {
      seamRef = "SEAM-WH";
    } else if (/north\s*head/i.test(location) || /n\.?\s*h\.?/i.test(location)) {
      seamRef = "SEAM-EH"; // North → East convention
    } else if (/south\s*head/i.test(location) || /s\.?\s*h\.?/i.test(location)) {
      seamRef = "SEAM-WH"; // South → West convention
    }

    // Extract angle if present
    const angleMatch = String(tml.angle || "").match(/(\d+)/);
    const angleStr = angleMatch ? angleMatch[1] : "";

    // Build proper stationKey
    let stationKey: string;
    if (distanceStr && angleStr) {
      stationKey = `${seamRef}-${distanceStr}IN-${angleStr}DEG`;
    } else if (distanceStr) {
      stationKey = `${seamRef}-${distanceStr}IN`;
    } else if (angleStr) {
      stationKey = `${seamRef}-${angleStr}DEG`;
    } else {
      stationKey = seamRef;
    }

    // Only override if the current legacyLocationId looks like a generic slice-angle
    // that would be misinterpreted
    const looksLikeSliceAngle = /^\d+-\d+$/.test(legacyId);
    if (looksLikeSliceAngle || !legacyId) {
      // Add stationKey as metadata, preserve original legacyLocationId
      if (!tml._metadata) tml._metadata = {};
      tml._metadata.stationKey = stationKey;
      tml._metadata.isSeamAdjacent = true;
      tml._metadata.originalLegacyId = legacyId;
      tml.readingType = tml.readingType || "seam";
      fixCount++;
    }
  }

  if (fixCount > 0) {
    overrides.push({
      field: "tmlReadings._metadata.stationKey",
      from: `${fixCount} seam-adjacent readings with slice-angle IDs`,
      to: `${fixCount} readings tagged with proper seam stationKeys`,
      rule: "seam_adjacent_location_fix",
      timestamp: new Date().toISOString(),
    });
    logger.info(`[Sanitizer] Fixed ${fixCount} seam-adjacent CML locations`);
  }
}

// ============================================================================
// FIX #5: INCOMPLETE THICKNESS FLAGGING
// ============================================================================

/**
 * Flag TML records that are missing critical data for calculations.
 * Prevents bad RL/CR calculations from running on incomplete data.
 * 
 * Hard-stop conditions:
 * - currentThickness missing → cannot calculate anything
 * - tRequired/minimumRequired missing → cannot determine fitness
 * - dates missing → cannot calculate corrosion rate
 */
function flagIncompleteThicknessRecords(data: any, warnings: string[]): void {
  const tmlReadings = data.tmlReadings || [];
  if (!tmlReadings.length) return;

  let incompleteCount = 0;
  let missingThicknessCount = 0;
  let missingMinReqCount = 0;

  for (const tml of tmlReadings) {
    const issues: string[] = [];

    // Check currentThickness
    const currentThickness = parseFloat(String(tml.currentThickness ?? ""));
    if (isNaN(currentThickness) || currentThickness <= 0) {
      issues.push("missing_current_thickness");
      missingThicknessCount++;
    }

    // Check for zero thickness (invalid measurement)
    if (currentThickness === 0) {
      issues.push("zero_thickness_invalid");
    }

    // Check previousThickness validity (0 is invalid, null is acceptable)
    // This is informational — does NOT make the record incomplete
    const infoIssues: string[] = [];
    if (tml.previousThickness !== null && tml.previousThickness !== undefined) {
      const prevThickness = parseFloat(String(tml.previousThickness));
      if (prevThickness === 0) {
        tml.previousThickness = null; // Convert 0 to null (invalid reading)
        infoIssues.push("zero_previous_thickness_nullified");
      }
    }

    // Check minimumRequired
    const minReq = parseFloat(String(tml.minimumRequired ?? ""));
    if (isNaN(minReq) || minReq <= 0) {
      missingMinReqCount++;
      // Don't flag as incomplete — tRequired is often calculated downstream
    }

    // Tag record status
    // Only hard-stop issues (missing/zero currentThickness) mark as incomplete
    // Informational issues (zero previousThickness nullified) are tracked but don't block calculations
    const allIssues = [...issues, ...infoIssues];
    if (issues.length > 0) {
      if (!tml._metadata) tml._metadata = {};
      tml._metadata.dataStatus = "incomplete";
      tml._metadata.dataIssues = allIssues;
      tml._metadata.calculationReady = false;
      incompleteCount++;
    } else {
      if (!tml._metadata) tml._metadata = {};
      tml._metadata.dataStatus = "complete";
      tml._metadata.dataIssues = infoIssues.length > 0 ? infoIssues : undefined;
      tml._metadata.calculationReady = true;
    }
  }

  if (incompleteCount > 0) {
    warnings.push(
      `${incompleteCount} of ${tmlReadings.length} TML readings are incomplete and will not be used for RL/CR calculations. ` +
      `${missingThicknessCount} missing currentThickness.`
    );
  }

  if (missingMinReqCount > 0 && missingMinReqCount === tmlReadings.length) {
    warnings.push(
      `All ${tmlReadings.length} TML readings are missing minimumRequired (t_min). ` +
      `This will be calculated from ASME formulas during import if vessel data is sufficient.`
    );
  }

  // Summary metadata
  if (!data._metadata) data._metadata = {};
  data._metadata.tmlDataQuality = {
    total: tmlReadings.length,
    complete: tmlReadings.length - incompleteCount,
    incomplete: incompleteCount,
    missingThickness: missingThicknessCount,
    missingMinRequired: missingMinReqCount,
    calculationReadyPercentage: tmlReadings.length > 0
      ? Math.round(((tmlReadings.length - incompleteCount) / tmlReadings.length) * 100)
      : 0,
  };
}

// ============================================================================
// FIX #6: CHECKLIST STATUS NORMALIZATION
// ============================================================================

/**
 * Normalize checklist status values.
 * 
 * Common patterns from PDF extraction:
 * - "A" → acceptable (checked: true)
 * - "S" → satisfactory (checked: true)
 * - "U" → unsatisfactory (checked: false, flagged)
 * - "N/A" → not applicable (checked: false, status: "not_applicable")
 * - "PASS" → pass (checked: true)
 * - "FAIL" → fail (checked: false, flagged)
 * - Concrete values like "CONCRETE", "STEEL" → store as notes, not pass/fail
 */
function normalizeChecklistStatuses(data: any, overrides: FieldOverride[]): void {
  const checklist = data.inspectionChecklist || data.checklistItems || [];
  if (!checklist.length) return;

  let normalizedCount = 0;

  for (const item of checklist) {
    const rawStatus = String(item.status || "").trim().toUpperCase();
    
    if (!rawStatus) continue;

    // Map single-letter and common abbreviations
    const statusMap: Record<string, { checked: boolean; status: string }> = {
      "A": { checked: true, status: "acceptable" },
      "ACC": { checked: true, status: "acceptable" },
      "ACCEPTABLE": { checked: true, status: "acceptable" },
      "S": { checked: true, status: "satisfactory" },
      "SAT": { checked: true, status: "satisfactory" },
      "SATISFACTORY": { checked: true, status: "satisfactory" },
      "PASS": { checked: true, status: "pass" },
      "OK": { checked: true, status: "acceptable" },
      "YES": { checked: true, status: "acceptable" },
      "U": { checked: false, status: "unsatisfactory" },
      "UNSAT": { checked: false, status: "unsatisfactory" },
      "UNSATISFACTORY": { checked: false, status: "unsatisfactory" },
      "FAIL": { checked: false, status: "fail" },
      "F": { checked: false, status: "fail" },
      "NO": { checked: false, status: "fail" },
      "N/A": { checked: false, status: "not_applicable" },
      "NA": { checked: false, status: "not_applicable" },
      "NOT APPLICABLE": { checked: false, status: "not_applicable" },
      "N.A.": { checked: false, status: "not_applicable" },
    };

    const mapped = statusMap[rawStatus];
    if (mapped) {
      if (item.status !== mapped.status || item.checked !== mapped.checked) {
        item.checked = mapped.checked;
        item.status = mapped.status;
        normalizedCount++;
      }
    } else {
      // Not a standard status — it's a value/observation (e.g., "CONCRETE", "STEEL", "GOOD")
      // Store original status as notes, set status to "observed"
      if (rawStatus.length > 1 && !/^[A-Z]$/.test(rawStatus)) {
        // Multi-character non-standard value — likely a descriptive observation
        if (!item.notes || item.notes === "") {
          item.notes = rawStatus;
        } else {
          item.notes = `${rawStatus}; ${item.notes}`;
        }
        item.status = "observed";
        item.checked = true; // Observation implies it was checked
        normalizedCount++;
      }
    }
  }

  if (normalizedCount > 0) {
    overrides.push({
      field: "inspectionChecklist[].status",
      from: `${normalizedCount} raw status values`,
      to: `${normalizedCount} normalized to standard statuses`,
      rule: "checklist_status_normalization",
      timestamp: new Date().toISOString(),
    });
    logger.info(`[Sanitizer] Normalized ${normalizedCount} checklist status values`);
  }

  // Update the data with the correct field name
  if (data.inspectionChecklist) {
    data.inspectionChecklist = checklist;
  } else if (data.checklistItems) {
    data.checklistItems = checklist;
  }
}

// ============================================================================
// FIX #7: DOCUMENT PROVENANCE
// ============================================================================

/**
 * Build the provenance block for audit trail.
 * Tracks parser type, confidence, field overrides, and raw header text.
 */
function buildProvenance(
  data: any,
  parserType: string,
  overrides: FieldOverride[],
  warnings: string[]
): Provenance {
  // Calculate confidence scores
  const reportFields = data.reportInfo || {};
  const vesselData = data.vesselData || {};
  const tmlReadings = data.tmlReadings || [];

  // Report field confidence: how many canonical fields are populated
  const reportFieldNames = [
    "reportNumber", "reportDate", "inspectionDate",
    "inspectionType", "inspectorName", "inspectorCert",
  ];
  const reportPopulated = reportFieldNames.filter(
    f => reportFields[f] && String(reportFields[f]).trim() !== ""
  ).length;
  const reportConfidence = reportFieldNames.length > 0
    ? Math.round((reportPopulated / reportFieldNames.length) * 100) / 100
    : 0;

  // Vessel field confidence: how many key fields are populated
  const vesselFieldNames = [
    "vesselTagNumber", "manufacturer", "serialNumber", "nbNumber",
    "designPressure", "materialSpec", "insideDiameter", "headType",
    "jointEfficiency", "allowableStress",
  ];
  const vesselPopulated = vesselFieldNames.filter(
    f => vesselData[f] && String(vesselData[f]).trim() !== ""
  ).length;
  const vesselConfidence = vesselFieldNames.length > 0
    ? Math.round((vesselPopulated / vesselFieldNames.length) * 100) / 100
    : 0;

  // TML confidence: percentage of readings with currentThickness
  const tmlWithThickness = tmlReadings.filter(
    (t: any) => t.currentThickness !== null && t.currentThickness !== undefined &&
                 !isNaN(parseFloat(String(t.currentThickness))) &&
                 parseFloat(String(t.currentThickness)) > 0
  ).length;
  const tmlConfidence = tmlReadings.length > 0
    ? Math.round((tmlWithThickness / tmlReadings.length) * 100) / 100
    : 0;

  // Overall confidence: weighted average
  const overall = Math.round(
    (reportConfidence * 0.2 + vesselConfidence * 0.3 + tmlConfidence * 0.5) * 100
  ) / 100;

  return {
    parser: parserType,
    ocrApplied: parserType === "vision" || parserType === "hybrid",
    extractionModel: "manus-llm",
    fieldOverrides: overrides,
    validationWarnings: warnings,
    confidence: {
      reportFields: reportConfidence,
      vesselFields: vesselConfidence,
      tmlReadings: tmlConfidence,
      overall,
    },
    rawHeaderText: data._rawReportHeader || undefined,
    sanitizerVersion: "1.0.0",
  };
}

// ============================================================================
// MAIN SANITIZER PIPELINE
// ============================================================================

/**
 * Run the full sanitization pipeline on extracted data.
 * 
 * This is a deterministic post-processor that:
 * 1. Cleans polluted report fields (regex-based)
 * 2. Hydrates missing vessel data from checklist items
 * 3. Extracts head type from narrative text
 * 4. Fixes seam-adjacent CML locations
 * 5. Flags incomplete thickness records
 * 6. Normalizes checklist statuses
 * 7. Builds provenance/audit trail
 * 
 * @param rawData - Raw extracted data from LLM parser
 * @param parserType - Parser that produced the data ("manus", "vision", "hybrid", "docupipe")
 * @returns Sanitized data with provenance block
 */
export function sanitizeExtractedData(
  rawData: any,
  parserType: string = "manus"
): SanitizedResult {
  logger.info(`[Sanitizer] Starting post-processing pipeline (parser: ${parserType})`);

  // Deep clone to avoid mutating original
  const data = JSON.parse(JSON.stringify(rawData));
  const overrides: FieldOverride[] = [];
  const warnings: string[] = [];

  // Fix #1: Sanitize report fields
  sanitizeReportFields(data, overrides);
  logger.info(`[Sanitizer] Fix #1 complete: ${overrides.length} report field overrides`);

  // Fix #2: Hydrate vessel data from checklist
  const preHydrateOverrides = overrides.length;
  hydrateVesselFromChecklist(data, overrides);
  logger.info(`[Sanitizer] Fix #2 complete: ${overrides.length - preHydrateOverrides} fields hydrated from checklist`);

  // Fix #3: Extract head type from narrative
  extractHeadTypeFromNarrative(data, overrides, warnings);
  logger.info(`[Sanitizer] Fix #3 complete: headType=${data.vesselData?.headType || "not found"}`);

  // Fix #4: Fix seam-adjacent CML locations
  fixSeamAdjacentLocations(data, overrides);
  logger.info(`[Sanitizer] Fix #4 complete: seam-adjacent locations processed`);

  // Fix #5: Flag incomplete thickness records
  flagIncompleteThicknessRecords(data, warnings);
  logger.info(`[Sanitizer] Fix #5 complete: TML quality=${data._metadata?.tmlDataQuality?.calculationReadyPercentage || 0}%`);

  // Fix #6: Normalize checklist statuses
  normalizeChecklistStatuses(data, overrides);
  logger.info(`[Sanitizer] Fix #6 complete: checklist statuses normalized`);

  // Fix #7: Build provenance
  const provenance = buildProvenance(data, parserType, overrides, warnings);
  logger.info(`[Sanitizer] Fix #7 complete: confidence=${provenance.confidence.overall}, overrides=${overrides.length}, warnings=${warnings.length}`);

  // Attach provenance to data for downstream access
  data._provenance = provenance;

  logger.info(`[Sanitizer] Pipeline complete. Summary:`, {
    overrides: overrides.length,
    warnings: warnings.length,
    confidence: provenance.confidence,
    tmlQuality: data._metadata?.tmlDataQuality,
  });

  return { data, provenance };
}

/**
 * Convenience: convert fraction strings found anywhere in vessel data to decimals.
 * Exported for use in other modules.
 */
export { convertFractionToDecimal };
