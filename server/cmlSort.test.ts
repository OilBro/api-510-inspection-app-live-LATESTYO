import { describe, it, expect } from 'vitest';
import { extractCmlNumber, compareCmlNumbers, sortByCmlNumber } from './cmlSort';

describe('CML Sorting Utility', () => {
  describe('extractCmlNumber', () => {
    it('should extract number from CML-001 format', () => {
      expect(extractCmlNumber('CML-001')).toBe(1);
      expect(extractCmlNumber('CML-12')).toBe(12);
      expect(extractCmlNumber('CML-100')).toBe(100);
    });

    it('should extract number from TML-X format', () => {
      expect(extractCmlNumber('TML-5')).toBe(5);
      expect(extractCmlNumber('TML-25')).toBe(25);
    });

    it('should extract number from plain numeric strings', () => {
      expect(extractCmlNumber('001')).toBe(1);
      expect(extractCmlNumber('12')).toBe(12);
      expect(extractCmlNumber('100')).toBe(100);
    });

    it('should extract number from letter-number format', () => {
      expect(extractCmlNumber('A-5')).toBe(5);
      expect(extractCmlNumber('B-12')).toBe(12);
    });

    it('should return Infinity for empty or null values', () => {
      expect(extractCmlNumber(null)).toBe(Infinity);
      expect(extractCmlNumber(undefined)).toBe(Infinity);
      expect(extractCmlNumber('')).toBe(Infinity);
    });

    it('should return Infinity for non-numeric strings', () => {
      expect(extractCmlNumber('ABC')).toBe(Infinity);
    });
  });

  describe('compareCmlNumbers', () => {
    it('should sort by numeric value ascending', () => {
      const a = { cmlNumber: 'CML-001' };
      const b = { cmlNumber: 'CML-010' };
      expect(compareCmlNumbers(a, b)).toBeLessThan(0);
    });

    it('should handle equal numbers with alphabetical fallback', () => {
      const a = { cmlNumber: 'CML-001' };
      const b = { cmlNumber: 'TML-001' };
      // Both have numeric value 1, so compare alphabetically
      expect(compareCmlNumbers(a, b)).toBeLessThan(0); // C < T
    });

    it('should put null/empty values at the end', () => {
      const a = { cmlNumber: null };
      const b = { cmlNumber: 'CML-001' };
      expect(compareCmlNumbers(a, b)).toBeGreaterThan(0);
    });
  });

  describe('sortByCmlNumber', () => {
    it('should sort readings numerically from low to high', () => {
      const readings = [
        { id: '1', cmlNumber: 'CML-010' },
        { id: '2', cmlNumber: 'CML-002' },
        { id: '3', cmlNumber: 'CML-001' },
        { id: '4', cmlNumber: 'CML-100' },
        { id: '5', cmlNumber: 'CML-005' },
      ];

      const sorted = sortByCmlNumber(readings);

      expect(sorted.map(r => r.cmlNumber)).toEqual([
        'CML-001',
        'CML-002',
        'CML-005',
        'CML-010',
        'CML-100',
      ]);
    });

    it('should handle mixed formats', () => {
      const readings = [
        { id: '1', cmlNumber: 'TML-5' },
        { id: '2', cmlNumber: 'CML-001' },
        { id: '3', cmlNumber: '3' },
        { id: '4', cmlNumber: 'A-2' },
      ];

      const sorted = sortByCmlNumber(readings);

      expect(sorted.map(r => r.cmlNumber)).toEqual([
        'CML-001',  // 1
        'A-2',      // 2
        '3',        // 3
        'TML-5',    // 5
      ]);
    });

    it('should put empty/null values at the end', () => {
      const readings = [
        { id: '1', cmlNumber: 'CML-002' },
        { id: '2', cmlNumber: null },
        { id: '3', cmlNumber: 'CML-001' },
        { id: '4', cmlNumber: '' },
      ];

      const sorted = sortByCmlNumber(readings);

      expect(sorted[0].cmlNumber).toBe('CML-001');
      expect(sorted[1].cmlNumber).toBe('CML-002');
      // null and empty should be at the end
      expect(sorted[2].cmlNumber === null || sorted[2].cmlNumber === '').toBe(true);
      expect(sorted[3].cmlNumber === null || sorted[3].cmlNumber === '').toBe(true);
    });

    it('should not mutate the original array', () => {
      const readings = [
        { id: '1', cmlNumber: 'CML-002' },
        { id: '2', cmlNumber: 'CML-001' },
      ];
      const original = [...readings];

      sortByCmlNumber(readings);

      expect(readings).toEqual(original);
    });

    it('should handle empty array', () => {
      const sorted = sortByCmlNumber([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single item array', () => {
      const readings = [{ id: '1', cmlNumber: 'CML-001' }];
      const sorted = sortByCmlNumber(readings);
      expect(sorted).toEqual(readings);
    });
  });
});
