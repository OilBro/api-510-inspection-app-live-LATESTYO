/**
 * Extraction Sanitizer / Post-Processor
 * 
 * Deterministic post-processing pipeline that runs AFTER LLM extraction
 * and BEFORE data reaches the preview/import pipeline.
 * 
 * Implements 9+ critical fixes for audit defensibility:
 * 
 * 1. Report field sanitization (regex-based, prevents LLM thought-loop pollution)
 * 2. Checklist-to-vessel field hydration (mines checklist items for missing vessel data)
 * 3. Head type authority hierarchy (nameplate > checklist > narrative, conflict warnings)
 * 3B. Phantom nozzle/head-quadrant TML row removal (prevents garbage stationKeys)
 * 4. Seam-adjacent CML location handling (angle-aware stationKey generation)
 * 5. Incomplete thickness record flagging (prevents bad RL/CR calculations)
 * 6. Checklist status normalization ("A" → acceptable, "N/A" → not_applicable)
 * 7. Document provenance tracking (audit trail for parser, overrides, confidence)
 * 8. Narrative mining for vessel physical characteristics (configuration, material, insulation, coating)
 * 9. Report info mining from narrative (clientLocation, inspectionType)
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
// STEP 0: SCHEMA NORMALIZATION
// ============================================================================

/**
 * Normalize LLM output field names to canonical schema BEFORE any other processing.
 * 
 * The LLM may return data under different field names depending on the prompt/model:
 *   - vesselInfo → vesselData
 *   - narratives.executiveSummary → executiveSummary (top-level)
 *   - checklistItems → inspectionChecklist
 *   - readings → tmlReadings
 * 
 * This function ensures all downstream sanitizer functions can rely on
 * canonical field names without per-function alias checks.
 */
function normalizeSchemaFields(data: any, overrides: FieldOverride[]): void {
  let normalizedCount = 0;

  // --- vesselInfo → vesselData ---
  if (data.vesselInfo && !data.vesselData) {
    data.vesselData = data.vesselInfo;
    delete data.vesselInfo;
    normalizedCount++;
  } else if (data.vesselInfo && data.vesselData) {
    // Merge vesselInfo into vesselData (vesselData takes precedence)
    data.vesselData = { ...data.vesselInfo, ...data.vesselData };
    delete data.vesselInfo;
    normalizedCount++;
  }

  // --- narratives.* → top-level ---
  if (data.narratives && typeof data.narratives === 'object') {
    if (data.narratives.executiveSummary && !data.executiveSummary) {
      data.executiveSummary = data.narratives.executiveSummary;
      normalizedCount++;
    }
    if (data.narratives.inspectionResults && !data.inspectionResults) {
      data.inspectionResults = data.narratives.inspectionResults;
      normalizedCount++;
    }
    if (data.narratives.recommendations && !data.recommendations) {
      data.recommendations = data.narratives.recommendations;
      normalizedCount++;
    }
    if (data.narratives.scopeOfInspection && !data.scopeOfInspection) {
      data.scopeOfInspection = data.narratives.scopeOfInspection;
      normalizedCount++;
    }
    delete data.narratives;
  }

  // --- checklistItems → inspectionChecklist ---
  if (data.checklistItems && !data.inspectionChecklist) {
    data.inspectionChecklist = data.checklistItems;
    delete data.checklistItems;
    normalizedCount++;
  }

  // --- readings → tmlReadings ---
  if (data.readings && !data.tmlReadings) {
    data.tmlReadings = data.readings;
    delete data.readings;
    normalizedCount++;
  }

  // --- report → reportInfo ---
  if (data.report && !data.reportInfo) {
    data.reportInfo = data.report;
    delete data.report;
    normalizedCount++;
  }

  if (normalizedCount > 0) {
    overrides.push({
      field: "_schema",
      from: `${normalizedCount} non-canonical field names`,
      to: "canonical schema (vesselData, inspectionChecklist, tmlReadings, reportInfo, top-level narratives)",
      rule: "schema_normalization",
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// STEP 0B: INSPECTION DATE VALIDATION & INFERENCE FROM NARRATIVE
// ============================================================================

/**
 * ANCHORED date patterns — only match dates near "conducted on", "inspected on",
 * "inspection date", "performed on" etc. These are high-confidence indicators
 * of the ACTUAL inspection date (not due dates or next-inspection dates).
 */
const ANCHORED_INSPECTION_DATE_PATTERNS = [
  // "conducted on 10/08/2025" or "conducted on October 8, 2025"
  /(?:conducted|performed|completed|done)\s+(?:on\s+)?(?:the\s+)?(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:conducted|performed|completed|done)\s+(?:on\s+)?(?:the\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})/i,
  // "inspection was conducted on ..."
  /inspect(?:ion|ed)\s+(?:was\s+)?(?:performed|conducted|completed|done)\s+(?:on\s+)?(?:the\s+)?(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /inspect(?:ion|ed)\s+(?:was\s+)?(?:performed|conducted|completed|done)\s+(?:on\s+)?(?:the\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})/i,
  // "inspection date: 2025-12-02" or "inspection date: 12/02/2025"
  /inspect(?:ion)?\s*date\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
  /inspect(?:ion)?\s*date\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
];

/**
 * "Due by" / "next inspection" date patterns — these should NEVER be used
 * as inspectionDate. They are extracted into separate fields.
 */
const NEXT_INSPECTION_DUE_PATTERNS: Array<{ field: string; pattern: RegExp }> = [
  { field: 'nextExternalInspectionDue', pattern: /next\s+external\s+(?:inspection\s+)?(?:is\s+)?due\s+(?:by)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})/i },
  { field: 'nextInternalInspectionDue', pattern: /next\s+internal\s+(?:inspection\s+)?(?:is\s+)?due\s+(?:by)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})/i },
  { field: 'nextUTInspectionDue', pattern: /next\s+(?:UT|ultrasonic|thickness)\s+(?:inspection\s+)?(?:is\s+)?due\s+(?:by)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})/i },
  // Generic "due by" / "due date" for any inspection type
  { field: 'nextExternalInspectionDue', pattern: /external\s+(?:inspection\s+)?(?:due\s+)?(?:date)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i },
  { field: 'nextInternalInspectionDue', pattern: /internal\s+(?:inspection\s+)?(?:due\s+)?(?:date)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i },
];

