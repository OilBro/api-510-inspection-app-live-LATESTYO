ALTER TABLE `componentCalculations` ADD `corrosionRateLongTerm` decimal(10,6);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `corrosionRateShortTerm` decimal(10,6);--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `governingRateType` enum('long_term','short_term','nominal');--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `governingRateReason` text;--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `dataQualityStatus` enum('good','anomaly','growth_error','below_minimum','confirmed') DEFAULT 'good';--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `dataQualityNotes` text;--> statement-breakpoint
ALTER TABLE `componentCalculations` ADD `excludeFromCalculation` boolean DEFAULT false;