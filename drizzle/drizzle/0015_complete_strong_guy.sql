CREATE TABLE `reportAnomalies` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`category` enum('thickness_below_minimum','high_corrosion_rate','missing_critical_data','calculation_inconsistency','negative_remaining_life','excessive_thickness_variation','unusual_mawp','incomplete_tml_data') NOT NULL,
	`severity` enum('critical','warning','info') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`affectedComponent` varchar(255),
	`detectedValue` varchar(255),
	`expectedRange` varchar(255),
	`reviewStatus` enum('pending','acknowledged','resolved','false_positive') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reportAnomalies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inspections` ADD `reviewStatus` enum('pending_review','reviewed','approved') DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `inspections` ADD `anomalyCount` int DEFAULT 0 NOT NULL;