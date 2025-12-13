import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { detectAnomalies, saveAnomalies, getAnomalies, reviewAnomaly } from "./anomalyDetection";
import { getDb } from "./db";
import { inspections, reportAnomalies } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

export const anomalyRouter = router({
  /**
   * Detect anomalies for an inspection
   */
  detectForInspection: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const anomalies = await detectAnomalies(input.inspectionId);
      await saveAnomalies(input.inspectionId, anomalies);
      
      return {
        success: true,
        anomalyCount: anomalies.length,
        criticalCount: anomalies.filter(a => a.severity === "critical").length,
        anomalies,
      };
    }),

  /**
   * Get anomalies for an inspection
   */
  getForInspection: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
    }))
    .query(async ({ input }) => {
      const anomalies = await getAnomalies(input.inspectionId);
      return anomalies;
    }),

  /**
   * Get all inspections with pending review
   */
  getPendingReviews: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const pendingInspections = await db.select()
        .from(inspections)
        .where(eq(inspections.reviewStatus, "pending_review"));

      return pendingInspections;
    }),

  /**
   * Mark anomaly as reviewed
   */
  reviewAnomaly: protectedProcedure
    .input(z.object({
      anomalyId: z.string(),
      status: z.enum(["acknowledged", "resolved", "false_positive"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await reviewAnomaly(
        input.anomalyId,
        ctx.user.id,
        input.status,
        input.notes
      );

      return { success: true };
    }),

  /**
   * Mark inspection as reviewed (approve all anomalies)
   */
  approveInspection: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Update inspection status
      await db.update(inspections)
        .set({ reviewStatus: "approved" })
        .where(eq(inspections.id, input.inspectionId));

      // Mark all pending anomalies as acknowledged
      await db.update(reportAnomalies)
        .set({ reviewStatus: "acknowledged" })
        .where(
          and(
            eq(reportAnomalies.inspectionId, input.inspectionId),
            eq(reportAnomalies.reviewStatus, "pending")
          )
        );

      return { success: true };
    }),

  /**
   * Get anomaly statistics
   */
  getStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all inspections for user
      const userInspections = await db.select()
        .from(inspections)
        .where(eq(inspections.userId, ctx.user.id));

      const totalInspections = userInspections.length;
      const pendingReview = userInspections.filter(i => i.reviewStatus === "pending_review").length;
      const totalAnomalies = userInspections.reduce((sum, i) => sum + (i.anomalyCount || 0), 0);

      // Get anomalies by severity
      const allAnomalies = await db.select()
        .from(reportAnomalies)
        .where(
          inArray(
            reportAnomalies.inspectionId,
            userInspections.map(i => i.id)
          )
        );

      const criticalCount = allAnomalies.filter(a => a.severity === "critical").length;
      const warningCount = allAnomalies.filter(a => a.severity === "warning").length;
      const infoCount = allAnomalies.filter(a => a.severity === "info").length;

      return {
        totalInspections,
        pendingReview,
        totalAnomalies,
        criticalCount,
        warningCount,
        infoCount,
      };
    }),
});
