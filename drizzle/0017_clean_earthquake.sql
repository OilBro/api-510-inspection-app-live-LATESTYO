CREATE TABLE `extractionJobs` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`progressMessage` text,
	`filename` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`parserType` varchar(50) NOT NULL,
	`extractedData` json,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `extractionJobs_id` PRIMARY KEY(`id`)
);
