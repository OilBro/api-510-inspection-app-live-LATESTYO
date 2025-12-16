/**
 * Head Detection Logic Tests
 * 
 * Tests the improved head detection logic that matches various naming conventions
 * for East Head and West Head components, including location field detection.
 */

import { describe, it, expect } from 'vitest';

// Replicate the head detection logic from routers.ts and professionalReportRouters.ts
// Updated to include location field checking
function isEastHead(component: string, componentType: string, location?: string): boolean {
  const comp = (component || '').toLowerCase();
  const compType = (componentType || '').toLowerCase();
  const loc = (location || '').toLowerCase();
  const combined = `${comp} ${compType}`;
  
  // Explicit east head matches (check location too)
  if (combined.includes('east') || loc.includes('east head')) return true;
  if (combined.includes('e head')) return true;
  if (combined.includes('head 1') || combined.includes('head-1')) return true;
  if (combined.includes('left head')) return true;
  
  // If it's a head but not explicitly west/right, treat as east (first head)
  // Exclude if location indicates west head
  if ((combined.includes('head') && !combined.includes('shell')) &&
      !combined.includes('west') && !combined.includes('w head') &&
      !combined.includes('head 2') && !combined.includes('head-2') &&
      !combined.includes('right') && !loc.includes('west')) {
    return true;
  }
  return false;
}

function isWestHead(component: string, componentType: string, location?: string): boolean {
  const comp = (component || '').toLowerCase();
  const compType = (componentType || '').toLowerCase();
  const loc = (location || '').toLowerCase();
  const combined = `${comp} ${compType}`;
  
  // Explicit west head matches (check location too)
  if (combined.includes('west') || loc.includes('west head')) return true;
  if (combined.includes('w head')) return true;
  if (combined.includes('head 2') || combined.includes('head-2')) return true;
  if (combined.includes('right head')) return true;
  
  return false;
}

describe('Head Detection Logic', () => {
  describe('Location Field Detection (Critical Fix)', () => {
    it('should detect West Head from location field when component is generic "Head"', () => {
      // This is the key case: component="Head", componentType="Head", location="West Head"
      expect(isWestHead('Head', 'Head', 'West Head')).toBe(true);
    });

    it('should detect East Head from location field when component is generic "Head"', () => {
      expect(isEastHead('Head', 'Head', 'East Head')).toBe(true);
    });

    it('should NOT detect generic "Head" as East Head when location says "West Head"', () => {
      expect(isEastHead('Head', 'Head', 'West Head')).toBe(false);
    });

    it('should handle location with additional info like "West Head 6-0"', () => {
      expect(isWestHead('Head', 'Head', 'West Head 6-0')).toBe(true);
      expect(isEastHead('Head', 'Head', 'East Head 6-0')).toBe(true);
    });
  });

  describe('East Head Detection', () => {
    it('should detect "East Head" explicitly', () => {
      expect(isEastHead('East Head', '')).toBe(true);
      expect(isEastHead('', 'East Head')).toBe(true);
      expect(isEastHead('east head', '')).toBe(true);
    });

    it('should detect "E Head" variant', () => {
      expect(isEastHead('E Head', '')).toBe(true);
      expect(isEastHead('e head', '')).toBe(true);
    });

    it('should detect "Head 1" and "Head-1" variants', () => {
      expect(isEastHead('Head 1', '')).toBe(true);
      expect(isEastHead('Head-1', '')).toBe(true);
      expect(isEastHead('head 1', '')).toBe(true);
      expect(isEastHead('head-1', '')).toBe(true);
    });

    it('should detect "Left Head" variant', () => {
      expect(isEastHead('Left Head', '')).toBe(true);
      expect(isEastHead('left head', '')).toBe(true);
    });

    it('should detect generic "Head" as East Head (default) when no location specified', () => {
      expect(isEastHead('Head', '')).toBe(true);
      expect(isEastHead('Vessel Head', '')).toBe(true);
      expect(isEastHead('', 'head')).toBe(true);
    });

    it('should NOT detect West Head variants as East Head', () => {
      expect(isEastHead('West Head', '')).toBe(false);
      expect(isEastHead('W Head', '')).toBe(false);
      expect(isEastHead('Head 2', '')).toBe(false);
      expect(isEastHead('Head-2', '')).toBe(false);
      expect(isEastHead('Right Head', '')).toBe(false);
    });

    it('should NOT detect Shell as East Head', () => {
      expect(isEastHead('Shell', '')).toBe(false);
      expect(isEastHead('Vessel Shell', '')).toBe(false);
    });
  });

  describe('West Head Detection', () => {
    it('should detect "West Head" explicitly', () => {
      expect(isWestHead('West Head', '')).toBe(true);
      expect(isWestHead('', 'West Head')).toBe(true);
      expect(isWestHead('west head', '')).toBe(true);
    });

    it('should detect "W Head" variant', () => {
      expect(isWestHead('W Head', '')).toBe(true);
      expect(isWestHead('w head', '')).toBe(true);
    });

    it('should detect "Head 2" and "Head-2" variants', () => {
      expect(isWestHead('Head 2', '')).toBe(true);
      expect(isWestHead('Head-2', '')).toBe(true);
      expect(isWestHead('head 2', '')).toBe(true);
      expect(isWestHead('head-2', '')).toBe(true);
    });

    it('should detect "Right Head" variant', () => {
      expect(isWestHead('Right Head', '')).toBe(true);
      expect(isWestHead('right head', '')).toBe(true);
    });

    it('should NOT detect East Head variants as West Head', () => {
      expect(isWestHead('East Head', '')).toBe(false);
      expect(isWestHead('E Head', '')).toBe(false);
      expect(isWestHead('Head 1', '')).toBe(false);
      expect(isWestHead('Head-1', '')).toBe(false);
      expect(isWestHead('Left Head', '')).toBe(false);
    });

    it('should NOT detect generic "Head" as West Head', () => {
      expect(isWestHead('Head', '')).toBe(false);
      expect(isWestHead('Vessel Head', '')).toBe(false);
    });
  });

  describe('Component Type Field Support', () => {
    it('should check both component and componentType fields', () => {
      // East Head in componentType field
      expect(isEastHead('', 'East Head')).toBe(true);
      expect(isEastHead('Some Component', 'east head')).toBe(true);
      
      // West Head in componentType field
      expect(isWestHead('', 'West Head')).toBe(true);
      expect(isWestHead('Some Component', 'west head')).toBe(true);
    });

    it('should combine component and componentType for matching', () => {
      // "east" in component, "head" in componentType
      expect(isEastHead('east', 'head')).toBe(true);
      
      // "west" in component, "head" in componentType
      expect(isWestHead('west', 'head')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined values', () => {
      expect(isEastHead(null as any, null as any)).toBe(false);
      expect(isWestHead(null as any, null as any)).toBe(false);
      expect(isEastHead(undefined as any, undefined as any)).toBe(false);
      expect(isWestHead(undefined as any, undefined as any)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isEastHead('', '')).toBe(false);
      expect(isWestHead('', '')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isEastHead('EAST HEAD', '')).toBe(true);
      expect(isEastHead('East HEAD', '')).toBe(true);
      expect(isWestHead('WEST HEAD', '')).toBe(true);
      expect(isWestHead('West HEAD', '')).toBe(true);
    });
  });
});
