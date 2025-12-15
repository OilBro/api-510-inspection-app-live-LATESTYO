import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { anomalyActionPlans, actionPlanAttachments, reportAnomalies } from "../drizzle/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";

export const actionPlanRouter = router({
  /**
   * Create a new action plan for an anomaly
   */
  create: protectedProcedure
    .input(
      z.object({
        anomalyId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        assignedTo: z.number().optional(),
        dueDate: z.string().optional(), // ISO date string
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const actionPlanId = nanoid();

      await db.insert(anomalyActionPlans).values({
        id: actionPlanId,
        anomalyId: input.anomalyId,
        title: input.title,
        description: input.description || null,
        assignedTo: input.assignedTo || null,
        assignedBy: ctx.user.id,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority,
        status: "pending",
      });

      // Send notification if assigned to someone
      if (input.assignedTo) {
        try {
          const { notifyOwner } = await import('./_core/notification');
          const anomaly = await db.select().from(reportAnomalies).where(eq(reportAnomalies.id, input.anomalyId)).limit(1);
          if (anomaly.length > 0) {
            await notifyOwner({
              title: `New Action Plan Assigned: ${input.title}`,
              content: `Priority: ${input.priority.toUpperCase()}\nAnomaly: ${anomaly[0].title}\n${input.description || ''}\n${input.dueDate ? `Due: ${new Date(input.dueDate).toLocaleDateString()}` : ''}`,
            });
          }
        } catch (notifyError) {
          console.error('[Action Plan] Failed to send notification:', notifyError);
        }
      }

      return { actionPlanId };
    }),

  /**
   * Get action plans for an anomaly
   */
  getForAnomaly: protectedProcedure
    .input(z.object({ anomalyId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const plans = await db
        .select()
        .from(anomalyActionPlans)
        .where(eq(anomalyActionPlans.anomalyId, input.anomalyId));

      return plans;
    }),

  /**
   * Get all action plans for the current user (assigned to them)
   */
  getMyTasks: protectedProcedure
    .input(
      z.object({
        status: z.enum(["all", "pending", "in_progress", "completed", "overdue"]).default("all"),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let query = db
        .select({
          actionPlan: anomalyActionPlans,
          anomaly: reportAnomalies,
        })
        .from(anomalyActionPlans)
        .leftJoin(reportAnomalies, eq(anomalyActionPlans.anomalyId, reportAnomalies.id))
        .where(eq(anomalyActionPlans.assignedTo, ctx.user.id));

      const results = await query;

      // Filter by status
      let filtered = results;
      if (input.status === "pending") {
        filtered = results.filter((r) => r.actionPlan.status === "pending");
      } else if (input.status === "in_progress") {
        filtered = results.filter((r) => r.actionPlan.status === "in_progress");
      } else if (input.status === "completed") {
        filtered = results.filter((r) => r.actionPlan.status === "completed");
      } else if (input.status === "overdue") {
        const now = new Date();
        filtered = results.filter(
          (r) =>
            r.actionPlan.dueDate &&
            new Date(r.actionPlan.dueDate) < now &&
            r.actionPlan.status !== "completed" &&
            r.actionPlan.status !== "cancelled"
        );
      }

      return filtered;
    }),

  /**
   * Update action plan status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        actionPlanId: z.string(),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
        completionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: any = {
        status: input.status,
      };

      if (input.status === "completed") {
        updateData.completedAt = new Date();
        updateData.completedBy = ctx.user.id;
        updateData.completionNotes = input.completionNotes || null;
      }

      await db
        .update(anomalyActionPlans)
        .set(updateData)
        .where(eq(anomalyActionPlans.id, input.actionPlanId));

      // If completed, update the anomaly status to resolved and send notification
      if (input.status === "completed") {
        const plan = await db
          .select()
          .from(anomalyActionPlans)
          .where(eq(anomalyActionPlans.id, input.actionPlanId))
          .limit(1);

        if (plan.length > 0) {
          await db
            .update(reportAnomalies)
            .set({ reviewStatus: "resolved" })
            .where(eq(reportAnomalies.id, plan[0].anomalyId));

          // Send completion notification
          try {
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: `Action Plan Completed: ${plan[0].title}`,
              content: `The action plan has been marked as completed.\n${input.completionNotes || 'No completion notes provided.'}`,
            });
          } catch (notifyError) {
            console.error('[Action Plan] Failed to send completion notification:', notifyError);
          }
        }
      }

      return { success: true };
    }),

  /**
   * Upload attachment for action plan
   */
  uploadAttachment: protectedProcedure
    .input(
      z.object({
        actionPlanId: z.string(),
        fileName: z.string(),
        fileData: z.string(), // base64
        fileType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Decode base64 and upload to S3
      const buffer = Buffer.from(input.fileData, "base64");
      const fileKey = `action-plans/${input.actionPlanId}/${nanoid()}-${input.fileName}`;
      
      const { url } = await storagePut(fileKey, buffer, input.fileType);

      // Save attachment record
      const attachmentId = nanoid();
      await db.insert(actionPlanAttachments).values({
        id: attachmentId,
        actionPlanId: input.actionPlanId,
        fileName: input.fileName,
        fileUrl: url,
        fileType: input.fileType,
        fileSize: buffer.length,
        uploadedBy: ctx.user.id,
      });

      return { attachmentId, url };
    }),

  /**
   * Get attachments for an action plan
   */
  getAttachments: protectedProcedure
    .input(z.object({ actionPlanId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const attachments = await db
        .select()
        .from(actionPlanAttachments)
        .where(eq(actionPlanAttachments.actionPlanId, input.actionPlanId));

      return attachments;
    }),

  /**
   * Delete action plan
   */
  delete: protectedProcedure
    .input(z.object({ actionPlanId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check ownership
      const plan = await db
        .select()
        .from(anomalyActionPlans)
        .where(eq(anomalyActionPlans.id, input.actionPlanId))
        .limit(1);

      if (plan.length === 0) {
        throw new Error("Action plan not found");
      }

      if (plan[0].assignedBy !== ctx.user.id && plan[0].assignedTo !== ctx.user.id) {
        throw new Error("Not authorized to delete this action plan");
      }

      // Delete attachments first
      await db
        .delete(actionPlanAttachments)
        .where(eq(actionPlanAttachments.actionPlanId, input.actionPlanId));

      // Delete action plan
      await db
        .delete(anomalyActionPlans)
        .where(eq(anomalyActionPlans.id, input.actionPlanId));

      return { success: true };
    }),

  /**
   * Get action plan statistics
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const plans = await db
      .select()
      .from(anomalyActionPlans)
      .where(eq(anomalyActionPlans.assignedTo, ctx.user.id));

    const now = new Date();
    const pending = plans.filter((p) => p.status === "pending").length;
    const inProgress = plans.filter((p) => p.status === "in_progress").length;
    const completed = plans.filter((p) => p.status === "completed").length;
    const overdue = plans.filter(
      (p) =>
        p.dueDate &&
        new Date(p.dueDate) < now &&
        p.status !== "completed" &&
        p.status !== "cancelled"
    ).length;

    return {
      total: plans.length,
      pending,
      inProgress,
      completed,
      overdue,
    };
  }),
});
