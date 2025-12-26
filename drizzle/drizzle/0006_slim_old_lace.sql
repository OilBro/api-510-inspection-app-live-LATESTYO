ALTER TABLE `inspections` ADD `serialNumber` varchar(255);--> statement-breakpoint
ALTER TABLE `inspections` ADD `allowableStress` decimal(10,2);--> statement-breakpoint
ALTER TABLE `inspections` ADD `jointEfficiency` decimal(4,2);--> statement-breakpoint
ALTER TABLE `inspections` ADD `radiographyType` varchar(50);--> statement-breakpoint
ALTER TABLE `inspections` ADD `specificGravity` decimal(10,4);