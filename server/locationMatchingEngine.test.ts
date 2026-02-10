/**
 * Tests for Location Matching Engine
 * Verifies correct matching of TML readings based on physical location
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLocationSimilarity,
  parseCmlNamingConvention,
  normalizeComponentType,
  TmlLocation,
} from './locationMatchingEngine';

describe('Location Matching Engine - Angle Wraparound Logic', () => {
  
  describe('parseCmlNamingConvention', () => {
    it('should parse slice-angle format correctly', () => {
      expect(parseCmlNamingConvention('10-0')).toEqual({
        sliceNumber: 10,
        circumferentialPosition: 0,
        raw: '10-0'
      });
      
      expect(parseCmlNamingConvention('10-315')).toEqual({
        sliceNumber: 10,
        circumferentialPosition: 315,
        raw: '10-315'
      });
    });
  });

  describe('calculateLocationSimilarity - Circular Angle Wraparound', () => {
    it('should match exact circumferential positions', () => {
      const existing: TmlLocation = {
        legacyLocationId: '10-0',
        componentType: 'Shell',
        locationDescription: 'Top',
        sliceNumber: 10,
        circumferentialPosition: 0,
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '10-0',
        componentType: 'Shell',
        locationDescription: 'Top',
        sliceNumber: 10,
        circumferentialPosition: 0,
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      expect(result.score).toBeGreaterThanOrEqual(0.9); // High score for exact match
    });

    it('should recognize adjacent positions within 45 degrees', () => {
      const existing: TmlLocation = {
        legacyLocationId: '10-0',
        componentType: 'Shell',
        locationDescription: 'Position A',
        sliceNumber: 10,
        circumferentialPosition: 0,
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '10-45',
        componentType: 'Shell',
        locationDescription: 'Position B',
        sliceNumber: 10,
        circumferentialPosition: 45,
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      // Should get partial credit for adjacent position (within 45°)
      expect(result.score).toBeGreaterThan(0.6); // Component + slice + adjacent bonus
      expect(result.score).toBeLessThan(0.9); // Not exact match
      expect(result.reason).toContain('Adjacent');
    });

    it('should handle wraparound at 0°/360° boundary (350° to 10°)', () => {
      const existing: TmlLocation = {
        legacyLocationId: '10-350',
        componentType: 'Shell',
        locationDescription: 'Position A',
        sliceNumber: 10,
        circumferentialPosition: 350, // Near 360°
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '10-10',
        componentType: 'Shell',
        locationDescription: 'Position B',
        sliceNumber: 10,
        circumferentialPosition: 10, // Near 0°
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      
      // Debug: log the actual result
      console.log('350° to 10° match result:', JSON.stringify(result, null, 2));
      
      // The actual angular difference is min(|350-10|, 360-|350-10|) = min(340, 20) = 20°
      // This is within 45°, so it should get the adjacent position bonus
      // The code correctly handles this: Math.abs(350-10) = 340, and 340 >= 315 triggers the bonus
      // because wraparound distance = 360-340 = 20° <= 45°
      expect(result.score).toBeGreaterThan(0.6); // Should get adjacent bonus
      expect(result.reason).toContain('Adjacent'); // Should mention adjacent position
    });

    it('should handle wraparound at 0°/360° boundary (315° to 0°)', () => {
      const existing: TmlLocation = {
        legacyLocationId: '8-315',
        componentType: 'Shell',
        locationDescription: 'Position A',
        sliceNumber: 8,
        circumferentialPosition: 315,
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '8-0',
        componentType: 'Shell',
        locationDescription: 'Position B',
        sliceNumber: 8,
        circumferentialPosition: 0,
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      
      // The actual angular difference is min(|315-0|, 360-|315-0|) = min(315, 45) = 45°
      // This is exactly 45°, so it should get the adjacent position bonus
      expect(result.score).toBeGreaterThan(0.6); // Should get adjacent bonus
      expect(result.reason).toContain('Adjacent'); // Should mention adjacent position
    });

    it('should NOT give adjacent bonus for positions >45° apart (90° example)', () => {
      const existing: TmlLocation = {
        legacyLocationId: '10-0',
        componentType: 'Shell',
        locationDescription: 'Position A',
        sliceNumber: 10,
        circumferentialPosition: 0,
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '10-90',
        componentType: 'Shell',
        locationDescription: 'Position B',
        sliceNumber: 10,
        circumferentialPosition: 90,
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      
      // 90° apart - should NOT get adjacent bonus
      expect(result.score).toBeLessThanOrEqual(0.65); // Only component + slice, no adjacent
      expect(result.reason).not.toContain('Adjacent');
    });

    it('should NOT give adjacent bonus for opposite positions (180° apart)', () => {
      const existing: TmlLocation = {
        legacyLocationId: '10-0',
        componentType: 'Shell',
        locationDescription: 'Position A',
        sliceNumber: 10,
        circumferentialPosition: 0,
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '10-180',
        componentType: 'Shell',
        locationDescription: 'Position B',
        sliceNumber: 10,
        circumferentialPosition: 180,
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      
      // 180° apart - should NOT get adjacent bonus
      expect(result.score).toBeLessThanOrEqual(0.65);
      expect(result.reason).not.toContain('Adjacent');
    });

    it('Edge case: 200° to 50° should NOT match (150° apart, or 210° the other way)', () => {
      const existing: TmlLocation = {
        legacyLocationId: '10-200',
        componentType: 'Shell',
        locationDescription: 'Position A',
        sliceNumber: 10,
        circumferentialPosition: 200,
      };
      
      const newLoc: TmlLocation = {
        legacyLocationId: '10-50',
        componentType: 'Shell',
        locationDescription: 'Position B',
        sliceNumber: 10,
        circumferentialPosition: 50,
      };
      
      const result = calculateLocationSimilarity(existing, newLoc);
      
      console.log('200° to 50° (150° apart) match result:', JSON.stringify(result, null, 2));
      
      // Actual difference: |200-50| = 150°
      // Circular distance: min(150, 210) = 150° - more than 45°
      // Should NOT get adjacent bonus
      expect(result.score).toBeLessThanOrEqual(0.65);
      expect(result.reason).not.toContain('Adjacent');
    });
  });

  describe('Component Type Normalization', () => {
    it('should normalize component types consistently', () => {
      expect(normalizeComponentType('Shell')).toBe('shell');
      expect(normalizeComponentType('SHELL')).toBe('shell');
      expect(normalizeComponentType('shell')).toBe('shell');
      expect(normalizeComponentType('East Head')).toBe('east_head');
      expect(normalizeComponentType('EAST HEAD')).toBe('east_head');
    });
  });
});
