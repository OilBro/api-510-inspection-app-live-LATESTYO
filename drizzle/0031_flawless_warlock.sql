CREATE TABLE `cmlCorrelations` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`baselineCML` varchar(255) NOT NULL,
	`baselineDescription` text,
	`currentCML` varchar(255) NOT NULL,
	`currentDescription` text,
	`correlationBasis` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cmlCorrelations_id` PRIMARY KEY(`id`)
);
