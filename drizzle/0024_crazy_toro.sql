ALTER TABLE `nozzleEvaluations` ADD `service` varchar(100);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `pipeOutsideDiameter` decimal(10,4);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `manufacturingTolerance` decimal(5,4) DEFAULT '0.125';--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `toleranceOverridden` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `previousThickness` decimal(10,4);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `nominalThickness` decimal(10,4);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `reinforcementRequired` decimal(10,4);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `reinforcementAvailable` decimal(10,4);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `reinforcementAdequate` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `reinforcementMargin` decimal(10,2);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `shortTermCorrosionRate` decimal(10,6);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `longTermCorrosionRate` decimal(10,6);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `corrosionRate` decimal(10,6);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `corrosionRateType` enum('LT','ST','USER','GOVERNING');--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `remainingLife` decimal(10,2);--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `nextInspectionDate` timestamp;--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `currentInspectionDate` timestamp;--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `previousInspectionDate` timestamp;--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `originalInstallDate` timestamp;--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `governingCriterion` enum('pipe_schedule','shell_head_required','reinforcement');--> statement-breakpoint
ALTER TABLE `nozzleEvaluations` ADD `calculationNotes` text;