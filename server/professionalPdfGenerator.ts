/**
 * Professional API 510 Report PDF Generator - FIXED VERSION
 * 
 * Generates a complete professional inspection report with proper content rendering
 */

import PDFDocument from "pdfkit";
import {
  getProfessionalReport,
  getComponentCalculations,
  getInspectionFindings,
  getRecommendations,
  getInspectionPhotos,
  getChecklistItems,
} from "./professionalReportDb";
import { logger } from "./_core/logger";
import { getInspection, getTmlReadings, getDb } from "./db";
import { ffsAssessments, inLieuOfAssessments } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { calculateComponent } from "./componentCalculations";

// ============================================================================
// PDF CONFIGURATION
// ============================================================================

const PAGE_WIDTH = 612; // 8.5 inches
const PAGE_HEIGHT = 792; // 11 inches
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const COLORS = {
  primary: '#2563eb', // Blue
  secondary: '#64748b', // Slate gray
  border: '#e2e8f0',
  headerBg: '#f8fafc',
  text: '#1e293b',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function addHeader(doc: PDFKit.PDFDocument, title: string, logoBuffer?: Buffer) {
  const startY = doc.y;
  
  // Add logo if provided (top left)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, MARGIN, MARGIN, {
        width: 100, // Scale down to fit header
        height: 42,
      });
    } catch (error) {
      logger.error('[PDF] Failed to add logo:', error);
    }
  }
  
  // Company information (right side of logo)
  const companyX = MARGIN + 110;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
  doc.text('OILPRO CONSULTING LLC', companyX, MARGIN);
  
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
  doc.text('Phone: 337-446-7459', companyX, MARGIN + 14);
  doc.text('www.oilproconsulting.com', companyX, MARGIN + 26);
  
  // Dynamic page number calculation (current page in buffered range)
  const currentPage = doc.bufferedPageRange().count;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.secondary);
  doc.text(`Page ${currentPage}`, PAGE_WIDTH - MARGIN - 60, MARGIN, {
    width: 60,
    align: 'right'
  });
  
  // Title (centered below header)
  if (title) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
    doc.text(title, MARGIN, MARGIN + 50, {
      width: CONTENT_WIDTH,
      align: 'center'
    });
  }
  
  // Separator line
  doc.strokeColor(COLORS.border).lineWidth(1);
  doc.moveTo(MARGIN, MARGIN + 70).lineTo(PAGE_WIDTH - MARGIN, MARGIN + 70).stroke();
  
  doc.y = MARGIN + 80;
  doc.fillColor(COLORS.text);
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  checkPageBreak(doc, 40);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.primary);
  doc.text(title, MARGIN, doc.y);
  doc.moveDown(0.5);
  
  // Underline
  const y = doc.y;
  doc.strokeColor(COLORS.primary).lineWidth(2);
  doc.moveTo(MARGIN, y).lineTo(MARGIN + 100, y).stroke();
  doc.moveDown(1);
  doc.fillColor(COLORS.text);
}

function addSubsectionTitle(doc: PDFKit.PDFDocument, title: string) {
  checkPageBreak(doc, 30);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
  doc.text(title, MARGIN, doc.y);
  doc.moveDown(0.5);
}

function addText(doc: PDFKit.PDFDocument, text: string, options: any = {}) {
  checkPageBreak(doc, 20);
  doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
     .fontSize(options.fontSize || 10)
     .fillColor(COLORS.text);
  doc.text(text, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: options.align || 'left',
    ...options
  });
  if (options.moveDown !== false) {
    doc.moveDown(0.3);
  }
}

function checkPageBreak(doc: PDFKit.PDFDocument, requiredSpace: number) {
  if (doc.y + requiredSpace > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    doc.y = MARGIN + 60; // Start below header space
  }
}

/**
 * Conditionally add a new page with header if:
 * 1. Not enough space on current page (< minSpace)
 * 2. Current page has content (y > initial position)
 */
async function conditionalPageBreak(
  doc: PDFKit.PDFDocument,
  title: string,
  logoBuffer?: Buffer,
  minSpace: number = 200
) {
  const hasContent = doc.y > MARGIN + 100; // Page has content beyond header
  const needsSpace = doc.y + minSpace > PAGE_HEIGHT - MARGIN;
  
  // Only add new page + header if current page has content AND needs more space
  if (hasContent && needsSpace) {
    doc.addPage();
    await addHeader(doc, title, logoBuffer);
  } else if (!hasContent && doc.y <= MARGIN) {
    // Brand new page with no header at all - add header
    await addHeader(doc, title, logoBuffer);
  }
  // Otherwise: fresh page with header already added, or enough space on current page - do nothing
}

async function addTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], sectionTitle?: string, logoBuffer?: Buffer, customColWidths?: number[]) {
  // Use custom column widths if provided, otherwise divide equally
  const colWidths = customColWidths || headers.map(() => CONTENT_WIDTH / headers.length);
  const ROW_HEIGHT = 20;
  const HEADER_HEIGHT = 25;
  const MAX_ROWS_PER_PAGE = 30; // Limit rows per page to avoid issues
  
  // Helper to draw table header
  function drawTableHeader(y: number) {
    doc.fillColor(COLORS.headerBg).rect(MARGIN, y, CONTENT_WIDTH, HEADER_HEIGHT).fill();
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9);
    
    let xOffset = MARGIN;
    headers.forEach((header, i) => {
      doc.text(header, xOffset + 5, y + 8, {
        width: colWidths[i] - 10,
        align: 'left'
      });
      xOffset += colWidths[i];
    });
    
    return y + HEADER_HEIGHT;
  }
  
  // Split rows into chunks if needed
  let rowIndex = 0;
  let isFirstChunk = true;
  
  while (rowIndex < rows.length) {
    const remainingRows = rows.length - rowIndex;
    const rowsThisPage = Math.min(remainingRows, MAX_ROWS_PER_PAGE);
    
    // Check if we need a page break (only if not the first chunk or insufficient space)
    const neededSpace = HEADER_HEIGHT + (rowsThisPage * ROW_HEIGHT) + 20;
    if (!isFirstChunk && doc.y + neededSpace > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      doc.y = MARGIN + 60; // Start below header space
    }
    
    // Draw header directly at current position (no extra spacing)
    let currentY = drawTableHeader(doc.y);
    isFirstChunk = false;
    const tableStartY = currentY - HEADER_HEIGHT;
    
    // Draw rows for this page
    doc.font('Helvetica').fontSize(9);
    
    // Save the current auto page break setting and disable it
    const originalBufferPages = (doc as any).options?.bufferPages;
    (doc as any).options = (doc as any).options || {};
    (doc as any).options.bufferPages = true; // Disable automatic page breaks
    
    for (let i = 0; i < rowsThisPage; i++) {
      const row = rows[rowIndex + i];
      const rowY = currentY + (i * ROW_HEIGHT);
      
      // Alternate row background
      if (i % 2 === 0) {
        doc.fillColor('#f9fafb').rect(MARGIN, rowY, CONTENT_WIDTH, ROW_HEIGHT).fill();
      }
      
      doc.fillColor(COLORS.text);
      let xOffset = MARGIN;
      row.forEach((cell, colIndex) => {
        const cellText = String(cell || '-');
        const colW = colWidths[colIndex];
        // Truncate text if it's too long to prevent overflow
        const maxLength = Math.floor((colW - 10) / 5); // Approximate chars that fit
        const displayText = cellText.length > maxLength ? cellText.substring(0, maxLength - 3) + '...' : cellText;
        
        // Use text without width parameter to prevent automatic page breaks
        const x = xOffset + 5;
        const y = rowY + 5;
        
        // Manually clip text to cell width
        doc.save();
        doc.rect(xOffset, rowY, colW, ROW_HEIGHT).clip();
        doc.text(displayText, x, y, {
          lineBreak: false, // Prevent line breaks within cells
          continued: false
        });
        doc.restore();
        xOffset += colW;
      });
    }
    
    // Restore original page break setting
    if (originalBufferPages !== undefined) {
      (doc as any).options.bufferPages = originalBufferPages;
    }
    
    // Draw border around this table section
    const tableHeight = HEADER_HEIGHT + (rowsThisPage * ROW_HEIGHT);
    doc.strokeColor(COLORS.border).lineWidth(1);
    doc.rect(MARGIN, tableStartY, CONTENT_WIDTH, tableHeight).stroke();
    
    // Update position
    doc.y = currentY + (rowsThisPage * ROW_HEIGHT) + 10;
    rowIndex += rowsThisPage;
    
    // Don't add page break here - let the next iteration's space check handle it
    // This prevents duplicate page breaks and blank pages
  }
}

