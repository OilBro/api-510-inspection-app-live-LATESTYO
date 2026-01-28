/**
 * Unit tests for Material Stress Resolver
 * Verifies stress resolution from database and manual input
 */

import { describe, it, expect } from 'vitest';
import {
  resolveAllowableStress,
  validateStressValue,
  formatStressSourceForAudit
} from './materialStressResolver';

describe('Material Stress Resolver', () => {
  describe('resolveAllowableStress', () => {
    describe('Database lookup', () => {
      it('should resolve stress from database for SA-516 Gr 70 at 100°F', () => {
        const result = resolveAllowableStress(0, 'SA-516 Gr 70', 100);
        
        expect(result.source).toBe('database');
        expect(result.stress).toBe(20000);
        expect(result.materialSpec).toBe('SA-516 Gr 70');
        expect(result.designTemperature).toBe(100);
        expect(result.lookupStatus).toBe('ok');
        expect(result.databaseVersion).toBe('ASME-BPVC-2023');
      });

      it('should resolve interpolated stress for SA-516 Gr 70 at 725°F', () => {
        const result = resolveAllowableStress(0, 'SA-516 Gr 70', 725);
        
        expect(result.source).toBe('database');
        expect(result.stress).toBe(19700); // Interpolated between 700 and 750
        expect(result.lookupStatus).toBe('ok_interpolated');
        expect(result.wasInterpolated).toBe(true);
      });

      it('should fall back to manual stress when material not found', () => {
        const result = resolveAllowableStress(17500, 'UNKNOWN-MATERIAL', 100);
        
        expect(result.source).toBe('manual');
        expect(result.stress).toBe(17500);
        expect(result.lookupStatus).toBe('error');
        expect(result.message).toContain('Database lookup failed');
      });

      it('should fall back to manual stress when temperature out of range', () => {
        const result = resolveAllowableStress(17500, 'SA-516 Gr 70', 1500);
        
        expect(result.source).toBe('manual');
        expect(result.stress).toBe(17500);
        expect(result.lookupStatus).toBe('error');
        expect(result.message).toContain('exceeds maximum');
      });
    });

    describe('Manual input', () => {
      it('should use manual stress when no material spec provided', () => {
        const result = resolveAllowableStress(17500);
        
        expect(result.source).toBe('manual');
        expect(result.stress).toBe(17500);
        expect(result.message).toContain('manually provided');
      });

      it('should use manual stress when only material spec provided (no temp)', () => {
        const result = resolveAllowableStress(17500, 'SA-516 Gr 70');
        
        expect(result.source).toBe('manual');
        expect(result.stress).toBe(17500);
      });
    });
  });

  describe('validateStressValue', () => {
    it('should validate normal stress values', () => {
      const result = validateStressValue(20000);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject zero stress', () => {
      const result = validateStressValue(0);
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Allowable stress must be positive');
    });

    it('should reject negative stress', () => {
      const result = validateStressValue(-1000);
      
      expect(result.isValid).toBe(false);
    });

    it('should warn for unusually low stress', () => {
      const result = validateStressValue(3000);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('unusually low');
    });

    it('should warn for unusually high stress', () => {
      const result = validateStressValue(35000);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('unusually high');
    });
  });

  describe('formatStressSourceForAudit', () => {
    it('should format database source correctly', () => {
      const result = {
        stress: 20000,
        source: 'database' as const,
        materialSpec: 'SA-516 Gr 70',
        designTemperature: 100,
        lookupStatus: 'ok' as const,
        message: 'Exact match',
        databaseVersion: 'ASME-BPVC-2023',
        tableReference: 'Table 1A',
        wasInterpolated: false
      };
      
      const formatted = formatStressSourceForAudit(result);
      
      expect(formatted).toContain('S = 20000 psi');
      expect(formatted).toContain('ASME Section II Part D');
      expect(formatted).toContain('Table 1A');
      expect(formatted).toContain('SA-516 Gr 70');
      expect(formatted).toContain('100°F');
      expect(formatted).toContain('ASME-BPVC-2023');
      expect(formatted).not.toContain('interpolated');
    });

    it('should note interpolation in audit format', () => {
      const result = {
        stress: 19700,
        source: 'database' as const,
        materialSpec: 'SA-516 Gr 70',
        designTemperature: 725,
        lookupStatus: 'ok_interpolated' as const,
        message: 'Interpolated',
        databaseVersion: 'ASME-BPVC-2023',
        tableReference: 'Table 1A',
        wasInterpolated: true
      };
      
      const formatted = formatStressSourceForAudit(result);
      
      expect(formatted).toContain('interpolated');
    });

    it('should format manual source correctly', () => {
      const result = {
        stress: 17500,
        source: 'manual' as const,
        message: 'Manually entered'
      };
      
      const formatted = formatStressSourceForAudit(result);
      
      expect(formatted).toContain('S = 17500 psi');
      expect(formatted).toContain('manually entered');
    });
  });
});
