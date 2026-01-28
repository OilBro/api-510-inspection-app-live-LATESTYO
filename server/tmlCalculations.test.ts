/**
 * TML Calculation Engine Tests
 * 
 * Tests for all TML calculation functions per API 510 and ASME specifications.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGoverningThickness,
  calculateCorrosionRates,
  calculateRemainingLife,
  calculateNextInspection,
  determineStatus,
  calculateMetalLoss,
  calculateCompleteTML,
} from './tmlCalculations';

describe('TML Calculation Engine', () => {
  describe('calculateGoverningThickness', () => {
    it('should return minimum of all valid readings', () => {
      const result = calculateGoverningThickness({
        tml1: 0.500,
        tml2: 0.480,
        tml3: 0.510,
        tml4: 0.490,
        tml5: null,
        tml6: null,
        tml7: null,
        tml8: null,
      });

      expect(result.tActual).toBe(0.480);
      expect(result.minPosition).toBe('90°');
      expect(result.readingsUsed).toBe(4);
    });

    it('should handle 8-angle readings', () => {
      const result = calculateGoverningThickness({
        tml1: 0.500,
        tml2: 0.480,
        tml3: 0.510,
        tml4: 0.490,
        tml5: 0.470,
        tml6: 0.495,
        tml7: 0.485,
        tml8: 0.505,
      });

      expect(result.tActual).toBe(0.470);
      expect(result.minPosition).toBe('45°');
      expect(result.readingsUsed).toBe(8);
    });

    it('should throw error when no valid readings provided', () => {
      expect(() => calculateGoverningThickness({
        tml1: null,
        tml2: null,
        tml3: null,
        tml4: null,
      })).toThrow('CALCULATION HALTED: No valid thickness readings provided');
    });

    it('should ignore zero and negative readings', () => {
      const result = calculateGoverningThickness({
        tml1: 0.500,
        tml2: 0,
        tml3: -0.1,
        tml4: 0.490,
      });

      expect(result.tActual).toBe(0.490);
      expect(result.readingsUsed).toBe(2);
    });
  });

  describe('calculateCorrosionRates', () => {
    it('should calculate short-term rate correctly', () => {
      const result = calculateCorrosionRates({
        tActual: 0.480,
        nominalThickness: null,
        previousThickness: 0.500,
        previousInspectionDate: new Date('2020-01-01'),
        currentInspectionDate: new Date('2025-01-01'),
        originalInstallDate: null,
      });

      expect(result.shortTermRate).toBeCloseTo(0.004, 4);
      expect(result.rateType).toBe('ST');
      expect(result.dataQualityStatus).toBe('good');
    });

    it('should calculate long-term rate correctly', () => {
      const result = calculateCorrosionRates({
        tActual: 0.480,
        nominalThickness: 0.500,
        previousThickness: null,
        previousInspectionDate: null,
        currentInspectionDate: new Date('2025-01-01'),
        originalInstallDate: new Date('2015-01-01'),
      });

      expect(result.longTermRate).toBeCloseTo(0.002, 4);
      expect(result.rateType).toBe('LT');
    });

    it('should select MAX of ST and LT as governing rate', () => {
      const result = calculateCorrosionRates({
        tActual: 0.480,
        nominalThickness: 0.500,
        previousThickness: 0.490,
        previousInspectionDate: new Date('2023-01-01'),
        currentInspectionDate: new Date('2025-01-01'),
        originalInstallDate: new Date('2015-01-01'),
      });

      // ST = (0.490 - 0.480) / 2 = 0.005 in/yr
      // LT = (0.500 - 0.480) / 10 = 0.002 in/yr
      // Governing = MAX(0.005, 0.002) = 0.005 (ST)
      expect(result.governingRate).toBeCloseTo(0.005, 4);
      expect(result.rateType).toBe('ST');
    });

    it('should flag negative corrosion rate as growth error', () => {
      const result = calculateCorrosionRates({
        tActual: 0.510,
        nominalThickness: null,
        previousThickness: 0.500,
        previousInspectionDate: new Date('2020-01-01'),
        currentInspectionDate: new Date('2025-01-01'),
        originalInstallDate: null,
      });

      expect(result.dataQualityStatus).toBe('growth_error');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should convert rate to mpy correctly', () => {
      const result = calculateCorrosionRates({
        tActual: 0.480,
        nominalThickness: null,
        previousThickness: 0.500,
        previousInspectionDate: new Date('2020-01-01'),
        currentInspectionDate: new Date('2025-01-01'),
        originalInstallDate: null,
      });

      // 0.004 in/yr * 1000 = 4 mpy
      expect(result.rateMpy).toBeCloseTo(4, 1);
    });
  });

  describe('calculateRemainingLife', () => {
    it('should calculate remaining life per API 510 §7.1.1', () => {
      const result = calculateRemainingLife({
        tActual: 0.480,
        tRequired: 0.250,
        corrosionRate: 0.005,
      });

      // RL = (0.480 - 0.250) / 0.005 = 46 years
      expect(result.remainingLife).toBeCloseTo(46, 0);
      expect(result.status).toBe('acceptable');
      expect(result.reference).toBe('API 510 §7.1.1');
    });

    it('should return 0 when at or below minimum', () => {
      const result = calculateRemainingLife({
        tActual: 0.250,
        tRequired: 0.250,
        corrosionRate: 0.005,
      });

      expect(result.remainingLife).toBe(0);
      expect(result.status).toBe('critical');
    });

    it('should flag alert status when RL ≤ 4 years', () => {
      const result = calculateRemainingLife({
        tActual: 0.268,
        tRequired: 0.250,
        corrosionRate: 0.005,
      });

      // RL = (0.268 - 0.250) / 0.005 = 3.6 years (< 4)
      expect(result.remainingLife).toBeCloseTo(3.6, 1);
      expect(result.status).toBe('alert');
      expect(result.message).toContain('Internal inspection required');
    });

    it('should throw error for invalid inputs', () => {
      expect(() => calculateRemainingLife({
        tActual: 0.480,
        tRequired: 0.250,
        corrosionRate: 0,
      })).toThrow('CALCULATION HALTED');
    });
  });

  describe('calculateNextInspection', () => {
    it('should calculate next inspection as MIN(RL/2, 10)', () => {
      const result = calculateNextInspection(20, new Date('2025-01-01'));

      // MIN(20/2, 10) = MIN(10, 10) = 10 years
      expect(result.interval).toBe(10);
      expect(result.inspectionType).toBe('External');
    });

    it('should cap interval at 10 years', () => {
      const result = calculateNextInspection(50, new Date('2025-01-01'));

      expect(result.interval).toBe(10);
    });

    it('should require internal inspection when RL ≤ 4 years', () => {
      const result = calculateNextInspection(4, new Date('2025-01-01'));

      expect(result.interval).toBe(2);
      expect(result.inspectionType).toBe('Internal');
    });

    it('should return immediate action when RL ≤ 0', () => {
      const result = calculateNextInspection(0, new Date('2025-01-01'));

      expect(result.interval).toBe(0);
      expect(result.inspectionType).toBe('IMMEDIATE');
    });
  });

  describe('determineStatus', () => {
    it('should return critical when t_actual ≤ t_required', () => {
      const result = determineStatus(0.250, 0.250, 1.10);

      expect(result.status).toBe('critical');
      expect(result.message).toContain('NON-COMPLIANT');
    });

    it('should return alert when within threshold', () => {
      const result = determineStatus(0.270, 0.250, 1.10);

      // Alert level = 0.250 * 1.10 = 0.275
      // 0.270 < 0.275, so alert
      expect(result.status).toBe('alert');
      expect(result.message).toContain('ALERT');
    });

    it('should return acceptable when above threshold', () => {
      const result = determineStatus(0.300, 0.250, 1.10);

      // Alert level = 0.250 * 1.10 = 0.275
      // 0.300 > 0.275, so acceptable
      expect(result.status).toBe('acceptable');
      expect(result.message).toContain('ACCEPTABLE');
    });

    it('should return unknown when data is missing', () => {
      const result = determineStatus(null, 0.250, 1.10);

      expect(result.status).toBe('unknown');
    });

    it('should use custom threshold', () => {
      const result = determineStatus(0.260, 0.250, 1.05);

      // Alert level = 0.250 * 1.05 = 0.2625
      // 0.260 < 0.2625, so alert
      expect(result.status).toBe('alert');
    });
  });

  describe('calculateMetalLoss', () => {
    it('should calculate metal loss correctly', () => {
      const result = calculateMetalLoss(0.500, 0.480);

      expect(result.metalLoss).toBeCloseTo(0.020, 4);
      expect(result.metalLossPercent).toBeCloseTo(4, 1);
    });
  });

  describe('calculateCompleteTML', () => {
    it('should perform complete TML calculation', () => {
      const result = calculateCompleteTML({
        readings: {
          tml1: 0.500,
          tml2: 0.480,
          tml3: 0.510,
          tml4: 0.490,
        },
        nominalThickness: 0.500,
        tRequired: 0.250,
        previousThickness: 0.490,
        previousInspectionDate: new Date('2023-01-01'),
        currentInspectionDate: new Date('2025-01-01'),
        originalInstallDate: new Date('2015-01-01'),
        statusThreshold: 1.10,
      });

      expect(result.governingThickness.tActual).toBe(0.480);
      expect(result.corrosionRate.governingRate).not.toBeNull();
      expect(result.remainingLife).not.toBeNull();
      expect(result.nextInspection).not.toBeNull();
      expect(result.status.status).toBe('acceptable');
      expect(result.metalLoss.metalLoss).toBeCloseTo(0.020, 4);
    });
  });
});
