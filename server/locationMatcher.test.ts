import { describe, it, expect } from 'vitest';
import {
  normalizeLocation,
  extractBaseLocation,
  extractAngularPosition,
  calculateLocationSimilarity,
  matchReadingsByLocation,
  ExistingCML,
  NewReading,
} from './locationMatcher';

describe('Location Matcher Utility', () => {
  describe('normalizeLocation', () => {
    it('should normalize feet indicators', () => {
      expect(normalizeLocation("2 ft")).toBe("2'");
      expect(normalizeLocation("2 feet")).toBe("2'");
      expect(normalizeLocation("2'")).toBe("2'");
    });

    it('should normalize o\'clock variations', () => {
      expect(normalizeLocation("12 O'Clock")).toBe("12 oclock");
      expect(normalizeLocation("12 o clock")).toBe("12 oclock");
      expect(normalizeLocation("12 O'clock")).toBe("12 oclock");
    });

    it('should handle empty and null-like inputs', () => {
      expect(normalizeLocation("")).toBe("");
      expect(normalizeLocation("  ")).toBe("");
    });

    it('should normalize whitespace', () => {
      expect(normalizeLocation("  East  Head  ")).toBe("east head");
    });
  });

  describe('extractBaseLocation', () => {
    it('should extract base from slice-angle format', () => {
      expect(extractBaseLocation("8-45")).toBe("8");
      expect(extractBaseLocation("10-90")).toBe("10");
      expect(extractBaseLocation("22-315")).toBe("22");
    });

    it('should return normalized location for non-slice format', () => {
      expect(extractBaseLocation("East Head 12 O'Clock")).toBe("east head 12 oclock");
      expect(extractBaseLocation("2'")).toBe("2'");
    });
  });

  describe('extractAngularPosition', () => {
    it('should extract angle from slice-angle format', () => {
      expect(extractAngularPosition("8-45")).toBe(45);
      expect(extractAngularPosition("10-90")).toBe(90);
      expect(extractAngularPosition("22-315")).toBe(315);
    });

    it('should return null for non-slice format', () => {
      expect(extractAngularPosition("East Head")).toBeNull();
      expect(extractAngularPosition("2'")).toBeNull();
    });
  });

  describe('calculateLocationSimilarity', () => {
    it('should return 1.0 for exact matches', () => {
      expect(calculateLocationSimilarity("2'", "2'")).toBe(1.0);
      expect(calculateLocationSimilarity("East Head", "east head")).toBe(1.0);
    });

    it('should return high similarity for similar locations', () => {
      const similarity = calculateLocationSimilarity("East Head 12 O'Clock", "East Head 12 Oclock");
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return low similarity for different locations', () => {
      const similarity = calculateLocationSimilarity("East Head", "West Head");
      expect(similarity).toBeLessThan(0.8);
    });
  });

  describe('matchReadingsByLocation', () => {
    const existingCMLs: ExistingCML[] = [
      { id: '1', cmlNumber: '1', location: "2'", component: 'Shell', angularPosition: 0 },
      { id: '2', cmlNumber: '2', location: "2'", component: 'Shell', angularPosition: 45 },
      { id: '3', cmlNumber: '3', location: "2'", component: 'Shell', angularPosition: 90 },
      { id: '4', cmlNumber: '4', location: "East Head 12 O'Clock", component: 'East Head' },
      { id: '5', cmlNumber: '5', location: "4'", component: 'Shell', angularPosition: 0 },
    ];

    it('should match by exact location', () => {
      const newReadings: NewReading[] = [
        { cmlNumber: '10', location: "East Head 12 O'Clock", component: 'East Head', thickness: 0.543 },
      ];

      const result = matchReadingsByLocation(existingCMLs, newReadings);
      
      expect(result.matched.length).toBe(1);
      expect(result.matched[0].existingCmlId).toBe('4');
      expect(result.matched[0].confidence).toBe(1.0);
    });

    it('should match by location + angular position', () => {
      const newReadings: NewReading[] = [
        { cmlNumber: '20', location: "2'", component: 'Shell', angularPosition: 45, thickness: 0.641 },
      ];

      const result = matchReadingsByLocation(existingCMLs, newReadings);
      
      expect(result.matched.length).toBe(1);
      expect(result.matched[0].existingCmlId).toBe('2');
    });

    it('should report unmatched readings', () => {
      const newReadings: NewReading[] = [
        { cmlNumber: '99', location: "Unknown Location", component: 'Unknown', thickness: 0.5 },
      ];

      const result = matchReadingsByLocation(existingCMLs, newReadings, { minConfidence: 0.9 });
      
      expect(result.unmatched.length).toBe(1);
      expect(result.matched.length).toBe(0);
    });

    it('should calculate correct match rate', () => {
      const newReadings: NewReading[] = [
        { cmlNumber: '10', location: "East Head 12 O'Clock", component: 'East Head', thickness: 0.543 },
        { cmlNumber: '20', location: "2'", component: 'Shell', angularPosition: 0, thickness: 0.640 },
        { cmlNumber: '99', location: "Nonexistent", component: 'Unknown', thickness: 0.5 },
      ];

      const result = matchReadingsByLocation(existingCMLs, newReadings, { minConfidence: 0.9 });
      
      expect(result.summary.totalNew).toBe(3);
      expect(result.summary.matchedCount).toBe(2);
      expect(result.summary.unmatchedCount).toBe(1);
      expect(result.summary.matchRate).toBeCloseTo(2/3, 2);
    });

    it('should not match same existing CML twice', () => {
      const newReadings: NewReading[] = [
        { cmlNumber: '10', location: "East Head 12 O'Clock", component: 'East Head', thickness: 0.543 },
        { cmlNumber: '11', location: "East Head 12 O'Clock", component: 'East Head', thickness: 0.545 },
      ];

      const result = matchReadingsByLocation(existingCMLs, newReadings);
      
      // First one matches, second one should be unmatched (CML already used)
      expect(result.matched.length).toBe(1);
      expect(result.unmatched.length).toBe(1);
    });
  });
});
