CREATE TABLE `inspectionEmbeddings` (
	`id` varchar(64) NOT NULL,
	`inspectionId` varchar(64) NOT NULL,
	`embedding` json NOT NULL,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspectionEmbeddings_id` PRIMARY KEY(`id`),
	CONSTRAINT `inspectionEmbeddings_inspectionId_unique` UNIQUE(`inspectionId`)
);
