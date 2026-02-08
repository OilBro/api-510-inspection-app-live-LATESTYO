/**
 * Tests for CML Correlation Helper - StationKey Pairing Logic
 * 
 * Verifies that thickness readings are correctly paired across inspections
 * using the 3-tier priority system: stationKey > correlation > legacyLocationId
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from './db';
import { inspections, tmlReadings, cmlCorrelations } from '../drizzle/schema';
import { getCorrelatedTMLReadings } from './cmlCorrelationHelper';
import { nanoid } from 'nanoid';

describe('CML Correlation Helper - StationKey Pairing', () => {
  let baselineInspectionId: string;
  let currentInspectionId: string;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create test inspections
    baselineInspectionId = nanoid();
    currentInspectionId = nanoid();

    await db.insert(inspections).values([
      {
        id: baselineInspectionId,
        userId: 'test-user',
        vesselTagNumber: 'TEST-001',
        inspectionDate: new Date('2017-01-01'),
        inspectionType: 'External',
      },
      {
        id: currentInspectionId,
        userId: 'test-user',
        vesselTagNumber: 'TEST-001',
        inspectionDate: new Date('2025-01-01'),
        inspectionType: 'External',
        previousInspectionId: baselineInspectionId,
      },
    ]);
  });

  it('should pair readings using stationKey (Priority 1)', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create baseline and current readings with matching stationKeys
    await db.insert(tmlReadings).values([
      {
        id: nanoid(),
        inspectionId: baselineInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'Shell @ 2 ft from West Head',
        legacyLocationId: 'CML-001',
        stationKey: 'SHELL-SLICE-27-A0',
        tActual: '0.652',
        currentThickness: '0.652',
      },
      {
        id: nanoid(),
        inspectionId: currentInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'Shell @ 2 ft from West Head',
        legacyLocationId: 'CML-166', // Different CML number
        stationKey: 'SHELL-SLICE-27-A0', // Same stationKey
        tActual: '0.640',
        currentThickness: '0.640',
      },
    ]);

    const pairs = await getCorrelatedTMLReadings(
      currentInspectionId,
      baselineInspectionId,
      'Vessel Shell'
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0].matchMethod).toBe('stationKey');
    expect(pairs[0].current.stationKey).toBe('SHELL-SLICE-27-A0');
    expect(pairs[0].baseline?.stationKey).toBe('SHELL-SLICE-27-A0');
    expect(pairs[0].baseline?.tActual).toBe('0.652');
  });

  it('should pair readings using correlation mapping (Priority 2)', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create baseline and current readings WITHOUT matching stationKeys
    await db.insert(tmlReadings).values([
      {
        id: nanoid(),
        inspectionId: baselineInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'CML 001',
        legacyLocationId: 'CML 001',
        stationKey: 'LOCATION-CML-001', // Different stationKey
        tActual: '0.652',
        currentThickness: '0.652',
      },
      {
        id: nanoid(),
        inspectionId: currentInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'Shell @ 2 ft from West Head',
        legacyLocationId: 'S-2FT-WH',
        stationKey: 'SHELL-SLICE-27-A0', // Different stationKey
        tActual: '0.640',
        currentThickness: '0.640',
      },
    ]);

    // Create correlation mapping
    await db.insert(cmlCorrelations).values({
      id: nanoid(),
      inspectionId: currentInspectionId,
      baselineCML: 'CML 001',
      currentCML: 'Shell @ 2 ft from West Head',
      correlationBasis: 'Manual mapping',
    });

    const pairs = await getCorrelatedTMLReadings(
      currentInspectionId,
      baselineInspectionId,
      'Vessel Shell'
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0].matchMethod).toBe('correlation');
    expect(pairs[0].baseline?.legacyLocationId).toBe('CML 001');
    expect(pairs[0].current.legacyLocationId).toBe('Shell @ 2 ft from West Head');
  });

  it('should pair readings using legacyLocationId (Priority 3)', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create baseline and current readings with matching legacyLocationId only
    await db.insert(tmlReadings).values([
      {
        id: nanoid(),
        inspectionId: baselineInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'Some location',
        legacyLocationId: 'CML-001',
        stationKey: 'LOCATION-SOME-LOCATION', // Different stationKey
        tActual: '0.652',
        currentThickness: '0.652',
      },
      {
        id: nanoid(),
        inspectionId: currentInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'Different location',
        legacyLocationId: 'CML-001', // Same legacyLocationId
        stationKey: 'LOCATION-DIFFERENT-LOCATION', // Different stationKey
        tActual: '0.640',
        currentThickness: '0.640',
      },
    ]);

    const pairs = await getCorrelatedTMLReadings(
      currentInspectionId,
      baselineInspectionId,
      'Vessel Shell'
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0].matchMethod).toBe('legacyLocationId');
    expect(pairs[0].baseline?.legacyLocationId).toBe('CML-001');
    expect(pairs[0].current.legacyLocationId).toBe('CML-001');
  });

  it('should mark as "none" when no match found', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create current reading with no matching baseline
    await db.insert(tmlReadings).values({
      id: nanoid(),
      inspectionId: currentInspectionId,
      component: 'Vessel Shell',
      componentType: 'Shell',
      location: 'New location',
      legacyLocationId: 'CML-999',
      stationKey: 'SHELL-SLICE-99-A0',
      tActual: '0.640',
      currentThickness: '0.640',
    });

    const pairs = await getCorrelatedTMLReadings(
      currentInspectionId,
      baselineInspectionId,
      'Vessel Shell'
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0].matchMethod).toBe('none');
    expect(pairs[0].baseline).toBeNull();
  });

  it('should prioritize stationKey over correlation mapping', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create readings with BOTH stationKey match AND correlation mapping
    await db.insert(tmlReadings).values([
      {
        id: nanoid(),
        inspectionId: baselineInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'CML 001',
        legacyLocationId: 'CML 001',
        stationKey: 'SHELL-SLICE-27-A0',
        tActual: '0.652',
        currentThickness: '0.652',
      },
      {
        id: nanoid(),
        inspectionId: baselineInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'CML 002',
        legacyLocationId: 'CML 002',
        stationKey: 'SHELL-SLICE-28-A0',
        tActual: '0.600',
        currentThickness: '0.600',
      },
      {
        id: nanoid(),
        inspectionId: currentInspectionId,
        component: 'Vessel Shell',
        componentType: 'Shell',
        location: 'Shell @ 2 ft from West Head',
        legacyLocationId: 'S-2FT-WH',
        stationKey: 'SHELL-SLICE-27-A0', // Matches first baseline reading
        tActual: '0.640',
        currentThickness: '0.640',
      },
    ]);

    // Create correlation mapping pointing to DIFFERENT baseline reading
    await db.insert(cmlCorrelations).values({
      id: nanoid(),
      inspectionId: currentInspectionId,
      baselineCML: 'CML 002', // Points to second baseline reading
      currentCML: 'Shell @ 2 ft from West Head',
      correlationBasis: 'Manual mapping',
    });

    const pairs = await getCorrelatedTMLReadings(
      currentInspectionId,
      baselineInspectionId,
      'Vessel Shell'
    );

    expect(pairs).toHaveLength(1);
    // Should use stationKey match (CML 001), NOT correlation mapping (CML 002)
    expect(pairs[0].matchMethod).toBe('stationKey');
    expect(pairs[0].baseline?.legacyLocationId).toBe('CML 001');
    expect(pairs[0].baseline?.tActual).toBe('0.652');
  });
});
