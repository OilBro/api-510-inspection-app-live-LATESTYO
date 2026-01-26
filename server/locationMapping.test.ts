import { describe, it, expect } from 'vitest';
import { parseCmlId, SHELL_ANGLES, NOZZLE_ANGLES } from './locationMappingRouter';

describe('CML ID Parser', () => {
  describe('parseCmlId', () => {
    it('should parse simple CML numbers', () => {
      const result = parseCmlId('10');
      expect(result.baseCml).toBe('10');
      expect(result.angle).toBeNull();
      expect(result.fullId).toBe('10');
    });

    it('should parse CML with valid angular position (slice-angle format)', () => {
      const result = parseCmlId('10-45');
      expect(result.baseCml).toBe('10');
      expect(result.angle).toBe(45);
      expect(result.fullId).toBe('10-45');
    });

    it('should parse CML at 0 degrees', () => {
      const result = parseCmlId('10-0');
      expect(result.baseCml).toBe('10');
      expect(result.angle).toBe(0);
      expect(result.fullId).toBe('10-0');
    });

    it('should parse CML at 315 degrees', () => {
      const result = parseCmlId('10-315');
      expect(result.baseCml).toBe('10');
      expect(result.angle).toBe(315);
      expect(result.fullId).toBe('10-315');
    });

    it('should parse nozzle CML numbers', () => {
      const result = parseCmlId('N1');
      expect(result.baseCml).toBe('N1');
      expect(result.angle).toBeNull();
      expect(result.fullId).toBe('N1');
    });

    it('should parse nozzle CML with angular position', () => {
      const result = parseCmlId('N1-90');
      expect(result.baseCml).toBe('N1');
      expect(result.angle).toBe(90);
      expect(result.fullId).toBe('N1-90');
    });

    it('should treat non-standard angles as part of base CML (range pattern)', () => {
      // "8-12" is a range pattern, not a slice-angle
      const result = parseCmlId('8-12');
      expect(result.baseCml).toBe('8-12');
      expect(result.angle).toBeNull();
      expect(result.fullId).toBe('8-12');
    });

    it('should handle text-based CML identifiers', () => {
      const result = parseCmlId('South Head');
      expect(result.baseCml).toBe('South Head');
      expect(result.angle).toBeNull();
      expect(result.fullId).toBe('South Head');
    });

    it('should trim whitespace', () => {
      const result = parseCmlId('  10-45  ');
      expect(result.baseCml).toBe('10');
      expect(result.angle).toBe(45);
      expect(result.fullId).toBe('10-45');
    });
  });

  describe('Angular Position Constants', () => {
    it('should have 8 shell angles', () => {
      expect(SHELL_ANGLES).toHaveLength(8);
      expect(SHELL_ANGLES).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    });

    it('should have 4 nozzle angles', () => {
      expect(NOZZLE_ANGLES).toHaveLength(4);
      expect(NOZZLE_ANGLES).toEqual([0, 90, 180, 270]);
    });

    it('should have all shell angles divisible by 45', () => {
      SHELL_ANGLES.forEach(angle => {
        expect(angle % 45).toBe(0);
      });
    });

    it('should have all nozzle angles divisible by 90', () => {
      NOZZLE_ANGLES.forEach(angle => {
        expect(angle % 90).toBe(0);
      });
    });
  });
});
