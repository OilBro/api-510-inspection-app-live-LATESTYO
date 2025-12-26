CREATE TABLE `materialStressValues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialSpec` varchar(255) NOT NULL,
	`materialGrade` varchar(100),
	`materialCategory` varchar(100),
	`temperatureF` int NOT NULL,
	`allowableStress` int NOT NULL,
	`asmeTable` varchar(50),
	`asmeEdition` varchar(50),
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materialStressValues_id` PRIMARY KEY(`id`)
);
