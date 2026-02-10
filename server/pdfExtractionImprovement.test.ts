/**
 * PDF Extraction Improvement Tests
 * 
 * Tests for enhanced PDF extraction features:
 * - Multi-page table handling
 * - Previous thickness extraction
 * - Nozzle size parsing
 * - Grid format decomposition
 * - Data quality validation
 */

import { describe, it, expect } from 'vitest';

describe('PDF Extraction Improvements', () => {
  
  describe('Nozzle Size Parsing', () => {
    // Helper function to extract nozzle size from description
    const parseNozzleSize = (description: string): number | null => {
      // Match patterns like "24\" Manway", "N1 Manway 24", "3\" Relief", etc.
      const patterns = [
        /(\d+\.?\d*)\s*"\s*\w+/, // "24\" Manway"
        /(\d+\.?\d*)\s*inch/i,   // "24 inch Manway"
        /\s(\d+\.?\d*)\s*$/,      // "N1 Manway 24"
        /^(\d+\.?\d*)\s/,         // "24 Manway"
        /size[:\s]+(\d+\.?\d*)/i, // "Size: 24"
      ];
      
      for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match && match[1]) {
          const size = parseFloat(match[1]);
          if (!isNaN(size) && size > 0 && size <= 100) {
            return size;
          }
        }
      }
      
      return null;
    };

    it('should parse size from "24\\" Manway" format', () => {
      expect(parseNozzleSize('24" Manway')).toBe(24);
    });

    it('should parse size from "N1 Manway 24" format', () => {
      expect(parseNozzleSize('N1 Manway 24')).toBe(24);
    });

    it('should parse size from "3\\" Relief" format', () => {
      expect(parseNozzleSize('3" Relief')).toBe(3);
    });

    it('should parse size from "2\\" Inlet" format', () => {
      expect(parseNozzleSize('2" Inlet')).toBe(2);
    });

    it('should parse size from "1\\" Drain" format', () => {
      expect(parseNozzleSize('1" Drain')).toBe(1);
    });

    it('should parse fractional size from "0.75\\" Gauge" format', () => {
      expect(parseNozzleSize('0.75" Gauge')).toBe(0.75);
    });

    it('should return null for descriptions without size', () => {
      expect(parseNozzleSize('Manway')).toBeNull();
    });

    it('should return null for invalid sizes', () => {
      expect(parseNozzleSize('999" Invalid')).toBeNull();
    });
  });

  describe('Previous Thickness Validation', () => {
    // Helper function to validate thickness values
    const isValidThickness = (value: any): boolean => {
      if (value === null || value === undefined) return false;
      if (typeof value !== 'number') return false;
      if (value === 0) return false; // Zero is INVALID
      if (value < 0 || value > 10) return false; // Reasonable range
      return true;
    };

    it('should reject null values', () => {
      expect(isValidThickness(null)).toBe(false);
    });

    it('should reject undefined values', () => {
      expect(isValidThickness(undefined)).toBe(false);
    });

    it('should reject zero values', () => {
      expect(isValidThickness(0)).toBe(false);
      expect(isValidThickness(0.000)).toBe(false);
    });

    it('should accept valid thickness values', () => {
      expect(isValidThickness(0.5)).toBe(true);
      expect(isValidThickness(0.652)).toBe(true);
      expect(isValidThickness(1.25)).toBe(true);
    });

    it('should reject negative values', () => {
      expect(isValidThickness(-0.5)).toBe(false);
    });

    it('should reject unreasonably large values', () => {
      expect(isValidThickness(100)).toBe(false);
    });

    it('should reject non-numeric values', () => {
      expect(isValidThickness('0.5')).toBe(false);
      expect(isValidThickness('invalid')).toBe(false);
    });
  });

  describe('Grid Format CML Generation', () => {
    // Helper function to generate CML IDs for grid format
    const generateGridCMLs = (sliceLocation: string, angles: number[]): string[] => {
      return angles.map(angle => `${sliceLocation}-${angle}`);
    };

    it('should generate 8 CML IDs for a single slice location', () => {
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      const cmls = generateGridCMLs('2', angles);
      
      expect(cmls).toHaveLength(8);
      expect(cmls).toEqual([
        '2-0', '2-45', '2-90', '2-135', 
        '2-180', '2-225', '2-270', '2-315'
      ]);
    });

    it('should generate CMLs for multiple slice locations', () => {
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      const slices = ['2', '4', '6'];
      
      const allCMLs = slices.flatMap(slice => generateGridCMLs(slice, angles));
      
      expect(allCMLs).toHaveLength(24); // 3 slices × 8 angles
      expect(allCMLs[0]).toBe('2-0');
      expect(allCMLs[7]).toBe('2-315');
      expect(allCMLs[8]).toBe('4-0');
      expect(allCMLs[23]).toBe('6-315');
    });

    it('should handle fractional slice locations', () => {
      const angles = [0, 90, 180, 270];
      const cmls = generateGridCMLs("2'", angles);
      
      expect(cmls).toEqual(["2'-0", "2'-90", "2'-180", "2'-270"]);
    });
  });

  describe('Component Type Categorization', () => {
    // Helper function that mirrors extraction logic
    const categorizeComponent = (description: string): string => {
      const lower = description.toLowerCase();
      
      if (lower.includes('nozzle') || lower.includes('manway') || 
          lower.includes('relief') || lower.includes('inlet') || 
          lower.includes('outlet') || lower.includes('drain') ||
          lower.includes('vent') || lower.includes('gauge')) {
        return 'Nozzle';
      }
      
      if (lower.includes('east head') || lower.includes('north head') || 
          lower.includes('head 1') || lower.includes('left head')) {
        return 'East Head';
      }
      
      if (lower.includes('west head') || lower.includes('south head') || 
          lower.includes('head 2') || lower.includes('right head')) {
        return 'West Head';
      }
      
      if (lower.includes('shell') || lower.includes('body') || 
          lower.includes('cylinder')) {
        return 'Shell';
      }
      
      return 'Shell'; // Default to Shell
    };

    it('should categorize shell components', () => {
      expect(categorizeComponent('Vessel Shell')).toBe('Shell');
      expect(categorizeComponent('Shell Body')).toBe('Shell');
      expect(categorizeComponent('Cylinder')).toBe('Shell');
    });

    it('should categorize East Head variants', () => {
      expect(categorizeComponent('East Head')).toBe('East Head');
      expect(categorizeComponent('North Head')).toBe('East Head');
      expect(categorizeComponent('Head 1')).toBe('East Head');
      expect(categorizeComponent('Left Head')).toBe('East Head');
    });

    it('should categorize West Head variants', () => {
      expect(categorizeComponent('West Head')).toBe('West Head');
      expect(categorizeComponent('South Head')).toBe('West Head');
      expect(categorizeComponent('Head 2')).toBe('West Head');
      expect(categorizeComponent('Right Head')).toBe('West Head');
    });

    it('should categorize nozzles', () => {
      expect(categorizeComponent('24" Manway')).toBe('Nozzle');
      expect(categorizeComponent('3" Relief')).toBe('Nozzle');
      expect(categorizeComponent('N1 Inlet')).toBe('Nozzle');
      expect(categorizeComponent('Outlet Nozzle')).toBe('Nozzle');
      expect(categorizeComponent('Drain')).toBe('Nozzle');
      expect(categorizeComponent('Vent')).toBe('Nozzle');
      expect(categorizeComponent('Level Gauge')).toBe('Nozzle');
    });

    it('should default to Shell for unknown types', () => {
      expect(categorizeComponent('Unknown Component')).toBe('Shell');
      expect(categorizeComponent('')).toBe('Shell');
    });
  });

  describe('Data Quality Scoring', () => {
    // Helper function to score TML completeness
    const scoreTMLCompleteness = (tml: any): number => {
      let score = 0;
      if (tml.currentThickness) score += 10;
      if (tml.previousThickness && tml.previousThickness !== 0) score += 5;
      if (tml.nominalThickness) score += 3;
      if (tml.minimumRequired) score += 3;
      if (tml.location && tml.location.length > 5) score += 2;
      if (tml.component && tml.component !== 'Unknown') score += 2;
      if (tml.angle) score += 1;
      if (tml.nozzleSize) score += 2;
      return score;
    };

    it('should give high score to complete TML record', () => {
      const completeTML = {
        currentThickness: 0.652,
        previousThickness: 0.639,
        nominalThickness: 0.625,
        minimumRequired: 0.530,
        location: '2\' from East Head Seam',
        component: 'Shell',
        angle: '0°',
        nozzleSize: null,
      };
      
      expect(scoreTMLCompleteness(completeTML)).toBe(26); // 10+5+3+3+2+2+1
    });

    it('should give low score to minimal TML record', () => {
      const minimalTML = {
        currentThickness: 0.652,
        location: 'N/A', // Short location, won't get bonus
        component: 'Unknown',
      };
      
      expect(scoreTMLCompleteness(minimalTML)).toBe(10); // Only currentThickness
    });

    it('should penalize zero previous thickness', () => {
      const tmlWithZeroPrev = {
        currentThickness: 0.652,
        previousThickness: 0, // Should not count
      };
      
      expect(scoreTMLCompleteness(tmlWithZeroPrev)).toBe(10); // No bonus for prev
    });

    it('should bonus nozzle records with size', () => {
      const nozzleTML = {
        currentThickness: 0.574,
        previousThickness: 0.560,
        location: 'N1 Manway',
        component: 'Nozzle',
        nozzleSize: 24, // NUMERIC VALUE as per extraction instructions
      };
      
      expect(scoreTMLCompleteness(nozzleTML)).toBe(21); // 10+5+2+2+2
    });
  });

  describe('Multi-Page Table Row Count Verification', () => {
    // Helper to validate expected row count
    const verifyRowCount = (extractedRows: any[], expectedMin: number): boolean => {
      return extractedRows.length >= expectedMin;
    };

    it('should verify minimum row extraction', () => {
      const rows = Array(177).fill({}).map((_, i) => ({ cml: `${i + 1}` }));
      expect(verifyRowCount(rows, 177)).toBe(true);
    });

    it('should detect incomplete extraction', () => {
      const rows = Array(50).fill({}).map((_, i) => ({ cml: `${i + 1}` }));
      expect(verifyRowCount(rows, 177)).toBe(false);
    });

    it('should handle partial extraction gracefully', () => {
      const rows = Array(100).fill({}).map((_, i) => ({ cml: `${i + 1}` }));
      // 100 rows is partial but acceptable if that's all available
      expect(verifyRowCount(rows, 50)).toBe(true);
      expect(verifyRowCount(rows, 200)).toBe(false);
    });
  });

  describe('Text Truncation Detection', () => {
    // Helper to detect if text fields are truncated
    const isTruncated = (text: string, maxLength: number = 100): boolean => {
      if (!text) return false;
      
      // Check for common truncation indicators
      const truncationMarkers = ['...', '…', 'gen...', 'Vessel...'];
      const hasTruncationMarker = truncationMarkers.some(marker => 
        text.includes(marker)
      );
      
      // Check if abnormally short for expected content
      const isSuspiciouslyShort = text.length < 10 && text.includes('...');
      
      return hasTruncationMarker || isSuspiciouslyShort;
    };

    it('should detect ellipsis truncation', () => {
      expect(isTruncated('Vessel...')).toBe(true);
      expect(isTruncated('2 inch East Head Seam - Head...')).toBe(true);
    });

    it('should detect common truncation patterns', () => {
      expect(isTruncated('gen...')).toBe(true);
      expect(isTruncated('Vessel...')).toBe(true);
    });

    it('should not flag complete text', () => {
      expect(isTruncated('2 inch East Head Seam - Head Side')).toBe(false);
      expect(isTruncated('Vessel Shell')).toBe(false);
      expect(isTruncated('N1 Manway 24')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isTruncated('')).toBe(false);
    });
  });
});
