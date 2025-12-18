import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { materialStressValues } from "../drizzle/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";

type StressRow = {
  materialSpec: string;
  materialGrade: string | null;
  materialCategory: string | null;
  temperatureF: number;
  allowableStress: number;
};

// Fallback dataset so tests can run without a database connection
const FALLBACK_STRESS_VALUES: StressRow[] = [
  // SA-240 Type 304
  { materialSpec: "SA-240 Type 304", materialGrade: "Type 304", materialCategory: "Stainless Steel", temperatureF: -20, allowableStress: 20000 },
  { materialSpec: "SA-240 Type 304", materialGrade: "Type 304", materialCategory: "Stainless Steel", temperatureF: 100, allowableStress: 20000 },
  { materialSpec: "SA-240 Type 304", materialGrade: "Type 304", materialCategory: "Stainless Steel", temperatureF: 200, allowableStress: 20000 },
  { materialSpec: "SA-240 Type 304", materialGrade: "Type 304", materialCategory: "Stainless Steel", temperatureF: 300, allowableStress: 19000 },
  { materialSpec: "SA-240 Type 304", materialGrade: "Type 304", materialCategory: "Stainless Steel", temperatureF: 400, allowableStress: 18000 },
  { materialSpec: "SA-240 Type 304", materialGrade: "Type 304", materialCategory: "Stainless Steel", temperatureF: 800, allowableStress: 15000 },

  // SA-516 Grade 70
  { materialSpec: "SA-516 Grade 70", materialGrade: "Grade 70", materialCategory: "Carbon Steel", temperatureF: -20, allowableStress: 17500 },
  { materialSpec: "SA-516 Grade 70", materialGrade: "Grade 70", materialCategory: "Carbon Steel", temperatureF: 100, allowableStress: 17500 },
  { materialSpec: "SA-516 Grade 70", materialGrade: "Grade 70", materialCategory: "Carbon Steel", temperatureF: 200, allowableStress: 17500 },
  { materialSpec: "SA-516 Grade 70", materialGrade: "Grade 70", materialCategory: "Carbon Steel", temperatureF: 300, allowableStress: 17000 },
  { materialSpec: "SA-516 Grade 70", materialGrade: "Grade 70", materialCategory: "Carbon Steel", temperatureF: 400, allowableStress: 16500 },

  // SA-612 (High-strength carbon steel for moderate/lower temp service)
  { materialSpec: "SA-612", materialGrade: null, materialCategory: "Carbon Steel", temperatureF: -40, allowableStress: 23800 },
  { materialSpec: "SA-612", materialGrade: null, materialCategory: "Carbon Steel", temperatureF: 100, allowableStress: 23800 },
  { materialSpec: "SA-612", materialGrade: null, materialCategory: "Carbon Steel", temperatureF: 200, allowableStress: 23800 },
  { materialSpec: "SA-612", materialGrade: null, materialCategory: "Carbon Steel", temperatureF: 400, allowableStress: 23800 },
  { materialSpec: "SA-612", materialGrade: null, materialCategory: "Carbon Steel", temperatureF: 600, allowableStress: 21300 },
  { materialSpec: "SA-612", materialGrade: null, materialCategory: "Carbon Steel", temperatureF: 700, allowableStress: 16400 },

  // SA-240 Type 316
  { materialSpec: "SA-240 Type 316", materialGrade: "Type 316", materialCategory: "Stainless Steel", temperatureF: -20, allowableStress: 20000 },
  { materialSpec: "SA-240 Type 316", materialGrade: "Type 316", materialCategory: "Stainless Steel", temperatureF: 100, allowableStress: 20000 },
  { materialSpec: "SA-240 Type 316", materialGrade: "Type 316", materialCategory: "Stainless Steel", temperatureF: 200, allowableStress: 19000 },
  { materialSpec: "SA-240 Type 316", materialGrade: "Type 316", materialCategory: "Stainless Steel", temperatureF: 300, allowableStress: 18000 },
  { materialSpec: "SA-240 Type 316", materialGrade: "Type 316", materialCategory: "Stainless Steel", temperatureF: 400, allowableStress: 17000 },
  { materialSpec: "SA-240 Type 316", materialGrade: "Type 316", materialCategory: "Stainless Steel", temperatureF: 800, allowableStress: 14000 },
];

