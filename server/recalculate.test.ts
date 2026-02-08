/**
 * Recalculate Integration Test
 * 
 * Tests that the recalculate function properly creates component calculations
 * for Shell, East Head, and West Head using the improved head detection logic.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { inspections, professionalReports, componentCalculations, tmlReadings } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

// Test data
suite('Recalculate Component Calculations', () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let testInspectionId: string;
  let testReportId: string;
  let testUserId: number;

  beforeAll(async () => {
    db = await getDb();
    testInspectionId = `test-recalc-${nanoid(8)}`;
    testReportId = `test-report-${nanoid(8)}`;
    testUserId = 999999; // Use integer for userId
    // Create test inspection
    await db.insert(inspections).values({
      id: testInspectionId,
      userId: testUserId as any,
      vesselTagNumber: 'TEST-RECALC-001',
      vesselName: 'Test Recalculate Vessel',
      designPressure: '250',
      designTemperature: '200',
      insideDiameter: '72',
      allowableStress: '17500',
      jointEfficiency: '1.0',
      materialSpec: 'SA-516 Grade 70',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test professional report
    await db.insert(professionalReports).values({
      id: testReportId,
      inspectionId: testInspectionId,
      userId: testUserId as any,
      reportNumber: 'TEST-RECALC-RPT-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create TML readings for Shell
    // Shell readings use numeric locations (8-12) and degree component types (0, 45, 90, etc.)
    await db.insert(tmlReadings).values([
      {
        id: `tml-shell-1-${nanoid(6)}`,
        inspectionId: testInspectionId,
        legacyLocationId: 'CML-1',
        component: 'Vessel Shell',
        componentType: '0',  // Degree position
        location: '8',       // Numeric location >= 8 for shell
        tActual: '0.650',
        currentThickness: '0.650',
        previousThickness: '0.680',
        status: 'good',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `tml-shell-2-${nanoid(6)}`,
        inspectionId: testInspectionId,
        legacyLocationId: 'CML-2',
        component: 'Vessel Shell',
        componentType: '180', // Degree position
        location: '9',        // Numeric location >= 8 for shell
        tActual: '0.645',
        currentThickness: '0.645',
        previousThickness: '0.675',
        status: 'good',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create TML readings for East Head (using generic "Head" naming)
    await db.insert(tmlReadings).values([
      {
        id: `tml-east-1-${nanoid(6)}`,
        inspectionId: testInspectionId,
        legacyLocationId: 'CML-6',
        component: 'Head',  // Generic "Head" should be treated as East Head
        componentType: 'Head',
        location: '12 o\'clock',
        tActual: '0.550',
        currentThickness: '0.550',
        previousThickness: '0.580',
        status: 'good',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create TML readings for West Head (using "Head 2" naming)
    await db.insert(tmlReadings).values([
      {
        id: `tml-west-1-${nanoid(6)}`,
        inspectionId: testInspectionId,
        legacyLocationId: 'CML-16',
        component: 'Head 2',  // "Head 2" should be treated as West Head
        componentType: 'Head',
        location: '12 o\'clock',
        tActual: '0.545',
        currentThickness: '0.545',
        previousThickness: '0.575',
        status: 'good',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(componentCalculations).where(eq(componentCalculations.reportId, testReportId));
    await db.delete(tmlReadings).where(eq(tmlReadings.inspectionId, testInspectionId));
    await db.delete(professionalReports).where(eq(professionalReports.id, testReportId));
    await db.delete(inspections).where(eq(inspections.id, testInspectionId));
  });

  it('should create Shell calculation from TML readings', async () => {
    // Import and run the generateDefaultCalculationsForInspection function
    const { generateDefaultCalculationsForInspection } = await import('./professionalReportDb');
    await generateDefaultCalculationsForInspection(testInspectionId, testReportId);

    // Query component calculations
    const calcs = await db.select().from(componentCalculations)
      .where(eq(componentCalculations.reportId, testReportId));

    // Find Shell calculation
    const shellCalc = calcs.find(c => c.componentName === 'Vessel Shell');
    expect(shellCalc).toBeDefined();
    expect(shellCalc?.componentType).toBe('shell');
    expect(parseFloat(shellCalc?.actualThickness || '0')).toBeGreaterThan(0);
  });

  it('should create East Head calculation from generic "Head" TML readings', async () => {
    const calcs = await db.select().from(componentCalculations)
      .where(eq(componentCalculations.reportId, testReportId));

    // Find East Head calculation
    const eastHeadCalc = calcs.find(c => c.componentName === 'East Head');
    expect(eastHeadCalc).toBeDefined();
    expect(eastHeadCalc?.componentType).toBe('head');
    expect(parseFloat(eastHeadCalc?.actualThickness || '0')).toBeGreaterThan(0);
  });

  it('should create West Head calculation from "Head 2" TML readings', async () => {
    const calcs = await db.select().from(componentCalculations)
      .where(eq(componentCalculations.reportId, testReportId));

    // Find West Head calculation
    const westHeadCalc = calcs.find(c => c.componentName === 'West Head');
    expect(westHeadCalc).toBeDefined();
    expect(westHeadCalc?.componentType).toBe('head');
    expect(parseFloat(westHeadCalc?.actualThickness || '0')).toBeGreaterThan(0);
  });

  it('should create exactly 3 component calculations (Shell, East Head, West Head)', async () => {
    const calcs = await db.select().from(componentCalculations)
      .where(eq(componentCalculations.reportId, testReportId));

    expect(calcs.length).toBe(3);
    
    const componentNames = calcs.map(c => c.componentName).sort();
    expect(componentNames).toEqual(['East Head', 'Vessel Shell', 'West Head']);
  });

  it('should use minimum thickness from TML readings for conservative calculations', async () => {
    const calcs = await db.select().from(componentCalculations)
      .where(eq(componentCalculations.reportId, testReportId));

    const shellCalc = calcs.find(c => c.componentName === 'Vessel Shell');
    
    // Should use minimum of 0.650 and 0.645 = 0.645
    expect(parseFloat(shellCalc?.actualThickness || '0')).toBe(0.645);
  });

  it('should calculate minimum thickness using ASME formula', async () => {
    const calcs = await db.select().from(componentCalculations)
      .where(eq(componentCalculations.reportId, testReportId));

    const shellCalc = calcs.find(c => c.componentName === 'Vessel Shell');
    
    // Verify minimum thickness is calculated (not zero or null)
    expect(parseFloat(shellCalc?.minimumThickness || '0')).toBeGreaterThan(0);
    
    // For P=250, R=36, S=17500, E=1.0:
    // t_min = PR/(SE - 0.6P) = 250*36/(17500*1.0 - 0.6*250) = 9000/17350 ≈ 0.519
    // Plus static head adjustment
    const tMin = parseFloat(shellCalc?.minimumThickness || '0');
    expect(tMin).toBeGreaterThan(0.4);
    expect(tMin).toBeLessThan(0.7);
  });
});
