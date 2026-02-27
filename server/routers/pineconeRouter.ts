/**
 * PINECONE ROUTER
 * OilPro 510 - Regulatory-Grade Inspection Application
 *
 * tRPC endpoints for Pinecone vector search integration.
 * Exposes search, fleet analysis, audit preparation, and data sync
 * capabilities to the client application.
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import {
    searchInspectionData,
    searchAcrossFleet,
    getAuditContext,
    syncVesselData,
    getIndexStats,
    isPineconeConfigured,
} from '../pineconeService';

export const pineconeRouter = router({
    /**
     * Check if Pinecone is configured
     */
    isConfigured: publicProcedure.query(() => {
        return { configured: isPineconeConfigured() };
    }),

    /**
     * Search inspection data in a specific namespace
     */
    search: protectedProcedure
        .input(
            z.object({
                query: z.string().min(1).max(500),
                namespace: z.string().optional(),
                topK: z.number().min(1).max(20).default(5),
            })
        )
        .query(async ({ input }) => {
            const results = await searchInspectionData({
                query: input.query,
                namespace: input.namespace,
                topK: input.topK,
                rerank: true,
            });

            return {
                results: results.map(r => ({
                    id: r.id,
                    score: Math.round(r.score * 10000) / 10000,
                    namespace: r.namespace,
                    text: r.text,
                    metadata: r.fields,
                })),
                count: results.length,
            };
        }),

    /**
     * Search across all vessel and knowledge namespaces
     */
    fleetSearch: protectedProcedure
        .input(
            z.object({
                query: z.string().min(1).max(500),
                topK: z.number().min(1).max(20).default(10),
                includeKnowledge: z.boolean().default(true),
            })
        )
        .query(async ({ input }) => {
            const result = await searchAcrossFleet(
                input.query,
                input.topK,
                input.includeKnowledge
            );

            return {
                results: result.results.map(r => ({
                    id: r.id,
                    score: Math.round(r.score * 10000) / 10000,
                    namespace: r.namespace,
                    text: r.text,
                    metadata: r.fields,
                })),
                namespacesSearched: result.namespacesSearched,
                totalResults: result.totalResults,
            };
        }),

    /**
     * Get audit-relevant context for a specific vessel
     */
    auditAssistant: protectedProcedure
        .input(
            z.object({
                vesselId: z.string(),
                question: z.string().min(1).max(500),
            })
        )
        .query(async ({ input }) => {
            const results = await getAuditContext(input.vesselId, input.question);

            return {
                vesselId: input.vesselId,
                question: input.question,
                results: results.map(r => ({
                    id: r.id,
                    score: Math.round(r.score * 10000) / 10000,
                    namespace: r.namespace,
                    text: r.text,
                    metadata: r.fields,
                })),
            };
        }),

    /**
     * Sync vessel data from database to Pinecone
     */
    syncVessel: protectedProcedure
        .input(
            z.object({
                vesselId: z.string(),
                components: z.array(
                    z.object({
                        componentName: z.string(),
                        componentType: z.string(),
                        nominalThickness: z.number().optional(),
                        actualThickness: z.number().optional(),
                        minimumThickness: z.number().optional(),
                        corrosionRate: z.number().optional(),
                        remainingLife: z.number().optional(),
                        materialCode: z.string().optional(),
                        designPressure: z.number().optional(),
                        calculatedMAWP: z.number().optional(),
                    })
                ),
            })
        )
        .mutation(async ({ input }) => {
            await syncVesselData(input.vesselId, input.components);
            return { success: true, vesselId: input.vesselId };
        }),

    /**
     * Get Pinecone index statistics
     */
    stats: protectedProcedure.query(async () => {
        const stats = await getIndexStats();
        return stats;
    }),
});
