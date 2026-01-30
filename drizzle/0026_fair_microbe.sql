ALTER TABLE `componentCalculations` ADD `tMinCodeReference` varchar(100);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `mawpCodeReference` varchar(100);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `remainingLifeCodeReference` varchar(100);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `intermediateValues` json;--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `calculationTimestamp` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `calculationVersion` varchar(50);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `calculatedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `calculationHash` varchar(64);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `allowableStressSource` varchar(255);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `allowableStressTableRef` varchar(50);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `jointEfficiencySource` varchar(255);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `jointEfficiencyCategory` varchar(20);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `jointEfficiencyType` varchar(20);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `jointEfficiencyExamination` varchar(50);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `measurementUncertainty` decimal(10,4);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `measurementMethod` enum('ut_contact','ut_immersion','rt_derived','profile_gauge');--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `measurementInstrument` varchar(255);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `measurementCalibrationDate` date;--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `validationStatus` enum('pending','validated','rejected','override') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `validationNotes` text;--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `validationDate` timestamp;--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `validatedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `reportRevision` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `reportStatus` enum('draft','review','final','superseded') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `previousReportId` varchar(64);--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `revisionReason` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `revisionDate` timestamp;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `revisedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `inspectorCertType` enum('API_510','API_570','API_653','AWS_CWI','ASNT_Level_III');--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `inspectorCertExpiry` date;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `inspectorCertValid` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `inspectorSignature` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `inspectorSignatureDate` timestamp;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `inspectorSignatureHash` varchar(64);--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `clientSignature` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `clientSignatureDate` timestamp;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `clientSignatureName` varchar(255);--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `clientSignatureTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `complianceDeterminationBasis` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `nonComplianceDetails` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `nonComplianceCodeSections` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `nextInspectionBasis` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `intervalCalculationMethod` enum('rl_half_or_10_years','rbi_extended','owner_user_specified','regulatory_mandated');--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `rbiJustification` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `riskCalculationMethod` enum('manual','calculated','rbi_based');--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `riskCalculationBasis` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `consequenceOfFailure` enum('low','medium','high','critical');--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `probabilityOfFailure` enum('low','medium','high','critical');--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `governingComponentMethod` enum('automatic','manual_override');--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `governingComponentBasis` text;--> statement-breakpoint
ALTER TABLE `professionalReports` ADD `governingComponentOverrideReason` text;