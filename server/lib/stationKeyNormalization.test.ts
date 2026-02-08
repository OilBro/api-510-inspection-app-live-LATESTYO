import { describe, it, expect } from 'vitest';
import {
  normalizeString,
  parseSliceAngle,
  parseAxialPosition,
  parseHeadPosition,
  parseHeadName,
  generateStationKey,
  resolveStationKeyWithCorrelation,
} from './stationKeyNormalization';

describe('stationKeyNormalization', () => {
  describe('normalizeString', () => {
    it('should normalize basic strings', () => {
      expect(normalizeString('CML 001')).toBe('CML 001');
      expect(normalizeString('  cml  001  ')).toBe('CML 001');
      expect(normalizeString('CML-001')).toBe('CML-001');
      expect(normalizeString('CML_001')).toBe('CML-001');
    });

    it('should remove degree symbols and quotes', () => {
      expect(normalizeString('0°')).toBe('0');
      expect(normalizeString("2'")).toBe('2');
      expect(normalizeString('2"')).toBe('2');
    });

    it('should handle null and undefined', () => {
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
    });
  });

  describe('parseSliceAngle', () => {
    it('should parse slice-angle format', () => {
      expect(parseSliceAngle('7-0')).toEqual({ slice: 7, angle: 0 });
      expect(parseSliceAngle('27-45')).toEqual({ slice: 27, angle: 45 });
      expect(parseSliceAngle('15-90')).toEqual({ slice: 15, angle: 90 });
    });

    it('should return null for non-matching formats', () => {
      expect(parseSliceAngle('CML 001')).toEqual({ slice: null, angle: null });
      expect(parseSliceAngle('Shell @ 2ft')).toEqual({ slice: null, angle: null });
    });
  });

  describe('parseAxialPosition', () => {
    it('should parse feet positions', () => {
      expect(parseAxialPosition("2'")).toBe('2FT');
      expect(parseAxialPosition("4'")).toBe('4FT');
      expect(parseAxialPosition("2' from South Head")).toBe('2FT');
    });

    it('should parse inch positions with side', () => {
      expect(parseAxialPosition('2" head side')).toBe('2IN-HEAD');
      expect(parseAxialPosition('2" shell side')).toBe('2IN-SHELL');
      expect(parseAxialPosition('2"')).toBe('2IN');
    });

    it('should return null for non-matching formats', () => {
      expect(parseAxialPosition('CML 001')).toBeNull();
      expect(parseAxialPosition('Shell')).toBeNull();
    });
  });

  describe('parseHeadPosition', () => {
    it('should parse clock positions', () => {
      expect(parseHeadPosition("12 O'Clock")).toBe('12-OCLOCK');
      expect(parseHeadPosition("3 O'Clock")).toBe('3-OCLOCK');
      expect(parseHeadPosition('6 OCLOCK')).toBe('6-OCLOCK');
    });

    it('should parse center position', () => {
      expect(parseHeadPosition('South Head Center')).toBe('CENTER');
      expect(parseHeadPosition('Center')).toBe('CENTER');
    });

    it('should return null for non-matching formats', () => {
      expect(parseHeadPosition('Shell')).toBeNull();
      expect(parseHeadPosition('CML 001')).toBeNull();
    });
  });

  describe('parseHeadName', () => {
    it('should parse head names', () => {
      expect(parseHeadName('South Head')).toBe('SOUTH-HEAD');
      expect(parseHeadName('North Head')).toBe('NORTH-HEAD');
      expect(parseHeadName('East Head')).toBe('EAST-HEAD');
      expect(parseHeadName('West Head')).toBe('WEST-HEAD');
    });

    it('should normalize top/bottom to east/west', () => {
      expect(parseHeadName('Top Head')).toBe('EAST-HEAD');
      expect(parseHeadName('Bottom Head')).toBe('WEST-HEAD');
      expect(parseHeadName('Bttm Head')).toBe('WEST-HEAD');
    });

    it('should return null for non-head components', () => {
      expect(parseHeadName('Vessel Shell')).toBeNull();
      expect(parseHeadName('Nozzle')).toBeNull();
    });
  });

  describe('generateStationKey', () => {
    it('should generate shell stationKey from explicit slice + angle', () => {
      const result = generateStationKey({
        sliceNumber: 27,
        angleDeg: 0,
        legacyLocationId: '166',
      });

      expect(result.stationKey).toBe('SHELL-SLICE-27-A0');
      expect(result.sliceNumber).toBe(27);
      expect(result.angleDeg).toBe(0);
      expect(result.trueCmlId).toBe('166');
      expect(result.confidence).toBe('high');
      expect(result.method).toBe('explicit_slice_angle');
    });

    it('should generate shell stationKey from location format', () => {
      const result = generateStationKey({
        location: '7-0',
        legacyLocationId: '14',
      });

      expect(result.stationKey).toBe('SHELL-SLICE-7-A0');
      expect(result.sliceNumber).toBe(7);
      expect(result.angleDeg).toBe(0);
      expect(result.trueCmlId).toBe('14');
      expect(result.confidence).toBe('high');
      expect(result.method).toBe('parsed_slice_angle');
    });

    it('should generate head stationKey', () => {
      const result = generateStationKey({
        component: 'South Head',
        location: "12 O'Clock",
        legacyLocationId: '1',
      });

      expect(result.stationKey).toBe('SOUTH-HEAD-12-OCLOCK');
      expect(result.sliceNumber).toBeNull();
      expect(result.angleDeg).toBeNull();
      expect(result.trueCmlId).toBe('1');
      expect(result.confidence).toBe('high');
      expect(result.method).toBe('head_position');
    });

    it('should generate nozzle stationKey', () => {
      const result = generateStationKey({
        component: 'Nozzle',
        legacyLocationId: 'N1',
        service: 'Manway',
      });

      expect(result.stationKey).toBe('NOZZLE-N1');
      expect(result.confidence).toBe('medium');
      expect(result.method).toBe('nozzle_id');
    });

    it('should fallback to location for unknown formats', () => {
      const result = generateStationKey({
        location: 'Unknown Location',
        legacyLocationId: 'X99',
      });

      expect(result.stationKey).toBe('LOCATION-UNKNOWN LOCATION');
      expect(result.confidence).toBe('low');
      expect(result.method).toBe('fallback_location');
    });
  });

  describe('resolveStationKeyWithCorrelation', () => {
    it('should use correlation mapping when available', async () => {
      const correlations = [
        {
          baselineCML: 'CML 001',
          currentCML: 'Shell @ 2 ft from West Head',
          baselineDescription: '2\' from South Head seam',
          currentDescription: 'Shell @ 2 ft from West Head',
        },
      ];

      const result = await resolveStationKeyWithCorrelation(
        {
          location: 'Shell @ 2 ft from West Head',
          legacyLocationId: 'UT-2025-001',
        },
        correlations
      );

      expect(result.method).toBe('correlation_mapping');
      expect(result.confidence).toBe('high');
    });

    it('should fallback to direct generation without correlations', async () => {
      const result = await resolveStationKeyWithCorrelation({
        location: '7-0',
        legacyLocationId: '14',
      });

      expect(result.stationKey).toBe('SHELL-SLICE-7-A0');
      expect(result.method).toBe('parsed_slice_angle');
    });
  });
});
