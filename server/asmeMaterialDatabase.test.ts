/**
 * Unit tests for ASME Section II Part D Material Database
 * Verifies allowable stress lookup, interpolation, and material normalization
 */

import { describe, it, expect } from 'vitest';
import {
  getAllowableStress,
  getMaterialProperties,
  listAvailableMaterials,
  getDatabaseInfo,
  normalizeMaterialSpec,
  getAllowableStressNormalized,
  DATABASE_VERSION
} from './asmeMaterialDatabase';

describe('ASME Material Database', () => {
  describe('getDatabaseInfo', () => {
    it('should return database version and traceability info', () => {
      const info = getDatabaseInfo();
      
      expect(info.version).toBe('ASME-BPVC-2023');
      expect(info.effectiveDate).toBe('2023-07-01');
      expect(info.reference).toContain('ASME');
      expect(info.table).toContain('Table 1A');
      expect(info.materialCount).toBeGreaterThan(0);
    });
  });

  describe('listAvailableMaterials', () => {
    it('should return a list of available materials', () => {
      const materials = listAvailableMaterials();
      
      expect(materials).toContain('SA-516 Gr 70');
      expect(materials).toContain('SA-516 Gr 60');
      expect(materials).toContain('SA-285 Gr C');
      expect(materials).toContain('SA-240 Type 304');
      expect(materials).toContain('SA-106 Gr B');
      expect(materials.length).toBeGreaterThan(5);
    });
  });

  describe('getMaterialProperties', () => {
    it('should return properties for SA-516 Gr 70', () => {
      const props = getMaterialProperties('SA-516 Gr 70');
      
      expect(props).not.toBeNull();
      expect(props!.specNumber).toBe('SA-516');
      expect(props!.grade).toBe('70');
      expect(props!.productForm).toBe('Plate');
      expect(props!.minTensileStrength).toBe(70000);
      expect(props!.minYieldStrength).toBe(38000);
      expect(props!.maxTemperature).toBe(900);
    });

    it('should return null for unknown material', () => {
      const props = getMaterialProperties('UNKNOWN-MATERIAL');
      expect(props).toBeNull();
    });
  });

  describe('getAllowableStress', () => {
    describe('SA-516 Gr 70 (Carbon Steel Plate)', () => {
      it('should return 20000 psi at 100°F (exact match)', () => {
        const result = getAllowableStress('SA-516 Gr 70', 100);
        
        expect(result.stress).toBe(20000);
        expect(result.status).toBe('ok');
        expect(result.databaseVersion).toBe(DATABASE_VERSION);
      });

      it('should return 20000 psi at 650°F (exact match)', () => {
        const result = getAllowableStress('SA-516 Gr 70', 650);
        
        expect(result.stress).toBe(20000);
        expect(result.status).toBe('ok');
      });

      it('should return 17500 psi at 800°F (exact match)', () => {
        const result = getAllowableStress('SA-516 Gr 70', 800);
        
        expect(result.stress).toBe(17500);
        expect(result.status).toBe('ok');
      });

      it('should interpolate at 725°F (between 700 and 750)', () => {
        const result = getAllowableStress('SA-516 Gr 70', 725);
        
        // At 700°F: 20000 psi, at 750°F: 19400 psi
        // Interpolated: 20000 + (19400 - 20000) * (725 - 700) / (750 - 700)
        // = 20000 + (-600) * 0.5 = 19700 psi
        expect(result.stress).toBe(19700);
        expect(result.status).toBe('ok_interpolated');
        expect(result.message).toContain('Interpolated');
      });

      it('should return error for temperature below minimum', () => {
        const result = getAllowableStress('SA-516 Gr 70', -50);
        
        expect(result.stress).toBeNull();
        expect(result.status).toBe('error');
        expect(result.message).toContain('below minimum');
      });

      it('should return error for temperature above maximum', () => {
        const result = getAllowableStress('SA-516 Gr 70', 1000);
        
        expect(result.stress).toBeNull();
        expect(result.status).toBe('error');
        expect(result.message).toContain('exceeds maximum');
      });
    });

    describe('SA-240 Type 304 (Stainless Steel Plate)', () => {
      it('should return 20000 psi at 100°F', () => {
        const result = getAllowableStress('SA-240 Type 304', 100);
        
        expect(result.stress).toBe(20000);
        expect(result.status).toBe('ok');
      });

      it('should return 16600 psi at 600°F', () => {
        const result = getAllowableStress('SA-240 Type 304', 600);
        
        expect(result.stress).toBe(16600);
        expect(result.status).toBe('ok');
      });

      it('should handle high temperature (1500°F)', () => {
        const result = getAllowableStress('SA-240 Type 304', 1500);
        
        expect(result.stress).toBe(7700);
        expect(result.status).toBe('ok');
      });
    });

    describe('Unknown material', () => {
      it('should return error for unknown material', () => {
        const result = getAllowableStress('UNKNOWN-MATERIAL', 100);
        
        expect(result.stress).toBeNull();
        expect(result.status).toBe('error');
        expect(result.message).toContain('not found in database');
        expect(result.message).toContain('Available');
      });
    });
  });

  describe('normalizeMaterialSpec', () => {
    it('should return exact match', () => {
      expect(normalizeMaterialSpec('SA-516 Gr 70')).toBe('SA-516 Gr 70');
    });

    it('should normalize case variations', () => {
      expect(normalizeMaterialSpec('sa-516 gr 70')).toBe('SA-516 Gr 70');
    });

    it('should handle "Grade" instead of "Gr"', () => {
      expect(normalizeMaterialSpec('SA-516 Grade 70')).toBe('SA-516 Gr 70');
    });

    it('should return null for unknown material', () => {
      expect(normalizeMaterialSpec('UNKNOWN')).toBeNull();
    });
  });

  describe('getAllowableStressNormalized', () => {
    it('should work with normalized material spec', () => {
      const result = getAllowableStressNormalized('sa-516 gr 70', 100);
      
      expect(result.stress).toBe(20000);
      expect(result.status).toBe('ok');
      expect(result.normalizedSpec).toBe('SA-516 Gr 70');
    });

    it('should return error for unknown material', () => {
      const result = getAllowableStressNormalized('UNKNOWN', 100);
      
      expect(result.stress).toBeNull();
      expect(result.status).toBe('error');
    });
  });

  describe('Interpolation accuracy', () => {
    it('should interpolate SA-516 Gr 70 at 775°F correctly', () => {
      const result = getAllowableStress('SA-516 Gr 70', 775);
      
      // At 750°F: 19400 psi, at 800°F: 17500 psi
      // Interpolated: 19400 + (17500 - 19400) * (775 - 750) / (800 - 750)
      // = 19400 + (-1900) * 0.5 = 18450 psi
      expect(result.stress).toBe(18450);
      expect(result.status).toBe('ok_interpolated');
    });

    it('should interpolate SA-240 Type 316L at 450°F correctly', () => {
      const result = getAllowableStress('SA-240 Type 316L', 450);
      
      // At 400°F: 15800 psi, at 500°F: 14600 psi
      // Interpolated: 15800 + (14600 - 15800) * (450 - 400) / (500 - 400)
      // = 15800 + (-1200) * 0.5 = 15200 psi
      expect(result.stress).toBe(15200);
      expect(result.status).toBe('ok_interpolated');
    });
  });
});
