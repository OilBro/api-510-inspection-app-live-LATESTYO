/**
 * Nominal Thickness Resolver Tests
 * =================================
 * Tests the 5-level authority hierarchy for nominal thickness resolution:
 *   1. Table A (most authoritative)
 *   2. TML readings
 *   3. Vessel-level
 *   4. Pipe schedule
 *   5. HARD STOP (unresolved)
 */
import { describe, it, expect } from 'vitest';
import {
  resolveNominalThickness,
  resolveAllNominals,
  lookupPipeSchedule,
  type ResolverInput,
} from './nominalThicknessResolver';

describe('Nominal Thickness Resolver', () => {
  
  // ========================================================================
  // Level 1: Table A (highest authority)
  // ========================================================================
  describe('Level 1: Table A authority', () => {
    it('should resolve from Table A when available', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tableANominal: 0.500,
        tmlNominals: [0.480, 0.490],
        vesselNominal: 0.375,
      });
      
      expect(result.value).toBe(0.500);
      expect(result.source).toBe('table_a');
      expect(result.calculationReady).toBe(true);
      expect(result.candidates.length).toBeGreaterThanOrEqual(3);
    });
    
    it('should prefer Table A over TML and vessel values', () => {
      const result = resolveNominalThickness({
        componentType: 'head',
        componentName: 'East Head',
        tableANominal: 0.625,
        tmlNominals: [0.500],
        vesselNominal: 0.500,
      });
      
      expect(result.value).toBe(0.625);
      expect(result.source).toBe('table_a');
    });
    
    it('should skip Table A when value is 0', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tableANominal: 0,
        tmlNominals: [0.375],
      });
      
      expect(result.source).not.toBe('table_a');
      expect(result.value).toBe(0.375);
    });
    
    it('should skip Table A when value is null', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tableANominal: null,
        tmlNominals: [0.250],
      });
      
      expect(result.source).toBe('tml_reading');
      expect(result.value).toBe(0.250);
    });
    
    it('should skip Table A when value is NaN', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tableANominal: NaN,
        vesselNominal: 0.500,
      });
      
      expect(result.source).toBe('vessel_shell');
      expect(result.value).toBe(0.500);
    });
  });
  
  // ========================================================================
  // Level 2: TML readings
  // ========================================================================
  describe('Level 2: TML readings', () => {
    it('should resolve from TML readings when Table A is unavailable', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tmlNominals: [0.500, 0.490, 0.510],
      });
      
      expect(result.value).toBe(0.490); // Conservative: minimum
      expect(result.source).toBe('tml_reading');
      expect(result.calculationReady).toBe(true);
    });
    
    it('should use minimum TML nominal (conservative per API 510)', () => {
      const result = resolveNominalThickness({
        componentType: 'head',
        componentName: 'West Head',
        tmlNominals: [0.750, 0.625, 0.688],
      });
      
      expect(result.value).toBe(0.625);
    });
    
    it('should skip TML readings when all are zero or invalid', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tmlNominals: [0, NaN, 0],
        vesselNominal: 0.375,
      });
      
      expect(result.source).toBe('vessel_shell');
      expect(result.value).toBe(0.375);
    });
    
    it('should skip TML readings when array is empty', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tmlNominals: [],
        vesselNominal: 0.500,
      });
      
      expect(result.source).toBe('vessel_shell');
    });
  });
  
  // ========================================================================
  // Level 3: Vessel-level
  // ========================================================================
  describe('Level 3: Vessel-level nominal', () => {
    it('should resolve from vessel shell nominal', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        vesselNominal: 0.375,
      });
      
      expect(result.value).toBe(0.375);
      expect(result.source).toBe('vessel_shell');
      expect(result.calculationReady).toBe(true);
    });
    
    it('should resolve from vessel head nominal', () => {
      const result = resolveNominalThickness({
        componentType: 'head',
        componentName: 'East Head',
        vesselNominal: 0.500,
      });
      
      expect(result.value).toBe(0.500);
      expect(result.source).toBe('vessel_head');
      expect(result.calculationReady).toBe(true);
    });
    
    it('should skip vessel nominal when zero', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        vesselNominal: 0,
      });
      
      expect(result.source).toBe('unresolved');
      expect(result.calculationReady).toBe(false);
    });
  });
  
  // ========================================================================
  // Level 4: Pipe schedule
  // ========================================================================
  describe('Level 4: Pipe schedule lookup', () => {
    it('should resolve from pipe schedule when higher sources unavailable', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Pipe Section',
        pipeSchedule: { nps: 8, schedule: '40' },
      });
      
      expect(result.value).toBe(0.322);
      expect(result.source).toBe('pipe_schedule');
      expect(result.calculationReady).toBe(true);
    });
    
    it('should handle schedule aliases (STD, XS)', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Pipe Section',
        pipeSchedule: { nps: 6, schedule: 'XS' },
      });
      
      expect(result.value).toBe(0.432);
      expect(result.source).toBe('pipe_schedule');
    });
    
    it('should handle "Sch 40" format', () => {
      const thickness = lookupPipeSchedule(4, 'Sch 40');
      expect(thickness).toBe(0.237);
    });
    
    it('should handle "Schedule 80" format', () => {
      const thickness = lookupPipeSchedule(6, 'Schedule 80');
      expect(thickness).toBe(0.432);
    });
    
    it('should return null for unknown NPS', () => {
      const thickness = lookupPipeSchedule(99, '40');
      expect(thickness).toBeNull();
    });
    
    it('should return null for unknown schedule', () => {
      const thickness = lookupPipeSchedule(8, '160');
      expect(thickness).toBeNull();
    });
  });
  
  // ========================================================================
  // Level 5: HARD STOP (unresolved)
  // ========================================================================
  describe('Level 5: HARD STOP (unresolved)', () => {
    it('should return unresolved when no sources available', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
      });
      
      expect(result.value).toBeNull();
      expect(result.source).toBe('unresolved');
      expect(result.calculationReady).toBe(false);
      expect(result.reason).toContain('HARD STOP');
      expect(result.reason).toContain('Vessel Shell');
    });
    
    it('should return unresolved when all sources are invalid', () => {
      const result = resolveNominalThickness({
        componentType: 'head',
        componentName: 'West Head',
        tableANominal: 0,
        tmlNominals: [0, NaN],
        vesselNominal: null,
      });
      
      expect(result.value).toBeNull();
      expect(result.source).toBe('unresolved');
      expect(result.calculationReady).toBe(false);
    });
    
    it('should include all candidates in the audit trail', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tableANominal: null,
        tmlNominals: [],
        vesselNominal: 0,
      });
      
      expect(result.candidates.length).toBeGreaterThanOrEqual(3);
      const sources = result.candidates.map(c => c.source);
      expect(sources).toContain('table_a');
      expect(sources).toContain('tml_reading');
      expect(sources).toContain('vessel_shell');
    });
  });
  
  // ========================================================================
  // Batch resolution (resolveAllNominals)
  // ========================================================================
  describe('resolveAllNominals (batch)', () => {
    it('should resolve multiple components independently', () => {
      const results = resolveAllNominals(
        [
          { componentType: 'shell', componentName: 'Vessel Shell', tmlNominals: [0.375] },
          { componentType: 'head', componentName: 'East Head', tmlNominals: [0.500] },
        ],
        {
          shellNominalThickness: '0.375',
          headNominalThickness: '0.500',
        }
      );
      
      expect(results.size).toBe(2);
      
      const shell = results.get('Vessel Shell');
      expect(shell?.value).toBe(0.375);
      expect(shell?.calculationReady).toBe(true);
      
      const head = results.get('East Head');
      expect(head?.value).toBe(0.500);
      expect(head?.calculationReady).toBe(true);
    });
    
    it('should use Table A when provided', () => {
      const results = resolveAllNominals(
        [
          { componentType: 'shell', componentName: 'Vessel Shell', tmlNominals: [0.375] },
        ],
        { shellNominalThickness: '0.375' },
        [{ componentName: 'Shell', nominalThickness: 0.500 }]
      );
      
      const shell = results.get('Vessel Shell');
      expect(shell?.value).toBe(0.500);
      expect(shell?.source).toBe('table_a');
    });
    
    it('should fall through to vessel-level when TML nominals are empty', () => {
      const results = resolveAllNominals(
        [
          { componentType: 'shell', componentName: 'Vessel Shell', tmlNominals: [] },
        ],
        { shellNominalThickness: '0.625' }
      );
      
      const shell = results.get('Vessel Shell');
      expect(shell?.value).toBe(0.625);
      expect(shell?.source).toBe('vessel_shell');
    });
    
    it('should flag unresolved when no data available', () => {
      const results = resolveAllNominals(
        [
          { componentType: 'head', componentName: 'West Head', tmlNominals: [] },
        ],
        {}
      );
      
      const head = results.get('West Head');
      expect(head?.value).toBeNull();
      expect(head?.source).toBe('unresolved');
      expect(head?.calculationReady).toBe(false);
    });
  });
  
  // ========================================================================
  // Pipe Schedule Lookup
  // ========================================================================
  describe('lookupPipeSchedule', () => {
    it('should return correct wall thickness for common sizes', () => {
      expect(lookupPipeSchedule(2, '40')).toBe(0.154);
      expect(lookupPipeSchedule(4, '80')).toBe(0.337);
      expect(lookupPipeSchedule(8, 'STD')).toBe(0.322);
      expect(lookupPipeSchedule(12, 'XS')).toBe(0.500);
      expect(lookupPipeSchedule(24, '40')).toBe(0.688);
    });
    
    it('should handle case-insensitive schedule names', () => {
      expect(lookupPipeSchedule(6, 'std')).toBe(0.280);
      expect(lookupPipeSchedule(6, 'STD')).toBe(0.280);
      expect(lookupPipeSchedule(6, 'xs')).toBe(0.432);
    });
    
    it('should strip "Sch" and "Schedule" prefixes', () => {
      expect(lookupPipeSchedule(8, 'Sch 40')).toBe(0.322);
      expect(lookupPipeSchedule(8, 'Schedule 80')).toBe(0.500);
      expect(lookupPipeSchedule(8, 'SCH40')).toBe(0.322);
    });
  });
  
  // ========================================================================
  // Edge cases
  // ========================================================================
  describe('Edge cases', () => {
    it('should handle negative Table A value (skip it)', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Vessel Shell',
        tableANominal: -0.5,
        vesselNominal: 0.375,
      });
      
      // Negative values are not > 0, so should skip to vessel level
      expect(result.source).toBe('vessel_shell');
      expect(result.value).toBe(0.375);
    });
    
    it('should handle very small but valid thickness', () => {
      const result = resolveNominalThickness({
        componentType: 'shell',
        componentName: 'Thin Shell',
        tableANominal: 0.0625, // 1/16"
      });
      
      expect(result.value).toBe(0.0625);
      expect(result.calculationReady).toBe(true);
    });
    
    it('should handle single TML nominal', () => {
      const result = resolveNominalThickness({
        componentType: 'head',
        componentName: 'North Head',
        tmlNominals: [0.750],
      });
      
      expect(result.value).toBe(0.750);
      expect(result.source).toBe('tml_reading');
    });
  });
});
