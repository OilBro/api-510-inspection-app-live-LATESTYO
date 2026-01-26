CREATE TABLE `cmlAngularReadings` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`tmlReadingId` varchar(64),
	`cmlNumber` varchar(50) NOT NULL,
	`angularPosition` int NOT NULL,
	`fullCmlId` varchar(100) NOT NULL,
	`componentType` varchar(50),
	`componentDescription` text,
	`thickness` decimal(10,4),
	`previousThickness` decimal(10,4),
	`nominalThickness` decimal(10,4),
	`minimumThickness` decimal(10,4),
	`corrosionRate` decimal(10,6),
	`remainingLife` decimal(10,2),
	`measurementDate` timestamp,
	`technicianName` varchar(255),
	`instrumentSerial` varchar(100),
	`dataQualityStatus` enum('good','anomaly','growth_error','below_minimum','confirmed') DEFAULT 'good',
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cmlAngularReadings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locationMappings` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`vesselTagNumber` varchar(255),
	`locationPattern` varchar(255) NOT NULL,
	`patternType` enum('single','range','prefix','slice_angle','text') DEFAULT 'single',
	`componentType` enum('shell','north_head','south_head','east_head','west_head','nozzle','manway','other') NOT NULL,
	`angularPositions` json,
	`description` text,
	`priority` int DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locationMappings_id` PRIMARY KEY(`id`)
);
