import { describe, it, expect } from 'vitest';
import { consolidateTMLReadings } from './cmlDeduplication';

describe('CML Deduplication', () => {
  it('should consolidate multi-angle readings into single record', () => {
    const readings = [
      {
        legacyLocationId: 'CML-001',
        component: 'Vessel Shell',
        location: '7-0',
        angle: '0°',
        currentThickness: 0.450,
        previousThickness: 0.500,
        nominalThickness: 0.625,
      },
      {
        legacyLocationId: 'CML-001',
        component: 'Vessel Shell',
        location: '7-0',
        angle: '90°',
        currentThickness: 0.445,
      },
      {
        legacyLocationId: 'CML-001',
        component: 'Vessel Shell',
        location: '7-0',
        angle: '180°',
        currentThickness: 0.440,
      },
      {
        legacyLocationId: 'CML-001',
        component: 'Vessel Shell',
        location: '7-0',
        angle: '270°',
        currentThickness: 0.438,
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(1);
    expect(result[0].legacyLocationId).toBe('CML-001');
    expect(result[0].tml1).toBe(0.450); // 0°
    expect(result[0].tml2).toBe(0.445); // 90°
    expect(result[0].tml3).toBe(0.440); // 180°
    expect(result[0].tml4).toBe(0.438); // 270°
    expect(result[0].tActual).toBe(0.438); // Minimum
    expect(result[0].previousThickness).toBe(0.500);
    expect(result[0].nominalThickness).toBe(0.625);
    expect(result[0].angles).toEqual(['0°', '90°', '180°', '270°']);
  });

  it('should handle readings without angles', () => {
    const readings = [
      {
        legacyLocationId: 'CML-002',
        component: 'East Head',
        location: '11B-C',
        currentThickness: 0.500,
        previousThickness: 0.550,
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(1);
    expect(result[0].legacyLocationId).toBe('CML-002');
    expect(result[0].tml1).toBe(0.500);
    expect(result[0].tActual).toBe(0.500);
    expect(result[0].angles).toEqual(['N/A']);
  });

  it('should separate different CML numbers', () => {
    const readings = [
      {
        legacyLocationId: 'CML-001',
        component: 'Vessel Shell',
        location: '7-0',
        currentThickness: 0.450,
      },
      {
        legacyLocationId: 'CML-002',
        component: 'Vessel Shell',
        location: '7-45',
        currentThickness: 0.460,
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(2);
    expect(result[0].legacyLocationId).toBe('CML-001');
    expect(result[1].legacyLocationId).toBe('CML-002');
  });

  it('should separate different component types', () => {
    const readings = [
      {
        legacyLocationId: 'CML-001',
        component: 'Vessel Shell',
        location: '7-0',
        currentThickness: 0.450,
      },
      {
        legacyLocationId: 'CML-001',
        component: 'East Head',
        location: '7-0',
        currentThickness: 0.460,
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(2);
    expect(result[0].componentType).toBe('Vessel Shell');
    expect(result[1].componentType).toBe('East Head');
  });

  it('should detect nozzle service types', () => {
    const readings = [
      {
        legacyLocationId: 'N1',
        component: 'Manway',
        location: 'N1',
        readingType: 'nozzle',
        nozzleSize: '24"',
        currentThickness: 0.500,
      },
      {
        legacyLocationId: 'N2',
        component: 'Relief Valve',
        location: 'N2',
        readingType: 'nozzle',
        nozzleSize: '3"',
        currentThickness: 0.300,
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(2);
    expect(result[0].service).toBe('Manway');
    expect(result[0].nozzleSize).toBe('24"');
    expect(result[1].service).toBe('Relief');
    expect(result[1].nozzleSize).toBe('3"');
  });

  it('should handle partial angle sets', () => {
    const readings = [
      {
        legacyLocationId: 'CML-003',
        component: 'West Head',
        location: '12-0',
        angle: '0°',
        currentThickness: 0.480,
      },
      {
        legacyLocationId: 'CML-003',
        component: 'West Head',
        location: '12-0',
        angle: '180°',
        currentThickness: 0.475,
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(1);
    expect(result[0].tml1).toBe(0.480); // 0°
    expect(result[0].tml2).toBe(0.475); // 180°
    expect(result[0].tml3).toBeUndefined();
    expect(result[0].tml4).toBeUndefined();
    expect(result[0].tActual).toBe(0.475); // Minimum
  });

  it('should handle string thickness values', () => {
    const readings = [
      {
        legacyLocationId: 'CML-004',
        component: 'Vessel Shell',
        location: '8-0',
        currentThickness: '0.450',
        previousThickness: '0.500',
        nominalThickness: '0.625',
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(1);
    expect(result[0].tml1).toBe(0.450);
    expect(result[0].previousThickness).toBe(0.500);
    expect(result[0].nominalThickness).toBe(0.625);
  });

  it('should handle missing or invalid thickness values', () => {
    const readings = [
      {
        legacyLocationId: 'CML-005',
        component: 'Vessel Shell',
        location: '9-0',
        currentThickness: null,
      },
      {
        legacyLocationId: 'CML-005',
        component: 'Vessel Shell',
        location: '9-0',
        currentThickness: undefined,
      },
      {
        legacyLocationId: 'CML-005',
        component: 'Vessel Shell',
        location: '9-0',
        currentThickness: '',
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(1);
    expect(result[0].tml1).toBeUndefined();
    expect(result[0].tActual).toBeUndefined();
  });

  it('should preserve readingType metadata', () => {
    const readings = [
      {
        legacyLocationId: 'CML-006',
        component: 'Seam Weld',
        location: 'S1',
        readingType: 'seam',
        currentThickness: 0.500,
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(1);
    expect(result[0].readingType).toBe('seam');
  });

  it('should truncate long field values to database limits', () => {
    const readings = [
      {
        legacyLocationId: 'CML-VERY-LONG-NUMBER-EXCEEDING-10-CHARS',
        component: 'A'.repeat(300), // Exceeds 255 char limit
        location: 'L'.repeat(100), // Exceeds 50 char limit
        currentThickness: 0.500,
      },
    ];

    const result = consolidateTMLReadings(readings);

    expect(result).toHaveLength(1);
    expect(result[0].legacyLocationId).toHaveLength(10); // Truncated to 10
    expect(result[0].componentType).toHaveLength(255); // Truncated to 255
    expect(result[0].location).toHaveLength(50); // Truncated to 50
  });
});
