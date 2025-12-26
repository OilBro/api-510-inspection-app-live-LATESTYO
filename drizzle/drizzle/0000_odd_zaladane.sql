CREATE TABLE `appendixDocuments` (
	`id` varchar(64) NOT NULL,
	`reportId` varchar(64) NOT NULL,
	`appendixType` enum('thickness_record','mechanical_integrity','drawings','checklist','photographs','manufacturer_data','nde_records') NOT NULL,
	`documentUrl` text,
	`documentName` text,
	`sequenceNumber` int,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `appendixDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calculations` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`minThicknessDesignPressure` decimal(10,2),
	`minThicknessInsideRadius` decimal(10,2),
	`minThicknessAllowableStress` decimal(10,2),
	`minThicknessJointEfficiency` decimal(4,2),
	`minThicknessCorrosionAllowance` decimal(10,4),
	`minThicknessResult` decimal(10,4),
	`mawpActualThickness` decimal(10,4),
	`mawpInsideRadius` decimal(10,2),
	`mawpAllowableStress` decimal(10,2),
	`mawpJointEfficiency` decimal(4,2),
	`mawpCorrosionAllowance` decimal(10,4),
	`mawpResult` decimal(10,2),
	`remainingLifeCurrentThickness` decimal(10,4),
	`remainingLifeRequiredThickness` decimal(10,4),
	`remainingLifeCorrosionRate` decimal(10,2),
	`remainingLifeSafetyFactor` decimal(4,2),
	`remainingLifeResult` decimal(10,2),
	`remainingLifeNextInspection` decimal(10,2),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calculations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklistItems` (
	`id` varchar(64) NOT NULL,
	`reportId` varchar(64) NOT NULL,
	`category` varchar(255) NOT NULL,
	`itemNumber` varchar(50),
	`itemText` text NOT NULL,
	`checked` boolean DEFAULT false,
	`checkedBy` varchar(255),
	`checkedDate` timestamp,
	`notes` text,
	`status` enum('satisfactory','unsatisfactory','not_applicable','not_checked') DEFAULT 'not_checked',
	`comments` text,
	`sequenceNumber` int,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklistItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `componentCalculations` (
	`id` varchar(64) NOT NULL,
	`reportId` varchar(64) NOT NULL,
	`componentName` varchar(255) NOT NULL,
	`componentType` enum('shell','head') NOT NULL,
	`materialCode` varchar(255),
	`materialName` text,
	`designTemp` decimal(10,2),
	`designMAWP` decimal(10,2),
	`staticHead` decimal(10,2),
	`specificGravity` decimal(10,4),
	`insideDiameter` decimal(10,3),
	`nominalThickness` decimal(10,4),
	`allowableStress` decimal(10,2),
	`jointEfficiency` decimal(4,2),
	`headType` varchar(50),
	`crownRadius` decimal(10,3),
	`knuckleRadius` decimal(10,3),
	`headFactor` decimal(10,4),
	`previousThickness` decimal(10,4),
	`actualThickness` decimal(10,4),
	`minimumThickness` decimal(10,4),
	`timeSpan` decimal(10,2),
	`nextInspectionYears` decimal(10,2),
	`corrosionAllowance` decimal(10,4),
	`corrosionRate` decimal(10,6),
	`remainingLife` decimal(10,2),
	`thicknessAtNextInspection` decimal(10,4),
	`pressureAtNextInspection` decimal(10,2),
	`mawpAtNextInspection` decimal(10,2),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `componentCalculations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `externalInspections` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`visualCondition` text,
	`corrosionObserved` boolean DEFAULT false,
	`damageMechanism` text,
	`findings` text,
	`recommendations` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `externalInspections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ffsAssessments` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`assessmentLevel` enum('level1','level2','level3') NOT NULL,
	`damageType` varchar(255),
	`remainingThickness` decimal(10,4),
	`minimumRequired` decimal(10,4),
	`futureCorrosionAllowance` decimal(10,4),
	`acceptable` boolean DEFAULT false,
	`remainingLife` decimal(10,2),
	`nextInspectionDate` timestamp,
	`assessmentNotes` text,
	`recommendations` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ffsAssessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fieldMappings` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`sourceField` varchar(255) NOT NULL,
	`sourceValue` text,
	`targetSection` varchar(100) NOT NULL,
	`targetField` varchar(100) NOT NULL,
	`confidence` decimal(3,2) DEFAULT '1.00',
	`usageCount` int DEFAULT 1,
	`lastUsed` timestamp DEFAULT (now()),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fieldMappings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `importedFiles` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileType` enum('pdf','excel') NOT NULL,
	`fileUrl` text,
	`fileSize` int,
	`parserType` varchar(50),
	`extractedData` text,
	`processingStatus` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `importedFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inLieuOfAssessments` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`cleanService` boolean DEFAULT false,
	`noCorrosionHistory` boolean DEFAULT false,
	`effectiveExternalInspection` boolean DEFAULT false,
	`processMonitoring` boolean DEFAULT false,
	`thicknessMonitoring` boolean DEFAULT false,
	`qualified` boolean DEFAULT false,
	`maxInterval` int,
	`nextInternalDue` timestamp,
	`justification` text,
	`monitoringPlan` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inLieuOfAssessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspectionFindings` (
	`id` varchar(64) NOT NULL,
	`reportId` varchar(64) NOT NULL,
	`section` varchar(255) NOT NULL,
	`findingType` varchar(50) NOT NULL DEFAULT 'observation',
	`severity` varchar(50) NOT NULL DEFAULT 'low',
	`description` text NOT NULL,
	`location` varchar(255),
	`measurements` text,
	`photos` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspectionFindings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspectionPhotos` (
	`id` varchar(64) NOT NULL,
	`reportId` varchar(64) NOT NULL,
	`photoUrl` text NOT NULL,
	`caption` text,
	`section` varchar(255),
	`sequenceNumber` int,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `inspectionPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`vesselTagNumber` varchar(255) NOT NULL,
	`vesselName` text,
	`manufacturer` text,
	`yearBuilt` int,
	`designPressure` decimal(10,2),
	`designTemperature` decimal(10,2),
	`operatingPressure` decimal(10,2),
	`materialSpec` varchar(255),
	`vesselType` varchar(255),
	`insideDiameter` decimal(10,2),
	`overallLength` decimal(10,2),
	`status` enum('draft','in_progress','completed','archived') NOT NULL DEFAULT 'draft',
	`inspectionDate` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `inspections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internalInspections` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`internalCondition` text,
	`corrosionPattern` text,
	`findings` text,
	`recommendations` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internalInspections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nozzleEvaluations` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`nozzleNumber` varchar(50) NOT NULL,
	`nozzleDescription` text,
	`location` varchar(100),
	`nominalSize` varchar(20) NOT NULL,
	`schedule` varchar(20),
	`actualThickness` decimal(10,4),
	`pipeNominalThickness` decimal(10,4),
	`pipeMinusManufacturingTolerance` decimal(10,4),
	`shellHeadRequiredThickness` decimal(10,4),
	`minimumRequired` decimal(10,4),
	`acceptable` boolean DEFAULT true,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nozzleEvaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipeSchedules` (
	`id` varchar(64) NOT NULL,
	`nominalSize` varchar(20) NOT NULL,
	`schedule` varchar(20) NOT NULL,
	`outsideDiameter` decimal(10,4) NOT NULL,
	`wallThickness` decimal(10,4) NOT NULL,
	`insideDiameter` decimal(10,4) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `pipeSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` varchar(64) NOT NULL,
	`reportId` varchar(64) NOT NULL,
	`section` varchar(255) NOT NULL,
	`subsection` varchar(255),
	`recommendation` text,
	`priority` enum('low','medium','high','critical'),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tmlReadings` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`cmlNumber` varchar(10) NOT NULL,
	`componentType` varchar(255) NOT NULL,
	`location` varchar(50) NOT NULL,
	`service` varchar(255),
	`tml1` decimal(10,4),
	`tml2` decimal(10,4),
	`tml3` decimal(10,4),
	`tml4` decimal(10,4),
	`tActual` decimal(10,4),
	`nominalThickness` decimal(10,4),
	`previousThickness` decimal(10,4),
	`previousInspectionDate` timestamp,
	`currentInspectionDate` timestamp,
	`loss` decimal(10,4),
	`lossPercent` decimal(10,2),
	`corrosionRate` decimal(10,2),
	`status` enum('good','monitor','critical') NOT NULL DEFAULT 'good',
	`tmlId` varchar(255),
	`component` varchar(255),
	`currentThickness` decimal(10,4),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tmlReadings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `unmatchedData` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`importedFileId` varchar(64),
	`fieldName` varchar(255) NOT NULL,
	`fieldValue` text,
	`fieldPath` varchar(500),
	`status` enum('pending','mapped','ignored') NOT NULL DEFAULT 'pending',
	`mappedTo` varchar(200),
	`createdAt` timestamp DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `unmatchedData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
