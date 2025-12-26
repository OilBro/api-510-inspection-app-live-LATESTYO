import { mysqlTable, varchar, text, timestamp, mysqlEnum, int } from "drizzle-orm/mysql-core";

/**
 * Report anomalies table - stores detected data quality issues
 */
export const reportAnomalies = mysqlTable("reportAnomalies", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Anomaly classification
  category: mysqlEnum("category", [
    "thickness_below_minimum",
    "high_corrosion_rate",
    "missing_critical_data",
    "calculation_inconsistency",
    "negative_remaining_life",
    "excessive_thickness_variation",
    "unusual_mawp",
    "incomplete_tml_data"
  ]).notNull(),
  
  severity: mysqlEnum("severity", ["critical", "warning", "info"]).notNull(),
  
  // Anomaly details
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  affectedComponent: varchar("affectedComponent", { length: 255 }), // e.g., "Shell", "East Head", "CML-1"
  detectedValue: varchar("detectedValue", { length: 255 }), // The problematic value
  expectedRange: varchar("expectedRange", { length: 255 }), // Expected range or threshold
  
  // Review status
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "acknowledged", "resolved", "false_positive"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"), // userId who reviewed
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  
  // Metadata
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportAnomaly = typeof reportAnomalies.$inferSelect;
export type InsertReportAnomaly = typeof reportAnomalies.$inferInsert;
