import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Import staging table - stores raw extracted data before mapping
 */
export const importStagingData = mysqlTable("importStagingData", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  
  // Source information
  sourceFile: text("sourceFile"), // Original filename
  sourceType: mysqlEnum("sourceType", ["pdf", "excel", "manual"]).notNull(),
  
  // Raw extracted data (JSON)
  rawData: json("rawData").$type<Record<string, any>>().notNull(),
  
  // AI mapping results
  mappedData: json("mappedData").$type<Record<string, any>>(),
  confidenceScores: json("confidenceScores").$type<Record<string, number>>(),
  
  // Unmatched data that needs manual mapping
  unmatchedData: json("unmatchedData").$type<Array<{
    key: string;
    value: any;
    suggestedField?: string;
    confidence?: number;
  }>>(),
  
  // Status tracking
  status: mysqlEnum("status", ["pending", "mapped", "approved", "rejected"]).default("pending").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImportStagingData = typeof importStagingData.$inferSelect;
export type InsertImportStagingData = typeof importStagingData.$inferInsert;

/**
 * Field mapping learning table - stores successful mappings for future use
 */
export const fieldMappingRules = mysqlTable("fieldMappingRules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  
  // Source pattern (what was found in the PDF)
  sourcePattern: text("sourcePattern").notNull(), // e.g., "CML Number", "Thickness Reading", "Shell Thickness"
  sourceContext: text("sourceContext"), // Surrounding text for context
  
  // Target field (where it should map to)
  targetField: varchar("targetField", { length: 255 }).notNull(), // e.g., "cmlNumber", "tml1", "componentType"
  targetTable: varchar("targetTable", { length: 255 }).notNull(), // e.g., "tmlReadings", "inspections"
  
  // Learning metrics
  usageCount: int("usageCount").default(1).notNull(),
  successRate: int("successRate").default(100).notNull(), // Percentage
  lastUsed: timestamp("lastUsed").defaultNow().notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FieldMappingRule = typeof fieldMappingRules.$inferSelect;
export type InsertFieldMappingRule = typeof fieldMappingRules.$inferInsert;
