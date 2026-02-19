/**
 * COHERE AI ROUTER
 * OilPro 510 - Regulatory-Grade Inspection Application
 * 
 * tRPC procedures for the three Cohere AI integrations:
 * 1. Formula Selection (Rerank V3)
 * 2. Historical Inspection Memory (Embed V3)
 * 3. Engineering Guidance (Command R+ RAG)
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  selectFormula,
  getCodeReference,
  generateEmbeddings,
  buildInspectionSummary,
  findSimilarInspections,
  cosineSimilarity,
  askEngineeringQuestion,
  CODE_CLAUSE_KNOWLEDGE_BASE,
} from '../cohereService';
import * as db from '../db';
import { logger } from '../_core/logger';

export const cohereRouter = router({
  // ========================================================================
  // INTEGRATION 1: RERANK V3 — Formula Selection
  // ========================================================================

  /**
   * Select the most appropriate code clause for a calculation context.
   * Returns ranked clauses with confidence scores.
   */
  selectFormula: protectedProcedure
    .input(z.object({
      query: z.string().min(3).max(500),
      componentType: z.string().optional(),
      topN: z.number().min(1).max(10).default(3),
    }))
    .mutation(async ({ input }) => {
      const result = await selectFormula(input.query, input.componentType, input.topN);
      return result;
    }),

  /**
   * Get code reference for a specific calculation type.
   * Convenience endpoint for common calculation types.
   */
  getCodeReference: protectedProcedure
    .input(z.object({
      calculationType: z.enum([
        'shell_tmin', 'shell_mawp', 'head_tmin', 'head_mawp',
        'nozzle_reinforcement', 'remaining_life', 'corrosion_rate', 'inspection_interval',
      ]),
      headType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const result = await getCodeReference(input.calculationType, input.headType);
      return result;
    }),

  /**
   * List all available code clauses in the knowledge base.
   */
  listCodeClauses: protectedProcedure
    .query(async () => {
      return CODE_CLAUSE_KNOWLEDGE_BASE.map(clause => ({
        id: clause.id,
        code: clause.code,
        paragraph: clause.paragraph,
        title: clause.title,
        formula: clause.formula,
        componentTypes: clause.componentTypes,
      }));
    }),

  // ========================================================================
  // INTEGRATION 2: EMBED V3 — Historical Inspection Memory
  // ========================================================================

  /**
   * Generate and store embedding for an inspection record.
   * Call this after creating or updating an inspection to build the historical memory.
   */
  embedInspection: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Fetch the inspection data
      const inspection = await db.getInspection(input.inspectionId);
      if (!inspection) {
        throw new Error(`Inspection ${input.inspectionId} not found`);
      }

      // Build the text summary for embedding
      const summary = buildInspectionSummary({
        vesselTagNumber: inspection.vesselTagNumber,
        vesselName: inspection.vesselName,
        materialSpec: inspection.materialSpec,
        designPressure: inspection.designPressure,
        designTemperature: inspection.designTemperature,
        headType: inspection.headType,
        product: inspection.product,
        inspectionResults: inspection.inspectionResults,
        recommendations: inspection.recommendations,
        status: inspection.status,
      });

      // Generate embedding
      const [embeddingResult] = await generateEmbeddings([summary], 'search_document');

      // Store the embedding in the database
      await db.storeInspectionEmbedding(
        input.inspectionId,
        JSON.stringify(embeddingResult.embedding),
        summary
      );

      logger.info(`[Cohere Embed] Stored embedding for inspection ${input.inspectionId}`);

      return {
        inspectionId: input.inspectionId,
        summaryLength: summary.length,
        embeddingDimension: embeddingResult.dimension,
        stored: true,
      };
    }),

  /**
   * Batch embed all inspections that don't have embeddings yet.
   * Use this to initialize the historical memory for existing inspections.
   */
  batchEmbedInspections: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Get all inspections without embeddings
      const inspections = await db.getInspectionsWithoutEmbeddings(ctx.user.id);

      if (inspections.length === 0) {
        return { processed: 0, message: 'All inspections already have embeddings.' };
      }

      // Build summaries
      const summaries = inspections.map(insp => buildInspectionSummary({
        vesselTagNumber: insp.vesselTagNumber,
        vesselName: insp.vesselName,
        materialSpec: insp.materialSpec,
        designPressure: insp.designPressure,
        designTemperature: insp.designTemperature,
        headType: insp.headType,
        product: insp.product,
        inspectionResults: insp.inspectionResults,
        recommendations: insp.recommendations,
        status: insp.status,
      }));

      // Generate embeddings in batches
      const embeddings = await generateEmbeddings(summaries, 'search_document');

      // Store all embeddings
      for (let i = 0; i < inspections.length; i++) {
        await db.storeInspectionEmbedding(
          inspections[i].id,
          JSON.stringify(embeddings[i].embedding),
          summaries[i]
        );
      }

      logger.info(`[Cohere Embed] Batch embedded ${inspections.length} inspections`);

      return {
        processed: inspections.length,
        message: `Successfully embedded ${inspections.length} inspections.`,
      };
    }),

  /**
   * Find inspections similar to a given inspection or free-text query.
   * This is the core "historical memory" search.
   */
  findSimilar: protectedProcedure
    .input(z.object({
      // Either provide an inspectionId to find similar ones, or a text query
      inspectionId: z.string().optional(),
      query: z.string().optional(),
      topK: z.number().min(1).max(20).default(5),
      minSimilarity: z.number().min(0).max(1).default(0.3),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!input.inspectionId && !input.query) {
        throw new Error('Either inspectionId or query must be provided');
      }

      // Generate query embedding
      let queryEmbedding: number[];

      if (input.inspectionId) {
        // Get the embedding for the specified inspection
        const stored = await db.getInspectionEmbedding(input.inspectionId);
        if (!stored) {
          throw new Error(`No embedding found for inspection ${input.inspectionId}. Run embedInspection first.`);
        }
        queryEmbedding = JSON.parse(stored.embedding);
      } else {
        // Generate embedding from the text query
        const [result] = await generateEmbeddings([input.query!], 'search_query');
        queryEmbedding = result.embedding;
      }

      // Get all stored embeddings (excluding the query inspection)
      const allEmbeddings = await db.getAllInspectionEmbeddings(ctx.user.id);
      const candidates = allEmbeddings
        .filter(e => e.inspectionId !== input.inspectionId)
        .map(e => ({
          inspectionId: e.inspectionId,
          vesselTagNumber: e.vesselTagNumber,
          vesselName: e.vesselName || '',
          embedding: JSON.parse(e.embedding),
          findings: e.summary || '',
          inspectionDate: e.inspectionDate || '',
        }));

      // Find similar inspections
      const similar = findSimilarInspections(
        queryEmbedding,
        candidates,
        input.topK,
        input.minSimilarity
      );

      return {
        query: input.inspectionId ? `Similar to inspection ${input.inspectionId}` : input.query!,
        results: similar,
        totalCandidates: candidates.length,
      };
    }),

  // ========================================================================
  // INTEGRATION 3: COMMAND R+ — Engineering Guidance (RAG)
  // ========================================================================

  /**
   * Ask an engineering question and receive code-grounded guidance.
   * The response includes citations to specific ASME/API code sections.
   */
  askQuestion: protectedProcedure
    .input(z.object({
      question: z.string().min(10).max(2000),
      vesselContext: z.object({
        vesselTagNumber: z.string().optional(),
        materialSpec: z.string().optional(),
        designPressure: z.number().optional(),
        designTemperature: z.number().optional(),
        headType: z.string().optional(),
        currentFindings: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await askEngineeringQuestion(input.question, input.vesselContext);
      return result;
    }),

  /**
   * Get a repair recommendation based on inspection findings.
   * Specialized endpoint that generates code-compliant repair guidance.
   */
  getRepairRecommendation: protectedProcedure
    .input(z.object({
      finding: z.string().min(10).max(2000),
      componentType: z.string(),
      severity: z.enum(['minor', 'moderate', 'severe']),
      vesselContext: z.object({
        vesselTagNumber: z.string().optional(),
        materialSpec: z.string().optional(),
        designPressure: z.number().optional(),
        designTemperature: z.number().optional(),
        currentThickness: z.number().optional(),
        minimumThickness: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const question = `Based on the following inspection finding on a ${input.componentType} component (severity: ${input.severity}), provide a code-compliant repair recommendation:

Finding: ${input.finding}

${input.vesselContext?.currentThickness && input.vesselContext?.minimumThickness
  ? `Current thickness: ${input.vesselContext.currentThickness}" vs minimum required: ${input.vesselContext.minimumThickness}"`
  : ''}

Please include:
1. Applicable repair methods per ASME/API codes
2. Required NDE after repair
3. Hydrostatic test requirements (if any)
4. Documentation requirements
5. Any temporary measures if immediate repair is not possible`;

      const result = await askEngineeringQuestion(question, input.vesselContext ? {
        vesselTagNumber: input.vesselContext.vesselTagNumber,
        materialSpec: input.vesselContext.materialSpec,
        designPressure: input.vesselContext.designPressure,
        designTemperature: input.vesselContext.designTemperature,
        currentFindings: input.finding,
      } : undefined);

      return {
        ...result,
        finding: input.finding,
        componentType: input.componentType,
        severity: input.severity,
      };
    }),
});
