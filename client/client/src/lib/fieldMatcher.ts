/**
 * Smart field matching utility for auto-mapping imported data
 * Uses fuzzy matching and confidence scoring to suggest field mappings
 */

// Common field name variations and their canonical names
const FIELD_ALIASES: Record<string, string[]> = {
  vesselTagNumber: ["tag", "tag number", "vessel tag", "equipment tag", "vessel id", "equipment id", "tag no"],
  vesselName: ["vessel name", "equipment name", "vessel description", "name"],
  manufacturer: ["manufacturer", "mfg", "fabricator", "builder", "made by"],
  yearBuilt: ["year built", "year", "built", "fabrication year", "mfg year", "year of manufacture"],
  designPressure: ["mawp", "design pressure", "max allowable working pressure", "design press", "dp"],
  designTemperature: ["design temp", "design temperature", "max temp", "dt"],
  operatingPressure: ["operating pressure", "op pressure", "working pressure", "op press"],
  materialSpec: ["material", "material spec", "material specification", "mat'l", "mtl"],
  insideDiameter: ["id", "inside diameter", "internal diameter", "diameter"],
  reportNumber: ["report no", "report number", "report #", "inspection report no"],
  inspectionDate: ["inspection date", "date of inspection", "date inspected", "insp date"],
  inspectorName: ["inspector", "inspector name", "inspected by", "api inspector"],
  clientName: ["client", "client name", "company", "owner"],
  nominalThickness: ["nominal thickness", "nom thick", "t nom", "tnom", "nominal t"],
  actualThickness: ["actual thickness", "act thick", "t act", "tact", "measured thickness", "current thickness"],
  previousThickness: ["previous thickness", "prev thick", "t prev", "tprev", "last thickness"],
};

/**
 * Normalize a field name for matching
 */
function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeFieldName(str1);
  const s2 = normalizeFieldName(str2);
  
  if (s1 === s2) return 1.0;
  
  // Check if one string contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return shorter / longer * 0.9; // Slightly lower than exact match
  }
  
  // Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

/**
 * Find the best matching field for a given field name
 */
export interface FieldMatch {
  section: string;
  field: string;
  confidence: number; // 0-100
  reason: string;
}

export function findBestMatch(
  fieldName: string,
  fieldMappings: Record<string, { label: string; fields: Record<string, string> }>
): FieldMatch | null {
  const normalized = normalizeFieldName(fieldName);
  let bestMatch: FieldMatch | null = null;
  let bestScore = 0;
  
  // First, check for exact alias matches
  for (const [canonicalField, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (normalizeFieldName(alias) === normalized) {
        // Find which section this field belongs to
        for (const [section, config] of Object.entries(fieldMappings)) {
          if (canonicalField in config.fields) {
            return {
              section,
              field: canonicalField,
              confidence: 100,
              reason: "Exact alias match",
            };
          }
        }
      }
    }
  }
  
  // If no exact match, find best fuzzy match
  for (const [section, config] of Object.entries(fieldMappings)) {
    for (const [field, label] of Object.entries(config.fields)) {
      // Check against field key
      let score = calculateSimilarity(fieldName, field);
      
      // Check against field label
      const labelScore = calculateSimilarity(fieldName, label);
      score = Math.max(score, labelScore);
      
      // Check against aliases
      const aliases = FIELD_ALIASES[field] || [];
      for (const alias of aliases) {
        const aliasScore = calculateSimilarity(fieldName, alias);
        score = Math.max(score, aliasScore);
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          section,
          field,
          confidence: Math.round(score * 100),
          reason: score > 0.9 ? "Strong similarity" : score > 0.7 ? "Moderate similarity" : "Weak similarity",
        };
      }
    }
  }
  
  // Only return matches with confidence >= 50%
  if (bestMatch && bestMatch.confidence >= 50) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Categorize match confidence level
 */
export function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 90) return "high";
  if (confidence >= 70) return "medium";
  return "low";
}

/**
 * Get color for confidence badge
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return "bg-green-100 text-green-800";
  if (confidence >= 70) return "bg-yellow-100 text-yellow-800";
  return "bg-orange-100 text-orange-800";
}

