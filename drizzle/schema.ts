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
  
  // Multiple readings at same location
  tml1: decimal("tml1", { precision: 10, scale: 4 }),
  tml2: decimal("tml2", { precision: 10, scale: 4 }),
  tml3: decimal("tml3", { precision: 10, scale: 4 }),
  tml4: decimal("tml4", { precision: 10, scale: 4 }),
  tActual: decimal("tActual", { precision: 10, scale: 4 }), // Minimum of tml1-4
  
  // Historical and reference data
  nominalThickness: decimal("nominalThickness", { precision: 10, scale: 4 }),
  previousThickness: decimal("previousThickness", { precision: 10, scale: 4 }),
  previousInspectionDate: timestamp("previousInspectionDate"),
  currentInspectionDate: timestamp("currentInspectionDate"),
  
  // Calculated values
  loss: decimal("loss", { precision: 10, scale: 4 }), // nominal - tActual (in inches)
  lossPercent: decimal("lossPercent", { precision: 10, scale: 2 }),
  corrosionRate: decimal("corrosionRate", { precision: 10, scale: 2 }), // mils per year
  status: mysqlEnum("status", ["good", "monitor", "critical"]).default("good").notNull(),
  
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
  
  // Pipe specifications
  nominalSize: varchar("nominalSize", { length: 20 }).notNull(),
  schedule: varchar("schedule", { length: 20 }),
  
  // Actual measurements (inches)
  actualThickness: decimal("actualThickness", { precision: 10, scale: 4 }),
  
  // Calculated values (inches)
  pipeNominalThickness: decimal("pipeNominalThickness", { precision: 10, scale: 4 }),
  pipeMinusManufacturingTolerance: decimal("pipeMinusManufacturingTolerance", { precision: 10, scale: 4 }),
  shellHeadRequiredThickness: decimal("shellHeadRequiredThickness", { precision: 10, scale: 4 }),
  minimumRequired: decimal("minimumRequired", { precision: 10, scale: 4 }),
  
  // Assessment
  acceptable: boolean("acceptable").default(true),
  notes: text("notes"),
  
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
