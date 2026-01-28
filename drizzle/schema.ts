import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, boolean, decimal, date, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Inspections table - main inspection records
 */
export const inspections = mysqlTable("inspections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  
  // Inspection linking for trend analysis
  previousInspectionId: varchar("previousInspectionId", { length: 64 }),
  
  // Vessel identification
  vesselTagNumber: varchar("vesselTagNumber", { length: 255 }).notNull(),
  vesselName: text("vesselName"),
  manufacturer: text("manufacturer"),
  serialNumber: varchar("serialNumber", { length: 255 }),
  yearBuilt: int("yearBuilt"),
  
  // Design specifications
  designPressure: decimal("designPressure", { precision: 10, scale: 2 }),
  designTemperature: decimal("designTemperature", { precision: 10, scale: 2 }),
  operatingPressure: decimal("operatingPressure", { precision: 10, scale: 2 }),
  operatingTemperature: decimal("operatingTemperature", { precision: 10, scale: 2 }),
  mdmt: decimal("mdmt", { precision: 10, scale: 2 }),
  materialSpec: varchar("materialSpec", { length: 255 }),
  allowableStress: decimal("allowableStress", { precision: 10, scale: 2 }),
  jointEfficiency: decimal("jointEfficiency", { precision: 4, scale: 2 }),
  radiographyType: varchar("radiographyType", { length: 50 }), // RT-1, RT-2, RT-3, RT-4
  specificGravity: decimal("specificGravity", { precision: 10, scale: 4 }),
  vesselType: varchar("vesselType", { length: 255 }),
  product: text("product"),
  constructionCode: varchar("constructionCode", { length: 255 }),
  vesselConfiguration: varchar("vesselConfiguration", { length: 255 }),
  headType: varchar("headType", { length: 255 }),
  insulationType: varchar("insulationType", { length: 255 }),
  nbNumber: varchar("nbNumber", { length: 255 }),
  
  // Geometry
  insideDiameter: decimal("insideDiameter", { precision: 10, scale: 2 }),
  overallLength: decimal("overallLength", { precision: 10, scale: 2 }),
  crownRadius: decimal("crownRadius", { precision: 10, scale: 3 }), // L parameter for torispherical heads
  knuckleRadius: decimal("knuckleRadius", { precision: 10, scale: 3 }), // r parameter for torispherical heads
  
  // Status
  status: mysqlEnum("status", ["draft", "in_progress", "completed", "archived"]).default("draft").notNull(),
  
  // Anomaly detection
  reviewStatus: mysqlEnum("reviewStatus", ["pending_review", "reviewed", "approved"]).default("approved").notNull(),
  anomalyCount: int("anomalyCount").default(0).notNull(),
  
  // Inspection date - when the physical inspection occurred
  inspectionDate: timestamp("inspectionDate"),
  
  // Inspection findings and recommendations
  inspectionResults: text("inspectionResults"), // Section 3.0 from PDF
  recommendations: text("recommendations"), // Section 4.0 from PDF
  
  // Extraction quality tracking
  extractionQuality: varchar("extractionQuality", { length: 50 }).default("complete"), // complete, missing_recommendations, missing_results, missing_both, needs_review
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  completedAt: timestamp("completedAt"),
});

export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;

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

/**
 * Anomaly action plans table - tracks corrective actions for anomalies
 */
