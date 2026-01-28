ALTER TABLE `tmlReadings` MODIFY COLUMN `corrosionRate` decimal(10,6);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `tml5` decimal(10,4);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `tml6` decimal(10,4);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `tml7` decimal(10,4);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `tml8` decimal(10,4);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `tRequired` decimal(10,4);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `retirementThickness` decimal(10,4);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `originalInstallDate` timestamp;--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `shortTermRate` decimal(10,6);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `longTermRate` decimal(10,6);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `corrosionRateType` enum('LT','ST','USER','GOVERNING');--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `corrosionRateMpy` decimal(10,3);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `remainingLife` decimal(10,2);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `nextInspectionInterval` decimal(10,2);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `nextInspectionDate` timestamp;--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `statusThreshold` decimal(4,2) DEFAULT '1.10';--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `measurementMethod` enum('UT','RT','VISUAL','PROFILE','OTHER');--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `technicianId` varchar(64);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `technicianName` varchar(255);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `equipmentId` varchar(64);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `calibrationDate` timestamp;--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `dataQualityStatus` enum('good','anomaly','growth_error','below_minimum','confirmed') DEFAULT 'good';--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `reviewedBy` varchar(64);--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `reviewDate` timestamp;--> statement-breakpoint
ALTER TABLE `tmlReadings` ADD `notes` text;