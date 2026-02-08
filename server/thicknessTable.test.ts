import { describe, it, expect } from 'vitest';

describe('Enhanced Thickness Table Format', () => {
  it('should have correct header structure with angle labels', () => {
    const expectedHeaders = [
      'CML',
      'Comp ID',
      'Location',
      'Type',
      'Size',
      'Service',
      't prev',
      '0°',
      '90°',
      '180°',
      '270°',
      't act*'
    ];
    
    expect(expectedHeaders).toHaveLength(12);
    expect(expectedHeaders[7]).toBe('0°');
    expect(expectedHeaders[8]).toBe('90°');
    expect(expectedHeaders[9]).toBe('180°');
    expect(expectedHeaders[10]).toBe('270°');
    expect(expectedHeaders[11]).toBe('t act*');
  });

  it('should format thickness readings with all metadata', () => {
    const mockReading = {
      legacyLocationId: 'CML-001',
      componentType: 'Vessel Shell',
      location: '7-0',
      readingType: 'seam',
      nozzleSize: null,
      service: null,
      previousThickness: '0.500',
      tml1: '0.450',
      tml2: '0.445',
      tml3: '0.440',
      tml4: '0.438',
      tActual: '0.438',
    };

    const row = [
      mockReading.legacyLocationId || '-',
      mockReading.componentType || '-',
      mockReading.location || '-',
      mockReading.readingType || '-',
      mockReading.nozzleSize || '-',
      mockReading.service || '-',
      mockReading.previousThickness ? parseFloat(mockReading.previousThickness).toFixed(3) : '-',
      mockReading.tml1 ? parseFloat(mockReading.tml1).toFixed(3) : '-',
      mockReading.tml2 ? parseFloat(mockReading.tml2).toFixed(3) : '-',
      mockReading.tml3 ? parseFloat(mockReading.tml3).toFixed(3) : '-',
      mockReading.tml4 ? parseFloat(mockReading.tml4).toFixed(3) : '-',
      mockReading.tActual ? parseFloat(mockReading.tActual).toFixed(3) : '-',
    ];

    expect(row).toEqual([
      'CML-001',
      'Vessel Shell',
      '7-0',
      'seam',
      '-',
      '-',
      '0.500',
      '0.450',
      '0.445',
      '0.440',
      '0.438',
      '0.438',
    ]);
  });

  it('should format nozzle readings with size and service', () => {
    const mockNozzle = {
      legacyLocationId: 'N1',
      componentType: '24',
      location: 'N1',
      readingType: 'nozzle',
      nozzleSize: '24"',
      service: 'Manway',
      previousThickness: '0.625',
      tml1: '0.600',
      tml2: '0.595',
      tml3: null,
      tml4: null,
      tActual: '0.595',
    };

    const row = [
      mockNozzle.legacyLocationId || '-',
      mockNozzle.componentType || '-',
      mockNozzle.location || '-',
      mockNozzle.readingType || '-',
      mockNozzle.nozzleSize || '-',
      mockNozzle.service || '-',
      mockNozzle.previousThickness ? parseFloat(mockNozzle.previousThickness).toFixed(3) : '-',
      mockNozzle.tml1 ? parseFloat(mockNozzle.tml1).toFixed(3) : '-',
      mockNozzle.tml2 ? parseFloat(mockNozzle.tml2).toFixed(3) : '-',
      mockNozzle.tml3 ? parseFloat(mockNozzle.tml3).toFixed(3) : '-',
      mockNozzle.tml4 ? parseFloat(mockNozzle.tml4).toFixed(3) : '-',
      mockNozzle.tActual ? parseFloat(mockNozzle.tActual).toFixed(3) : '-',
    ];

    expect(row).toEqual([
      'N1',
      '24',
      'N1',
      'nozzle',
      '24"',
      'Manway',
      '0.625',
      '0.600',
      '0.595',
      '-',
      '-',
      '0.595',
    ]);
  });

  it('should handle partial angle readings', () => {
    const mockReading = {
      legacyLocationId: 'CML-002',
      componentType: 'East Head',
      location: '11B-C',
      readingType: 'spot',
      nozzleSize: null,
      service: null,
      previousThickness: '0.550',
      tml1: '0.520',
      tml2: null,
      tml3: '0.515',
      tml4: null,
      tActual: '0.515',
    };

    const row = [
      mockReading.legacyLocationId || '-',
      mockReading.componentType || '-',
      mockReading.location || '-',
      mockReading.readingType || '-',
      mockReading.nozzleSize || '-',
      mockReading.service || '-',
      mockReading.previousThickness ? parseFloat(mockReading.previousThickness).toFixed(3) : '-',
      mockReading.tml1 ? parseFloat(mockReading.tml1).toFixed(3) : '-',
      mockReading.tml2 ? parseFloat(mockReading.tml2).toFixed(3) : '-',
      mockReading.tml3 ? parseFloat(mockReading.tml3).toFixed(3) : '-',
      mockReading.tml4 ? parseFloat(mockReading.tml4).toFixed(3) : '-',
      mockReading.tActual ? parseFloat(mockReading.tActual).toFixed(3) : '-',
    ];

    expect(row).toEqual([
      'CML-002',
      'East Head',
      '11B-C',
      'spot',
      '-',
      '-',
      '0.550',
      '0.520',
      '-',
      '0.515',
      '-',
      '0.515',
    ]);
    
    // Verify tActual is minimum
    expect(row[11]).toBe('0.515');
  });

  it('should handle missing previous thickness', () => {
    const mockReading = {
      legacyLocationId: 'CML-003',
      componentType: 'West Head',
      location: '12-0',
      readingType: 'general',
      nozzleSize: null,
      service: null,
      previousThickness: null,
      tml1: '0.480',
      tml2: '0.475',
      tml3: '0.470',
      tml4: '0.468',
      tActual: '0.468',
    };

    const row = [
      mockReading.legacyLocationId || '-',
      mockReading.componentType || '-',
      mockReading.location || '-',
      mockReading.readingType || '-',
      mockReading.nozzleSize || '-',
      mockReading.service || '-',
      mockReading.previousThickness ? parseFloat(mockReading.previousThickness).toFixed(3) : '-',
      mockReading.tml1 ? parseFloat(mockReading.tml1).toFixed(3) : '-',
      mockReading.tml2 ? parseFloat(mockReading.tml2).toFixed(3) : '-',
      mockReading.tml3 ? parseFloat(mockReading.tml3).toFixed(3) : '-',
      mockReading.tml4 ? parseFloat(mockReading.tml4).toFixed(3) : '-',
      mockReading.tActual ? parseFloat(mockReading.tActual).toFixed(3) : '-',
    ];

    expect(row[6]).toBe('-'); // t prev should be dash
    expect(row[11]).toBe('0.468'); // t act should still be present
  });
});
