CREATE TABLE `vesselDrawings` (
	`id` varchar(64) NOT NULL,
	`reportId` varchar(64) NOT NULL,
	`inspectionId` varchar(64),
	`title` varchar(255) NOT NULL,
	`description` text,
	`drawingNumber` varchar(100),
	`revision` varchar(20),
	`category` enum('pid','fabrication','isometric','general_arrangement','detail','nameplate','nozzle_schedule','other') DEFAULT 'other',
	`fileUrl` text NOT NULL,
	`fileName` varchar(255),
	`fileType` varchar(50),
	`fileSize` int,
	`sequenceNumber` int DEFAULT 0,
	`uploadedBy` int,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vesselDrawings_id` PRIMARY KEY(`id`)
);
