import { eq, desc } from "drizzle-orm";
import { logger } from "./_core/logger";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  inspections,
  InsertInspection,
  calculations,
  InsertCalculation,
  tmlReadings,
  InsertTmlReading,
  externalInspections,
  InsertExternalInspection,
  internalInspections,
  InsertInternalInspection,
  importedFiles,
  InsertImportedFile,
  nozzleEvaluations,
  InsertNozzleEvaluation
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============= User Functions =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    logger.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============= Inspection Functions =============

export async function getInspections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(inspections).where(eq(inspections.userId, userId));
  return result;
}

/**
 * Get all inspections across all users - for admin access
 */
export async function getAllInspections() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(inspections).orderBy(desc(inspections.createdAt));
  return result;
}

export async function getInspection(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(inspections).where(eq(inspections.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createInspection(inspection: InsertInspection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(inspections).values(inspection);
  return inspection;
}

export async function updateInspection(id: string, data: Partial<InsertInspection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(inspections).set(data).where(eq(inspections.id, id));
}

export async function deleteInspection(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(inspections).where(eq(inspections.id, id));
}

// ============= Calculation Functions =============

export async function getCalculations(inspectionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(calculations).where(eq(calculations.inspectionId, inspectionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function saveCalculations(calculation: InsertCalculation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(calculations).values(calculation).onDuplicateKeyUpdate({
    set: calculation,
  });
}

// ============= TML Reading Functions =============

export async function getTmlReadings(inspectionId: string) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(tmlReadings).where(eq(tmlReadings.inspectionId, inspectionId));
  return result;
}

export async function createTmlReading(reading: InsertTmlReading) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(tmlReadings).values(reading);
}

export async function updateTmlReading(id: string, data: Partial<InsertTmlReading>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tmlReadings).set(data).where(eq(tmlReadings.id, id));
}

export async function deleteTmlReading(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(tmlReadings).where(eq(tmlReadings.id, id));
}

// ============= External Inspection Functions =============

export async function getExternalInspection(inspectionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(externalInspections).where(eq(externalInspections.inspectionId, inspectionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function saveExternalInspection(data: InsertExternalInspection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(externalInspections).values(data).onDuplicateKeyUpdate({
    set: data,
  });
}

// ============= Internal Inspection Functions =============

export async function getInternalInspection(inspectionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(internalInspections).where(eq(internalInspections.inspectionId, inspectionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function saveInternalInspection(data: InsertInternalInspection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(internalInspections).values(data).onDuplicateKeyUpdate({
    set: data,
  });
}

// ============= Imported Files Functions =============

export async function getImportedFiles(inspectionId: string) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(importedFiles).where(eq(importedFiles.inspectionId, inspectionId));
  return result;
}

export async function createImportedFile(file: InsertImportedFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(importedFiles).values(file);
}

// Alias functions for backward compatibility
export const getUserInspections = getInspections;
export const getCalculation = getCalculations;
export const saveCalculation = saveCalculations;
export const getInspectionImportedFiles = getImportedFiles;

export async function updateCalculation(id: string, data: Partial<InsertCalculation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(calculations).set(data).where(eq(calculations.id, id));
}

export async function updateExternalInspection(id: string, data: Partial<InsertExternalInspection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(externalInspections).set(data).where(eq(externalInspections.id, id));
}

export async function updateInternalInspection(id: string, data: Partial<InsertInternalInspection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(internalInspections).set(data).where(eq(internalInspections.id, id));
}

export async function updateImportedFile(id: string, data: Partial<InsertImportedFile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(importedFiles).set(data).where(eq(importedFiles.id, id));
}

// ============= Nozzle Evaluation Functions =============

export async function createNozzleEvaluation(nozzle: InsertNozzleEvaluation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(nozzleEvaluations).values(nozzle);
}

export async function getNozzleEvaluations(inspectionId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(nozzleEvaluations).where(eq(nozzleEvaluations.inspectionId, inspectionId));
}
