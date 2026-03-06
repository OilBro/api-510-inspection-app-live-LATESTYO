/**
 * Nozzle Excel Import/Export Utilities
 * Handles parsing Excel files for nozzle data import and generating Excel exports
 */

import * as XLSX from 'xlsx';

export interface NozzleExcelRow {
  nozzleNumber: string;
  size: string; // e.g., "6", "12"
  schedule: string; // e.g., "STD", "40", "XS"
  service?: string; // e.g., "Inlet", "Outlet", "Manway"
  location: string;
  actualThickness: number; // inches
  notes?: string;
}

export interface NozzleExportRow extends NozzleExcelRow {
  nominalThickness: number;
  minusManufacturingTolerance: number;
  minimumRequired: number;
  status: string;
  margin: number; // inches
}

/**
 * Parse Excel file buffer and extract nozzle data
 * Returns array of nozzle rows
 */
export function parseNozzleExcel(fileBuffer: Buffer): NozzleExcelRow[] {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // Map to NozzleExcelRow format
    const nozzles: NozzleExcelRow[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];

      // Skip empty rows
      if (!row['Nozzle Number'] && !row['Size']) {
        continue;
      }

      // Validate required fields
      if (!row['Nozzle Number']) {
        throw new Error(`Row ${i + 2}: Nozzle Number is required`);
      }
      if (!row['Size']) {
        throw new Error(`Row ${i + 2}: Size is required`);
      }
      if (!row['Schedule']) {
        throw new Error(`Row ${i + 2}: Schedule is required`);
      }
      if (!row['Actual Thickness']) {
        throw new Error(`Row ${i + 2}: Actual Thickness is required`);
      }

      // Parse actual thickness
      const actualThickness = parseFloat(row['Actual Thickness']);
      if (isNaN(actualThickness) || actualThickness <= 0) {
        throw new Error(`Row ${i + 2}: Actual Thickness must be a positive number`);
      }

      nozzles.push({
        nozzleNumber: String(row['Nozzle Number']).trim(),
        size: String(row['Size']).trim(),
        schedule: String(row['Schedule']).trim().toUpperCase(),
        // N1 fix: capture service description from new column
        service: row['Service / Description'] ? String(row['Service / Description']).trim() : undefined,
        location: String(row['Location'] || '').trim(),
        actualThickness,
        notes: row['Notes'] ? String(row['Notes']).trim() : undefined,
      });
    }

    if (nozzles.length === 0) {
      throw new Error('No valid nozzle data found in Excel file');
    }

    return nozzles;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Excel parsing error: ${error.message}`);
    }
    throw new Error('Failed to parse Excel file');
  }
}

/**
 * Generate Excel file buffer from nozzle evaluation data
 * Includes all evaluation results and status
 */
export function generateNozzleExcel(nozzles: NozzleExportRow[]): Buffer {
  // Create worksheet data
  const wsData: any[] = [
    // Header row
    [
      'Nozzle Number',
      'Size (in)',
      'Schedule',
      'Location',
      'Nominal Thickness (in)',
      'Minus Tolerance (in)',
      'Actual Thickness (in)',
      'Minimum Required (in)',
      'Margin (in)',
      'Status',
      'Notes',
    ],
  ];

  // Data rows
  for (const nozzle of nozzles) {
    wsData.push([
      nozzle.nozzleNumber,
      nozzle.size,
      nozzle.schedule,
      nozzle.location,
      nozzle.nominalThickness.toFixed(4),
      nozzle.minusManufacturingTolerance.toFixed(4),
      nozzle.actualThickness.toFixed(4),
      nozzle.minimumRequired.toFixed(4),
      nozzle.margin.toFixed(4),
      nozzle.status,
      nozzle.notes || '',
    ]);
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Nozzle Number
    { wch: 10 }, // Size
    { wch: 10 }, // Schedule
    { wch: 20 }, // Location
    { wch: 18 }, // Nominal Thickness
    { wch: 18 }, // Minus Tolerance
    { wch: 18 }, // Actual Thickness
    { wch: 18 }, // Minimum Required
    { wch: 12 }, // Margin
    { wch: 15 }, // Status
    { wch: 30 }, // Notes
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nozzle Evaluation');

  // Generate buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return buffer;
}

/**
 * Generate blank Excel template for nozzle import
 */
export function generateNozzleTemplate(): Buffer {
  // Create template data with example row
  const wsData: any[] = [
    // Header row
    [
      'Nozzle Number',
      'Size',
      'Schedule',
      'Service / Description',
      'Location',
      'Actual Thickness',
      'Notes',
    ],
    // Example row
    [
      'N1',
      '6',
      'STD',
      'Inlet',
      'Shell - North',
      '0.2800',
      'Optional notes',
    ],
    // Empty rows for data entry
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Nozzle Number
    { wch: 10 }, // Size
    { wch: 12 }, // Schedule
    { wch: 25 }, // Service / Description
    { wch: 25 }, // Location
    { wch: 18 }, // Actual Thickness
    { wch: 30 }, // Notes
  ];

  // Add instructions as a comment/note
  const instructions = `
NOZZLE IMPORT TEMPLATE INSTRUCTIONS:

Required Columns:
- Nozzle Number: Unique identifier (e.g., N1, N2, M1)
- Size: Nominal pipe size in inches (e.g., 2, 6, 12)
- Schedule: Pipe schedule (e.g., STD, 40, XS, 80, 160)
- Actual Thickness: Measured thickness in inches (e.g., 0.2800)

Optional Columns:
- Location: Physical location on vessel (e.g., "Shell - North", "Head - Top")
- Notes: Additional comments or observations

Notes:
- Delete the example row before importing
- Size must match standard NPS (1/2 through 48 inches)
- Schedule must match ASME B36.10M schedules
- Actual thickness must be a positive decimal number
- All measurements in inches
  `.trim();

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nozzle Data');

  // Add instructions sheet
  const instructionsWs = XLSX.utils.aoa_to_sheet([
    ['NOZZLE IMPORT TEMPLATE'],
    [''],
    ...instructions.split('\n').map(line => [line]),
  ]);
  instructionsWs['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

  // Generate buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return buffer;
}

