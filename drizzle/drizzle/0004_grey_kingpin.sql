ALTER TABLE `inspections` ADD `operatingTemperature` decimal(10,2);--> statement-breakpoint
ALTER TABLE `inspections` ADD `mdmt` decimal(10,2);--> statement-breakpoint
ALTER TABLE `inspections` ADD `product` text;--> statement-breakpoint
ALTER TABLE `inspections` ADD `constructionCode` varchar(255);--> statement-breakpoint
ALTER TABLE `inspections` ADD `vesselConfiguration` varchar(255);--> statement-breakpoint
ALTER TABLE `inspections` ADD `headType` varchar(255);--> statement-breakpoint
ALTER TABLE `inspections` ADD `insulationType` varchar(255);--> statement-breakpoint
ALTER TABLE `inspections` ADD `nbNumber` varchar(255);