export const anomalyActionPlans = mysqlTable("anomalyActionPlans", {
  id: varchar("id", { length: 64 }).primaryKey(),
  anomalyId: varchar("anomalyId", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assignedTo: int("assignedTo"), // userId
  assignedBy: int("assignedBy").notNull(), // userId who created the plan
  dueDate: timestamp("dueDate"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  completedAt: timestamp("completedAt"),
  completedBy: int("completedBy"),
  completionNotes: text("completionNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AnomalyActionPlan = typeof anomalyActionPlans.$inferSelect;
export type InsertAnomalyActionPlan = typeof anomalyActionPlans.$inferInsert;

/**
 * Action plan attachments table - stores photos/documents for action plans
 */
export const actionPlanAttachments = mysqlTable("actionPlanAttachments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  actionPlanId: varchar("actionPlanId", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: varchar("fileType", { length: 100 }),
  fileSize: int("fileSize"), // bytes
  uploadedBy: int("uploadedBy").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type ActionPlanAttachment = typeof actionPlanAttachments.$inferSelect;
export type InsertActionPlanAttachment = typeof actionPlanAttachments.$inferInsert;

/**
 * Calculations table - stores calculation results
 */
export const calculations = mysqlTable("calculations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Minimum thickness calculation
  minThicknessDesignPressure: decimal("minThicknessDesignPressure", { precision: 10, scale: 2 }),
  minThicknessInsideRadius: decimal("minThicknessInsideRadius", { precision: 10, scale: 2 }),
  minThicknessAllowableStress: decimal("minThicknessAllowableStress", { precision: 10, scale: 2 }),
  minThicknessJointEfficiency: decimal("minThicknessJointEfficiency", { precision: 4, scale: 2 }),
  minThicknessCorrosionAllowance: decimal("minThicknessCorrosionAllowance", { precision: 10, scale: 4 }),
  minThicknessResult: decimal("minThicknessResult", { precision: 10, scale: 4 }),
  
  // MAWP calculation
  mawpActualThickness: decimal("mawpActualThickness", { precision: 10, scale: 4 }),
  mawpInsideRadius: decimal("mawpInsideRadius", { precision: 10, scale: 2 }),
  mawpAllowableStress: decimal("mawpAllowableStress", { precision: 10, scale: 2 }),
  mawpJointEfficiency: decimal("mawpJointEfficiency", { precision: 4, scale: 2 }),
  mawpCorrosionAllowance: decimal("mawpCorrosionAllowance", { precision: 10, scale: 4 }),
  mawpResult: decimal("mawpResult", { precision: 10, scale: 2 }),
  
  // Remaining life calculation
  remainingLifeCurrentThickness: decimal("remainingLifeCurrentThickness", { precision: 10, scale: 4 }),
  remainingLifeRequiredThickness: decimal("remainingLifeRequiredThickness", { precision: 10, scale: 4 }),
  remainingLifeCorrosionRate: decimal("remainingLifeCorrosionRate", { precision: 10, scale: 2 }),
  remainingLifeSafetyFactor: decimal("remainingLifeSafetyFactor", { precision: 4, scale: 2 }),
  remainingLifeResult: decimal("remainingLifeResult", { precision: 10, scale: 2 }),
  remainingLifeNextInspection: decimal("remainingLifeNextInspection", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Calculation = typeof calculations.$inferSelect;
export type InsertCalculation = typeof calculations.$inferInsert;

/**
 * TML (Thickness Measurement Location) readings
 * Grid-based measurement system:
 * - CML Number: Unique ID (001, 002, 003...)
 * - Location: Physical position (7-0, 7-45, 11B-C, N1)
 * - Component Type: Vessel Shell, East Head, West Head, or nozzle number
 * - Service: For nozzles only (Manhole, Relief, Vap Out, etc.)
 * - tml1-4: Multiple readings at same location
 * - tActual: Minimum of all readings
 */
export const tmlReadings = mysqlTable("tmlReadings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Grid-based identification
  cmlNumber: varchar("cmlNumber", { length: 10 }).notNull(), // "001", "002", "003"
  componentType: varchar("componentType", { length: 255 }).notNull(), // "Vessel Shell", "East Head", "West Head", "24"
  location: varchar("location", { length: 50 }).notNull(), // "7-0", "7-45", "11B-C", "N1"
  service: varchar("service", { length: 255 }), // For nozzles: "Manhole", "Relief", "Vap Out"
  
  // Reading metadata for deduplication
  readingType: varchar("readingType", { length: 50 }), // "nozzle", "seam", "spot", "general"
  nozzleSize: varchar("nozzleSize", { length: 20 }), // "24\"", "3\"", "2\"", "1\"" (for nozzles only)
  angle: varchar("angle", { length: 20 }), // "0°", "90°", "180°", "270°" (for multi-angle readings)
  
  // Standard 4-point readings at same location
  tml1: decimal("tml1", { precision: 10, scale: 4 }), // 0° position
  tml2: decimal("tml2", { precision: 10, scale: 4 }), // 90° position
  tml3: decimal("tml3", { precision: 10, scale: 4 }), // 180° position
  tml4: decimal("tml4", { precision: 10, scale: 4 }), // 270° position
  
  // Extended 8-point readings for high-criticality locations
  tml5: decimal("tml5", { precision: 10, scale: 4 }), // 45° position
  tml6: decimal("tml6", { precision: 10, scale: 4 }), // 135° position
  tml7: decimal("tml7", { precision: 10, scale: 4 }), // 225° position
  tml8: decimal("tml8", { precision: 10, scale: 4 }), // 315° position
  
  // Governing thickness (computed as MIN of all tml readings)
  tActual: decimal("tActual", { precision: 10, scale: 4 }), // Minimum of tml1-8
  
  // CRITICAL: Required thickness per ASME (API 510 §7.1.1 compliance)
  tRequired: decimal("tRequired", { precision: 10, scale: 4 }), // Minimum required per UG-27/UG-32
  retirementThickness: decimal("retirementThickness", { precision: 10, scale: 4 }), // t_required with CA=0
  
  // Historical and reference data
  nominalThickness: decimal("nominalThickness", { precision: 10, scale: 4 }),
  previousThickness: decimal("previousThickness", { precision: 10, scale: 4 }),
  previousInspectionDate: timestamp("previousInspectionDate"),
  currentInspectionDate: timestamp("currentInspectionDate"),
  originalInstallDate: timestamp("originalInstallDate"), // For long-term rate calculation
  
  // Corrosion rate fields - stored in INCHES/YEAR per API 510
  shortTermRate: decimal("shortTermRate", { precision: 10, scale: 6 }), // (t_prev - t_actual) / years, in/yr
  longTermRate: decimal("longTermRate", { precision: 10, scale: 6 }), // (t_nom - t_actual) / total_years, in/yr
  corrosionRate: decimal("corrosionRate", { precision: 10, scale: 6 }), // Governing rate in/yr (MAX of ST, LT)
  corrosionRateType: mysqlEnum("corrosionRateType", ["LT", "ST", "USER", "GOVERNING"]), // Rate type declaration
  corrosionRateMpy: decimal("corrosionRateMpy", { precision: 10, scale: 3 }), // Display value: corrosionRate × 1000
  
  // Remaining life and inspection interval (API 510 §7.1.1)
  remainingLife: decimal("remainingLife", { precision: 10, scale: 2 }), // (t_actual - t_required) / CR, years
  nextInspectionInterval: decimal("nextInspectionInterval", { precision: 10, scale: 2 }), // MIN(RL/2, 10), years
  nextInspectionDate: timestamp("nextInspectionDate"), // Calculated next inspection date
  
  // Metal loss fields
  loss: decimal("loss", { precision: 10, scale: 4 }), // nominal - tActual (in inches)
  lossPercent: decimal("lossPercent", { precision: 10, scale: 2 }),
  
  // Status with configurable threshold
  status: mysqlEnum("status", ["good", "monitor", "critical"]).default("good").notNull(),
  statusThreshold: decimal("statusThreshold", { precision: 4, scale: 2 }).default("1.10"), // Owner/User alert threshold
  
  // AUDIT TRAIL FIELDS (Required for regulatory compliance)
  measurementMethod: mysqlEnum("measurementMethod", ["UT", "RT", "VISUAL", "PROFILE", "OTHER"]), // NDT method
  technicianId: varchar("technicianId", { length: 64 }), // ID of person who took reading
  technicianName: varchar("technicianName", { length: 255 }), // Name for report
  equipmentId: varchar("equipmentId", { length: 64 }), // UT gauge or equipment ID
  calibrationDate: timestamp("calibrationDate"), // Equipment calibration date
  
  // Data quality tracking
  dataQualityStatus: mysqlEnum("dataQualityStatus", ["good", "anomaly", "growth_error", "below_minimum", "confirmed"]).default("good"),
  reviewedBy: varchar("reviewedBy", { length: 64 }), // Reviewer ID if anomaly reviewed
  reviewDate: timestamp("reviewDate"), // Date of review
  notes: text("notes"), // Inspector notes
  
  // Legacy fields for backward compatibility (will be deprecated)
  tmlId: varchar("tmlId", { length: 255 }), // Old field, use cmlNumber instead
  component: varchar("component", { length: 255 }), // Old field, use componentType instead
  currentThickness: decimal("currentThickness", { precision: 10, scale: 4 }), // Old field, use tActual instead
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type TmlReading = typeof tmlReadings.$inferSelect;
export type InsertTmlReading = typeof tmlReadings.$inferInsert;

/**
 * External inspection findings
 */
export const externalInspections = mysqlTable("externalInspections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  visualCondition: text("visualCondition"),
  corrosionObserved: boolean("corrosionObserved").default(false),
  damageMechanism: text("damageMechanism"),
  findings: text("findings"),
  recommendations: text("recommendations"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type ExternalInspection = typeof externalInspections.$inferSelect;
export type InsertExternalInspection = typeof externalInspections.$inferInsert;

/**
 * Internal inspection findings
 */
export const internalInspections = mysqlTable("internalInspections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  internalCondition: text("internalCondition"),
  corrosionPattern: text("corrosionPattern"),
  findings: text("findings"),
  recommendations: text("recommendations"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type InternalInspection = typeof internalInspections.$inferSelect;
export type InsertInternalInspection = typeof internalInspections.$inferInsert;

/**
 * Imported files tracking
 */
export const importedFiles = mysqlTable("importedFiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: mysqlEnum("fileType", ["pdf", "excel"]).notNull(),
  fileUrl: text("fileUrl"),
  fileSize: int("fileSize"),
  parserType: varchar("parserType", { length: 50 }), // "docupipe" or "manus"
  
  extractedData: text("extractedData"), // JSON string
  processingStatus: mysqlEnum("processingStatus", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  processedAt: timestamp("processedAt"),
});

export type ImportedFile = typeof importedFiles.$inferSelect;
export type InsertImportedFile = typeof importedFiles.$inferInsert;



/**
 * Field mappings for machine learning
 * Stores user's manual mappings to improve future imports
 */
export const fieldMappings = mysqlTable("fieldMappings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  
  // Source data
  sourceField: varchar("sourceField", { length: 255 }).notNull(),
  sourceValue: text("sourceValue"),
  
  // Target mapping
  targetSection: varchar("targetSection", { length: 100 }).notNull(),
  targetField: varchar("targetField", { length: 100 }).notNull(),
  
  // Learning metadata
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("1.00"),
  usageCount: int("usageCount").default(1),
  lastUsed: timestamp("lastUsed").defaultNow(),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type FieldMapping = typeof fieldMappings.$inferSelect;
export type InsertFieldMapping = typeof fieldMappings.$inferInsert;

/**
 * Unmatched data storage
 * Stores extracted data that wasn't automatically mapped
 */
export const unmatchedData = mysqlTable("unmatchedData", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  importedFileId: varchar("importedFileId", { length: 64 }),
  
  fieldName: varchar("fieldName", { length: 255 }).notNull(),
  fieldValue: text("fieldValue"),
  fieldPath: varchar("fieldPath", { length: 500 }), // JSON path in original data
  
  // Status
  status: mysqlEnum("status", ["pending", "mapped", "ignored"]).default("pending").notNull(),
  mappedTo: varchar("mappedTo", { length: 200 }), // targetSection.targetField
  
  createdAt: timestamp("createdAt").defaultNow(),
  resolvedAt: timestamp("resolvedAt"),
});

export type UnmatchedData = typeof unmatchedData.$inferSelect;
export type InsertUnmatchedData = typeof unmatchedData.$inferInsert;



/**
 * Professional Report Data - for generating OilPro-style reports
 */
export const professionalReports = mysqlTable("professionalReports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  reportNumber: varchar("reportNumber", { length: 255 }),
  reportDate: date("reportDate"),
  inspectorName: text("inspectorName"),
  inspectorCertification: varchar("inspectorCertification", { length: 255 }),
  employerName: text("employerName"),
  
  // Client information
  clientName: text("clientName"),
  clientLocation: text("clientLocation"),
  clientContact: text("clientContact"),
  clientApprovalName: text("clientApprovalName"),
  clientApprovalTitle: text("clientApprovalTitle"),
  
  // Executive summary
  executiveSummary: text("executiveSummary"),
  
  // Next inspection dates
  nextExternalInspectionClient: date("nextExternalInspectionClient"),
  nextExternalInspectionAPI: date("nextExternalInspectionAPI"),
  nextInternalInspection: date("nextInternalInspection"),
  nextUTInspection: date("nextUTInspection"),
  
  // Governing component
  governingComponent: varchar("governingComponent", { length: 255 }),
  
  // Compliance and risk assessment (Option 1 Quick Wins)
  api510Compliant: boolean("api510Compliant").default(true),
  asmeCompliant: boolean("asmeCompliant").default(true),
  riskClassification: mysqlEnum("riskClassification", ["low", "medium", "high", "critical"]).default("medium"),
  operationalEfficiencyScore: int("operationalEfficiencyScore"), // 0-100
  complianceNotes: text("complianceNotes"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type ProfessionalReport = typeof professionalReports.$inferSelect;
export type InsertProfessionalReport = typeof professionalReports.$inferInsert;

/**
 * Shell/Head calculation results for professional reports
 */
export const componentCalculations = mysqlTable("componentCalculations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull(),
  
  // Component hierarchy (Industry Leader Feature - Phase 5)
  parentComponentId: varchar("parentComponentId", { length: 64 }), // Link to parent component
  componentPath: varchar("componentPath", { length: 500 }), // Hierarchical path: "vessel/shell1/cml-a"
  hierarchyLevel: int("hierarchyLevel").default(0), // 0=vessel, 1=shell/head, 2=cml
  
  componentName: varchar("componentName", { length: 255 }).notNull(), // e.g., "Shell 1", "North Head", "South Head"
  componentType: mysqlEnum("componentType", ["shell", "head"]).notNull(),
  
  // Material data
  materialCode: varchar("materialCode", { length: 255 }),
  materialName: text("materialName"),
  
  // Design parameters
  designTemp: decimal("designTemp", { precision: 10, scale: 2 }),
  designMAWP: decimal("designMAWP", { precision: 10, scale: 2 }),
  staticHead: decimal("staticHead", { precision: 10, scale: 2 }),
  specificGravity: decimal("specificGravity", { precision: 10, scale: 4 }),
  insideDiameter: decimal("insideDiameter", { precision: 10, scale: 3 }),
  nominalThickness: decimal("nominalThickness", { precision: 10, scale: 4 }),
  
  // Stress and efficiency
  allowableStress: decimal("allowableStress", { precision: 10, scale: 2 }),
  jointEfficiency: decimal("jointEfficiency", { precision: 4, scale: 2 }),
  
  // Head-specific
  headType: varchar("headType", { length: 50 }), // "hemispherical", "ellipsoidal", "torispherical"
  crownRadius: decimal("crownRadius", { precision: 10, scale: 3 }),
  knuckleRadius: decimal("knuckleRadius", { precision: 10, scale: 3 }),
  headFactor: decimal("headFactor", { precision: 10, scale: 4 }), // M factor for torispherical
  
  // Thickness measurements
  previousThickness: decimal("previousThickness", { precision: 10, scale: 4 }),
  actualThickness: decimal("actualThickness", { precision: 10, scale: 4 }),
  minimumThickness: decimal("minimumThickness", { precision: 10, scale: 4 }),
  
  // Time span
  timeSpan: decimal("timeSpan", { precision: 10, scale: 2 }), // Y - years between readings
  nextInspectionYears: decimal("nextInspectionYears", { precision: 10, scale: 2 }), // Yn
  
  // Calculated results
  corrosionAllowance: decimal("corrosionAllowance", { precision: 10, scale: 4 }), // Ca
  
  // Dual corrosion rate system (Industry Leader Feature)
  corrosionRateLongTerm: decimal("corrosionRateLongTerm", { precision: 10, scale: 6 }), // CR_LT (in/year) - from initial to current
  corrosionRateShortTerm: decimal("corrosionRateShortTerm", { precision: 10, scale: 6 }), // CR_ST (in/year) - from previous to current
  corrosionRate: decimal("corrosionRate", { precision: 10, scale: 6 }), // Governing rate: max(CR_LT, CR_ST)
  governingRateType: mysqlEnum("governingRateType", ["long_term", "short_term", "nominal"]),
  governingRateReason: text("governingRateReason"), // Explanation of why this rate was selected
  
  remainingLife: decimal("remainingLife", { precision: 10, scale: 2 }), // RL (years)
  calculatedMAWP: decimal("calculatedMAWP", { precision: 10, scale: 2 }), // Calculated MAWP at current thickness
  
  // Data quality flags (Industry Leader Feature)
  dataQualityStatus: mysqlEnum("dataQualityStatus", ["good", "anomaly", "growth_error", "below_minimum", "confirmed"]).default("good"),
  dataQualityNotes: text("dataQualityNotes"), // Explanation of data quality issues
  excludeFromCalculation: boolean("excludeFromCalculation").default(false), // Flag to exclude bad data
  
  // MAWP at next inspection
  thicknessAtNextInspection: decimal("thicknessAtNextInspection", { precision: 10, scale: 4 }),
  pressureAtNextInspection: decimal("pressureAtNextInspection", { precision: 10, scale: 2 }),
  mawpAtNextInspection: decimal("mawpAtNextInspection", { precision: 10, scale: 2 }),
  
  // PDF original values for validation (from TABLE A)
  pdfOriginalActualThickness: decimal("pdfOriginalActualThickness", { precision: 10, scale: 4 }),
  pdfOriginalMinimumThickness: decimal("pdfOriginalMinimumThickness", { precision: 10, scale: 4 }),
  pdfOriginalCalculatedMAWP: decimal("pdfOriginalCalculatedMAWP", { precision: 10, scale: 2 }),
  pdfOriginalCorrosionRate: decimal("pdfOriginalCorrosionRate", { precision: 10, scale: 6 }),
  pdfOriginalRemainingLife: decimal("pdfOriginalRemainingLife", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type ComponentCalculation = typeof componentCalculations.$inferSelect;
export type InsertComponentCalculation = typeof componentCalculations.$inferInsert;

/**
 * Inspection findings - detailed write-ups for each section
 */
export const inspectionFindings = mysqlTable("inspectionFindings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull(),
  
  section: varchar("section", { length: 255 }).notNull(), // "Foundation", "Shell", "Heads", "Appurtenances", etc.
  findingType: varchar("findingType", { length: 50 }).notNull().default("observation"), // "observation", "defect", "recommendation"
  severity: varchar("severity", { length: 50 }).notNull().default("low"), // "low", "medium", "high", "critical"
  
  description: text("description").notNull(),
  location: varchar("location", { length: 255 }),
  measurements: text("measurements"),
  photos: text("photos"), // Comma-separated photo references
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type InspectionFinding = typeof inspectionFindings.$inferSelect;
export type InsertInspectionFinding = typeof inspectionFindings.$inferInsert;

/**
 * Recommendations for each section
 */
export const recommendations = mysqlTable("recommendations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull(),
  
  section: varchar("section", { length: 255 }).notNull(), // "foundation", "shell", "heads", "appurtenances", "next_inspection"
  subsection: varchar("subsection", { length: 255 }),
  
  recommendation: text("recommendation"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = typeof recommendations.$inferInsert;

/**
 * Photos for inspection report
 */
export const inspectionPhotos = mysqlTable("inspectionPhotos", {
  id: varchar("id", { length: 64 }).primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull(),
  
  photoUrl: text("photoUrl").notNull(),
  caption: text("caption"),
  section: varchar("section", { length: 255 }), // "foundation", "shell", "heads", "appurtenances", "general"
  sequenceNumber: int("sequenceNumber"), // For ordering photos
  
  createdAt: timestamp("createdAt").defaultNow(),
});

export type InspectionPhoto = typeof inspectionPhotos.$inferSelect;
export type InsertInspectionPhoto = typeof inspectionPhotos.$inferInsert;

/**
 * Appendix documents
 */
export const appendixDocuments = mysqlTable("appendixDocuments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull(),
  
  appendixType: mysqlEnum("appendixType", [
    "thickness_record",      // Appendix A
    "mechanical_integrity",  // Appendix B
    "drawings",             // Appendix C
    "checklist",            // Appendix D
    "photographs",          // Appendix E
    "manufacturer_data",    // Appendix F
    "nde_records"           // Appendix G
  ]).notNull(),
  
  documentUrl: text("documentUrl"),
  documentName: text("documentName"),
  sequenceNumber: int("sequenceNumber"),
  
  createdAt: timestamp("createdAt").defaultNow(),
});

export type AppendixDocument = typeof appendixDocuments.$inferSelect;
export type InsertAppendixDocument = typeof appendixDocuments.$inferInsert;

/**
 * Inspection checklist items
 */
export const checklistItems = mysqlTable("checklistItems", {
  id: varchar("id", { length: 64 }).primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull(),
  
  category: varchar("category", { length: 255 }).notNull(), // "foundation", "shell", "heads", etc.
  itemNumber: varchar("itemNumber", { length: 50 }),
  itemText: text("itemText").notNull(), // renamed from description
  
  // Checkbox-style fields
  checked: boolean("checked").default(false),
  checkedBy: varchar("checkedBy", { length: 255 }),
  checkedDate: timestamp("checkedDate"),
  notes: text("notes"),
  
  // Status-style fields (for compatibility)
  status: mysqlEnum("status", ["satisfactory", "unsatisfactory", "not_applicable", "not_checked"]).default("not_checked"),
  comments: text("comments"),
  
  sequenceNumber: int("sequenceNumber"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = typeof checklistItems.$inferInsert;




/**
 * Fitness-for-Service (FFS) Assessments per API 579
 */
export const ffsAssessments = mysqlTable("ffsAssessments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Assessment type
  assessmentLevel: mysqlEnum("assessmentLevel", ["level1", "level2", "level3"]).notNull(),
  damageType: varchar("damageType", { length: 255 }), // LTA, general metal loss, pitting, etc.
  
  // Level 1 screening criteria
  remainingThickness: decimal("remainingThickness", { precision: 10, scale: 4 }),
  minimumRequired: decimal("minimumRequired", { precision: 10, scale: 4 }),
  futureCorrosionAllowance: decimal("futureCorrosionAllowance", { precision: 10, scale: 4 }),
  
  // Assessment results
  acceptable: boolean("acceptable").default(false),
  remainingLife: decimal("remainingLife", { precision: 10, scale: 2 }),
  nextInspectionDate: timestamp("nextInspectionDate"),
  
  // Documentation
  assessmentNotes: text("assessmentNotes"),
  recommendations: text("recommendations"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type FfsAssessment = typeof ffsAssessments.$inferSelect;
export type InsertFfsAssessment = typeof ffsAssessments.$inferInsert;

/**
 * In-Lieu-Of Internal Inspection per API 510
 */
export const inLieuOfAssessments = mysqlTable("inLieuOfAssessments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Qualification criteria per API 510 Section 6.4
  cleanService: boolean("cleanService").default(false),
  noCorrosionHistory: boolean("noCorrosionHistory").default(false),
  effectiveExternalInspection: boolean("effectiveExternalInspection").default(false),
  processMonitoring: boolean("processMonitoring").default(false),
  thicknessMonitoring: boolean("thicknessMonitoring").default(false),
  
  // Assessment results
  qualified: boolean("qualified").default(false),
  maxInterval: int("maxInterval"), // years
  nextInternalDue: timestamp("nextInternalDue"),
  
  // Documentation
  justification: text("justification"),
  monitoringPlan: text("monitoringPlan"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type InLieuOfAssessment = typeof inLieuOfAssessments.$inferSelect;
export type InsertInLieuOfAssessment = typeof inLieuOfAssessments.$inferInsert;



/**
 * Pipe Schedule Database - ASME B36.10M standard pipe dimensions
 * Used for nozzle minimum thickness calculations per ASME UG-45
 */
export const pipeSchedules = mysqlTable("pipeSchedules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  
  // Pipe identification
  nominalSize: varchar("nominalSize", { length: 20 }).notNull(), // e.g., "1/2", "1", "2", "6", "24"
  schedule: varchar("schedule", { length: 20 }).notNull(), // e.g., "10", "STD", "40", "XS", "80", "XXS"
  
  // Dimensions (inches)
  outsideDiameter: decimal("outsideDiameter", { precision: 10, scale: 4 }).notNull(),
  wallThickness: decimal("wallThickness", { precision: 10, scale: 4 }).notNull(),
  insideDiameter: decimal("insideDiameter", { precision: 10, scale: 4 }).notNull(),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow(),
});

export type PipeSchedule = typeof pipeSchedules.$inferSelect;
export type InsertPipeSchedule = typeof pipeSchedules.$inferInsert;

/**
 * Nozzle Evaluations - per ASME UG-45
 * Tracks all nozzles on a vessel with minimum thickness requirements
 */
export const nozzleEvaluations = mysqlTable("nozzleEvaluations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Nozzle identification
  nozzleNumber: varchar("nozzleNumber", { length: 50 }).notNull(), // e.g., "N1", "N2", "MW-1"
  nozzleDescription: text("nozzleDescription"), // e.g., "Inlet", "Outlet", "Manway", "Drain"
  location: varchar("location", { length: 100 }), // e.g., "Shell", "Top Head", "Bottom Head"
  service: varchar("service", { length: 100 }), // e.g., "Inlet", "Outlet", "Drain", "Relief"
  
  // Pipe specifications
  nominalSize: varchar("nominalSize", { length: 20 }).notNull(),
  schedule: varchar("schedule", { length: 20 }),
  pipeOutsideDiameter: decimal("pipeOutsideDiameter", { precision: 10, scale: 4 }), // OD from pipe schedule
  
  // Manufacturing tolerance - USER OVERRIDABLE (default 12.5% per ASME B36.10M)
  manufacturingTolerance: decimal("manufacturingTolerance", { precision: 5, scale: 4 }).default("0.125"),
  toleranceOverridden: boolean("toleranceOverridden").default(false), // Track if user changed default
  
  // Actual measurements (inches)
  actualThickness: decimal("actualThickness", { precision: 10, scale: 4 }),
  previousThickness: decimal("previousThickness", { precision: 10, scale: 4 }), // For corrosion rate
  nominalThickness: decimal("nominalThickness", { precision: 10, scale: 4 }), // Original thickness
  
  // Calculated values (inches)
  pipeNominalThickness: decimal("pipeNominalThickness", { precision: 10, scale: 4 }),
  pipeMinusManufacturingTolerance: decimal("pipeMinusManufacturingTolerance", { precision: 10, scale: 4 }),
  shellHeadRequiredThickness: decimal("shellHeadRequiredThickness", { precision: 10, scale: 4 }),
  minimumRequired: decimal("minimumRequired", { precision: 10, scale: 4 }),
  
  // UG-37 Reinforcement calculation results
  reinforcementRequired: decimal("reinforcementRequired", { precision: 10, scale: 4 }), // A (sq in)
  reinforcementAvailable: decimal("reinforcementAvailable", { precision: 10, scale: 4 }), // Aavail (sq in)
  reinforcementAdequate: boolean("reinforcementAdequate").default(true),
  reinforcementMargin: decimal("reinforcementMargin", { precision: 10, scale: 2 }), // % margin
  
  // Nozzle-specific corrosion rates (separate from shell) - stored in in/yr
  shortTermCorrosionRate: decimal("shortTermCorrosionRate", { precision: 10, scale: 6 }), // in/yr
  longTermCorrosionRate: decimal("longTermCorrosionRate", { precision: 10, scale: 6 }), // in/yr
  corrosionRate: decimal("corrosionRate", { precision: 10, scale: 6 }), // Governing rate in/yr
  corrosionRateType: mysqlEnum("corrosionRateType", ["LT", "ST", "USER", "GOVERNING"]),
  
  // Remaining life per API 510
  remainingLife: decimal("remainingLife", { precision: 10, scale: 2 }), // years
  nextInspectionDate: timestamp("nextInspectionDate"),
  
  // Inspection dates for rate calculation
  currentInspectionDate: timestamp("currentInspectionDate"),
  previousInspectionDate: timestamp("previousInspectionDate"),
  originalInstallDate: timestamp("originalInstallDate"),
  
  // Assessment
  acceptable: boolean("acceptable").default(true),
  governingCriterion: mysqlEnum("governingCriterion", ["pipe_schedule", "shell_head_required", "reinforcement"]),
  notes: text("notes"),
  calculationNotes: text("calculationNotes"), // Detailed calculation audit trail
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type NozzleEvaluation = typeof nozzleEvaluations.$inferSelect;
export type InsertNozzleEvaluation = typeof nozzleEvaluations.$inferInsert;

/**
 * Material Stress Values - ASME Section II Part D
 * Allowable stress values for common pressure vessel materials at various temperatures
 */
export const materialStressValues = mysqlTable("materialStressValues", {
  id: int("id").autoincrement().primaryKey(),
  
  // Material identification
  materialSpec: varchar("materialSpec", { length: 255 }).notNull(), // e.g., "SA-240 Type 304"
  materialGrade: varchar("materialGrade", { length: 100 }), // e.g., "Type 304", "Grade 70"
  materialCategory: varchar("materialCategory", { length: 100 }), // e.g., "Stainless Steel", "Carbon Steel"
  
  // Temperature and stress
  temperatureF: int("temperatureF").notNull(), // Temperature in Fahrenheit
  allowableStress: int("allowableStress").notNull(), // Allowable stress in psi
  
  // ASME reference
  asmeTable: varchar("asmeTable", { length: 50 }), // e.g., "1A", "1B"
  asmeEdition: varchar("asmeEdition", { length: 50 }), // e.g., "2021"
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type MaterialStressValue = typeof materialStressValues.$inferSelect;
export type InsertMaterialStressValue = typeof materialStressValues.$inferInsert;


/**
 * Extraction Jobs - Background PDF extraction processing
 * Tracks async extraction jobs to avoid timeout issues
 */
export const extractionJobs = mysqlTable("extractionJobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  
  // Job status
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  progress: int("progress").default(0).notNull(), // 0-100 percentage
  progressMessage: text("progressMessage"),
  
  // Input data
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  parserType: varchar("parserType", { length: 50 }).notNull(), // manus, vision, hybrid
  
  // Result data (stored as JSON)
  extractedData: json("extractedData"),
  errorMessage: text("errorMessage"),
  
  // Timing
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type ExtractionJob = typeof extractionJobs.$inferSelect;
export type InsertExtractionJob = typeof extractionJobs.$inferInsert;


/**
 * RCRA Facility Status - Tracks RCRA compliance status for tank systems
 * Per 40 CFR Part 265 Subpart J requirements
 */
export const rcraFacilityStatus = mysqlTable("rcraFacilityStatus", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Facility identification
  epaId: varchar("epaId", { length: 50 }),
  facilityName: varchar("facilityName", { length: 255 }),
  
  // Tank system status
  interimStatus: mysqlEnum("interimStatus", ["active", "transitioning", "permitted", "closed"]).default("active"),
  tankSystemType: mysqlEnum("tankSystemType", ["existing", "new"]).default("existing"),
  tankMaterial: mysqlEnum("tankMaterial", ["metal", "polyethylene", "fiberglass", "concrete", "other"]).default("metal"),
  tankCapacityGallons: int("tankCapacityGallons"),
  wasteTypes: text("wasteTypes"), // JSON array of waste codes
  
  // PE certification tracking
  peCertificationDate: date("peCertificationDate"),
  peCertificationExpiry: date("peCertificationExpiry"),
  peEngineerName: varchar("peEngineerName", { length: 255 }),
  peEngineerLicense: varchar("peEngineerLicense", { length: 100 }),
  
  // Compliance status
  secondaryContainmentStatus: mysqlEnum("secondaryContainmentStatus", ["compliant", "exempt_daily_inspection", "upgrade_required", "non_compliant"]).default("compliant"),
  airEmissionControlLevel: mysqlEnum("airEmissionControlLevel", ["level_1", "level_2", "exempt"]).default("level_1"),
  closureStatus: mysqlEnum("closureStatus", ["operational", "closure_planned", "clean_closure", "landfill_closure"]).default("operational"),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type RcraFacilityStatus = typeof rcraFacilityStatus.$inferSelect;
export type InsertRcraFacilityStatus = typeof rcraFacilityStatus.$inferInsert;

/**
 * RCRA Checklist Items - Individual inspection checklist items per 40 CFR Part 265 Subpart J
 */
export const rcraChecklistItems = mysqlTable("rcraChecklistItems", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Item identification
  category: mysqlEnum("category", [
    "integrity_assessment",
    "daily_visual", 
    "corrosion_protection",
    "secondary_containment",
    "ancillary_equipment",
    "air_emission_controls",
    "leak_detection",
    "spill_overfill_prevention"
  ]).notNull(),
  itemCode: varchar("itemCode", { length: 20 }).notNull(),
  itemDescription: text("itemDescription").notNull(),
  regulatoryReference: varchar("regulatoryReference", { length: 100 }),
  
  // Inspection results
  status: mysqlEnum("status", ["satisfactory", "unsatisfactory", "na", "not_inspected"]).default("not_inspected"),
  findings: text("findings"),
  
  // Corrective action tracking
  correctiveActionRequired: boolean("correctiveActionRequired").default(false),
  correctiveActionDescription: text("correctiveActionDescription"),
  correctiveActionDueDate: date("correctiveActionDueDate"),
  correctiveActionCompletedDate: date("correctiveActionCompletedDate"),
  
  // Inspector info
  inspectorName: varchar("inspectorName", { length: 255 }),
  inspectionDate: timestamp("inspectionDate"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type RcraChecklistItem = typeof rcraChecklistItems.$inferSelect;
export type InsertRcraChecklistItem = typeof rcraChecklistItems.$inferInsert;

/**
 * RCRA Inspection Schedules - Regulatory inspection frequency tracking
 * Per 40 CFR 265.195 requirements
 */
export const rcraInspectionSchedules = mysqlTable("rcraInspectionSchedules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  
  // Schedule type
  scheduleType: mysqlEnum("scheduleType", [
    "daily_visual",           // 40 CFR 265.195(a) - daily for aboveground
    "weekly_visual",          // 40 CFR 265.195(a) - weekly for underground
    "bimonthly_impressed",    // 40 CFR 265.195(b) - every 2 months for impressed current
    "annual_cathodic",        // 40 CFR 265.195(b) - annual cathodic protection survey
    "pe_assessment",          // 40 CFR 265.191 - PE assessment before use
    "leak_test"               // 40 CFR 265.191 - leak test as required
  ]).notNull(),
  
  // Schedule details
  frequencyDays: int("frequencyDays").notNull(), // Days between inspections
  lastCompletedDate: date("lastCompletedDate"),
  nextDueDate: date("nextDueDate"),
  
  // Notification settings
  reminderDaysBefore: int("reminderDaysBefore").default(7),
  notificationEmail: varchar("notificationEmail", { length: 320 }),
  notificationEnabled: boolean("notificationEnabled").default(true),
  
  // Status
  isOverdue: boolean("isOverdue").default(false),
  overdueByDays: int("overdueByDays").default(0),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type RcraInspectionSchedule = typeof rcraInspectionSchedules.$inferSelect;
export type InsertRcraInspectionSchedule = typeof rcraInspectionSchedules.$inferInsert;

/**
 * RCRA Corrective Actions - Tracks findings and corrective actions
 */
export const rcraCorrectiveActions = mysqlTable("rcraCorrectiveActions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  checklistItemId: varchar("checklistItemId", { length: 64 }),
  
  // Finding details
  findingDescription: text("findingDescription").notNull(),
  findingSeverity: mysqlEnum("findingSeverity", ["critical", "major", "minor", "observation"]).default("minor"),
  regulatoryReference: varchar("regulatoryReference", { length: 100 }),
  
  // Corrective action
  actionDescription: text("actionDescription"),
  assignedTo: varchar("assignedTo", { length: 255 }),
  dueDate: date("dueDate"),
  completedDate: date("completedDate"),
  status: mysqlEnum("status", ["open", "in_progress", "completed", "verified", "overdue"]).default("open"),
  
  // Verification
  verifiedBy: varchar("verifiedBy", { length: 255 }),
  verificationDate: date("verificationDate"),
  verificationNotes: text("verificationNotes"),
  
  // Attachments (photos, documents)
  attachmentUrls: json("attachmentUrls"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type RcraCorrectiveAction = typeof rcraCorrectiveActions.$inferSelect;
export type InsertRcraCorrectiveAction = typeof rcraCorrectiveActions.$inferInsert;


/**
 * Vessel Drawings - Technical drawings for inspection reports
 * Includes P&IDs, fabrication drawings, isometrics, etc.
 */
export const vesselDrawings = mysqlTable("vesselDrawings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull(),
  inspectionId: varchar("inspectionId", { length: 64 }),
  
  // Drawing details
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  drawingNumber: varchar("drawingNumber", { length: 100 }), // e.g., "DWG-001", "P&ID-123"
  revision: varchar("revision", { length: 20 }), // e.g., "Rev A", "Rev 2"
  
  // Category for organization - supports all document types
  category: mysqlEnum("category", [
    // Inspection Drawings
    "fabrication",          // Fabrication Drawing
    "isometric",            // Isometric Drawing
    "general_arrangement",  // General Arrangement
    "detail",               // Detail Drawing
    "nameplate",            // Nameplate/Data Plate
    "nozzle_schedule",      // Nozzle Schedule
    "drawing_other",        // Other Drawing
    // P&IDs
    "pid",                  // P&ID (Piping and Instrumentation Diagram)
    "pfd",                  // Process Flow Diagram
    "pid_markup",           // P&ID Markup/Redline
    // U-1 Forms & Data Reports
    "u1_form",              // U-1 Form
    "u1a_form",             // U-1A Form
    "u2_form",              // U-2 Form
    "mdr",                  // Manufacturer's Data Report
    "partial_data_report",  // Partial Data Report
    // Certifications & Calibrations
    "api_inspector_cert",   // API Inspector Certification
    "nde_tech_cert",        // NDE Technician Certification
    "ut_calibration",       // UT Equipment Calibration
    "thickness_gauge_cal",  // Thickness Gauge Calibration
    "pressure_gauge_cal",   // Pressure Gauge Calibration
    "other_calibration",    // Other Calibration Record
    "other_cert",           // Other Certification
    // Legacy
    "other"                 // Other (legacy)
  ]).default("other"),
  
  // File information
  fileUrl: text("fileUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  fileType: varchar("fileType", { length: 50 }), // pdf, png, jpg, dwg, etc.
  fileSize: int("fileSize"), // in bytes
  
  // Display order
  sequenceNumber: int("sequenceNumber").default(0),
  
  // Metadata
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type VesselDrawing = typeof vesselDrawings.$inferSelect;
export type InsertVesselDrawing = typeof vesselDrawings.$inferInsert;


/**
 * Location Mappings - CML/TML location pattern to component type mappings
 * Used to correctly categorize thickness readings by component (Shell, Head, Nozzle)
 * Supports both simple patterns (1, 2, 3) and slice-angle format (1-0, 1-45, 1-90)
 */
export const locationMappings = mysqlTable("locationMappings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  
  // Scope - applies to all vessels or specific vessel
  vesselTagNumber: varchar("vesselTagNumber", { length: 255 }), // null = default for all vessels
  
  // Pattern matching
  locationPattern: varchar("locationPattern", { length: 255 }).notNull(), // e.g., "7", "8-12", "N1", "1-0", "1-45"
  patternType: mysqlEnum("patternType", [
    "single",        // Single CML number: "7"
    "range",         // Range of CMLs: "8-12"
    "prefix",        // Prefix match: "N" for nozzles
    "slice_angle",   // Slice with angle: "1-0", "1-45", "1-90"
    "text"           // Text pattern: "South Head"
  ]).default("single"),
  
  // Component mapping
  componentType: mysqlEnum("componentType", [
    "shell",
    "north_head",
    "south_head",
    "east_head",
    "west_head",
    "nozzle",
    "manway",
    "other"
  ]).notNull(),
  
  // Angular position support for circumferential readings
  // Shell: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
  // Nozzle: 0°, 90°, 180°, 270°
  angularPositions: json("angularPositions"), // Array of supported angles: [0, 45, 90, 135, 180, 225, 270, 315]
  
  // Description
  description: text("description"),
  
  // Priority for matching (higher = checked first)
  priority: int("priority").default(0),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type LocationMapping = typeof locationMappings.$inferSelect;
export type InsertLocationMapping = typeof locationMappings.$inferInsert;

/**
 * CML Angular Readings - Individual readings at specific angular positions
 * Supports the slice-angle format (e.g., CML 10 at 45° = "10-45")
 */
export const cmlAngularReadings = mysqlTable("cmlAngularReadings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  inspectionId: varchar("inspectionId", { length: 64 }).notNull(),
  tmlReadingId: varchar("tmlReadingId", { length: 64 }), // Link to parent TML reading if applicable
  
  // CML identification
  cmlNumber: varchar("cmlNumber", { length: 50 }).notNull(), // Base CML number: "10", "N1"
  angularPosition: int("angularPosition").notNull(), // Degrees: 0, 45, 90, 135, 180, 225, 270, 315
  fullCmlId: varchar("fullCmlId", { length: 100 }).notNull(), // Combined: "10-45", "N1-90"
  
  // Component type (resolved from location mapping)
  componentType: varchar("componentType", { length: 50 }), // shell, head, nozzle
  componentDescription: text("componentDescription"), // e.g., "2' from East Head Seam"
  
  // Thickness reading
  thickness: decimal("thickness", { precision: 10, scale: 4 }),
  previousThickness: decimal("previousThickness", { precision: 10, scale: 4 }),
  nominalThickness: decimal("nominalThickness", { precision: 10, scale: 4 }),
  minimumThickness: decimal("minimumThickness", { precision: 10, scale: 4 }),
  
  // Calculated values
  corrosionRate: decimal("corrosionRate", { precision: 10, scale: 6 }),
  remainingLife: decimal("remainingLife", { precision: 10, scale: 2 }),
  
  // Measurement metadata
  measurementDate: timestamp("measurementDate"),
  technicianName: varchar("technicianName", { length: 255 }),
  instrumentSerial: varchar("instrumentSerial", { length: 100 }),
  
  // Data quality
  dataQualityStatus: mysqlEnum("dataQualityStatus", ["good", "anomaly", "growth_error", "below_minimum", "confirmed"]).default("good"),
  notes: text("notes"),
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type CmlAngularReading = typeof cmlAngularReadings.$inferSelect;
export type InsertCmlAngularReading = typeof cmlAngularReadings.$inferInsert;
