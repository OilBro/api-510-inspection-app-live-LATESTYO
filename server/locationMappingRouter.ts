import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { nanoid } from "nanoid";
import { getDb } from "./db";
import { locationMappings, cmlAngularReadings } from "../drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

/**
 * Location Mapping Router
 * Handles CML/TML location pattern to component type mappings
 * Supports both simple patterns (1, 2, 3) and slice-angle format (1-0, 1-45, 1-90)
 */
export const locationMappingRouter = router({
  // List all mappings for the current user
  list: protectedProcedure
    .input(z.object({
      vesselTagNumber: z.string().optional(), // Filter by vessel, or get defaults
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Get both default mappings (vesselTagNumber = null) and vessel-specific mappings
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const mappings = await db
        .select()
        .from(locationMappings)
        .where(
          input?.vesselTagNumber
            ? and(
                eq(locationMappings.userId, userId),
                eq(locationMappings.vesselTagNumber, input.vesselTagNumber)
              )
            : and(
                eq(locationMappings.userId, userId),
                isNull(locationMappings.vesselTagNumber)
              )
        )
        .orderBy(desc(locationMappings.priority), locationMappings.locationPattern);
      
      return mappings;
    }),

  // Get all mappings (both default and vessel-specific) for a vessel
  getForVessel: protectedProcedure
    .input(z.object({
      vesselTagNumber: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Get default mappings and vessel-specific mappings
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [defaultMappings, vesselMappings] = await Promise.all([
        db.select().from(locationMappings).where(
          and(eq(locationMappings.userId, userId), isNull(locationMappings.vesselTagNumber))
        ),
        db.select().from(locationMappings).where(
          and(eq(locationMappings.userId, userId), eq(locationMappings.vesselTagNumber, input.vesselTagNumber))
        ),
      ]);
      
      // Vessel-specific mappings override defaults
      const vesselPatterns = new Set(vesselMappings.map((m: typeof vesselMappings[0]) => m.locationPattern));
      const effectiveMappings = [
        ...vesselMappings,
        ...defaultMappings.filter((m: typeof defaultMappings[0]) => !vesselPatterns.has(m.locationPattern)),
      ];
      
      return effectiveMappings.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }),

  // Create a new mapping
  create: protectedProcedure
    .input(z.object({
      vesselTagNumber: z.string().optional(),
      locationPattern: z.string().min(1),
      patternType: z.enum(["single", "range", "prefix", "slice_angle", "text"]).default("single"),
      componentType: z.enum(["shell", "north_head", "south_head", "east_head", "west_head", "nozzle", "manway", "other"]),
      angularPositions: z.array(z.number()).optional(), // [0, 45, 90, 135, 180, 225, 270, 315]
      description: z.string().optional(),
      priority: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const id = nanoid();
      
      await db.insert(locationMappings).values({
        id,
        userId: ctx.user.id,
        vesselTagNumber: input.vesselTagNumber || null,
        locationPattern: input.locationPattern,
        patternType: input.patternType,
        componentType: input.componentType,
        angularPositions: input.angularPositions ? JSON.stringify(input.angularPositions) : null,
        description: input.description || null,
        priority: input.priority,
      });
      
      return { id, success: true };
    }),

  // Update an existing mapping
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      locationPattern: z.string().min(1).optional(),
      patternType: z.enum(["single", "range", "prefix", "slice_angle", "text"]).optional(),
      componentType: z.enum(["shell", "north_head", "south_head", "east_head", "west_head", "nozzle", "manway", "other"]).optional(),
      angularPositions: z.array(z.number()).optional(),
      description: z.string().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updates } = input;
      
      // Verify ownership
      const existing = await db.select().from(locationMappings).where(eq(locationMappings.id, id)).limit(1);
      if (!existing.length || existing[0].userId !== ctx.user.id) {
        throw new Error("Mapping not found or access denied");
      }
      
      const updateData: any = {};
      if (updates.locationPattern) updateData.locationPattern = updates.locationPattern;
      if (updates.patternType) updateData.patternType = updates.patternType;
      if (updates.componentType) updateData.componentType = updates.componentType;
      if (updates.angularPositions) updateData.angularPositions = JSON.stringify(updates.angularPositions);
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      
      await db.update(locationMappings).set(updateData).where(eq(locationMappings.id, id));
      
      return { success: true };
    }),

  // Delete a mapping
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Verify ownership
      const existing = await db.select().from(locationMappings).where(eq(locationMappings.id, input.id)).limit(1);
      if (!existing.length || existing[0].userId !== ctx.user.id) {
        throw new Error("Mapping not found or access denied");
      }
      
      await db.delete(locationMappings).where(eq(locationMappings.id, input.id));
      
      return { success: true };
    }),

  // Bulk save mappings (replace all mappings for a scope)
  bulkSave: protectedProcedure
    .input(z.object({
      vesselTagNumber: z.string().optional(), // null = default mappings
      mappings: z.array(z.object({
        locationPattern: z.string().min(1),
        patternType: z.enum(["single", "range", "prefix", "slice_angle", "text"]).default("single"),
        componentType: z.enum(["shell", "north_head", "south_head", "east_head", "west_head", "nozzle", "manway", "other"]),
        angularPositions: z.array(z.number()).optional(),
        description: z.string().optional(),
        priority: z.number().default(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const userId = ctx.user.id;
      
      // Delete existing mappings for this scope
      if (input.vesselTagNumber) {
        await db.delete(locationMappings).where(
          and(eq(locationMappings.userId, userId), eq(locationMappings.vesselTagNumber, input.vesselTagNumber))
        );
      } else {
        await db.delete(locationMappings).where(
          and(eq(locationMappings.userId, userId), isNull(locationMappings.vesselTagNumber))
        );
      }
      
      // Insert new mappings
      if (input.mappings.length > 0) {
        const values = input.mappings.map((m, index) => ({
          id: nanoid(),
          userId,
          vesselTagNumber: input.vesselTagNumber || null,
          locationPattern: m.locationPattern,
          patternType: m.patternType,
          componentType: m.componentType,
          angularPositions: m.angularPositions ? JSON.stringify(m.angularPositions) : null,
          description: m.description || null,
          priority: m.priority || input.mappings.length - index, // Higher priority for earlier items
        }));
        
        await db.insert(locationMappings).values(values);
      }
      
      return { success: true, count: input.mappings.length };
    }),

  // Resolve a CML location to its component type using mappings
  resolveLocation: protectedProcedure
    .input(z.object({
      vesselTagNumber: z.string(),
      cmlId: z.string(), // e.g., "10", "10-45", "N1", "N1-90"
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const userId = ctx.user.id;
      
      // Parse the CML ID to extract base number and angle
      const parsed = parseCmlId(input.cmlId);
      
      // Get effective mappings for this vessel
      const [defaultMappings, vesselMappings] = await Promise.all([
        db.select().from(locationMappings).where(
          and(eq(locationMappings.userId, userId), isNull(locationMappings.vesselTagNumber))
        ),
        db.select().from(locationMappings).where(
          and(eq(locationMappings.userId, userId), eq(locationMappings.vesselTagNumber, input.vesselTagNumber))
        ),
      ]);
      
      // Vessel-specific mappings override defaults
      const vesselPatterns = new Set(vesselMappings.map((m: typeof vesselMappings[0]) => m.locationPattern));
      const effectiveMappings = [
        ...vesselMappings,
        ...defaultMappings.filter((m: typeof defaultMappings[0]) => !vesselPatterns.has(m.locationPattern)),
      ].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      // Find matching mapping
      for (const mapping of effectiveMappings) {
        if (matchesPattern(parsed.baseCml, mapping.locationPattern, mapping.patternType)) {
          return {
            componentType: mapping.componentType,
            description: mapping.description,
            baseCml: parsed.baseCml,
            angularPosition: parsed.angle,
            fullCmlId: parsed.fullId,
          };
        }
      }
      
      // Default to "other" if no mapping found
      return {
        componentType: "other" as const,
        description: null,
        baseCml: parsed.baseCml,
        angularPosition: parsed.angle,
        fullCmlId: parsed.fullId,
      };
    }),
});

/**
 * Parse a CML ID into its components
 * Examples:
 *   "10" -> { baseCml: "10", angle: null, fullId: "10" }
 *   "10-45" -> { baseCml: "10", angle: 45, fullId: "10-45" }
 *   "N1" -> { baseCml: "N1", angle: null, fullId: "N1" }
 *   "N1-90" -> { baseCml: "N1", angle: 90, fullId: "N1-90" }
 */
export function parseCmlId(cmlId: string): { baseCml: string; angle: number | null; fullId: string } {
  const trimmed = cmlId.trim();
  
  // Check for slice-angle format: "10-45", "N1-90"
  const angleMatch = trimmed.match(/^(.+)-(\d+)$/);
  if (angleMatch) {
    const angle = parseInt(angleMatch[2], 10);
    // Only treat as angle if it's a valid angular position (0, 45, 90, 135, 180, 225, 270, 315)
    const validAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    if (validAngles.includes(angle)) {
      return {
        baseCml: angleMatch[1],
        angle,
        fullId: trimmed,
      };
    }
  }
  
  return {
    baseCml: trimmed,
    angle: null,
    fullId: trimmed,
  };
}

/**
 * Check if a CML matches a pattern
 */
function matchesPattern(cml: string, pattern: string, patternType: string | null): boolean {
  const cmlLower = cml.toLowerCase();
  const patternLower = pattern.toLowerCase();
  
  switch (patternType) {
    case "single":
      return cmlLower === patternLower;
    
    case "range":
      // Pattern like "8-12" means CMLs 8, 9, 10, 11, 12
      const rangeMatch = pattern.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        const cmlNum = parseInt(cml, 10);
        if (!isNaN(cmlNum)) {
          return cmlNum >= start && cmlNum <= end;
        }
      }
      return false;
    
    case "prefix":
      // Pattern like "N" matches "N1", "N2", etc.
      return cmlLower.startsWith(patternLower);
    
    case "slice_angle":
      // Pattern like "10-0" matches exactly
      return cmlLower === patternLower;
    
    case "text":
      // Text pattern - case-insensitive contains
      return cmlLower.includes(patternLower) || patternLower.includes(cmlLower);
    
    default:
      // Default to exact match
      return cmlLower === patternLower;
  }
}

/**
 * Standard angular positions for different component types
 */
export const SHELL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
export const NOZZLE_ANGLES = [0, 90, 180, 270];
export const HEAD_ANGLES: number[] = []; // Heads typically have single readings
