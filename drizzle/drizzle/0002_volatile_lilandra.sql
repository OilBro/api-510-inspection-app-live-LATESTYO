CREATE TABLE `fieldMappingRules` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`sourcePattern` text NOT NULL,
	`sourceContext` text,
	`targetField` varchar(255) NOT NULL,
	`targetTable` varchar(255) NOT NULL,
	`usageCount` int NOT NULL DEFAULT 1,
	`successRate` int NOT NULL DEFAULT 100,
	`lastUsed` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fieldMappingRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `importStagingData` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`sourceFile` text,
	`sourceType` enum('pdf','excel','manual') NOT NULL,
	`rawData` json NOT NULL,
	`mappedData` json,
	`confidenceScores` json,
	`unmatchedData` json,
	`status` enum('pending','mapped','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `importStagingData_id` PRIMARY KEY(`id`)
);
