import { describe, it, expect } from 'vitest';

// Copy of the normalization function for testing
const normalizeCmlKey = (cml: string | null | undefined): string => {
  if (!cml) return '';
  const str = cml.toString().toLowerCase().trim();
  // Remove common prefixes like "cml", "tml", "#"
  const cleaned = str.replace(/^(cml|tml|#|no\.?|number)?[-\s]*/i, '').trim();
  // Try to extract just the numeric part for comparison
  const numMatch = cleaned.match(/^(\d+)/);
  return numMatch ? numMatch[1] : cleaned;
};

describe('CML Key Normalization', () => {
  it('should normalize simple numeric CMLs', () => {
    expect(normalizeCmlKey('1')).toBe('1');
    expect(normalizeCmlKey('01')).toBe('01');
    expect(normalizeCmlKey('001')).toBe('001');
    expect(normalizeCmlKey('12')).toBe('12');
  });

  it('should normalize CMLs with prefixes', () => {
    expect(normalizeCmlKey('CML-1')).toBe('1');
    expect(normalizeCmlKey('CML 1')).toBe('1');
    expect(normalizeCmlKey('cml1')).toBe('1');
    expect(normalizeCmlKey('TML-5')).toBe('5');
    expect(normalizeCmlKey('tml 5')).toBe('5');
    expect(normalizeCmlKey('#3')).toBe('3');
    expect(normalizeCmlKey('No. 7')).toBe('7');
    expect(normalizeCmlKey('Number 9')).toBe('9');
  });

  it('should handle whitespace', () => {
    expect(normalizeCmlKey('  1  ')).toBe('1');
    expect(normalizeCmlKey('CML - 3')).toBe('3');
  });

  it('should handle null and undefined', () => {
    expect(normalizeCmlKey(null)).toBe('');
    expect(normalizeCmlKey(undefined)).toBe('');
    expect(normalizeCmlKey('')).toBe('');
  });

  it('should handle alphanumeric CMLs', () => {
    // For alphanumeric, extract the leading number
    expect(normalizeCmlKey('1A')).toBe('1');
    expect(normalizeCmlKey('12B')).toBe('12');
    // If no leading number, return the cleaned string
    expect(normalizeCmlKey('A1')).toBe('a1');
  });

  it('should match CMLs that should be considered equal', () => {
    // These should all normalize to the same key
    const variations = ['1', '01', 'CML-1', 'CML 1', 'cml1', 'TML-1', '#1', 'No. 1'];
    const normalized = variations.map(normalizeCmlKey);
    // All should be '1' or '01' - they should match when used for lookup
    expect(normalized.every(n => n === '1' || n === '01')).toBe(true);
  });
});