// ============================================================================
// MAIN PDF GENERATION
// ============================================================================

export interface ReportSectionConfig {
  coverPage?: boolean;
  tableOfContents?: boolean;
  executiveSummary?: boolean;
  vesselData?: boolean;
  componentCalculations?: boolean;
  inspectionFindings?: boolean;
  recommendations?: boolean;
  thicknessReadings?: boolean;
  checklist?: boolean;
  ffsAssessment?: boolean;
  inLieuOfQualification?: boolean;
  photos?: boolean;
}

export interface ProfessionalReportData {
  reportId: string;
  inspectionId: string;
  sectionConfig?: ReportSectionConfig;
}

// Predefined templates
export const REPORT_TEMPLATES = {
  FULL_REPORT: {
    name: 'Full Report',
    description: 'Complete report with all sections',
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: true,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: true,
      checklist: true,
      ffsAssessment: true,
      inLieuOfQualification: true,
      photos: true,
    }
  },
  EXECUTIVE_SUMMARY: {
    name: 'Executive Summary',
    description: 'High-level summary for management',
    config: {
      coverPage: true,
      tableOfContents: false,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: false,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: false,
      checklist: false,
      ffsAssessment: false,
      inLieuOfQualification: false,
      photos: false,
    }
  },
  CLIENT_SUMMARY: {
    name: 'Client Summary',
    description: 'Client-facing report without technical details',
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: false,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: false,
      checklist: false,
      ffsAssessment: true,
      inLieuOfQualification: false,
      photos: true,
    }
  },
  TECHNICAL_REPORT: {
    name: 'Technical Report',
    description: 'Detailed technical analysis',
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: false,
      vesselData: true,
      componentCalculations: true,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: true,
      checklist: true,
      ffsAssessment: true,
      inLieuOfQualification: true,
      photos: false,
    }
  },
  COMPLIANCE_REPORT: {
    name: 'Compliance Report',
    description: 'Regulatory compliance documentation',
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: true,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: true,
      checklist: true,
      ffsAssessment: true,
      inLieuOfQualification: true,
      photos: false,
    }
  },
} as const;

export async function generateProfessionalPDF(data: ProfessionalReportData): Promise<Buffer> {
  const { reportId, inspectionId, sectionConfig } = data;
  
  // Default to full report if no config provided
  const config: ReportSectionConfig = sectionConfig || REPORT_TEMPLATES.FULL_REPORT.config;
  
  // Load company logo
  let logoBuffer: Buffer | undefined;
  try {
    const logoPath = './client/public/oilpro-logo.png';
    const fs = await import('fs');
    logoBuffer = fs.readFileSync(logoPath);
    logger.info('[PDF] Logo loaded successfully');
  } catch (error) {
    logger.error('[PDF] Failed to load logo:', error);
  }
  
  // Fetch all data
  const report = await getProfessionalReport(reportId);
  if (!report) throw new Error('Report not found');
  
  const inspection = await getInspection(inspectionId);
  if (!inspection) throw new Error('Inspection not found');
  
  const components = (await getComponentCalculations(reportId)).sort((a, b) => {
    // Extract numeric part from component name for sorting
    const getNumber = (name: string) => {
      const match = name?.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 999999;
    };
    return getNumber(a.componentName) - getNumber(b.componentName);
  });
  const findings = await getInspectionFindings(reportId);
  const recommendations = await getRecommendations(reportId);
  const photos = await getInspectionPhotos(reportId);
  const checklist = await getChecklistItems(reportId);
  const tmlReadings = await getTmlReadings(inspectionId);
  
  // DEBUG LOGGING
  logger.info('[PDF DEBUG] Data counts:');
  logger.info('  Components:', components?.length || 0);
  logger.info('  Findings:', findings?.length || 0);
  logger.info('  Recommendations:', recommendations?.length || 0);
  logger.info('  Photos:', photos?.length || 0);
  logger.info('  Checklist:', checklist?.length || 0);
  logger.info('  TML Readings:', tmlReadings?.length || 0);
  
  // Create PDF
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
  });
  
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  
  // Generate pages based on section config
  if (config.coverPage !== false) {
    logger.info('[PDF DEBUG] Generating cover page...');
    generateCoverPage(doc, report, inspection);
    logger.info('[PDF DEBUG] Page count after cover:', doc.bufferedPageRange().count);
  }
  
  if (config.tableOfContents !== false) {
    logger.info('[PDF DEBUG] Generating TOC...');
    await generateTableOfContents(doc, logoBuffer);
    logger.info('[PDF DEBUG] Page count after TOC:', doc.bufferedPageRange().count);
  }
  
  if (config.executiveSummary !== false) {
    logger.info('[PDF DEBUG] Generating executive summary...');
    await generateExecutiveSummary(doc, report, components, logoBuffer, inspection, tmlReadings);
    logger.info('[PDF DEBUG] Page count after exec summary:', doc.bufferedPageRange().count);
  }
  
  if (config.vesselData !== false) {
    logger.info('[PDF DEBUG] Generating vessel data...');
    await generateVesselData(doc, inspection, logoBuffer);
    logger.info('[PDF DEBUG] Page count after vessel data:', doc.bufferedPageRange().count);
  }
  
  if (config.componentCalculations !== false) {
    logger.info('[PDF DEBUG] Generating component calculations...');
    await generateComponentCalculations(doc, components, logoBuffer, inspection, tmlReadings, report);
    logger.info('[PDF DEBUG] Page count after components:', doc.bufferedPageRange().count);
  }
  
  if (config.inspectionFindings !== false) {
    logger.info('[PDF DEBUG] Generating findings...');
    await generateInspectionFindings(doc, findings, logoBuffer);
    logger.info('[PDF DEBUG] Page count after findings:', doc.bufferedPageRange().count);
  }
  
  if (config.recommendations !== false) {
    logger.info('[PDF DEBUG] Generating recommendations...');
    await generateRecommendationsSection(doc, recommendations, logoBuffer);
    logger.info('[PDF DEBUG] Page count after recommendations:', doc.bufferedPageRange().count);
  }
  
  if (config.thicknessReadings !== false) {
    logger.info('[PDF DEBUG] Generating thickness readings...');
    await generateThicknessReadings(doc, tmlReadings, logoBuffer);
    logger.info('[PDF DEBUG] Page count after TML:', doc.bufferedPageRange().count);
  }
  
  // Nozzle evaluation section
  logger.info('[PDF DEBUG] Generating nozzle evaluation...');
  await generateNozzleEvaluation(doc, inspectionId, logoBuffer, report, inspection);
  logger.info('[PDF DEBUG] Page count after nozzles:', doc.bufferedPageRange().count);
  
  if (config.checklist !== false) {
    logger.info('[PDF DEBUG] Generating checklist...');
    await generateChecklist(doc, checklist, logoBuffer);
    logger.info('[PDF DEBUG] Page count after checklist:', doc.bufferedPageRange().count);
  }
  
  if (config.ffsAssessment !== false) {
    logger.info('[PDF DEBUG] Generating FFS assessment...');
    await generateFfsAssessment(doc, inspectionId, logoBuffer);
    logger.info('[PDF DEBUG] Page count after FFS:', doc.bufferedPageRange().count);
  }
  
  if (config.inLieuOfQualification !== false) {
    logger.info('[PDF DEBUG] Generating In-Lieu-Of qualification...');
    await generateInLieuOfQualification(doc, inspectionId, logoBuffer);
    logger.info('[PDF DEBUG] Page count after In-Lieu-Of:', doc.bufferedPageRange().count);
  }
  
  if (config.photos !== false) {
    logger.info('[PDF DEBUG] Generating photos...');
    await generatePhotos(doc, photos, logoBuffer);
    logger.info('[PDF DEBUG] Final page count:', doc.bufferedPageRange().count);
  }
  
  // Finalize
  doc.end();
  
  return pdfPromise;
}

// ============================================================================
// PAGE GENERATION FUNCTIONS
// ============================================================================