function useFallback(rows: StressRow[]) {
  const unique = new Map<string, StressRow>();
  for (const row of rows) {
    if (!unique.has(row.materialSpec)) {
      unique.set(row.materialSpec, row);
    }
  }
  return Array.from(unique.values());
}

function getFallbackTable(materialSpec: string) {
  return FALLBACK_STRESS_VALUES
    .filter((row) => row.materialSpec === materialSpec)
    .sort((a, b) => a.temperatureF - b.temperatureF);
}

function interpolateStress(lower: StressRow, upper: StressRow, temperatureF: number) {
  const tempRange = upper.temperatureF - lower.temperatureF;
  if (tempRange === 0) return null;
  const stressRange = upper.allowableStress - lower.allowableStress;
  const tempDiff = temperatureF - lower.temperatureF;
  const allowableStress = Math.round(lower.allowableStress + (stressRange * tempDiff) / tempRange);
  return { allowableStress, lower, upper };
}

export const materialStressRouter = router({
  /**
   * Get all unique materials
   */
  getAllMaterials: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return useFallback(FALLBACK_STRESS_VALUES).map(({ materialSpec, materialGrade, materialCategory }) => ({
        materialSpec,
        materialGrade,
        materialCategory,
      }));
    }
    const materials = await db
      .selectDistinct({
        materialSpec: materialStressValues.materialSpec,
        materialGrade: materialStressValues.materialGrade,
        materialCategory: materialStressValues.materialCategory,
      })
      .from(materialStressValues);
    
    return materials;
  }),

  /**
   * Get allowable stress for a specific material and temperature
   * Uses linear interpolation if exact temperature not found
   */
  getMaterialStressValue: publicProcedure
    .input(
      z.object({
        materialSpec: z.string(),
        temperatureF: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        const table = getFallbackTable(input.materialSpec);
        if (table.length === 0) return null;

        const roundedTemp = Math.round(input.temperatureF);
        const exact = table.find((row) => row.temperatureF === roundedTemp);
        if (exact) {
          return {
            allowableStress: exact.allowableStress,
            temperatureF: exact.temperatureF,
            materialSpec: exact.materialSpec,
            materialGrade: exact.materialGrade,
            materialCategory: exact.materialCategory,
            interpolated: false,
          };
        }

        const lower = [...table].filter((row) => row.temperatureF <= roundedTemp).pop();
        const upper = table.find((row) => row.temperatureF >= roundedTemp);

        if (lower && upper) {
          const interpolated = interpolateStress(lower, upper, input.temperatureF);
          if (!interpolated) {
            return {
              allowableStress: lower.allowableStress,
              temperatureF: lower.temperatureF,
              materialSpec: lower.materialSpec,
              materialGrade: lower.materialGrade,
              materialCategory: lower.materialCategory,
              interpolated: false,
              note: "Using nearest available temperature",
            };
          }

          return {
            allowableStress: interpolated.allowableStress,
            temperatureF: input.temperatureF,
            materialSpec: interpolated.lower.materialSpec,
            materialGrade: interpolated.lower.materialGrade,
            materialCategory: interpolated.lower.materialCategory,
            interpolated: true,
            lowerBound: {
              temperatureF: interpolated.lower.temperatureF,
              allowableStress: interpolated.lower.allowableStress,
            },
            upperBound: {
              temperatureF: interpolated.upper.temperatureF,
              allowableStress: interpolated.upper.allowableStress,
            },
          };
        }

        if (lower) {
          return {
            allowableStress: lower.allowableStress,
            temperatureF: lower.temperatureF,
            materialSpec: lower.materialSpec,
            materialGrade: lower.materialGrade,
            materialCategory: lower.materialCategory,
            interpolated: false,
            note: "Using nearest available temperature",
          };
        }

        if (upper) {
          return {
            allowableStress: upper.allowableStress,
            temperatureF: upper.temperatureF,
            materialSpec: upper.materialSpec,
            materialGrade: upper.materialGrade,
            materialCategory: upper.materialCategory,
            interpolated: false,
            note: "Using nearest available temperature",
          };
        }

        return null;
      }
      
      // Try to find exact temperature match first
      const exactMatch = await db
        .select()
        .from(materialStressValues)
        .where(
          and(
            eq(materialStressValues.materialSpec, input.materialSpec),
            eq(materialStressValues.temperatureF, Math.round(input.temperatureF))
          )
        )
        .limit(1);

      if (exactMatch.length > 0) {
        return {
          allowableStress: exactMatch[0].allowableStress,
          temperatureF: exactMatch[0].temperatureF,
          materialSpec: exactMatch[0].materialSpec,
          materialGrade: exactMatch[0].materialGrade,
          materialCategory: exactMatch[0].materialCategory,
          interpolated: false,
        };
      }

      // If no exact match, find bounding temperatures for interpolation
      const lowerBound = await db
        .select()
        .from(materialStressValues)
        .where(
          and(
            eq(materialStressValues.materialSpec, input.materialSpec),
            lte(materialStressValues.temperatureF, Math.round(input.temperatureF))
          )
        )
        .orderBy(sql`${materialStressValues.temperatureF} DESC`)
        .limit(1);

      const upperBound = await db
        .select()
        .from(materialStressValues)
        .where(
          and(
            eq(materialStressValues.materialSpec, input.materialSpec),
            gte(materialStressValues.temperatureF, Math.round(input.temperatureF))
          )
        )
        .orderBy(sql`${materialStressValues.temperatureF} ASC`)
        .limit(1);

      // If we have both bounds, interpolate
      if (lowerBound.length > 0 && upperBound.length > 0) {
        const lower = lowerBound[0];
        const upper = upperBound[0];

        const interpolated = interpolateStress(lower, upper, input.temperatureF);
        if (!interpolated) {
          return {
            allowableStress: lower.allowableStress,
            temperatureF: lower.temperatureF,
            materialSpec: lower.materialSpec,
            materialGrade: lower.materialGrade,
            materialCategory: lower.materialCategory,
            interpolated: false,
            note: "Using nearest available temperature",
          };
        }

        return {
          allowableStress: interpolated.allowableStress,
          temperatureF: input.temperatureF,
          materialSpec: interpolated.lower.materialSpec,
          materialGrade: interpolated.lower.materialGrade,
          materialCategory: interpolated.lower.materialCategory,
          interpolated: true,
          lowerBound: {
            temperatureF: interpolated.lower.temperatureF,
            allowableStress: interpolated.lower.allowableStress,
          },
          upperBound: {
            temperatureF: interpolated.upper.temperatureF,
            allowableStress: interpolated.upper.allowableStress,
          },
        };
      }

      // If only lower bound exists, use that value
      if (lowerBound.length > 0) {
        return {
          allowableStress: lowerBound[0].allowableStress,
          temperatureF: lowerBound[0].temperatureF,
          materialSpec: lowerBound[0].materialSpec,
          materialGrade: lowerBound[0].materialGrade,
          materialCategory: lowerBound[0].materialCategory,
          interpolated: false,
          note: "Using nearest available temperature",
        };
      }

      // If only upper bound exists, use that value
      if (upperBound.length > 0) {
        return {
          allowableStress: upperBound[0].allowableStress,
          temperatureF: upperBound[0].temperatureF,
          materialSpec: upperBound[0].materialSpec,
          materialGrade: upperBound[0].materialGrade,
          materialCategory: upperBound[0].materialCategory,
          interpolated: false,
          note: "Using nearest available temperature",
        };
      }

      // No data found
      return null;
    }),

  /**
   * Get all stress values for a specific material
   */
  getMaterialStressTable: publicProcedure
    .input(z.object({ materialSpec: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return getFallbackTable(input.materialSpec);
      }
      const values = await db
        .select()
        .from(materialStressValues)
        .where(eq(materialStressValues.materialSpec, input.materialSpec))
        .orderBy(materialStressValues.temperatureF);

      return values;
    }),
});