/**
 * Validates and corrects inspectionDate using anchored narrative parsing.
 * 
 * CRITICAL FIX: The LLM sometimes returns a "next inspection due" date
 * (e.g., 2030-10-08) instead of the actual inspection date (e.g., 2025-10-08).
 * This function:
 * 1. ALWAYS extracts anchored dates from narratives ("conducted on", "inspected on")
 * 2. If the LLM date conflicts with the anchored date, OVERRIDES with the anchored date
 * 3. If no LLM date exists, infers from narrative
 * 4. Extracts "next inspection due" dates into separate fields
 */
function validateAndInferInspectionDate(data: any, overrides: FieldOverride[], warnings: string[]): void {
  const reportInfo = data.reportInfo || {};
  const existingDate = reportInfo.inspectionDate ? String(reportInfo.inspectionDate).trim() : '';

  // Build narrative corpus from executive summary and inspection results
  // EXCLUDE recommendations to avoid picking up "due by" dates
  const inspectionNarrative = [
    data.executiveSummary || '',
    data.inspectionResults || '',
    data.scopeOfInspection || '',
  ].join(' ');

  // Full corpus including recommendations (for due date extraction)
  const fullNarrative = [
    inspectionNarrative,
    data.recommendations || '',
  ].join(' ');

  // --- Step 1: Extract anchored inspection date from narrative ---
  let anchoredDate: string | null = null;
  if (inspectionNarrative.trim()) {
    for (const pattern of ANCHORED_INSPECTION_DATE_PATTERNS) {
      const match = inspectionNarrative.match(pattern);
      if (match && match[1]) {
        const extracted = extractDate(match[1]);
        if (extracted) {
          anchoredDate = extracted;
          break;
        }
      }
    }
  }

  // --- Step 2: Validate/correct the inspectionDate ---
  if (anchoredDate) {
    if (!existingDate) {
      // No LLM date — use anchored date
      reportInfo.inspectionDate = anchoredDate;
      data.reportInfo = reportInfo;
      overrides.push({
        field: 'reportInfo.inspectionDate',
        from: '',
        to: anchoredDate,
        rule: 'anchored_inspection_date_inference',
        timestamp: new Date().toISOString(),
      });
      warnings.push(
        `Inspection date "${anchoredDate}" was inferred from anchored narrative text ("conducted on" / "performed on"). ` +
        `Verify this date matches the actual inspection date on the report.`
      );
    } else if (existingDate !== anchoredDate) {
      // LLM date CONFLICTS with anchored date — override with anchored
      overrides.push({
        field: 'reportInfo.inspectionDate',
        from: existingDate,
        to: anchoredDate,
        rule: 'anchored_date_override_conflict',
        timestamp: new Date().toISOString(),
      });
      warnings.push(
        `INSPECTION DATE CONFLICT: LLM returned "${existingDate}" but narrative says inspection was ` +
        `"conducted on ${anchoredDate}". Overriding with anchored date. The LLM date may be a ` +
        `"next inspection due" date — verify in the original report.`
      );
      reportInfo.inspectionDate = anchoredDate;
      data.reportInfo = reportInfo;
    }
    // else: existingDate === anchoredDate — no action needed, dates agree
  } else if (!existingDate) {
    // No anchored date found AND no LLM date — try reportDate fallback
    if (reportInfo.reportDate && String(reportInfo.reportDate).trim() !== '') {
      reportInfo.inspectionDate = reportInfo.reportDate;
      data.reportInfo = reportInfo;
      overrides.push({
        field: 'reportInfo.inspectionDate',
        from: '',
        to: reportInfo.reportDate,
        rule: 'fallback_to_report_date',
        timestamp: new Date().toISOString(),
      });
      warnings.push(
        `Inspection date was not found in narrative or structured fields; using report date ` +
        `"${reportInfo.reportDate}" as fallback. Verify this is the actual inspection date.`
      );
    }
  }

  // --- Step 3: Extract "next inspection due" dates into separate fields ---
  if (fullNarrative.trim()) {
    if (!data._nextInspectionDates) {
      data._nextInspectionDates = {};
    }
    for (const { field, pattern } of NEXT_INSPECTION_DUE_PATTERNS) {
      // Don't overwrite if already extracted
      if (data._nextInspectionDates[field]) continue;
      const match = fullNarrative.match(pattern);
      if (match && match[1]) {
        const extracted = extractDate(match[1]);
        if (extracted) {
          data._nextInspectionDates[field] = extracted;
          overrides.push({
            field: `_nextInspectionDates.${field}`,
            from: '',
            to: extracted,
            rule: 'next_inspection_due_extraction',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }
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
// FIX #3: HEAD TYPE AUTHORITY HIERARCHY
// ============================================================================

/**
 * Head type patterns used for matching across all sources.
 */
const HEAD_TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /(?:2\s*:\s*1\s+)?ellipsoidal/i, type: "2:1 Ellipsoidal" },
  { pattern: /elliptical/i, type: "2:1 Ellipsoidal" },
  { pattern: /torispherical/i, type: "Torispherical" },
  { pattern: /(?:F\s*&\s*D|flanged\s*(?:and|&)\s*dished)/i, type: "Torispherical" },
  { pattern: /hemispherical/i, type: "Hemispherical" },
  { pattern: /(?:flat|blind)\s*(?:head|plate|cover)/i, type: "Flat" },
  { pattern: /conical/i, type: "Conical" },
];

/**
 * Try to match a head type from a text string.
 */
function matchHeadType(text: string): string | null {
  for (const { pattern, type } of HEAD_TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return null;
}

/**
 * Head type authority hierarchy:
 *   1. vesselData.headType (nameplate/structured field) — HIGHEST authority
 *   2. Checklist items mentioning head type
 *   3. Narrative text (executive summary, inspection results)
 *
 * If sources conflict, keep the highest-authority source and add a
 * provenance warning documenting the disagreement.
 */
function resolveHeadTypeAuthority(data: any, overrides: FieldOverride[], warnings: string[]): void {
  const vesselData = data.vesselData || {};
  const checklist = data.inspectionChecklist || data.checklistItems || [];

  // --- Source 1: vesselData.headType (nameplate / structured) ---
  const nameplateRaw = String(vesselData.headType || "").trim();
  const nameplateType = nameplateRaw ? matchHeadType(nameplateRaw) || nameplateRaw : null;

  // --- Source 2: Checklist ---
  let checklistType: string | null = null;
  for (const item of checklist) {
    const text = `${item.itemText || ""} ${item.notes || ""} ${item.description || ""}`;
    const match = matchHeadType(text);
    if (match) { checklistType = match; break; }
  }

  // --- Source 3: Narrative ---
  const narrativeText = [
    data.executiveSummary || "",
    data.inspectionResults || "",
    data.recommendations || "",
  ].join(" ");
  const narrativeType = matchHeadType(narrativeText);

  // --- Resolve ---
  let resolvedType: string | null = null;
  let resolvedSource = "";

  if (nameplateType) {
    resolvedType = nameplateType;
    resolvedSource = "nameplate";

    // Check for conflicts with other sources
    if (checklistType && normalizeHeadLabel(checklistType) !== normalizeHeadLabel(nameplateType)) {
      warnings.push(
        `Head type conflict: nameplate says "${nameplateType}" but checklist says "${checklistType}". ` +
        `Keeping nameplate value (highest authority). Verify against design drawings.`
      );
    }
    if (narrativeType && normalizeHeadLabel(narrativeType) !== normalizeHeadLabel(nameplateType)) {
      warnings.push(
        `Head type conflict: nameplate says "${nameplateType}" but narrative says "${narrativeType}". ` +
        `Keeping nameplate value (highest authority). Verify against design drawings.`
      );
    }
  } else if (checklistType) {
    resolvedType = checklistType;
    resolvedSource = "checklist";

    overrides.push({
      field: "vesselData.headType",
      from: "",
      to: checklistType,
      rule: "checklist_head_type_hydration",
      timestamp: new Date().toISOString(),
    });
    warnings.push(
      `Head type "${checklistType}" was extracted from checklist (not from nameplate). ` +
      `Verify this matches design data.`
    );

    if (narrativeType && normalizeHeadLabel(narrativeType) !== normalizeHeadLabel(checklistType)) {
      warnings.push(
        `Head type conflict: checklist says "${checklistType}" but narrative says "${narrativeType}". ` +
        `Keeping checklist value (higher authority than narrative).`
      );
    }
  } else if (narrativeType) {
    resolvedType = narrativeType;
    resolvedSource = "narrative";

    overrides.push({
      field: "vesselData.headType",
      from: "",
      to: narrativeType,
      rule: "narrative_head_type_extraction",
      timestamp: new Date().toISOString(),
    });
    warnings.push(
      `Head type "${narrativeType}" was extracted from narrative text (lowest authority). ` +
      `Verify this matches nameplate/design data.`
    );
  }

  if (resolvedType) {
    vesselData.headType = resolvedType;

    // For torispherical, warn about missing crown/knuckle radii
    if (normalizeHeadLabel(resolvedType) === "torispherical") {
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
  }
}

/**
 * Normalize head type labels for comparison (case-insensitive, strip whitespace).
 */
function normalizeHeadLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

// ============================================================================
// FIX #3B: REMOVE PHANTOM NOZZLE TML ROWS
// ============================================================================

/**
 * Remove phantom nozzle and head-quadrant TML entries that have no real thickness.
 *
 * Problem: The LLM sometimes expands nozzle objects into TML-like rows with
 * readingType="nozzle" and legacyLocationIds like "1-0", "1-90", "1-180", "1-270"
 * that duplicate a real head or nozzle point. These phantom rows:
 *   - Have no currentThickness (or it's blank/null)
 *   - Share the same location text as a real reading
 *   - Create garbage stationKeys and mess up Tmin selection
 *
 * Rules:
 *   1. If readingType === "nozzle" AND no parseable currentThickness → DROP
 *   2. If location contains "Head" AND legacyLocationId matches /^\d+-(0|90|180|270)$/
 *      AND no parseable currentThickness → DROP
 *   3. Dedupe by (location, legacyLocationId): keep the row with thickness
 */
function removePhantomNozzleTmlRows(data: any, overrides: FieldOverride[], warnings: string[]): void {
  const tmlReadings = data.tmlReadings || [];
  if (!tmlReadings.length) return;

  const originalCount = tmlReadings.length;
  const kept: any[] = [];
  let droppedNozzle = 0;
  let droppedHeadQuadrant = 0;
  let droppedDuplicate = 0;

  // First pass: filter out phantom rows
  for (const tml of tmlReadings) {
    const readingType = String(tml.readingType || "").toLowerCase().trim();
    const location = String(tml.location || "");
    const legacyId = String(tml.legacyLocationId || "");
    const hasThickness = hasParseableThickness(tml.currentThickness) || hasParseableThickness(tml.tActual);

    // Rule 1: nozzle readingType with no thickness → drop
    if (readingType === "nozzle" && !hasThickness) {
      droppedNozzle++;
      continue;
    }

    // Rule 2: head quadrant expansion with no thickness → drop
    // Pattern: legacyId like "1-0", "1-90", "1-180", "1-270" AND location mentions "Head"
    const isHeadQuadrant = /head/i.test(location) &&
      /^\d+-(0|45|90|135|180|225|270|315)$/.test(legacyId);
    if (isHeadQuadrant && !hasThickness) {
      droppedHeadQuadrant++;
      continue;
    }

    kept.push(tml);
  }

  // Second pass: dedupe by (location, legacyLocationId), keeping the one with thickness
  const seen = new Map<string, any>();
  const deduped: any[] = [];

  for (const tml of kept) {
    const key = `${String(tml.location || "").toLowerCase().trim()}||${String(tml.legacyLocationId || "")}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, tml);
      deduped.push(tml);
    } else {
      // Keep the one with thickness; drop the other
      const existingHasThickness = hasParseableThickness(existing.currentThickness) || hasParseableThickness(existing.tActual);
      const newHasThickness = hasParseableThickness(tml.currentThickness) || hasParseableThickness(tml.tActual);

      if (!existingHasThickness && newHasThickness) {
        // Replace existing with new (new has thickness)
        const idx = deduped.indexOf(existing);
        if (idx >= 0) deduped[idx] = tml;
        seen.set(key, tml);
        droppedDuplicate++;
      } else {
        // Keep existing, drop new
        droppedDuplicate++;
      }
    }
  }

  const totalDropped = droppedNozzle + droppedHeadQuadrant + droppedDuplicate;

  if (totalDropped > 0) {
    data.tmlReadings = deduped;

    overrides.push({
      field: "tmlReadings",
      from: `${originalCount} rows`,
      to: `${deduped.length} rows (removed ${totalDropped} phantom/duplicate)`,
      rule: "remove_phantom_nozzle_tml_rows",
      timestamp: new Date().toISOString(),
    });

    const details: string[] = [];
    if (droppedNozzle > 0) details.push(`${droppedNozzle} nozzle rows without thickness`);
    if (droppedHeadQuadrant > 0) details.push(`${droppedHeadQuadrant} head quadrant expansions without thickness`);
    if (droppedDuplicate > 0) details.push(`${droppedDuplicate} duplicate (location, legacyId) rows`);

    warnings.push(
      `Removed ${totalDropped} phantom TML rows: ${details.join(", ")}. ` +
      `Original: ${originalCount}, kept: ${deduped.length}.`
    );

    logger.info(`[Sanitizer] Removed ${totalDropped} phantom TML rows: ${details.join(", ")}`);
  }
}

/**
 * Check if a value can be parsed as a valid positive thickness number.
 */
function hasParseableThickness(value: any): boolean {
  if (value === null || value === undefined || value === "") return false;
  const num = parseFloat(String(value));
  return !isNaN(num) && num > 0;
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

    // Extract angle: first from explicit angle field, then from legacyLocationId suffix
    let angleStr = "";
    const explicitAngle = String(tml.angle || "").match(/(\d+)/);
    if (explicitAngle) {
      angleStr = explicitAngle[1];
    } else {
      // Check legacyLocationId for angle suffix: "6-135" → angle=135, "6-0" → angle=0
      const legacyAngleMatch = legacyId.match(/^\d+-(\d+)$/);
      if (legacyAngleMatch) {
        angleStr = legacyAngleMatch[1];
      }
    }

    // Build proper stationKey — always include angle when present
    // This prevents collapsing distinct circumferential UT points into one key
    let stationKey: string;
    if (distanceStr && angleStr) {
      stationKey = `${seamRef}-${distanceStr}IN-A${angleStr}`;
    } else if (distanceStr) {
      stationKey = `${seamRef}-${distanceStr}IN`;
    } else if (angleStr) {
      stationKey = `${seamRef}-A${angleStr}`;
    } else {
      stationKey = seamRef;
    }

    // Only override if the current legacyLocationId looks like a generic slice-angle
    // that would be misinterpreted
    const looksLikeSliceAngle = /^\d+-\d+$/.test(legacyId);
    if (looksLikeSliceAngle || !legacyId) {
      // Dual-write: both tml._stationKey (flat) and tml._metadata.stationKey (nested)
      // so downstream consumers can use either convention
      if (!tml._metadata) tml._metadata = {};
      tml._metadata.stationKey = stationKey;
      tml._metadata.isSeamAdjacent = true;
      tml._metadata.originalLegacyId = legacyId;
      tml._stationKey = stationKey;  // flat alias for direct access
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
      tml._dataStatus = "incomplete";  // flat alias for direct access
      incompleteCount++;
    } else {
      if (!tml._metadata) tml._metadata = {};
      tml._metadata.dataStatus = "complete";
      tml._metadata.dataIssues = infoIssues.length > 0 ? infoIssues : undefined;
      tml._metadata.calculationReady = true;
      tml._dataStatus = "complete";  // flat alias for direct access
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
// FIX #8: NARRATIVE MINING — VESSEL PHYSICAL CHARACTERISTICS
// ============================================================================

/**
 * Mine narrative text for vessel physical characteristics that the LLM missed.
 * 
 * The inspection results section often contains rich physical descriptions:
 *   - Vessel configuration (horizontal, vertical, sphere)
 *   - Shell/head material (carbon steel, stainless steel, SA-516 Gr 70)
 *   - Insulation status (un-insulated, fiberglass, calcium silicate)
 *   - External coating (epoxy, paint, galvanized)
 *   - Orientation/mounting (horizontal storage tank, vertical column)
 * 
 * Authority: Narrative is LOWEST authority — only fills empty fields.
 * If vesselData already has a value, narrative does NOT override.
 */
function mineNarrativeForVesselCharacteristics(data: any, overrides: FieldOverride[], warnings: string[]): void {
  const vesselData = data.vesselData || {};
  const narrativeText = [
    data.executiveSummary || '',
    data.inspectionResults || '',
    data.scopeOfInspection || '',
  ].join(' ');

  if (!narrativeText.trim()) return;

  let mineCount = 0;

  // --- Vessel Configuration ---
  if (!vesselData.vesselConfiguration || vesselData.vesselConfiguration === '') {
    const configPatterns: Array<{ pattern: RegExp; config: string }> = [
      { pattern: /horizontal\s+(?:storage\s+)?(?:tank|vessel|drum|accumulator|receiver)/i, config: 'Horizontal' },
      { pattern: /vertical\s+(?:storage\s+)?(?:tank|vessel|drum|column|tower|accumulator|receiver)/i, config: 'Vertical' },
      { pattern: /(?:sphere|spherical)\s+(?:storage\s+)?(?:tank|vessel)/i, config: 'Sphere' },
      // Fallback: just "horizontal" or "vertical" near vessel-related words
      { pattern: /\b(?:the\s+)?(?:vessel|tank|drum)\s+(?:is\s+)?(?:a\s+)?horizontal\b/i, config: 'Horizontal' },
      { pattern: /\b(?:the\s+)?(?:vessel|tank|drum)\s+(?:is\s+)?(?:a\s+)?vertical\b/i, config: 'Vertical' },
    ];
    for (const { pattern, config } of configPatterns) {
      if (pattern.test(narrativeText)) {
        vesselData.vesselConfiguration = config;
        overrides.push({
          field: 'vesselData.vesselConfiguration',
          from: '',
          to: config,
          rule: 'narrative_mining_vessel_configuration',
          timestamp: new Date().toISOString(),
        });
        mineCount++;
        break;
      }
    }
  }

  // --- Shell Material ---
  // Only fill if materialSpec is empty. Narrative often says "carbon steel" or "stainless steel"
  // but may not give the SA- spec. We store what we find.
  if (!vesselData.materialSpec || vesselData.materialSpec === '') {
    const materialPatterns: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray) => string }> = [
      // SA-spec with grade: "SA-516 Gr 70", "SA-240 Type 304"
      { pattern: /(SA-\d+\s*(?:Gr\.?\s*\d+|Type\s*\d+[A-Za-z]*))/i, extract: (m) => m[1] },
      // Generic material near "shell": "The shell is ... stainless steel"
      { pattern: /(?:shell|body|cylinder)\s+(?:is\s+)?(?:un-?insulated,?\s*)?(?:(?:\d+\s*(?:ga(?:uge)?|mm|inch|")?\s*)?)?((?:carbon|stainless|alloy|chrome-?moly|duplex|inconel|monel|hastelloy|clad)\s*steel(?:\s*\d+[A-Za-z]*)?)/i, extract: (m) => m[1] },
      // Material near "head": "heads are ... carbon steel"
      { pattern: /head(?:s)?\s+(?:are|is)\s+[^.]*?((?:carbon|stainless|alloy|chrome-?moly|duplex)\s*steel(?:\s*\d+[A-Za-z]*)?)/i, extract: (m) => m[1] },
    ];
    for (const { pattern, extract } of materialPatterns) {
      const match = narrativeText.match(pattern);
      if (match) {
        const material = extract(match).trim();
        vesselData.materialSpec = material;
        overrides.push({
          field: 'vesselData.materialSpec',
          from: '',
          to: material,
          rule: 'narrative_mining_material_spec',
          timestamp: new Date().toISOString(),
        });
        warnings.push(
          `Material spec "${material}" was extracted from narrative text (lowest authority). ` +
          `This may not be the full SA- specification. Verify against nameplate/MTR.`
        );
        mineCount++;
        break;
      }
    }
  }

  // --- Insulation Type ---
  if (!vesselData.insulationType || vesselData.insulationType === '') {
    const insulationPatterns: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray) => string }> = [
      // "un-insulated" or "uninsulated"
      { pattern: /\b(un-?insulated)\b/i, extract: () => 'None (un-insulated)' },
      // Specific insulation types
      { pattern: /(?:insulated\s+with|insulation\s+(?:is|type)?:?\s*)(fiberglass|calcium\s*silicate|mineral\s*wool|polyurethane|foam\s*glass|perlite|ceramic\s*fiber|rockwool)/i, extract: (m) => m[1] },
      // "X insulation" pattern
      { pattern: /(fiberglass|calcium\s*silicate|mineral\s*wool|polyurethane|foam\s*glass|perlite|ceramic\s*fiber|rockwool)\s+insulation/i, extract: (m) => m[1] },
    ];
    for (const { pattern, extract } of insulationPatterns) {
      const match = narrativeText.match(pattern);
      if (match) {
        const insulation = extract(match).trim();
        vesselData.insulationType = insulation;
        overrides.push({
          field: 'vesselData.insulationType',
          from: '',
          to: insulation,
          rule: 'narrative_mining_insulation_type',
          timestamp: new Date().toISOString(),
        });
        mineCount++;
        break;
      }
    }
  }

  // --- External Coating ---
  // Store in a _hydratedFields bucket since coating isn't a standard vesselData field
  if (!data._hydratedFields) data._hydratedFields = {};
  if (!data._hydratedFields.externalCoating) {
    const coatingPatterns: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray) => string }> = [
      // "20 to 30 mils epoxy external coating"
      { pattern: /(\d+\s*(?:to|-)\s*\d+\s*mils?\s+(?:epoxy|polyurethane|paint|zinc|primer|galvanized|phenolic)[^.]*(?:coating|paint))/i, extract: (m) => m[1] },
      // "epoxy external coating" or "external epoxy coating"
      { pattern: /((?:epoxy|polyurethane|zinc\s*rich|primer|galvanized|phenolic|alkyd|acrylic)\s+(?:external\s+)?coating)/i, extract: (m) => m[1] },
      // "external coating" with preceding description
      { pattern: /(?:with|has)\s+(\d+[^.]*(?:external\s+)?coating)/i, extract: (m) => m[1] },
    ];
    for (const { pattern, extract } of coatingPatterns) {
      const match = narrativeText.match(pattern);
      if (match) {
        const coating = extract(match).trim();
        data._hydratedFields.externalCoating = coating;
        overrides.push({
          field: '_hydratedFields.externalCoating',
          from: '',
          to: coating,
          rule: 'narrative_mining_external_coating',
          timestamp: new Date().toISOString(),
        });
        mineCount++;
        break;
      }
    }
  }

  // --- Vessel Type (if empty) ---
  if (!vesselData.vesselType || vesselData.vesselType === '') {
    const typePatterns: Array<{ pattern: RegExp; vesselType: string }> = [
      { pattern: /\bstorage\s+tank\b/i, vesselType: 'Storage Tank' },
      { pattern: /\bpressure\s+vessel\b/i, vesselType: 'Pressure Vessel' },
      { pattern: /\bheat\s+exchanger\b/i, vesselType: 'Heat Exchanger' },
      { pattern: /\breactor\b/i, vesselType: 'Reactor' },
      { pattern: /\bcolumn\b/i, vesselType: 'Column' },
      { pattern: /\btower\b/i, vesselType: 'Tower' },
      { pattern: /\baccumulator\b/i, vesselType: 'Accumulator' },
      { pattern: /\bseparator\b/i, vesselType: 'Separator' },
      { pattern: /\bdryer\b/i, vesselType: 'Dryer' },
      { pattern: /\bfilter\b/i, vesselType: 'Filter' },
      { pattern: /\breceiver\b/i, vesselType: 'Receiver' },
      { pattern: /\bdrum\b/i, vesselType: 'Drum' },
    ];
    for (const { pattern, vesselType } of typePatterns) {
      if (pattern.test(narrativeText)) {
        vesselData.vesselType = vesselType;
        overrides.push({
          field: 'vesselData.vesselType',
          from: '',
          to: vesselType,
          rule: 'narrative_mining_vessel_type',
          timestamp: new Date().toISOString(),
        });
        mineCount++;
        break;
      }
    }
  }

  if (mineCount > 0) {
    data.vesselData = vesselData;
    logger.info(`[Sanitizer] Fix #8: Mined ${mineCount} vessel characteristics from narrative`);
  }
}

// ============================================================================
// FIX #9: MINE CLIENT LOCATION & INSPECTION TYPE FROM NARRATIVE
// ============================================================================

function mineReportInfoFromNarrative(
  data: any,
  overrides: FieldOverride[],
  warnings: string[]
): void {
  const reportInfo = data.reportInfo || {};
  const narrativeText = [
    data.executiveSummary || '',
    data.inspectionResults || '',
    data.recommendations || '',
  ].join(' ');

  if (!narrativeText || narrativeText.length < 20) return;

  let mineCount = 0;

  // --- Client Location ---
  // Executive summaries often say "located in CITY STATE" or "located at CITY, STATE"
  if (!reportInfo.clientLocation || reportInfo.clientLocation === '') {
    const locationPatterns: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray) => string }> = [
      // "located in CLEBURNE TX" or "located in Houston, Texas"
      { pattern: /located\s+(?:in|at)\s+([A-Z][A-Za-z\s]+,?\s*(?:TX|CA|LA|OK|PA|OH|NJ|NY|IL|MI|WI|MN|IN|KY|TN|AL|MS|GA|FL|SC|NC|VA|WV|MD|DE|CT|RI|MA|VT|NH|ME|IA|MO|AR|KS|NE|SD|ND|MT|WY|CO|NM|AZ|UT|NV|ID|OR|WA|HI|AK|Texas|California|Louisiana|Oklahoma|Pennsylvania|Ohio|New\s+Jersey|New\s+York|Illinois|Michigan|Wisconsin|Minnesota|Indiana|Kentucky|Tennessee|Alabama|Mississippi|Georgia|Florida|South\s+Carolina|North\s+Carolina|Virginia|West\s+Virginia|Maryland|Delaware|Connecticut|Rhode\s+Island|Massachusetts|Vermont|New\s+Hampshire|Maine|Iowa|Missouri|Arkansas|Kansas|Nebraska|South\s+Dakota|North\s+Dakota|Montana|Wyoming|Colorado|New\s+Mexico|Arizona|Utah|Nevada|Idaho|Oregon|Washington|Hawaii|Alaska))/i, extract: (m) => m[1].trim().replace(/,\s*$/, '') },
      // "located in CITY, ST" (2-letter state code)
      { pattern: /located\s+(?:in|at)\s+([A-Z][A-Za-z\s]+,\s*[A-Z]{2})\b/i, extract: (m) => m[1].trim() },
      // "facility in CITY" (less specific)
      { pattern: /facility\s+(?:in|at|located\s+in)\s+([A-Z][A-Za-z\s]+,?\s*[A-Z]{2})\b/i, extract: (m) => m[1].trim() },
    ];
    for (const { pattern, extract } of locationPatterns) {
      const match = narrativeText.match(pattern);
      if (match) {
        const location = extract(match);
        // Sanity check: location should be reasonable length
        if (location.length >= 3 && location.length <= 60) {
          reportInfo.clientLocation = location;
          overrides.push({
            field: 'reportInfo.clientLocation',
            from: '',
            to: location,
            rule: 'narrative_mining_client_location',
            timestamp: new Date().toISOString(),
          });
          mineCount++;
          break;
        }
      }
    }
  }

  // --- Inspection Type ---
  // Determine from narrative context whether this was External, Internal, or On-Stream
  if (!reportInfo.inspectionType || reportInfo.inspectionType === '') {
    const narrativeLower = narrativeText.toLowerCase();
    let inspectionType = '';
    
    // Look for explicit mentions — ORDER MATTERS: check compound phrases first
    if (/\bin-?lieu-?of\s+internal/i.test(narrativeText)) {
      // "in-lieu-of internal inspection" means they did an external with UT instead of internal
      inspectionType = 'External (In-Lieu-of Internal)';
    } else if (/\b(on-?stream|on\s+stream\s+inspection)\b/i.test(narrativeText)) {
      inspectionType = 'On-Stream';
    } else if (/\b(internal\s+inspection|internal\s+visual|internal\s+examination)\b/i.test(narrativeText)) {
      inspectionType = 'Internal';
    } else if (/\b(external\s+inspection|external\s+visual|external\s+examination)\b/i.test(narrativeText)) {
      inspectionType = 'External';
    } else if (/\b(ut\s+(?:thickness|scan|inspection)|ultrasonic\s+thickness)/i.test(narrativeText) &&
               !/\binternal\b/i.test(narrativeText)) {
      // UT-based inspection without internal access suggests external
      inspectionType = 'External';
    }
    
    if (inspectionType) {
      reportInfo.inspectionType = inspectionType;
      overrides.push({
        field: 'reportInfo.inspectionType',
        from: '',
        to: inspectionType,
        rule: 'narrative_mining_inspection_type',
        timestamp: new Date().toISOString(),
      });
      mineCount++;
    }
  }

  if (mineCount > 0) {
    data.reportInfo = reportInfo;
    logger.info(`[Sanitizer] Fix #9: Mined ${mineCount} report info fields from narrative`);
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
    sanitizerVersion: "1.3.0",
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
  logger.info(`[Sanitizer] Starting post-processing pipeline v1.3.0 (parser: ${parserType})`);

  // Deep clone to avoid mutating original
  const data = JSON.parse(JSON.stringify(rawData));
  const overrides: FieldOverride[] = [];
  const warnings: string[] = [];

  // ── Step 0: Schema normalization ──
  // Normalize field names BEFORE any other processing so all downstream
  // functions can rely on canonical field names.
  normalizeSchemaFields(data, overrides);

  // ── Pre-flight: warn about empty data sections ──
  // These warnings help inspectors understand why certain hydrations didn't run.
  const checklist = data.inspectionChecklist || data.checklistItems || [];
  const tmlReadings = data.tmlReadings || [];
  const hasNarratives = !!(data.executiveSummary || data.inspectionResults || data.recommendations);
  const hasVesselData = data.vesselData && Object.values(data.vesselData).some((v: any) => v && String(v).trim() !== '');

  if (!checklist.length) {
    warnings.push('No checklist items provided; vessel hydration from checklist will be skipped.');
    logger.info('[Sanitizer] Pre-flight: empty checklist — hydration will be limited');
  }
  if (!hasNarratives) {
    warnings.push('No narrative text provided (executive summary, inspection results, recommendations); head type extraction from narrative will be skipped.');
    logger.info('[Sanitizer] Pre-flight: empty narratives — head type narrative extraction will be limited');
  }
  if (!tmlReadings.length) {
    warnings.push('No TML readings provided; seam-adjacent processing, phantom removal, and thickness flagging will be skipped.');
    logger.info('[Sanitizer] Pre-flight: empty TML readings — thickness processing will be skipped');
  }
  if (!hasVesselData) {
    warnings.push('No vessel data provided; vessel field validation will be limited.');
    logger.info('[Sanitizer] Pre-flight: empty vessel data');
  }

  // Fix #1: Sanitize report fields
  sanitizeReportFields(data, overrides);
  logger.info(`[Sanitizer] Fix #1 complete: ${overrides.length} report field overrides`);

  // Fix #1B: Infer inspectionDate from narrative if blank
  validateAndInferInspectionDate(data, overrides, warnings);

  // Fix #2: Hydrate vessel data from checklist
  const preHydrateOverrides = overrides.length;
  hydrateVesselFromChecklist(data, overrides);
  logger.info(`[Sanitizer] Fix #2 complete: ${overrides.length - preHydrateOverrides} fields hydrated from checklist`);

  // Fix #3: Resolve head type with authority hierarchy (nameplate > checklist > narrative)
  resolveHeadTypeAuthority(data, overrides, warnings);
  logger.info(`[Sanitizer] Fix #3 complete: headType=${data.vesselData?.headType || "not found"}`);

  // Fix #3B: Remove phantom nozzle/head-quadrant TML rows
  removePhantomNozzleTmlRows(data, overrides, warnings);
  logger.info(`[Sanitizer] Fix #3B complete: phantom TML rows removed, ${(data.tmlReadings || []).length} rows remaining`);

  // Fix #4: Fix seam-adjacent CML locations (with angle-aware stationKeys)
  fixSeamAdjacentLocations(data, overrides);
  logger.info(`[Sanitizer] Fix #4 complete: seam-adjacent locations processed`);

  // Fix #5: Flag incomplete thickness records
  flagIncompleteThicknessRecords(data, warnings);
  logger.info(`[Sanitizer] Fix #5 complete: TML quality=${data._metadata?.tmlDataQuality?.calculationReadyPercentage || 0}%`);

  // Fix #6: Normalize checklist statuses
  normalizeChecklistStatuses(data, overrides);
  logger.info(`[Sanitizer] Fix #6 complete: checklist statuses normalized`);

  // Fix #8: Mine narrative for vessel physical characteristics
  mineNarrativeForVesselCharacteristics(data, overrides, warnings);
  logger.info(`[Sanitizer] Fix #8 complete: narrative mining for vessel characteristics`);

  // Fix #9: Mine report info (clientLocation, inspectionType) from narrative
  mineReportInfoFromNarrative(data, overrides, warnings);
  logger.info(`[Sanitizer] Fix #9 complete: report info mining from narrative`);

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
