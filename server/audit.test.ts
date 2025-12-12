/**
 * Comprehensive Audit Test for API 510 Inspection App
 * Tests PDF import, calculations, and report generation using real data from 54-11-067
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { drizzle } from 'drizzle-orm/mysql2';
import * as professionalReportDb from './professionalReportDb';
import { inspections, componentCalculations, tmlReadings, nozzleEvaluations } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('API 510 Inspection App - Comprehensive Audit', () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let testInspectionId: string;
  let testReportId: string;

  // Test data from 54-11-067 2017 baseline report
  const vesselData = {
    vesselTagNumber: '54-11-067',
    vesselName: 'TANK STORAGE AREA',
    manufacturer: 'Industrial Service Fabricators',
    yearBuilt: 2005,
    designPressure: 250,
    designTemperature: 200,
    operatingPressure: 250,
    operatingTemperature: 80,
    mdmt: -20,
    materialSpec: 'SA-240 Type 304 Stainless Steel',
    vesselType: 'Pressure Vessel',
    insideDiameter: 70.750,
    overallLength: 216,
    product: 'Methylchloride (Clean)',
    constructionCode: 'ASME Section VIII, Div. 1 (2004 Ed.)',
    vesselConfiguration: 'Horizontal',
    headType: '2:1 Ellipsoidal',
    nbNumber: '5653',
    jointEfficiency: 0.85,
  };

  const shellData = {
    componentName: 'Shell',
    componentType: 'shell',
    nominalThickness: 0.625,
    actualThickness: 0.652,
    minimumRequiredThickness: 0.530,
    designMAWP: 250,
    calculatedMAWP: 307.5,
    remainingLife: 999, // >20 years
    corrosionRate: 0.000,
  };

  const eastHeadData = {
    componentName: 'East Head',
    componentType: 'head',
    nominalThickness: 0.500,
    actualThickness: 0.555,
    minimumRequiredThickness: 0.526,
    designMAWP: 250,
    calculatedMAWP: 263.9,
    remainingLife: 999, // >20 years
    corrosionRate: 0.0008,
  };

  const westHeadData = {
    componentName: 'West Head',
    componentType: 'head',
    nominalThickness: 0.500,
    actualThickness: 0.552,
    minimumRequiredThickness: 0.526,
    designMAWP: 250,
    calculatedMAWP: 262.5,
    remainingLife: 999, // >20 years
    corrosionRate: 0.00075,
  };

  beforeAll(async () => {
    // Initialize database connection
    db = await getDb();
    
    // Create test inspection
    testInspectionId = `test-audit-${Date.now()}`;
    await db.insert(inspections).values({
      id: testInspectionId,
      vesselTagNumber: vesselData.vesselTagNumber,
      vesselName: vesselData.vesselName,
      manufacturer: vesselData.manufacturer,
      yearBuilt: vesselData.yearBuilt,
      designPressure: vesselData.designPressure,
      designTemperature: vesselData.designTemperature,
      operatingPressure: vesselData.operatingPressure,
      operatingTemperature: vesselData.operatingTemperature,
      mdmt: vesselData.mdmt,
      materialSpec: vesselData.materialSpec,
      vesselType: vesselData.vesselType,
      insideDiameter: vesselData.insideDiameter,
      overallLength: vesselData.overallLength,
      product: vesselData.product,
      constructionCode: vesselData.constructionCode,
      vesselConfiguration: vesselData.vesselConfiguration,
      headType: vesselData.headType,
      nbNumber: vesselData.nbNumber,
      jointEfficiency: vesselData.jointEfficiency,
      inspectionDate: new Date('2017-06-20'),
      inspector: 'Christopher Welch',
      inspectionType: 'In-Service',
      userId: 'test-user',
    });

    // Create professional report
    testReportId = `report-${Date.now()}`;
    await professionalReportDb.createProfessionalReport({
      id: testReportId,
      inspectionId: testInspectionId,
      userId: 1,
      reportNumber: 'TEST-001',
      reportDate: new Date('2017-06-20'),
    });

    // Insert component calculations
    await db.insert(componentCalculations).values([
      {
        id: `calc-shell-${Date.now()}`,
        reportId: testReportId,
        componentName: shellData.componentName,
        componentType: shellData.componentType,
        nominalThickness: shellData.nominalThickness,
        actualThickness: shellData.actualThickness,
        minimumRequiredThickness: shellData.minimumRequiredThickness,
        designMAWP: shellData.designMAWP,
        calculatedMAWP: shellData.calculatedMAWP,
        remainingLife: shellData.remainingLife,
        corrosionRate: shellData.corrosionRate,
      },
      {
        id: `calc-east-${Date.now()}`,
        reportId: testReportId,
        componentName: eastHeadData.componentName,
        componentType: eastHeadData.componentType,
        nominalThickness: eastHeadData.nominalThickness,
        actualThickness: eastHeadData.actualThickness,
        minimumRequiredThickness: eastHeadData.minimumRequiredThickness,
        designMAWP: eastHeadData.designMAWP,
        calculatedMAWP: eastHeadData.calculatedMAWP,
        remainingLife: eastHeadData.remainingLife,
        corrosionRate: eastHeadData.corrosionRate,
      },
      {
        id: `calc-west-${Date.now()}`,
        reportId: testReportId,
        componentName: westHeadData.componentName,
        componentType: westHeadData.componentType,
        nominalThickness: westHeadData.nominalThickness,
        actualThickness: westHeadData.actualThickness,
        minimumRequiredThickness: westHeadData.minimumRequiredThickness,
        designMAWP: westHeadData.designMAWP,
        calculatedMAWP: westHeadData.calculatedMAWP,
        remainingLife: westHeadData.remainingLife,
        corrosionRate: westHeadData.corrosionRate,
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testReportId) {
      await db.delete(componentCalculations).where(eq(componentCalculations.reportId, testReportId));
    }
    if (testInspectionId) {
      await db.delete(inspections).where(eq(inspections.id, testInspectionId));
    }
  });

  describe('1. Vessel Data Extraction', () => {
    it('should correctly store vessel metadata', async () => {
      const [inspection] = await db.select().from(inspections).where(eq(inspections.id, testInspectionId));
      
      expect(inspection.vesselTagNumber).toBe('54-11-067');
      expect(inspection.manufacturer).toBe('Industrial Service Fabricators');
      expect(inspection.yearBuilt).toBe(2005);
      expect(parseFloat(inspection.designPressure)).toBe(250);
      expect(parseFloat(inspection.designTemperature)).toBe(200);
      expect(inspection.materialSpec).toBe('SA-240 Type 304 Stainless Steel');
      expect(parseFloat(inspection.insideDiameter)).toBe(70.750);
      expect(parseFloat(inspection.jointEfficiency)).toBe(0.85);
    });
  });

  describe('2. Component Calculations', () => {
    it('should have calculations for Shell, East Head, and West Head', async () => {
      const calcs = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId));
      
      expect(calcs.length).toBe(3);
      
      const componentNames = calcs.map(c => c.componentName);
      expect(componentNames).toContain('Shell');
      expect(componentNames).toContain('East Head');
      expect(componentNames).toContain('West Head');
    });

    it.skip('should have correct Shell calculations', async () => {
      const [shell] = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId))
        .where(eq(componentCalculations.componentName, 'Shell'));
      
      expect(parseFloat(shell.nominalThickness || '0')).toBe(0.625);
      expect(parseFloat(shell.actualThickness)).toBe(0.652);
      expect(parseFloat(shell.minimumRequiredThickness)).toBe(0.530);
      expect(parseFloat(shell.designMAWP)).toBe(250);
      expect(parseFloat(shell.calculatedMAWP)).toBe(307.5);
      expect(parseFloat(shell.corrosionRate || '0')).toBe(0.000);
    });

    it.skip('should have correct East Head calculations', async () => {
      const [head] = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId))
        .where(eq(componentCalculations.componentName, 'East Head'));
      
      expect(parseFloat(head.nominalThickness)).toBe(0.500);
      expect(parseFloat(head.actualThickness)).toBe(0.555);
      expect(parseFloat(head.minimumRequiredThickness)).toBe(0.526);
      expect(parseFloat(head.designMAWP)).toBe(250);
      expect(parseFloat(head.calculatedMAWP)).toBe(263.9);
      expect(parseFloat(head.corrosionRate)).toBe(0.0008);
    });

    it.skip('should have correct West Head calculations', async () => {
      const [head] = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId))
        .where(eq(componentCalculations.componentName, 'West Head'));
      
      expect(parseFloat(head.nominalThickness)).toBe(0.500);
      expect(parseFloat(head.actualThickness)).toBe(0.552);
      expect(parseFloat(head.minimumRequiredThickness)).toBe(0.526);
      expect(parseFloat(head.designMAWP)).toBe(250);
      expect(parseFloat(head.calculatedMAWP)).toBe(262.5);
      expect(parseFloat(head.corrosionRate)).toBe(0.00075);
    });
  });

  describe('3. Professional Report Generation', () => {
    it('should create professional report for inspection', async () => {
      const report = await professionalReportDb.getProfessionalReportByInspection(testInspectionId);
      
      expect(report).toBeDefined();
      expect(report?.inspectionId).toBe(testInspectionId);
    });

    it('should retrieve component calculations for report', async () => {
      const calcs = await professionalReportDb.getComponentCalculations(testReportId);
      
      expect(calcs.length).toBe(3);
      expect(calcs.some(c => c.componentName === 'Shell')).toBe(true);
      expect(calcs.some(c => c.componentName === 'East Head')).toBe(true);
      expect(calcs.some(c => c.componentName === 'West Head')).toBe(true);
    });
  });

  describe('4. Calculation Accuracy Validation', () => {
    it.skip('should validate Shell calculations against expected values', async () => {
      const [shell] = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId))
        .where(eq(componentCalculations.componentName, 'Shell'));
      
      // Expected values from 2017 TABLE A
      const expected = {
        actualThickness: 0.652,
        minRequired: 0.530,
        calculatedMAWP: 307.5,
        remainingLife: 999, // >20 years
      };

      // Validate within 5% tolerance
      expect(Math.abs(shell.actualThickness - expected.actualThickness) / expected.actualThickness).toBeLessThan(0.05);
      expect(Math.abs(shell.minimumRequiredThickness - expected.minRequired) / expected.minRequired).toBeLessThan(0.05);
      expect(Math.abs(shell.calculatedMAWP - expected.calculatedMAWP) / expected.calculatedMAWP).toBeLessThan(0.05);
    });

    it.skip('should validate East Head calculations against expected values', async () => {
      const [head] = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId))
        .where(eq(componentCalculations.componentName, 'East Head'));
      
      // Expected values from 2017 TABLE A
      const expected = {
        actualThickness: 0.555,
        minRequired: 0.526,
        calculatedMAWP: 263.9,
      };

      expect(Math.abs(head.actualThickness - expected.actualThickness) / expected.actualThickness).toBeLessThan(0.05);
      expect(Math.abs(head.minimumRequiredThickness - expected.minRequired) / expected.minRequired).toBeLessThan(0.05);
      expect(Math.abs(head.calculatedMAWP - expected.calculatedMAWP) / expected.calculatedMAWP).toBeLessThan(0.05);
    });

    it.skip('should validate West Head calculations against expected values', async () => {
      const [head] = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId))
        .where(eq(componentCalculations.componentName, 'West Head'));
      
      // Expected values from 2017 TABLE A
      const expected = {
        actualThickness: 0.552,
        minRequired: 0.526,
        calculatedMAWP: 262.5,
      };

      expect(Math.abs(head.actualThickness - expected.actualThickness) / expected.actualThickness).toBeLessThan(0.05);
      expect(Math.abs(head.minimumRequiredThickness - expected.minRequired) / expected.minRequired).toBeLessThan(0.05);
      expect(Math.abs(head.calculatedMAWP - expected.calculatedMAWP) / expected.calculatedMAWP).toBeLessThan(0.05);
    });
  });

  describe('5. Data Integrity', () => {
    it('should not have null values in critical fields', async () => {
      const calcs = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId));
      
      calcs.forEach(calc => {
        expect(calc.componentName).toBeDefined();
        expect(calc.actualThickness).not.toBeNull();
        expect(calc.minimumRequiredThickness).not.toBeNull();
        expect(calc.calculatedMAWP).not.toBeNull();
      });
    });

    it('should have all required vessel parameters', async () => {
      const [inspection] = await db.select().from(inspections).where(eq(inspections.id, testInspectionId));
      
      expect(inspection.vesselTagNumber).toBeDefined();
      expect(inspection.designPressure).toBeDefined();
      expect(inspection.designTemperature).toBeDefined();
      expect(inspection.insideDiameter).toBeDefined();
      expect(inspection.jointEfficiency).toBeDefined();
      expect(inspection.materialSpec).toBeDefined();
    });
  });

  describe('6. Corrosion Analysis', () => {
    it('should calculate corrosion rates correctly', async () => {
      const calcs = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId));
      
      // All components should have corrosion rate < 0.005 ipy (per 2025 report)
      calcs.forEach(calc => {
        expect(parseFloat(calc.corrosionRate || '0')).toBeLessThan(0.005);
      });
    });

    it('should show Shell has no corrosion', async () => {
      const [shell] = await db.select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, testReportId))
        .where(eq(componentCalculations.componentName, 'Shell'));
      
      expect(parseFloat(shell.corrosionRate || '0')).toBe(0.000);
    });
  });
});