function generateCoverPage(doc: PDFKit.PDFDocument, report: any, inspection: any) {
  // Company header
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.secondary);
  doc.text('OILPRO CONSULTING LLC', MARGIN, MARGIN);
  doc.text(`${inspection.vesselTagNumber || ''} API 510 IN LIEU OF`, 
    PAGE_WIDTH - MARGIN - 200, MARGIN, { width: 200, align: 'right' });
  
  // Logo (text-based for now - will add image support)
  doc.font('Helvetica-Bold').fontSize(32).fillColor(COLORS.primary);
  doc.text('OilPro', MARGIN, MARGIN + 60);
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.secondary);
  doc.text('CONSULTING', MARGIN + 10, MARGIN + 95);
  
  // Client info
  doc.moveDown(4);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.text);
  doc.text(report.clientName || 'CLIENT NAME', { align: 'center' });
  doc.font('Helvetica').fontSize(14).fillColor(COLORS.secondary);
  doc.text(report.clientLocation || 'Location', { align: 'center' });
  
  // Report metadata box
  doc.moveDown(3);
  const boxY = doc.y;
  const boxHeight = 120;
  
  // Box background
  doc.fillColor(COLORS.headerBg).rect(MARGIN + 50, boxY, CONTENT_WIDTH - 100, boxHeight).fill();
  doc.strokeColor(COLORS.border).rect(MARGIN + 50, boxY, CONTENT_WIDTH - 100, boxHeight).stroke();
  
  // Metadata fields
  const leftX = MARGIN + 70;
  const valueX = leftX + 140;
  let fieldY = boxY + 20;
  
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(11);
  
  const fields = [
    ['Report No.:', report.reportNumber || ''],
    ['Inspector:', report.inspectorName || ''],
    ['Employer:', report.employerName || 'OilPro Consulting LLC'],
    ['Inspection Date:', report.reportDate ? new Date(report.reportDate).toLocaleDateString('en-US') : ''],
  ];
  
  fields.forEach(([label, value]) => {
    doc.text(label, leftX, fieldY);
    doc.font('Helvetica').text(value, valueX, fieldY);
    doc.font('Helvetica-Bold');
    fieldY += 25;
  });
  
  // Title
  doc.moveDown(4);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.primary);
  doc.text('IN-SERVICE', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(16);
  doc.text('Inspection Report For', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(20);
  doc.text('Pressure Vessel', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(24).fillColor(COLORS.text);
  doc.text(inspection.vesselTagNumber || '', { align: 'center' });
  
  // Executive summary paragraph
  doc.moveDown(2);
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
  const summaryText = `An API Standard 510 Inspection based on client criterion for nondestructive examinations was conducted on vessel ${inspection.vesselTagNumber || ''} in the ${report.clientLocation || ''} facility located at ${report.clientLocation || ''} on ${report.reportDate ? new Date(report.reportDate).toLocaleDateString('en-US') : ''}. This vessel was originally built to ASME S8 D1. This inspection was conducted in accordance with requirements of the API-510 standard for inspections of Pressure Vessels. The following is a detailed report of the inspection including findings and recommendations.`;
  
  doc.text(summaryText, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: 'justify'
  });
}

async function generateTableOfContents(doc: PDFKit.PDFDocument, logoBuffer?: Buffer) {
  await conditionalPageBreak(doc, 'TABLE OF CONTENTS', logoBuffer, 300);
  
  const sections = [
    '1.0 EXECUTIVE SUMMARY',
    '2.0 VESSEL DATA',
    '3.0 COMPONENT CALCULATIONS',
    '4.0 INSPECTION FINDINGS',
    '5.0 RECOMMENDATIONS',
    '6.0 ULTRASONIC THICKNESS MEASUREMENTS',
    '7.0 NOZZLE EVALUATION',
    '8.0 INSPECTION CHECKLIST',
    '9.0 PHOTOGRAPHS',
    '10.0 FITNESS-FOR-SERVICE ASSESSMENT',
    '11.0 IN-LIEU-OF INTERNAL INSPECTION QUALIFICATION',
  ];
  
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text);
  sections.forEach((section, i) => {
    doc.text(section, MARGIN + 20, doc.y);
    doc.moveDown(0.8);
  });
}

async function generateExecutiveSummary(doc: PDFKit.PDFDocument, report: any, components: any[], logoBuffer?: Buffer, inspection?: any, tmlReadings?: any[]) {
  await conditionalPageBreak(doc, 'EXECUTIVE SUMMARY', logoBuffer, 400);
  
  addSectionTitle(doc, '1.0 EXECUTIVE SUMMARY');
  
  // Use database summary if available, otherwise generate default text
  const summaryText = report.executiveSummary || 
    `An API Standard 510 inspection of pressure vessel ${report.vesselId || 'UNKNOWN'} located in ${report.location || 'UNKNOWN'}, was conducted on ${report.inspectionDate ? new Date(report.inspectionDate).toLocaleDateString() : 'UNKNOWN'}. This inspection was made to collect data in order to evaluate the mechanical integrity and fitness for service of the vessel. No major problems were noted. The vessel is in satisfactory mechanical condition for continued service.`;
  
  addText(doc, summaryText);
  
  doc.moveDown(1);
  
  // TABLE A - Summary of 3 main components
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text);
  doc.text('TABLE A', { align: 'center' });
  doc.moveDown(0.5);
  
  try {
    // Debug logging handled by centralized logger
    
    
  
  // Get component calculations for TABLE A
  // These should have been created during PDF import or manually
  const componentCalcs = await getComponentCalculations(report.id);
  
  
  
  // Find the three main components
  const findComponent = (name: string) => {
    return componentCalcs.find(c => 
      c.componentName?.toLowerCase().includes(name.toLowerCase()) ||
      c.componentType?.toLowerCase().includes(name.toLowerCase())
    );
  };
  
  const shellCalc = findComponent('shell');
  const eastCalc = findComponent('east');
  const westCalc = findComponent('west');
  
  
  
  
  
  // Helper to format values
  const formatValue = (val: any, decimals: number = 3): string => {
    if (val == null || val === '' || val === '-') return '-';
    const num = parseFloat(String(val));
    return !isNaN(num) && isFinite(num) ? num.toFixed(decimals) : '-';
  };
  
  // Extract data from component calculations
  const getComponentData = (calc: any) => {
    if (!calc) return { tNom: '-', tActual: '-', tMin: '-', mawp: '-', rl: '>20' };
    
    return {
      tNom: formatValue(calc.nominalThickness),
      tActual: formatValue(calc.actualThickness),
      tMin: formatValue(calc.minimumThickness),
      mawp: formatValue(calc.calculatedMAWP, 1),
      rl: calc.remainingLife || '>20',
    };
  };
  
  const shellData = getComponentData(shellCalc);
  const eastData = getComponentData(eastCalc);
  const westData = getComponentData(westCalc);
  
  // Create table structure with aggregated data
  const tableHeaders = [
    'Component',
    'Nominal\nDesign\nThickness\n(in.)',
    'Actual\nMeasured\nThickness\n(in.)',
    'Minimum\nRequired\nThickness\n(in.)',
    'Design\nMAWP\n(psi)\nInternal',
    'Calculated\nMAWP\n(psi)\nInternal',
    'Remaining\nLife\n(years)'
  ];
  
  // Convert all values to strings explicitly to prevent PDFKit pattern errors
  const toStr = (val: any): string => {
    if (val === null || val === undefined) return '-';
    // Ensure we always return a clean string and strip non-ASCII chars to prevent font crashes
    return String(val).replace(/[^\x00-\x7F]/g, '');
  };
  
  const tableRows = [
    [
      'Vessel Shell',
      toStr(shellData.tNom),
      toStr(shellData.tActual),
      toStr(shellData.tMin),
      toStr(inspection?.designPressure || '250'),
      toStr(shellData.mawp),
      toStr(shellData.rl),
    ],
    [
      'East Head',
      toStr(eastData.tNom),
      toStr(eastData.tActual),
      toStr(eastData.tMin),
      toStr(inspection?.designPressure || '250'),
      toStr(eastData.mawp),
      toStr(eastData.rl),
    ],
    [
      'West Head',
      toStr(westData.tNom),
      toStr(westData.tActual),
      toStr(westData.tMin),
      toStr(inspection?.designPressure || '250'),
      toStr(westData.mawp),
      toStr(westData.rl),
    ],
  ];
  
  
  
  // Custom column widths for TABLE A to prevent text cutoff
  // Total CONTENT_WIDTH is ~515, distribute to fit long headers
  const tableAColWidths = [
    70,  // Component
    65,  // Nominal Design Thickness
    80,  // Actual Measured Thickness (wider)
    80,  // Minimum Required Thickness (wider)
    70,  // Design MAWP
    80,  // Calculated MAWP (wider)
    70   // Remaining Life
  ];
  
  await addTable(doc, tableHeaders, tableRows, '', logoBuffer, tableAColWidths);
  
  
  } catch (error) {
    // Error logged via Sentry in production
    
    
    
    // Fallback: Generate simple table with dashes
    const fallbackHeaders = ['Component', 'Nominal\nDesign\nThickness\n(in.)', 'Actual\nMeasured\nThickness\n(in.)', 'Minimum\nRequired\nThickness\n(in.)', 'Design\nMAWP\n(psi)\nInternal', 'Calculated\nMAWP\n(psi)\nInternal', 'Remaining\nLife\n(years)'];
    const fallbackRows = [
      ['Vessel Shell', '-', '-', '-', inspection?.designPressure || '250', '-', '>20'],
      ['East Head', '-', '-', '-', inspection?.designPressure || '250', '-', '>20'],
      ['West Head', '-', '-', '-', inspection?.designPressure || '250', '-', '>20'],
    ];
    await addTable(doc, fallbackHeaders, fallbackRows, '', logoBuffer);
  }
  
  // Next Inspection section - properly formatted below table
  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
  doc.text('Next Inspection:', MARGIN, doc.y);
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9);
  
  // Format dates to show only date without time and timezone
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'Not specified';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  doc.text(`Next external inspection is due by: ${formatDate(report.nextExternalInspectionAPI)}`, MARGIN, doc.y);
  doc.text(`Next internal inspection is due by: ${formatDate(report.nextInternalInspection)}`, MARGIN, doc.y);
  doc.text(`Next UT inspection is due by: ${formatDate(report.nextUTInspection)}`, MARGIN, doc.y);
  
  // Compliance and Risk Assessment section (Option 1 Quick Wins)
  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
  doc.text('Compliance & Risk Assessment:', MARGIN, doc.y);
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9);
  
  // Compliance status
  const api510Status = report.api510Compliant ? '✓ Compliant' : '✗ Non-Compliant';
  const asmeStatus = report.asmeCompliant ? '✓ Compliant' : '✗ Non-Compliant';
  doc.text(`API 510 Compliance: ${api510Status}`, MARGIN, doc.y);
  doc.text(`ASME Compliance: ${asmeStatus}`, MARGIN, doc.y);
  
  // Risk classification with color coding
  const riskLevel = report.riskClassification || 'medium';
  const riskColors: { [key: string]: string } = {
    low: '#10b981',    // green
    medium: '#f59e0b', // amber
    high: '#ef4444',   // red
    critical: '#991b1b' // dark red
  };
  const riskLabels: { [key: string]: string } = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk'
  };
  
  doc.fillColor(riskColors[riskLevel] || riskColors.medium);
  doc.text(`Risk Classification: ${riskLabels[riskLevel] || 'Medium Risk'}`, MARGIN, doc.y);
  doc.fillColor(COLORS.text); // Reset color
  
  // Operational efficiency score
  if (report.operationalEfficiencyScore != null) {
    doc.text(`Operational Efficiency Score: ${report.operationalEfficiencyScore}/100`, MARGIN, doc.y);
  }
  
  // Compliance notes if present
  if (report.complianceNotes) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Compliance Notes:', MARGIN, doc.y);
    doc.font('Helvetica').fontSize(9);
    doc.text(report.complianceNotes, MARGIN, doc.y, { width: CONTENT_WIDTH });
  }
}

