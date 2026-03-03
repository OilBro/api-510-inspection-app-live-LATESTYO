/**
 * Database helper functions for nozzle evaluations and pipe schedules
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from './db.js';
import { nozzleEvaluations, type InsertNozzleEvaluation, type NozzleEvaluation } from '../drizzle/schema.js';
import {
  PIPE_SCHEDULE_DATABASE,
  getPipeSchedule as getPipeScheduleFromMemory,
  getAvailableSizes,
  type PipeScheduleEntry
} from './pipeScheduleDatabase.js';

/**
 * Get all nozzles for an inspection
 */
export async function getNozzlesByInspection(inspectionId: string): Promise<NozzleEvaluation[]> {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(nozzleEvaluations)
    .where(eq(nozzleEvaluations.inspectionId, inspectionId));

  return results;
}

/**
 * Get a single nozzle by ID
 */
export async function getNozzleById(nozzleId: string): Promise<NozzleEvaluation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const results = await db
    .select()
    .from(nozzleEvaluations)
    .where(eq(nozzleEvaluations.id, nozzleId))
    .limit(1);

  return results[0];
}

/**
 * Create a new nozzle evaluation
 */
export async function createNozzle(nozzle: InsertNozzleEvaluation): Promise<NozzleEvaluation> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.insert(nozzleEvaluations).values(nozzle);

  const created = await getNozzleById(nozzle.id);
  if (!created) throw new Error('Failed to create nozzle');

  return created;
}

/**
 * Update a nozzle evaluation
 */
export async function updateNozzle(
  nozzleId: string,
  updates: Partial<InsertNozzleEvaluation>
): Promise<NozzleEvaluation> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(nozzleEvaluations)
    .set(updates)
    .where(eq(nozzleEvaluations.id, nozzleId));

  const updated = await getNozzleById(nozzleId);
  if (!updated) throw new Error('Failed to update nozzle');

  return updated;
}

/**
 * Delete a nozzle evaluation
 */
export async function deleteNozzle(nozzleId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .delete(nozzleEvaluations)
    .where(eq(nozzleEvaluations.id, nozzleId));
}

/**
 * Delete ALL nozzle evaluations for an inspection (bulk delete)
 */
export async function deleteAllNozzles(inspectionId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .delete(nozzleEvaluations)
    .where(eq(nozzleEvaluations.inspectionId, inspectionId));
}

/**
 * Get pipe schedule by nominal size and schedule
 * Uses in-memory PIPE_SCHEDULE_DATABASE (ASME B36.10M/B36.19M)
 */
export async function getPipeSchedule(
  nominalSize: string,
  schedule: string
): Promise<{ nominalSize: string; schedule: string; outsideDiameter: string; wallThickness: string } | undefined> {
  const entry = getPipeScheduleFromMemory(nominalSize, schedule);
  if (!entry) return undefined;

  return {
    nominalSize: entry.nominalSize,
    schedule: entry.schedule,
    outsideDiameter: entry.outsideDiameter.toString(),
    wallThickness: entry.wallThickness.toString(),
  };
}

/**
 * Get all available pipe schedules for a nominal size
 * Uses in-memory PIPE_SCHEDULE_DATABASE
 */
export async function getPipeSchedulesBySize(nominalSize: string): Promise<{ nominalSize: string; schedule: string; outsideDiameter: string; wallThickness: string }[]> {
  const normalizedSize = nominalSize.replace(/\s+/g, '').replace(/"/g, '').trim();
  return PIPE_SCHEDULE_DATABASE
    .filter(p => p.nominalSize === normalizedSize || p.nominalSizeInches === parseFloat(normalizedSize))
    .map(p => ({
      nominalSize: p.nominalSize,
      schedule: p.schedule,
      outsideDiameter: p.outsideDiameter.toString(),
      wallThickness: p.wallThickness.toString(),
    }));
}

/**
 * Get all unique nominal sizes from pipe schedule database
 * Uses in-memory PIPE_SCHEDULE_DATABASE
 */
export async function getAllNominalSizes(): Promise<string[]> {
  return getAvailableSizes().sort((a, b) => {
    // Sort numerically where possible
    const aNum = parseFloat(a.replace(/[^\d.]/g, ''));
    const bNum = parseFloat(b.replace(/[^\d.]/g, ''));
    return aNum - bNum;
  });
}

/**
 * Get all unique schedules from pipe schedule database
 * Uses in-memory PIPE_SCHEDULE_DATABASE
 */
export async function getAllSchedules(): Promise<string[]> {
  const schedules = new Set<string>();
  PIPE_SCHEDULE_DATABASE.forEach(p => schedules.add(p.schedule));

  // Sort schedules in logical order
  const scheduleOrder = ['5S', '10S', '10', '20', '30', 'STD', '40', 'XS', '60', '80', '100', '120', '140', 'XXS', '160'];

  return Array.from(schedules)
    .sort((a, b) => {
      const aIndex = scheduleOrder.indexOf(a);
      const bIndex = scheduleOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
}

