/**
 * Validation Warnings Router
 * 
 * Checks for missing or fallback values in inspection data
 * and provides warnings to help identify incomplete PDF extractions.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { inspections, componentCalculations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export interface ValidationWarning {
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
  component?: string;
  fallbackValue?: string;
  suggestedAction: string;
}

export const validationWarningsRouter = router({
  /**
   * Dismiss all warnings for an inspection
   */
  dismissAll: publicProcedure
    .input(z.object({
      inspectionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(inspections)
        .set({ warningsDismissedAt: new Date() })
        .where(eq(inspections.id, input.inspectionId));

      return { success: true, message: "All warnings dismissed" };
    }),

  /**
   * Restore warnings for an inspection (clear the dismissal)
   */
  restore: publicProcedure
    .input(z.object({
      inspectionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(inspections)
        .set({ warningsDismissedAt: null })
        .where(eq(inspections.id, input.inspectionId));

      return { success: true, message: "Warnings restored" };
    }),

  /**
   * Get validation warnings for an inspection
   */
  getWarnings: publicProcedure
    .input(z.object({
      inspectionId: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const warnings: ValidationWarning[] = [];

      // Get inspection data
      const [inspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.id, input.inspectionId))
        .limit(1);

      if (!inspection) {
        throw new Error("Inspection not found");
      }

      // Check if warnings have been dismissed
      const warningsDismissed = !!inspection.warningsDismissedAt;

      // If warnings are dismissed, return empty list with dismissed flag
      if (warningsDismissed) {
        return {
          warnings: [],
          totalWarnings: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
          dismissed: true,
          dismissedAt: inspection.warningsDismissedAt,
        };
      }

      // Check for missing joint efficiency (E)
      if (!inspection.jointEfficiency || inspection.jointEfficiency === "0.85") {
        warnings.push({
          field: "jointEfficiency",
          message: "Joint efficiency (E) not extracted from PDF",
          severity: "warning",
          fallbackValue: "0.85",
          suggestedAction: "Verify the E value in the PDF calculation tables and update manually if needed. Common values: 1.0 (fully radiographed), 0.85 (spot radiographed), 0.70 (not radiographed).",
        });
      }

      // Check for missing allowable stress (S)
      if (!inspection.allowableStress || inspection.allowableStress === "20000") {
        warnings.push({
          field: "allowableStress",
          message: "Allowable stress (S) not extracted from PDF",
          severity: "warning",
          fallbackValue: "20000 psi",
          suggestedAction: "Verify the S value in the PDF for the specific material and temperature. Consult ASME Section II Part D for correct values.",
        });
      }

      // Check for missing specific gravity
      if (!inspection.specificGravity || inspection.specificGravity === "0.92") {
        warnings.push({
          field: "specificGravity",
          message: "Specific gravity (SG) not extracted from PDF",
          severity: "info",
          fallbackValue: "0.92",
          suggestedAction: "Verify the specific gravity of the vessel product. This affects static head pressure calculations.",
        });
      }

      // Check for missing crown radius and knuckle radius (for torispherical heads)
      if (!inspection.crownRadius) {
        warnings.push({
          field: "crownRadius",
          message: "Crown radius (L) not extracted - using default L=D",
          severity: "warning",
          fallbackValue: "Inside diameter (D)",
          suggestedAction: "For torispherical heads, crown radius should be specified in the PDF. Using D as default may result in inaccurate calculations.",
        });
      }

      if (!inspection.knuckleRadius) {
        warnings.push({
          field: "knuckleRadius",
          message: "Knuckle radius (r) not extracted - using default r=0.06D",
          severity: "warning",
          fallbackValue: "6% of inside diameter",
          suggestedAction: "For torispherical heads, knuckle radius should be specified in the PDF. Using 0.06D as default may result in inaccurate calculations.",
        });
      }

      // Check component calculations for data quality issues
      const components = await db
        .select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, inspection.id));

      for (const component of components) {
        // Check for below minimum thickness
        if (component.dataQualityStatus === "below_minimum") {
          warnings.push({
            field: "actualThickness",
            message: `${component.componentName} is below minimum required thickness`,
            severity: "error",
            component: component.componentName,
            suggestedAction: `Immediate attention required. Component thickness (${component.actualThickness}") is below minimum required (${component.minimumThickness}"). Consider repair, replacement, or fitness-for-service assessment.`,
          });
        }

        // Check for anomalies
        if (component.dataQualityStatus === "anomaly") {
          warnings.push({
            field: "dataQuality",
            message: `${component.componentName} has data quality anomaly`,
            severity: "warning",
            component: component.componentName,
            suggestedAction: component.dataQualityNotes || "Review thickness readings for unusual patterns or measurement errors.",
          });
        }

        // Check for growth errors
        if (component.dataQualityStatus === "growth_error") {
          warnings.push({
            field: "dataQuality",
            message: `${component.componentName} shows thickness growth (impossible)`,
            severity: "error",
            component: component.componentName,
            suggestedAction: component.dataQualityNotes || "Thickness cannot increase over time. Verify measurement accuracy and previous readings.",
          });
        }
      }

      return {
        warnings,
        totalWarnings: warnings.length,
        errorCount: warnings.filter(w => w.severity === "error").length,
        warningCount: warnings.filter(w => w.severity === "warning").length,
        infoCount: warnings.filter(w => w.severity === "info").length,
        dismissed: false,
        dismissedAt: null,
      };
    }),
});
