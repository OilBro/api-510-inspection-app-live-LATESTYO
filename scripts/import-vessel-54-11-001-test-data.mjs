/**
 * Import Script for Vessel 54-11-001 Test Data
 * 
 * Imports 2017 baseline and 2025 UT readings to test stationKey pairing system
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { inspections, tmlReadings, vessels, users } from '../drizzle/schema.ts';
import { createTmlReading } from '../server/db.ts';
import { nanoid } from 'nanoid';

const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

if (!OWNER_OPEN_ID) {
  console.error('OWNER_OPEN_ID not found in environment');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log('🚀 Starting import of vessel 54-11-001 test data...\n');

// Get numeric user ID from openId
const [user] = await db.select({ id: users.id }).from(users).where(eq(users.openId, OWNER_OPEN_ID)).limit(1);
if (!user) {
  console.error(`User with openId ${OWNER_OPEN_ID} not found`);
  process.exit(1);
}
const userId = user.id;
console.log(`✅ Found user ID: ${userId}\n`);

// Create vessel
const vesselId = nanoid();
const vesselData = {
  id: vesselId,
  userId: userId,
  vesselTagNumber: '54-11-001',
  vesselName: 'Trimethylamine Storage',
  manufacturer: 'Unknown',
  serialNumber: null,
  yearBuilt: 1977,
  nbNumber: '51109',
  constructionCode: 'ASME S8 D1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

await db.insert(vessels).values(vesselData);
console.log(`✅ Created vessel: ${vesselData.vesselTagNumber} (${vesselId})\n`);

// Create 2017 baseline inspection
const inspection2017Id = nanoid();
const inspection2017Data = {
  id: inspection2017Id,
  userId: userId,
  vesselTagNumber: '54-11-001',
  inspectionDate: new Date('2017-06-20'),
  status: 'completed',
  createdAt: new Date(),
  updatedAt: new Date(),
};

await db.insert(inspections).values(inspection2017Data);
console.log(`✅ Created 2017 baseline inspection (${inspection2017Id})\n`);

// Import 2017 shell readings (CML 8-24)
const shell2017Data = [
  { cml: 8, desc: '2" from South Head seam-Shell side', readings: [0.8, 0.809, 0.813, 0.813, 0.812, 0.811, 0.811, 0.809] },
  { cml: 9, desc: '2\'', readings: [0.811, 0.814, 0.807, 0.815, 0.813, 0.813, 0.81, 0.812] },
  { cml: 10, desc: '4\'', readings: [0.813, 0.812, 0.809, 0.813, 0.811, 0.815, 0.81, 0.814] },
  { cml: 11, desc: '6\'', readings: [0.811, 0.81, 0.813, 0.811, 0.809, 0.811, 0.811, 0.811] },
  { cml: 12, desc: '8\'', readings: [0.807, 0.814, 0.812, 0.818, 0.819, 0.817, 0.813, 0.814] },
  { cml: 13, desc: '10\'', readings: [0.82, 0.818, 0.819, 0.825, 0.822, 0.824, 0.817, 0.815] },
  { cml: 14, desc: '12\'', readings: [0.819, 0.822, 0.82, 0.825, 0.817, 0.822, 0.818, 0.819] },
  { cml: 15, desc: '14\'', readings: [0.816, 0.818, 0.816, 0.817, 0.821, 0.814, 0.814, 0.814] },
  { cml: 16, desc: '16\'', readings: [0.811, 0.814, 0.811, 0.804, 0.82, 0.824, 0.818, 0.819] },
  { cml: 17, desc: '18\'', readings: [0.811, 0.811, 0.813, 0.808, 0.817, 0.826, 0.822, 0.821] },
  { cml: 18, desc: '20\'', readings: [0.804, 0.808, 0.802, 0.797, 0.808, 0.823, 0.814, 0.804] },
  { cml: 19, desc: '22\'', readings: [0.807, 0.811, 0.81, 0.801, 0.808, 0.809, 0.809, 0.807] },
  { cml: 20, desc: '24\'', readings: [0.807, 0.809, 0.804, 0.801, 0.807, 0.809, 0.809, 0.81] },
  { cml: 21, desc: '26\'', readings: [0.806, 0.804, 0.808, 0.797, 0.799, 0.801, 0.805, 0.804] },
  { cml: 22, desc: '28\'', readings: [0.807, 0.806, 0.809, 0.806, 0.813, 0.814, 0.81, 0.811] },
  { cml: 23, desc: '30\'', readings: [0.81, 0.808, 0.804, 0.806, 0.818, 0.812, 0.811, 0.811] },
  { cml: 24, desc: '2" from North Head seam- Shell side', readings: [0.806, 0.807, 0.804, 0.801, 0.81, 0.812, 0.808, 0.803] },
];

// Import 2017 head seam readings (CML 7 and 25)
const headSeam2017Data = [
  { cml: 7, desc: '2" from South Head seam-Head side', readings: [0.507, 0.501, 0.498, 0.493, 0.51, 0.499, 0.494, 0.494], component: 'South Head' },
  { cml: 25, desc: '2" from North Head seam- Head side', readings: [0.51, 0.501, 0.497, 0.499, 0.509, 0.503, 0.5, 0.498], component: 'North Head' },
];

console.log('Importing 2017 shell readings...');
let count2017Shell = 0;
for (const item of shell2017Data) {
  const minThickness = Math.min(...item.readings).toFixed(3);
  
  await createTmlReading({
    id: nanoid(),
    inspectionId: inspection2017Id,
    legacyLocationId: item.cml.toString(),
    component: 'Vessel Shell',
    componentType: 'Shell',
    location: item.desc,
    tml1: item.readings[0]?.toString() || null,
    tml2: item.readings[1]?.toString() || null,
    tml3: item.readings[2]?.toString() || null,
    tml4: item.readings[3]?.toString() || null,
    tml5: item.readings[4]?.toString() || null,
    tml6: item.readings[5]?.toString() || null,
    tml7: item.readings[6]?.toString() || null,
    tml8: item.readings[7]?.toString() || null,
    tActual: minThickness,
    currentThickness: minThickness,
    nominalThickness: '0.813',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  count2017Shell++;
}
console.log(`✅ Imported ${count2017Shell} shell readings for 2017\n`);

// Import 2017 head seam readings (CML 7, 25)
console.log('Importing 2017 head seam readings...');
let count2017HeadSeam = 0;
for (const item of headSeam2017Data) {
  const minThickness = Math.min(...item.readings).toFixed(3);
  
  await createTmlReading({
    id: nanoid(),
    inspectionId: inspection2017Id,
    legacyLocationId: item.cml.toString(),
    component: item.component,
    componentType: 'Head',
    location: item.desc,
    tml1: item.readings[0]?.toString() || null,
    tml2: item.readings[1]?.toString() || null,
    tml3: item.readings[2]?.toString() || null,
    tml4: item.readings[3]?.toString() || null,
    tml5: item.readings[4]?.toString() || null,
    tml6: item.readings[5]?.toString() || null,
    tml7: item.readings[6]?.toString() || null,
    tml8: item.readings[7]?.toString() || null,
    tActual: minThickness,
    currentThickness: minThickness,
    nominalThickness: '0.530',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  count2017HeadSeam++;
}
console.log(`✅ Imported ${count2017HeadSeam} head seam readings for 2017\n`);

// Import 2017 head readings
const head2017Data = [
  { cml: 1, desc: 'South Head 12 O\'Clock', reading: 0.518, component: 'South Head' },
  { cml: 2, desc: 'South Head 3 O\'Clock', reading: 0.526, component: 'South Head' },
  { cml: 3, desc: 'South Head 6 O\'Clock', reading: 0.526, component: 'South Head' },
  { cml: 4, desc: 'South Head 9 O\'Clock', reading: 0.515, component: 'South Head' },
  { cml: 5, desc: 'South Head Center', reading: 0.52, component: 'South Head' },
  { cml: 26, desc: 'North Head 12 O\'Clock', reading: 0.516, component: 'North Head' },
  { cml: 27, desc: 'North Head 3 O\'Clock', reading: 0.521, component: 'North Head' },
  { cml: 28, desc: 'North Head 6 O\'Clock', reading: 0.503, component: 'North Head' },
  { cml: 29, desc: 'North Head 9 O\'Clock', reading: 0.512, component: 'North Head' },
  { cml: 30, desc: 'North Head Center', reading: 0.507, component: 'North Head' },
];

console.log('Importing 2017 head readings...');
let count2017Head = 0;
for (const item of head2017Data) {
  await createTmlReading({
    id: nanoid(),
    inspectionId: inspection2017Id,
    legacyLocationId: item.cml.toString(),
    component: item.component,
    componentType: 'Head',
    location: item.desc,
    tActual: item.reading.toString(),
    currentThickness: item.reading.toString(),
    nominalThickness: '0.530',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  count2017Head++;
}
console.log(`✅ Imported ${count2017Head} head readings for 2017\n`);

// Create 2025 UT inspection
const inspection2025Id = nanoid();
const inspection2025Data = {
  id: inspection2025Id,
  userId: userId,
  vesselTagNumber: '54-11-001',
  inspectionDate: new Date('2025-11-04'),
  status: 'completed',
  previousInspectionId: inspection2017Id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

await db.insert(inspections).values(inspection2025Data);
console.log(`✅ Created 2025 UT inspection (${inspection2025Id})\n`);

// Import 2025 shell readings (CML 8-24)
const shell2025Data = [
  { cml: 8, desc: '2" from SH Shell', readings: [0.801, 0.801, 0.802, 0.859, 0.801, 0.801, 0.803, 0.801] },
  { cml: 9, desc: '2\'', readings: [0.801, 0.8, 0.802, 0.861, 0.801, 0.801, 0.802, 0.801] },
  { cml: 10, desc: '4\'', readings: [0.801, 0.801, 0.802, 0.863, 0.801, 0.801, 0.802, 0.8] },
  { cml: 11, desc: '6\'', readings: [0.801, 0.801, 0.803, 0.857, 0.801, 0.8, 0.808, 0.801] },
  { cml: 12, desc: '8\'', readings: [0.802, 0.8, 0.802, 0.865, 0.801, 0.8, 0.802, 0.801] },
  { cml: 13, desc: '10\'', readings: [0.802, 0.8, 0.802, 0.872, 0.801, 0.801, 0.802, 0.801] },
  { cml: 14, desc: '12\'', readings: [0.801, 0.801, 0.802, 0.87, 0.801, 0.801, 0.802, 0.801] },
  { cml: 15, desc: '14\'', readings: [0.801, 0.8, 0.839, 0.864, 0.801, 0.8, 0.802, 0.801] },
  { cml: 16, desc: '16\'', readings: [0.801, 0.802, 0.802, 0.802, 0.801, 0.801, 0.807, 0.801] },
  { cml: 17, desc: '18\'', readings: [0.803, 0.801, 0.802, 0.802, 0.801, 0.801, 0.861, 0.801] },
  { cml: 18, desc: '20\'', readings: [0.801, 0.805, 0.802, 0.802, 0.8, 0.801, 0.864, 0.801] },
  { cml: 19, desc: '22\'', readings: [0.802, 0.801, 0.802, 0.801, 0.801, 0.801, 0.838, 0.803] },
  { cml: 20, desc: '24\'', readings: [0.801, 0.801, 0.802, 0.801, 0.801, 0.8, 0.801, 0.802] },
  { cml: 21, desc: '26\'', readings: [0.801, 0.804, 0.802, 0.802, 0.801, 0.801, 0.802, 0.801] },
  { cml: 22, desc: '28\'', readings: [0.801, 0.806, 0.808, 0.802, 0.801, 0.801, 0.802, 0.801] },
  { cml: 23, desc: '30\'', readings: [0.804, 0.801, 0.802, 0.802, 0.801, 0.802, 0.805, 0.801] },
  { cml: 24, desc: '2" from NH Shell', readings: [null, 0.81, 0.804, 0.802, 0.802, 0.802, 0.802, 0.801] },
];

// Import 2025 head seam readings (CML 7 and 25)
const headSeam2025Data = [
  { cml: 7, desc: '2" from SH Head', readings: [0.52, 0.523, 0.502, 0.506, 0.522, 0.52, 0.509, 0.524], component: 'South Head' },
  { cml: 25, desc: '2" from NH Head', readings: [null, 0.523, 0.523, 0.51, 0.523, 0.517, 0.502, 0.528], component: 'North Head' },
];

console.log('Importing 2025 shell readings...');
let count2025Shell = 0;
for (const item of shell2025Data) {
  const validReadings = item.readings.filter(r => r !== null);
  const minThickness = Math.min(...validReadings).toFixed(3);
  
  await createTmlReading({
    id: nanoid(),
    inspectionId: inspection2025Id,
    legacyLocationId: item.cml.toString(),
    component: 'Vessel Shell',
    componentType: 'Shell',
    location: item.desc,
    tml1: item.readings[0]?.toString() || null,
    tml2: item.readings[1]?.toString() || null,
    tml3: item.readings[2]?.toString() || null,
    tml4: item.readings[3]?.toString() || null,
    tml5: item.readings[4]?.toString() || null,
    tml6: item.readings[5]?.toString() || null,
    tml7: item.readings[6]?.toString() || null,
    tml8: item.readings[7]?.toString() || null,
    tActual: minThickness,
    currentThickness: minThickness,
    nominalThickness: '0.813',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  count2025Shell++;
}
console.log(`✅ Imported ${count2025Shell} shell readings for 2025\n`);

// Import 2025 head seam readings (CML 7, 25)
console.log('Importing 2025 head seam readings...');
let count2025HeadSeam = 0;
for (const item of headSeam2025Data) {
  const validReadings = item.readings.filter(r => r !== null);
  const minThickness = Math.min(...validReadings).toFixed(3);
  
  await createTmlReading({
    id: nanoid(),
    inspectionId: inspection2025Id,
    legacyLocationId: item.cml.toString(),
    component: item.component,
    componentType: 'Head',
    location: item.desc,
    tml1: item.readings[0]?.toString() || null,
    tml2: item.readings[1]?.toString() || null,
    tml3: item.readings[2]?.toString() || null,
    tml4: item.readings[3]?.toString() || null,
    tml5: item.readings[4]?.toString() || null,
    tml6: item.readings[5]?.toString() || null,
    tml7: item.readings[6]?.toString() || null,
    tml8: item.readings[7]?.toString() || null,
    tActual: minThickness,
    currentThickness: minThickness,
    nominalThickness: '0.530',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  count2025HeadSeam++;
}
console.log(`✅ Imported ${count2025HeadSeam} head seam readings for 2025\n`);

// Import 2025 head readings
const head2025Data = [
  { cml: 1, desc: '12 O\'Clock', reading: 0.488, component: 'South Head' },
  { cml: 2, desc: '3 O\'Clock', reading: 0.493, component: 'South Head' },
  { cml: 3, desc: '6 O\'Clock', reading: 0.495, component: 'South Head' },
  { cml: 4, desc: '9 O\'Clock', reading: 0.501, component: 'South Head' },
  { cml: 5, desc: 'South Head Center', reading: 0.501, component: 'South Head' },
  { cml: 26, desc: '12 O\'Clock', reading: 0.508, component: 'North Head' },
  { cml: 27, desc: '3 O\'Clock', reading: 0.506, component: 'North Head' },
  { cml: 28, desc: '6 O\'Clock', reading: 0.517, component: 'North Head' },
  { cml: 29, desc: '9 O\'Clock', reading: 0.513, component: 'North Head' },
  { cml: 30, desc: 'North Head Center', reading: 0.502, component: 'North Head' },
];

console.log('Importing 2025 head readings...');
let count2025Head = 0;
for (const item of head2025Data) {
  await createTmlReading({
    id: nanoid(),
    inspectionId: inspection2025Id,
    legacyLocationId: item.cml.toString(),
    component: item.component,
    componentType: 'Head',
    location: item.desc,
    tActual: item.reading.toString(),
    currentThickness: item.reading.toString(),
    nominalThickness: '0.530',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  count2025Head++;
}
console.log(`✅ Imported ${count2025Head} head readings for 2025\n`);

console.log('✅ Import complete!');
console.log(`\nSummary:`);
console.log(`  Vessel: ${vesselData.vesselNumber} (${vesselId})`);
console.log(`  2017 Inspection: ${inspection2017Id} (${count2017Shell + count2017Head} readings)`);
console.log(`  2025 Inspection: ${inspection2025Id} (${count2025Shell + count2025Head} readings)`);
console.log(`\nNext: Run backfill script to generate stationKeys for these readings`);

await connection.end();