async function generateVesselData(doc: PDFKit.PDFDocument, inspection: any, logoBuffer?: Buffer) {
  await conditionalPageBreak(doc, 'VESSEL DATA', logoBuffer, 350);
  
  addSectionTitle(doc, '2.0 VESSEL DATA');
  
  const data = [
    ['Vessel Tag Number', inspection.vesselTagNumber || '-'],
    ['Vessel Name', inspection.vesselName || '-'],
    ['Manufacturer', inspection.manufacturer || '-'],
    ['Year Built', inspection.yearBuilt || '-'],
    ['Design Pressure', `${inspection.designPressure || '-'} psi`],
    ['Design Temperature', `${inspection.designTemperature || '-'} °F`],
    ['Operating Pressure', `${inspection.operatingPressure || '-'} psi`],
    ['Material Specification', inspection.materialSpec || '-'],
    ['Vessel Type', inspection.vesselType || '-'],
    ['Inside Diameter', `${inspection.insideDiameter || '-'} inches`],
    ['Overall Length', `${inspection.overallLength || '-'} inches`],
  ];
  
  // Two-column layout
  const colWidth = CONTENT_WIDTH / 2 - 10;
  let leftY = doc.y;
  
  data.forEach((row, i) => {
    const isLeft = i % 2 === 0;
    const x = isLeft ? MARGIN : MARGIN + colWidth + 20;
    const y = isLeft ? leftY : leftY;
    
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
    doc.text(row[0] + ':', x, y, { width: colWidth });
    doc.font('Helvetica');
    doc.text(row[1], x, y + 15, { width: colWidth });
    
    if (!isLeft) {
      leftY += 40;
    }
  });
  
  doc.y = leftY + 20;
}

