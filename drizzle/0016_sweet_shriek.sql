CREATE TABLE `actionPlanAttachments` (
	`id` varchar(64) NOT NULL,
	`actionPlanId` varchar(64) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileType` varchar(100),
	`fileSize` int,
	`uploadedBy` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actionPlanAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `anomalyActionPlans` (
	`id` varchar(64) NOT NULL,
	`anomalyId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`assignedTo` int,
	`assignedBy` int NOT NULL,
	`dueDate` timestamp,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`completedAt` timestamp,
	`completedBy` int,
	`completionNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `anomalyActionPlans_id` PRIMARY KEY(`id`)
);
