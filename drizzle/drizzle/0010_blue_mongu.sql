ALTER TABLE `componentCalculations` ADD `parentComponentId` varchar(64);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `componentPath` varchar(500);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `hierarchyLevel` int DEFAULT 0;