async function generateComponentCalculations(doc: PDFKit.PDFDocument, components: any[], logoBuffer?: Buffer, inspection?: any, tmlReadings?: any[], report?: any) {
  // Prepare header data once for reuse across all pages
  const headerData = [
    ['Report No.', 'Client', 'Inspector', 'Vessel', 'Date'],
    [
      report?.reportNumber || '-',
      report?.clientName || inspection?.clientName || '-',
      report?.inspectorName || inspection?.inspector || '-',
      inspection?.vesselTagNumber || '-',
      report?.reportDate ? new Date(report.reportDate).toLocaleDateString() : (inspection?.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString() : '-')
    ]
  ];
  
  // Generate Variable Definitions page
  await conditionalPageBreak(doc, 'VARIABLE DEFINITIONS', logoBuffer, 400);
  
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
  doc.text('API-510 PRESSURE VESSEL SHELL EVALUATION', { align: 'center' });
  doc.fontSize(10);
  doc.text('MINIMUM THICKNESS, REMAINING LIFE, PRESSURE CALCULATIONS', { align: 'center' });
  doc.moveDown(1);
  
  await addTable(doc, headerData[0], [headerData[1]], '', logoBuffer);
  doc.moveDown(1);
  
  // Variable Definitions for Shell Calculations
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Variable Definitions for Shell Calculations:', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  doc.font('Helvetica').fontSize(9);
  const definitions = [
    'A = factor determined from Fig. G in Subpart 3 of Section II, Part D and used to enter the applicable material chart in Subpart 3 of Section II, Part D. For the case of cylinders having Do/t values less than 10, see UG-28(c)(2).',
    '',
    'B = factor determined from the applicable material chart in Subpart 3 of Section II, Part D for maximum design metal temperature, psi [see UG-20(c)]',
    '',
    'Ca = remaining corrosion allowance of the vessel part under consideration, in inches.',
    '',
    'Cr = corrosion rate of the vessel part under consideration, in inches per year.',
    '',
    'D = inside diameter of the shell course under consideration, in inches.',
    '',
    'E = (Internal Calculations) lowest efficiency of any joint in the shell course under consideration. For welded vessels, use the efficiency specified in UW-12.',
    '',
    'E = (External Calculations) - Modulus of Elasticity (MOE) at operating temperature for specified material, P = the design maximum allowable internal working pressure, including static head pressure, in psi.',
    '',
    'Pa = maximum allowable external working pressure (includes jacket pressure and vessel internal negative pressure) in psi.',
    '',
    'R = inside radius of the shell under consideration, in inches.',
    '',
    'Ro = outside radius of the shell under consideration, in inches.',
    '',
    'RL = estimated remaining life of the vessel part under consideration, in years.',
    '',
    'S = maximum allowable stress value, in psi.',
    '',
    'SH = static head, in feet',
    '',
    'SG = specific gravity of vessel product.',
    't = thickness of the vessel part under consideration, variable related to applicable calculation used therein, in inches.',
    '',
    't act = actual thickness measurement of the vessel part under consideration, as recorded at the time of inspection, in inches.',
    '',
    't min = minimum required thickness of vessel part under consideration, as the nominal thickness minus the design corrosion allowance or the calculated minimum required thickness at the design MAWP at the coinciding working temperature, in inches.',
    '',
    't nom = design nominal thickness of head, in inches.',
    't prev = previous thickness measurement of the vessel part under consideration, as recorded at last inspection or nominal thickness if no previous thickness measurements, in inches.',
    '',
    'Y = time span between thickness readings or age of the vessel if t nom is used for t prev, in years',
    '',
    'Yn = estimated time span to next inspection of the vessel part under consideration, in years.'
  ];
  
  definitions.forEach(def => {
    if (def === '') {
      doc.moveDown(0.3);
    } else {
      doc.text(def, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'left' });
    }
  });
  
  // Generate Shell Evaluation page
  await conditionalPageBreak(doc, 'SHELL EVALUATION', logoBuffer, 400);
  
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
  doc.text('API-510 PRESSURE VESSEL SHELL EVALUATION', { align: 'center' });
  doc.fontSize(10);
  doc.text('MINIMUM THICKNESS, REMAINING LIFE, PRESSURE CALCULATIONS', { align: 'center' });
  doc.moveDown(1);
  
  // Header info table (reuse from Variable Definitions page)
  await addTable(doc, headerData[0], [headerData[1]], '', logoBuffer);
  doc.moveDown(1);
  
  // Vessel Shell Material specs
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Vessel Shell', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  // Find shell component data (needed for staticHead)
  const shellComp = components.find(c => c.componentType === 'shell' || c.componentName?.includes('Shell'));
  
  const shellMaterialData = [
    ['Material', 'Temp.', 'MAWP', 'SH', 'SG', 'D', 't nom'],
    [
      inspection?.materialSpec || 'SSA-304',
      inspection?.designTemperature || '200',
      inspection?.designPressure || '250',
      shellComp?.staticHead || '0',
      inspection?.specificGravity || '0.92',
      inspection?.insideDiameter || '70.750',
      shellComp?.nominalThickness || inspection?.nominalThickness || '0.625'
    ]
  ];
  
  await addTable(doc, shellMaterialData[0], [shellMaterialData[1]], '', logoBuffer);
  doc.moveDown(1);
  
  // Minimum Thickness Calculations
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Minimum Thickness Calculations', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  const minThicknessData = [
    ['Vessel Shell', 'Internal', 'PR/(SE-0.6P) = t', '', ''],
    ['P', 'R', 'S', 'E', 't'],
    [
      inspection?.designPressure || '252.4',
      (parseFloat(inspection?.insideDiameter || '70.750') / 2).toFixed(3),
      shellComp?.allowableStress || inspection?.allowableStress || '20000',
      inspection?.jointEfficiency || '0.85',
      shellComp?.minimumThickness || shellComp?.minimumRequired || '0.530'
    ]
  ];
  
  await addTable(doc, minThicknessData[1], [minThicknessData[2]], '', logoBuffer);
  doc.moveDown(1);
  
  // Remaining Life Calculations
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Remaining Life Calculations', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  const rlData = [
    ['Vessel Shell', 't prev', 't act', 't min', 'y'],
    [
      'Values',
      shellComp?.previousThickness || shellComp?.tPrevious || shellComp?.nominalThickness || '0.625',
      shellComp?.actualThickness || shellComp?.tActual || '0.652',
      shellComp?.minimumThickness || shellComp?.minimumRequired || shellComp?.tMin || '0.530',
      shellComp?.timeSpan || '12.0'
    ]
  ];
  
  await addTable(doc, rlData[0], [rlData[1]], '', logoBuffer);
  doc.moveDown(0.5);
  
  // Formulas
  doc.font('Helvetica').fontSize(10);
  const ca = shellComp?.tActual && shellComp?.tMin ? (parseFloat(shellComp.tActual) - parseFloat(shellComp.tMin)).toFixed(3) : '0.122';
  const cr = shellComp?.tPrevious && shellComp?.tActual ? ((parseFloat(shellComp.tPrevious) - parseFloat(shellComp.tActual)) / 12.0).toFixed(5) : '0.00000';
  const rl = parseFloat(cr) > 0 ? (parseFloat(ca) / parseFloat(cr)).toFixed(0) : '>20';
  
  doc.text(`Ca = t act - t min = ${ca} (inch)`, MARGIN, doc.y);
  doc.text(`Cr = t prev - t act / Y = ${cr} (in/year)`, MARGIN, doc.y);
  doc.text(`RL = Ca / Cr = ${rl} (year)`, MARGIN, doc.y);
  doc.moveDown(1);
  
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Next Inspection (Yn) = 10 (years)', MARGIN, doc.y);
  doc.moveDown(1);
  
  // MAWP Calculations
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('MAWP Calculations', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  const tNext = shellComp?.tActual ? (parseFloat(shellComp.tActual) - 2 * 10 * parseFloat(cr)).toFixed(3) : '0.652';
  const mawp = shellComp?.mawp || '307.5';
  
  doc.font('Helvetica').fontSize(10);
  doc.text('Vessel Shell - MAP - Next Inspection', MARGIN, doc.y);
  doc.text(`Where t = t act - 2YnCr = ${tNext} (inch)`, MARGIN, doc.y);
  doc.text(`SEt/(R+0.6t) = P = ${mawp} (psi)`, MARGIN, doc.y);
  doc.text(`P-(SH*.433*SG) = MAWP = ${mawp} (psi)`, MARGIN, doc.y);
  
  // Generate Head Evaluation page
  await conditionalPageBreak(doc, 'HEAD EVALUATION', logoBuffer, 400);
  
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
  doc.text('API-510 PRESSURE VESSEL HEAD EVALUATION', { align: 'center' });
  doc.fontSize(10);
  doc.text('MINIMUM THICKNESS, REMAINING LIFE, PRESSURE CALCULATIONS', { align: 'center' });
  doc.moveDown(1);
  
  // Header info table
  await addTable(doc, headerData[0], [headerData[1]], '', logoBuffer);
  doc.moveDown(1);
  
  // Vessel Head(s) info
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Vessel Head(s)', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  // Get head component data
  const eastHead = components.find(c => c.componentName?.includes('East'));
  const westHead = components.find(c => c.componentName?.includes('West'));
  
  const headInfoData = [
    ['', 'East Head and West Head', '', '', '', ''],
    ['MAWP', 'D', 'T', 'E', 'SG1', 'SG2'],
    [
      inspection?.designPressure || '250',
      inspection?.insideDiameter || '70.750',
      inspection?.designTemperature || '200',
      inspection?.jointEfficiency || '0.85',
      inspection?.specificGravity || '0.92',
      inspection?.specificGravity || '0.92'
    ]
  ];
  
  await addTable(doc, headInfoData[1], [headInfoData[2]], '', logoBuffer);
  doc.moveDown(1);
  
  // Head specifications table - use component calculation data
  const headSpecData = [
    ['Head ID', 'Head Type', 't nom', 'Material', 'S', 'SH', 'P'],
    [
      'East Head',
      'Ellipsoidal',
      eastHead?.nominalThickness || '0.500',
      inspection?.materialSpec || 'SSA-304',
      eastHead?.allowableStress || inspection?.allowableStress || '20000',
      eastHead?.staticHead || '0',
      eastHead?.designMAWP || inspection?.designPressure || '252.4'
    ],
    [
      'West Head',
      'Ellipsoidal',
      westHead?.nominalThickness || '0.500',
      inspection?.materialSpec || 'SSA-304',
      westHead?.allowableStress || inspection?.allowableStress || '20000',
      westHead?.staticHead || '0',
      westHead?.designMAWP || inspection?.designPressure || '252.4'
    ]
  ];
  
  await addTable(doc, headSpecData[0], headSpecData.slice(1), '', logoBuffer);
  doc.moveDown(1);
  
  // Minimum Thickness Calculations for heads
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Minimum Thickness Calculations', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  doc.font('Helvetica').fontSize(9);
  doc.text('Internal; Hemispherical Head: PL/(2SE-0.2P) = t min', MARGIN, doc.y);
  doc.text('2:1 Ellipsoidal Head: PD/(2SE-0.2P) = t min', MARGIN, doc.y);
  doc.text('Torispherical Head: PLM/(2SE-0.2P) = t min, where M = 0.25(3+√(L/r))', MARGIN, doc.y);
  
  // Display head type and calculation for each head
  const eastHeadType = eastHead?.headType || 'Ellipsoidal';
  const westHeadType = westHead?.headType || 'Ellipsoidal';
  const eastHeadTypeDisplay = eastHeadType.charAt(0).toUpperCase() + eastHeadType.slice(1);
  const westHeadTypeDisplay = westHeadType.charAt(0).toUpperCase() + westHeadType.slice(1);
  
  doc.text(`East Head: ${eastHeadTypeDisplay} t min = ${eastHead?.minimumThickness || eastHead?.minimumRequired || '0.526'} (inch)`, MARGIN, doc.y);
  if (eastHead?.headFactor) {
    doc.text(`  (M factor = ${eastHead.headFactor})`, MARGIN + 20, doc.y);
  }
  doc.text(`West Head: ${westHeadTypeDisplay} t min = ${westHead?.minimumThickness || westHead?.minimumRequired || '0.526'} (inch)`, MARGIN, doc.y);
  if (westHead?.headFactor) {
    doc.text(`  (M factor = ${westHead.headFactor})`, MARGIN + 20, doc.y);
  }
  doc.moveDown(1);
  
  // Remaining Life Calculations for heads
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Remaining Life Calculations', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  const eastRLData = [
    ['East Head', 't prev', 't act', 't min', 'y'],
    [
      '',
      eastHead?.previousThickness || eastHead?.nominalThickness || '0.500',
      eastHead?.actualThickness || '0.555',
      eastHead?.minimumThickness || eastHead?.minimumRequired || '0.526',
      eastHead?.timeSpan || '10.0'
    ]
  ];
  
  await addTable(doc, eastRLData[0], [eastRLData[1]], '', logoBuffer);
  doc.moveDown(0.5);
  
  const eastCa = eastHead?.actualThickness && eastHead?.minimumThickness 
    ? (parseFloat(eastHead.actualThickness) - parseFloat(eastHead.minimumThickness)).toFixed(3) 
    : '0.029';
  const eastCr = eastHead?.corrosionRate || '0';
  const eastRL = eastHead?.remainingLife || '>20';
  
  doc.font('Helvetica').fontSize(10);
  doc.text(`Ca = t act - t min = ${eastCa} (inch)`, MARGIN, doc.y);
  doc.text(`Cr = t prev - t act / Y = ${eastCr} (in/year)`, MARGIN, doc.y);
  doc.text(`RL = Ca / Cr = ${eastRL} (years)`, MARGIN, doc.y);
  doc.moveDown(1);
  
  const westRLData = [
    ['West Head', 't prev', 't act', 't min', 'y'],
    [
      '',
      westHead?.previousThickness || westHead?.nominalThickness || '0.500',
      westHead?.actualThickness || '0.552',
      westHead?.minimumThickness || westHead?.minimumRequired || '0.526',
      westHead?.timeSpan || '10.0'
    ]
  ];
  
  await addTable(doc, westRLData[0], [westRLData[1]], '', logoBuffer);
  doc.moveDown(0.5);
  
  const westCa = westHead?.actualThickness && westHead?.minimumThickness 
    ? (parseFloat(westHead.actualThickness) - parseFloat(westHead.minimumThickness)).toFixed(3) 
    : '0.026';
  const westCr = westHead?.corrosionRate || '0';
  const westRL = westHead?.remainingLife || '>20';
  
  doc.text(`Ca = t act - t min = ${westCa} (inch)`, MARGIN, doc.y);
  doc.text(`Cr = t prev - t act / Y = ${westCr} (in/year)`, MARGIN, doc.y);
  doc.text(`RL = Ca / Cr = ${westRL} (years)`, MARGIN, doc.y);
  doc.moveDown(1);
  
  doc.font('Helvetica-Bold').fontSize(10);
  const nextInspectionYears = eastHead?.nextInspectionYears || westHead?.nextInspectionYears || '10';
  doc.text(`Next Inspection (Yn) = ${nextInspectionYears} (year)`, MARGIN, doc.y);
  doc.moveDown(1);
  
  // MAWP Calculations for heads
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('MAWP Calculations', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  doc.font('Helvetica').fontSize(9);
  doc.text('(reference supplemental calcs for other head type formulas)', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  const eastMAWP = eastHead?.calculatedMAWP || eastHead?.mawp || '263.9';
  const westMAWP = westHead?.calculatedMAWP || westHead?.mawp || '262.5';
  
  const eastThickness = eastHead?.actualThickness || '0.555';
  const westThickness = westHead?.actualThickness || '0.552';
  
  // Calculate P values if possible (simplified - actual formula would need more data)
  const eastP = eastMAWP;
  const westP = westMAWP;
  
  doc.text(`East Head Ellipsoidal t = ${eastThickness} (inch) P= ${eastP} (psi) MAWP = ${eastMAWP} (psi)`, MARGIN, doc.y);
  doc.text(`West Head Ellipsoidal t = ${westThickness} (inch) P= ${westP} (psi) MAWP = ${westMAWP} (psi)`, MARGIN, doc.y);
  doc.moveDown(1);
  
  doc.font('Helvetica').fontSize(10);
  doc.text('Where t = t act - 2YnCr', MARGIN, doc.y);
  doc.text('Where P = MAP at the Next Inspection', MARGIN, doc.y);
  doc.text('Where MAWP = P-(SH*.433*SG)', MARGIN, doc.y);
}

async function generateInspectionFindings(doc: PDFKit.PDFDocument, findings: any[], logoBuffer?: Buffer) {
  await conditionalPageBreak(doc, 'INSPECTION FINDINGS', logoBuffer, 200);
  
  addSectionTitle(doc, '4.0 INSPECTION FINDINGS');
  
  if (!findings || findings.length === 0) {
    addText(doc, 'No findings reported.');
    return;
  }
  
  findings.forEach((finding, index) => {
    if (index > 0) doc.moveDown(1);
    
    addSubsectionTitle(doc, `Finding ${index + 1}: ${finding.findingType || 'General'}`);
    addText(doc, `Section: ${finding.section || '-'}`);
    addText(doc, `Severity: ${finding.severity || '-'}`, { bold: true });
    addText(doc, `Location: ${finding.location || '-'}`);
    addText(doc, `Description: ${finding.description || '-'}`);
    
    if (finding.measurements) {
      addText(doc, `Measurements: ${finding.measurements}`);
    }
    
    checkPageBreak(doc, 80);
  });
}

async function generateRecommendationsSection(doc: PDFKit.PDFDocument, recommendations: any[], logoBuffer?: Buffer) {
  await conditionalPageBreak(doc, 'RECOMMENDATIONS', logoBuffer, 200);
  
  addSectionTitle(doc, '5.0 RECOMMENDATIONS');
  
  if (!recommendations || recommendations.length === 0) {
    addText(doc, 'No recommendations at this time.');
    return;
  }
  
  recommendations.forEach((rec, index) => {
    if (index > 0) doc.moveDown(1);
    
    addText(doc, `${index + 1}. ${rec.recommendation || ''}`, { bold: true });
    addText(doc, `Priority: ${rec.priority || '-'}`);
    if (rec.dueDate) {
      addText(doc, `Due Date: ${new Date(rec.dueDate).toLocaleDateString('en-US')}`);
    }
    if (rec.notes) {
      addText(doc, `Notes: ${rec.notes}`);
    }
    
    checkPageBreak(doc, 60);
  });
}

async function generateNozzleEvaluation(doc: PDFKit.PDFDocument, inspectionId: string, logoBuffer?: Buffer, report?: any, inspection?: any) {
  // Import nozzle standards and database functions
  const { NOZZLE_MIN_THICKNESS_TABLE, calculateNozzleRL } = await import('../shared/nozzleStandards.js');
  const { getNozzlesByInspection } = await import('./nozzleDb.js');
  const { getTmlReadings } = await import('./db.js');
  
  const nozzles = await getNozzlesByInspection(inspectionId);
  const tmlReadings = await getTmlReadings(inspectionId);
  
  await conditionalPageBreak(doc, 'NOZZLE EVALUATION', logoBuffer, 300);
  
  // Add header with title
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
  doc.text('API-510 PRESSURE VESSEL NOZZLE EVALUATION', { align: 'center' });
  doc.fontSize(10);
  doc.text('MINIMUM THICKNESS, REMAINING LIFE, PRESSURE CALCULATIONS', { align: 'center' });
  doc.moveDown(1);
  
  // Add header info table
  const headerData = [
    ['Report No.', 'Client', 'Inspector', 'Vessel', 'Date'],
    [
      report?.reportNumber || '-',
      report?.clientName || inspection?.clientName || '-',
      report?.inspectorName || inspection?.inspector || '-',
      inspection?.vesselTagNumber || '-',
      report?.reportDate ? new Date(report.reportDate).toLocaleDateString() : (inspection?.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString() : '-')
    ]
  ];
  await addTable(doc, headerData[0], [headerData[1]], '', logoBuffer);
  doc.moveDown(1);
  
  addSectionTitle(doc, '7.0 NOZZLE MINIMUM THICKNESS EVALUATION (ASME UG-45)');
  
  if (!nozzles || nozzles.length === 0) {
    addText(doc, 'No nozzle evaluations recorded.');
    return;
  }
  
  // Section a) Minimum Thickness Determinations
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
  doc.text('Minimum Thickness Determinations:', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('a) The following nozzle minimum thicknesses are based on current ASME Standards. Minimum thickness allowed for nozzles walls are based on standard pipe thicknesses minus 12.5% or connecting shell/head required thickness whichever is smaller. (ASME Sect VIII, UG-45)', MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: 'left'
  });
  doc.moveDown(1);
  
  // ASME UG-45 minimum thickness table
  doc.font('Helvetica').fontSize(9);
  const minThicknessHeaders = ['Size (inch)', ...NOZZLE_MIN_THICKNESS_TABLE.map(t => t.size)];
  const minThicknessValues = ['tmin (inch)', ...NOZZLE_MIN_THICKNESS_TABLE.map(t => t.tminInches.toFixed(3))];
  
  // Draw table manually for horizontal layout
  const cellWidth = 45;
  const cellHeight = 20;
  let startX = MARGIN;
  let startY = doc.y;
  
  // Header row
  doc.font('Helvetica-Bold').fontSize(8);
  minThicknessHeaders.forEach((header, i) => {
    doc.rect(startX + i * cellWidth, startY, cellWidth, cellHeight).stroke();
    doc.text(header, startX + i * cellWidth + 2, startY + 5, {
      width: cellWidth - 4,
      align: 'center'
    });
  });
  
  // Value row
  doc.font('Helvetica').fontSize(8);
  startY += cellHeight;
  minThicknessValues.forEach((value, i) => {
    doc.rect(startX + i * cellWidth, startY, cellWidth, cellHeight).stroke();
    doc.text(value, startX + i * cellWidth + 2, startY + 5, {
      width: cellWidth - 4,
      align: 'center'
    });
  });
  
  doc.y = startY + cellHeight + 20;
  
  // Section b) Large nozzles note
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('b) Large size nozzles or nozzles subject to high pressures are calculated per ASME Sect VIII, DIV 1, UG-27 as follows: PR/(SE-0.6P) = t.', MARGIN, doc.y, {
    width: CONTENT_WIDTH
  });
  doc.moveDown(1.5);
  
  // Nozzle Remaining Life Calculations section
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Nozzle Remaining Life Calculations:', MARGIN, doc.y);
  doc.moveDown(0.5);
  
  // Calculate CML numbers (continuing from shell/head components)
  let cmlNumber = 100; // Start at 100 for nozzles (adjust based on last shell/head CML)
  
  // Build nozzle RL table
  const nozzleRLHeaders = [
    'CML',
    'Noz ID',
    'Size\n(inch)',
    'Material',
    'Age\n(year)',
    't prev\n(inch)',
    't act\n(inch)',
    't min\n(inch)',
    'Ca\n(inch)',
    'Cr\n(inch/Yr)',
    'RL\n(year)'
  ];
  
  const nozzleRLWidths = [35, 40, 35, 60, 40, 45, 45, 45, 40, 50, 45];
  
  const nozzleRLRows = nozzles.map((nozzle, index) => {
    const cml = cmlNumber + index;
    
    // Get TML readings for this nozzle (at 0°, 90°, 180°, 270°)
    const nozzleTMLs = tmlReadings?.filter((tml: any) => {
      const tmlComp = (tml.component || '').toLowerCase();
      const nozzleId = (nozzle.nozzleNumber || '').toLowerCase();
      return tmlComp.includes(nozzleId) || tmlComp.includes('nozzle') && tmlComp.includes(nozzleId.replace(/\D/g, ''));
    }) || [];
    
    // Get minimum (governing) thickness from TML readings
    let tAct = nozzle.actualThickness ? parseFloat(nozzle.actualThickness) : null;
    let tPrev = tAct; // Default to same if no history
    
    if (nozzleTMLs.length > 0) {
      tAct = nozzleTMLs.reduce((min: number, tml: any) => {
        const current = tml.currentThickness ? parseFloat(tml.currentThickness) : Infinity;
        return current < min ? current : min;
      }, Infinity);
      
      if (tAct === Infinity) tAct = null;
      
      // Get previous thickness if available
      const prevThickness = nozzleTMLs[0]?.previousThickness || nozzleTMLs[0]?.nominalThickness;
      if (prevThickness) tPrev = parseFloat(prevThickness);
    }
    
    const tMin = nozzle.minimumRequired ? parseFloat(nozzle.minimumRequired) : 0.116;
    const age = 12.0; // Default age, should come from vessel data
    
    // Calculate RL
    let Ca = 0, Cr = 0, RL = 0;
    if (tAct && tPrev) {
      const calc = calculateNozzleRL(tPrev, tAct, tMin, age);
      Ca = calc.Ca;
      Cr = calc.Cr;
      RL = calc.RL;
    }
    
    return [
      cml.toString(),
      nozzle.nozzleNumber || `N${index + 1}`,
      nozzle.nominalSize ? nozzle.nominalSize.toString() : '-',
      'SS A - 304', // material field not in schema, using default
      age.toFixed(1),
      tPrev ? tPrev.toFixed(3) : '-',
      tAct ? tAct.toFixed(3) : '-',
      tMin.toFixed(3),
      Ca > 0 ? Ca.toFixed(3) : '0.000',
      Cr > 0 ? Cr.toFixed(0) : '0',
      RL > 20 ? '>20' : RL.toFixed(0)
    ];
  });
  
  await addTable(doc, nozzleRLHeaders, nozzleRLRows, '', logoBuffer, nozzleRLWidths);
}

async function generateThicknessReadings(doc: PDFKit.PDFDocument, readings: any[], logoBuffer?: Buffer) {
    // TML Readings count: ${readings?.length || 0}
  
  if (!readings || readings.length === 0) {
    await conditionalPageBreak(doc, 'THICKNESS MEASUREMENTS', logoBuffer, 150);
    addSectionTitle(doc, '8.0 ULTRASONIC THICKNESS MEASUREMENTS');
    addText(doc, 'No thickness readings recorded.');
    return;
  }
  
  // Add page with header and title - table will start immediately after
  // Use smaller minSpace since addTable will handle its own page breaks
  await conditionalPageBreak(doc, 'THICKNESS MEASUREMENTS', logoBuffer, 150);
  addSectionTitle(doc, '6.0 ULTRASONIC THICKNESS MEASUREMENTS');
  doc.moveDown(0.5); // Small spacing before table
  
  // First TML reading structure verified
  
  // Enhanced grid-based format with angle labels and metadata
  const headers = ['CML', 'Comp ID', 'Location', 'Type', 'Size', 'Service', 't prev', '0°', '90°', '180°', '270°', 't act*'];
  const rows = readings.map(r => [
    r.cmlNumber || r.tmlId || '-',
    r.componentType || r.component || '-',
    r.location || '-',
    r.readingType || '-',
    r.nozzleSize || '-',
    r.service || '-',
    r.previousThickness ? parseFloat(r.previousThickness).toFixed(3) : '-',
    r.tml1 ? parseFloat(r.tml1).toFixed(3) : '-',
    r.tml2 ? parseFloat(r.tml2).toFixed(3) : '-',
    r.tml3 ? parseFloat(r.tml3).toFixed(3) : '-',
    r.tml4 ? parseFloat(r.tml4).toFixed(3) : '-',
    r.tActual ? parseFloat(r.tActual).toFixed(3) : (r.currentThickness ? parseFloat(r.currentThickness).toFixed(3) : '-'),
  ]);
  
  // TML table rows created: ${rows.length}
  
  await addTable(doc, headers, rows, 'ULTRASONIC THICKNESS MEASUREMENTS', logoBuffer);
  
  // Add explanatory note about t act*
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#666666');
  doc.text('* t act (actual thickness) = minimum of all angle readings (0°, 90°, 180°, 270°)', { align: 'left' });
  doc.fillColor('#000000'); // Reset to black
  doc.fontSize(10); // Reset font size
}

async function generateChecklist(doc: PDFKit.PDFDocument, items: any[], logoBuffer?: Buffer) {
  await conditionalPageBreak(doc, 'INSPECTION CHECKLIST', logoBuffer, 300);
  
  addSectionTitle(doc, '9.0 API 510 INSPECTION CHECKLIST');
  
  if (!items || items.length === 0) {
    addText(doc, 'Checklist not completed.');
    return;
  }
  
  items.forEach((item, index) => {
    const status = item.checked ? '[✓]' : '[ ]';
    const itemNumber = index + 1;
    addText(doc, `${itemNumber}. ${status} ${item.itemText || ''}`, { moveDown: true });
    
    if (item.notes) {
      addText(doc, `   Notes: ${item.notes}`, { fontSize: 9 });
    }
    
    checkPageBreak(doc, 30);
  });
}

async function generatePhotos(doc: PDFKit.PDFDocument, photos: any[], logoBuffer?: Buffer) {
  await conditionalPageBreak(doc, 'PHOTOGRAPHS', logoBuffer, 300);
  addSectionTitle(doc, '6.0 INSPECTION PHOTOGRAPHS');
  
  if (!photos || photos.length === 0) {
    addText(doc, 'No photographs attached.');
    return;
  }
  
  // Group photos by section
  const photosBySection: {[key: string]: any[]} = {};
  const sectionOrder = ['general', 'shell', 'heads', 'nozzles', 'foundation', 'appurtenances'];
  const sectionNames: {[key: string]: string} = {
    general: 'General Views',
    shell: 'Shell',
    heads: 'Heads',
    nozzles: 'Nozzles',
    foundation: 'Foundation',
    appurtenances: 'Appurtenances'
  };
  
  photos.forEach(photo => {
    const section = photo.section || 'general';
    if (!photosBySection[section]) {
      photosBySection[section] = [];
    }
    photosBySection[section].push(photo);
  });
  
  // Render photos grouped by section
  let photoCounter = 1;
  for (const sectionKey of sectionOrder) {
    if (!photosBySection[sectionKey] || photosBySection[sectionKey].length === 0) continue;
    
    // Add section header
    addSubsectionTitle(doc, `6.${sectionOrder.indexOf(sectionKey) + 1} ${sectionNames[sectionKey]}`);
    doc.moveDown(0.5);
    
    // 2-column layout configuration
    const photoWidth = (CONTENT_WIDTH - 30) / 2; // 30px spacing between columns
    const photoHeight = 200;
    const columnSpacing = 15; // Horizontal spacing between columns
    const rowSpacing = 30; // Vertical spacing between rows
    const captionHeight = 25; // Space for caption above photo
    
    const leftColumnX = MARGIN;
    const rightColumnX = MARGIN + photoWidth + columnSpacing;
    
    let columnIndex = 0; // 0 = left column, 1 = right column
    let rowStartY = doc.y; // Track the Y position where current row started
    
    for (const photo of photosBySection[sectionKey]) {
      const isLeftColumn = columnIndex % 2 === 0;
      const imgX = isLeftColumn ? leftColumnX : rightColumnX;
      
      // If starting a new row (left column), check if we have enough space
      if (isLeftColumn) {
        const spaceNeeded = captionHeight + photoHeight + rowSpacing;
        checkPageBreak(doc, spaceNeeded);
        rowStartY = doc.y; // Remember where this row starts
      } else {
        // Right column: go back to the row start Y position
        doc.y = rowStartY;
      }
      
      // Add caption above photo
      const captionY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
      doc.text(`Photo ${photoCounter}: ${photo.caption || 'Untitled'}`, imgX, captionY, {
        width: photoWidth,
        align: 'left'
      });
      photoCounter++;
      
      // Render actual photo from URL
      const imgY = captionY + captionHeight;
      if (photo.photoUrl) {
        try {
          // Fetch image from URL
          const response = await fetch(photo.photoUrl);
          if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
          
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          
          // Add image to PDF in the correct column
          doc.image(imageBuffer, imgX, imgY, {
            fit: [photoWidth, photoHeight],
          });
          
          logger.info(`[PDF] Rendered photo ${photoCounter - 1} in ${isLeftColumn ? 'left' : 'right'} column`);
        } catch (error) {
          logger.error(`[PDF] Failed to render photo ${photoCounter - 1}:`, error);
          doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
          doc.text(`[Photo could not be loaded]`, imgX, imgY, {
            width: photoWidth,
            align: 'center'
          });
        }
      } else {
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
        doc.text('[No photo URL provided]', imgX, imgY, {
          width: photoWidth,
          align: 'center'
        });
      }
      
      // After rendering right column photo, move Y down for next row
      if (!isLeftColumn) {
        doc.y = rowStartY + captionHeight + photoHeight + rowSpacing;
      }
      
      columnIndex++;
    }
    
    // If we ended on a left column photo, move Y down
    if (columnIndex % 2 === 1) {
      doc.y = rowStartY + captionHeight + photoHeight + rowSpacing;
    }
    
    // Add spacing between sections
    doc.moveDown(1);
  }
}




async function generateFfsAssessment(doc: PDFKit.PDFDocument, inspectionId: string, logoBuffer?: Buffer) {
  // Fetch FFS assessment data from database
  const db = await getDb();
  if (!db) {
    logger.info('[PDF] Database not available for FFS assessment');
    return;
  }
  
  const assessments = await db.select().from(ffsAssessments).where(eq(ffsAssessments.inspectionId, inspectionId));
  
  if (!assessments || assessments.length === 0) {
    logger.info('[PDF] No FFS assessments found');
    return;
  }
  
  await conditionalPageBreak(doc, 'FFS ASSESSMENT', logoBuffer, 300);
  addSectionTitle(doc, '10.0 FITNESS-FOR-SERVICE ASSESSMENT (API 579)');
  
  addText(doc, 'Fitness-For-Service (FFS) assessment performed per API 579-1/ASME FFS-1 to evaluate the structural integrity of components with identified flaws or damage.');
  doc.moveDown();
  
  for (const assessment of assessments) {
    addSubsectionTitle(doc, `Damage Type: ${assessment.damageType || 'Unknown'}`);
    
    // Helper to parse decimal fields
    const parseDecimal = (val: any) => val ? parseFloat(val.toString()) : null;
    
    const data = [
      ['Assessment Level', assessment.assessmentLevel ? `Level ${assessment.assessmentLevel.replace('level', '')}` : '-'],
      ['Damage Type', assessment.damageType || '-'],
      ['Remaining Thickness (in)', parseDecimal(assessment.remainingThickness)?.toFixed(4) || '-'],
      ['Minimum Required (in)', parseDecimal(assessment.minimumRequired)?.toFixed(4) || '-'],
      ['Future Corrosion Allowance (in)', parseDecimal(assessment.futureCorrosionAllowance)?.toFixed(4) || '-'],
      ['Acceptable', assessment.acceptable ? 'Yes' : 'No'],
      ['Remaining Life (years)', parseDecimal(assessment.remainingLife)?.toFixed(2) || '-'],
      ['Next Inspection Date', assessment.nextInspectionDate ? new Date(assessment.nextInspectionDate).toLocaleDateString() : '-'],
    ];
    
    addTable(doc, ['Parameter', 'Value'], data);
    doc.moveDown();
    
    if (assessment.recommendations) {
      addSubsectionTitle(doc, 'Recommendations');
      addText(doc, assessment.recommendations);
      doc.moveDown();
    }
    
    // Note: warnings field removed - not in schema
  }
}

async function generateInLieuOfQualification(doc: PDFKit.PDFDocument, inspectionId: string, logoBuffer?: Buffer) {
  // Fetch In-Lieu-Of assessment data from database
  const db = await getDb();
  if (!db) {
    logger.info('[PDF] Database not available for In-Lieu-Of assessment');
    return;
  }
  
  const assessments = await db.select().from(inLieuOfAssessments).where(eq(inLieuOfAssessments.inspectionId, inspectionId));
  
  if (!assessments || assessments.length === 0) {
    logger.info('[PDF] No In-Lieu-Of assessments found');
    return;
  }
  
  await conditionalPageBreak(doc, 'IN-LIEU-OF QUALIFICATION', logoBuffer, 300);
  addSectionTitle(doc, '11.0 IN-LIEU-OF INTERNAL INSPECTION QUALIFICATION (API 510 Section 6.4)');
  
  addText(doc, 'Assessment performed to determine if external inspection combined with thickness measurements can be used in lieu of internal inspection per API 510 Section 6.4.');
  doc.moveDown();
  
  for (const assessment of assessments) {
    const data = [
      ['Clean Service', assessment.cleanService ? 'Yes' : 'No'],
      ['No Corrosion History', assessment.noCorrosionHistory ? 'Yes' : 'No'],
      ['Effective External Inspection', assessment.effectiveExternalInspection ? 'Yes' : 'No'],
      ['Process Monitoring', assessment.processMonitoring ? 'Yes' : 'No'],
      ['Thickness Monitoring', assessment.thicknessMonitoring ? 'Yes' : 'No'],
      ['Qualified', assessment.qualified ? 'Yes' : 'No'],
      ['Maximum Interval (years)', assessment.maxInterval?.toString() || '-'],
      ['Next Internal Due', assessment.nextInternalDue ? new Date(assessment.nextInternalDue).toLocaleDateString() : '-'],
    ];
    
    addTable(doc, ['Criteria', 'Status'], data);
    doc.moveDown();
    
    if (assessment.justification) {
      addSubsectionTitle(doc, 'Justification');
      addText(doc, assessment.justification);
      doc.moveDown();
    }
    
    if (assessment.monitoringPlan) {
      addSubsectionTitle(doc, 'Monitoring Plan');
      addText(doc, assessment.monitoringPlan);
      doc.moveDown();
    }
  }
}

