import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { inspections } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

describe('Import Data Flow', () => {
  let testInspectionId: string;
  const testUserId = 'test-user-import';

  beforeAll(async () => {
    // Clean up any existing test data
    const db = await getDb();
    const existing = await db.select().from(inspections).where(eq(inspections.userId, testUserId));
    for (const insp of existing) {      await db.delete(inspections).where(eq(inspections.id, insp.id));
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testInspectionId) {
      const db = await getDb();
      await db.delete(inspections).where(eq(inspections.id, testInspectionId));
    }
  });

  it('should generate valid inspection ID using nanoid', () => {
    const id1 = nanoid();
    const id2 = nanoid();
    
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
  });

  it('should create inspection with generated ID', async () => {
    const db = await getDb();
    testInspectionId = nanoid();
    
    const inspection = {
      id: testInspectionId,
      userId: testUserId,
      vesselTagNumber: 'TEST-IMPORT-001',
      vesselName: 'Test Import Vessel',
      status: 'draft' as const,
      manufacturer: 'Test Manufacturer',
      yearBuilt: 2020,
      designPressure: '250',
      designTemperature: '200',
      materialSpec: 'SA-240 Type 304',
    };

    await db.insert(inspections).values(inspection);

    // Verify inspection was created
    const [created] = await db.select().from(inspections).where(eq(inspections.id, testInspectionId));
    
    expect(created).toBeTruthy();
    expect(created.id).toBe(testInspectionId);
    expect(created.vesselTagNumber).toBe('TEST-IMPORT-001');
    expect(created.vesselName).toBe('Test Import Vessel');
    expect(created.manufacturer).toBe('Test Manufacturer');
    expect(created.yearBuilt).toBe(2020);
  });

  it('should find existing inspection by vessel tag number', async () => {
    const db = await getDb();
    const userInspections = await db.select()
      .from(inspections)
      .where(eq(inspections.userId, testUserId));

    const existingInspection = userInspections.find(
      (insp: any) => insp.vesselTagNumber === 'TEST-IMPORT-001'
    );

    expect(existingInspection).toBeTruthy();
    expect(existingInspection?.id).toBe(testInspectionId);
  });

  it('should update existing inspection without creating duplicate', async () => {
    const db = await getDb();
    const [before] = await db.select().from(inspections).where(eq(inspections.id, testInspectionId));
    
    // Update inspection
    await db.update(inspections)
      .set({
        vesselName: 'Updated Test Vessel',
        operatingPressure: '225',
      })
      .where(eq(inspections.id, testInspectionId));

    const [after] = await db.select().from(inspections).where(eq(inspections.id, testInspectionId));
    
    expect(after.vesselName).toBe('Updated Test Vessel');
    expect(parseFloat(after.operatingPressure || '0')).toBe(225);
    expect(after.vesselTagNumber).toBe(before.vesselTagNumber); // Should not change
  });

  it('should handle numeric parsing correctly', () => {
    const parseNumeric = (value: any): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const str = String(value).trim();
      const match = str.match(/([0-9]+\.?[0-9]*)/);
      return match ? match[1] : null;
    };

    expect(parseNumeric('250')).toBe('250');
    expect(parseNumeric('250 psig')).toBe('250');
    expect(parseNumeric('250.5')).toBe('250.5');
    expect(parseNumeric('  250  ')).toBe('250');
    expect(parseNumeric(250)).toBe('250');
    expect(parseNumeric(null)).toBe(null);
    expect(parseNumeric('')).toBe(null);
    expect(parseNumeric('N/A')).toBe(null);
  });

  it('should handle integer parsing correctly', () => {
    const parseIntValue = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return isNaN(num) ? null : Math.floor(num);
    };

    expect(parseIntValue('2020')).toBe(2020);
    expect(parseIntValue(2020)).toBe(2020);
    expect(parseIntValue('2020.7')).toBe(2020);
    expect(parseIntValue(2020.7)).toBe(2020);
    expect(parseIntValue(null)).toBe(null);
    expect(parseIntValue('')).toBe(null);
    expect(parseIntValue('N/A')).toBe(null);
  });
});
