/**
 * Utility function to sort CML/TML readings numerically by their CML number.
 * Handles various formats like "CML-001", "CML-1", "1", "001", "A-1", etc.
 */

/**
 * Extract numeric value from a CML number string for sorting purposes.
 * Examples:
 *   "CML-001" -> 1
 *   "CML-12" -> 12
 *   "001" -> 1
 *   "A-5" -> 5
 *   "12" -> 12
 *   "CML-1A" -> 1 (ignores trailing letters)
 */
export function extractCmlNumber(cmlString: string | null | undefined): number {
  if (!cmlString) return Infinity; // Put empty/null values at the end
  
  // Try to extract numeric portion from the string
  // First, try to match patterns like "CML-001", "TML-12", "A-5"
  const prefixMatch = cmlString.match(/[A-Za-z]+-?(\d+)/);
  if (prefixMatch) {
    return parseInt(prefixMatch[1], 10);
  }
  
  // Try to match just a number (possibly with leading zeros)
  const numberMatch = cmlString.match(/(\d+)/);
  if (numberMatch) {
    return parseInt(numberMatch[1], 10);
  }
  
  // If no number found, sort alphabetically by returning a high value
  return Infinity;
}

/**
 * Compare function for sorting CML readings by their cmlNumber field.
 * Sorts numerically from low to high.
 */
export function compareCmlNumbers<T extends { cmlNumber?: string | null }>(a: T, b: T): number {
  const numA = extractCmlNumber(a.cmlNumber);
  const numB = extractCmlNumber(b.cmlNumber);
  
  if (numA === numB) {
    // If numbers are equal, sort alphabetically by the full string
    const strA = a.cmlNumber || '';
    const strB = b.cmlNumber || '';
    return strA.localeCompare(strB);
  }
  
  return numA - numB;
}

/**
 * Sort an array of readings by CML number (low to high).
 * Returns a new sorted array, does not mutate the original.
 */
export function sortByCmlNumber<T extends { cmlNumber?: string | null }>(readings: T[]): T[] {
  return [...readings].sort(compareCmlNumbers);
}
