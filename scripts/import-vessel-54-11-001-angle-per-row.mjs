/**
 * Import Script for Vessel 54-11-001 - Angle-per-Row Approach
 * 
 * Creates SEPARATE ROWS for each (slice, angle) combination to avoid stationKey collisions
 * This aligns with the code review requirement: "each (slice, angle) becomes a distinct row"
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { inspections, tmlReadings, vessels, users } from '../drizzle/schema.ts';
import { createTmlReading } from '../server/db.ts';
import { nanoid } from 'nanoid';

const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID;

if (!DATABASE_URL || !OWNER_OPEN_ID) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log('🚀 Starting import of vessel 54-11-001 (angle-per-row approach)...\n');

// Get numeric user ID
const [user] = await db.select({ id: users.id }).from(users).where(eq(users.openId, OWNER_OPEN_ID)).limit(1);
if (!user) {
  console.error(`User with openId ${OWNER_OPEN_ID} not found`);
  process.exit(1);
}
const userId = user.id;

// Create vessel
const vesselId = nanoid();
await db.insert(vessels).values({
  id: vesselId,
  userId: userId,
  vesselTagNumber: '54-11-001',
  vesselName: 'Trimethylamine Storage',
  manufacturer: 'Unknown',
  serialNumber: null,
  yearBuilt: 1977,
  constructionCode: 'ASME VIII Div. 1',
  designPressure: 125,
  designTemperature: 100,
  shellMaterial: 'SA-516 Gr. 70',
  headMaterial: 'SA-516 Gr. 70',
  shellThickness: 0.813,
  headThickness: 0.530,
  insideDiameter: 96,
  overallLength: 240,
  straightShellLength: 180,
  headType: '2:1 Ellipsoidal',
  createdAt: new Date(),
  updatedAt: new Date(),
});

console.log(`✅ Created vessel: 54-11-001\n`);

// Create 2017 baseline inspection
const inspection2017Id = nanoid();
await db.insert(inspections).values({
  id: inspection2017Id,
  userId: userId,
  vesselId: vesselId,
  vesselTagNumber: '54-11-001',
  inspectionDate: new Date('2017-06-20'),
  inspectionType: 'External',
  createdAt: new Date(),
  updatedAt: new Date(),
});

console.log(`✅ Created 2017 baseline inspection\n`);

// Shell data: CML 9-23 (excluding 7, 8, 24, 25 which are seam-adjacent)
// Each CML has 8 angles: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
const shell2017Data = [
  { cml: 9, desc: "2' from South Head", readings: [0.811, 0.829, 0.811, 0.809, null, null, null, null] },
  { cml: 11, desc: "6' from South Head", readings: [0.808, 0.831, 0.808, 0.809, null, null, null, null] },
  { cml: 13, desc: "10' from South Head", readings: [0.822, 0.846, 0.822, 0.817, null, null, null, null] },
  { cml: 15, desc: "14' from South Head", readings: [0.821, 0.845, 0.821, 0.816, null, null, null, null] },
  { cml: 17, desc: "18' from South Head", readings: [0.813, 0.837, 0.813, 0.816, null, null, null, null] },
  { cml: 19, desc: "22' from South Head", readings: [0.802, 0.825, 0.802, null, null, null, null, null] },
  { cml: 21, desc: "26' from South Head", readings: [0.805, 0.828, 0.805, 0.809, null, null, null, null] },
  { cml: 23, desc: "30' from South Head", readings: [0.800, 0.824, 0.800, 0.809, null, null, null, null] },
  { cml: 10, desc: "4' from South Head", readings: [0.797, 0.823, 0.797, null, null, null, null, null] },
  { cml: 12, desc: "8' from South Head", readings: [0.800, 0.820, 0.800, 0.814, null, null, null, null] },
  { cml: 14, desc: "12' from South Head", readings: [0.815, 0.838, 0.815, 0.814, null, null, null, null] },
  { cml: 16, desc: "16' from South Head", readings: [0.807, 0.832, 0.807, null, null, null, null, null] },
  { cml: 18, desc: "20' from South Head", readings: [0.796, 0.827, 0.796, 0.800, null, null, null, null] },
  { cml: 20, desc: "24' from South Head", readings: [0.802, 0.825, 0.802, 0.802, null, null, null, null] },
  { cml: 22, desc: "28' from South Head", readings: [0.807, 0.823, 0.807, null, null, null, null, null] },
  { cml: 26, desc: "2' from North Head", readings: [0.510, 0.501, 0.497, 0.499, 0.509, 0.503, 0.500, 0.498] },
];

// Seam-adjacent data: CML 7, 8, 24, 25
const headSeam2017Data = [
  { cml: 7, desc: "2\" from South Head seam-Head side", readings: [0.507, 0.501, 0.498, 0.493, 0.510, 0.499, 0.494, 0.494], component: 'South Head' },
  { cml: 8, desc: "2\" from South Head seam-Shell side", readings: [0.810, 0.809, 0.813, 0.809, 0.807, null, null, null], component: 'Vessel Shell' },
  { cml: 24, desc: "2\" from North Head seam-Shell side", readings: [0.807, null, null, null, null, null, null, null], component: 'Vessel Shell' },
  { cml: 25, desc: "2\" from North Head seam-Head side", readings: [0.807, null, null, null, null, null, null, null], component: 'North Head' },
];

const angles = [0, 45, 90, 135, 180, 225, 270, 315];

console.log('Importing 2017 shell readings (angle-per-row)...');
let count2017Shell = 0;
for (const item of shell2017Data) {
  for (let i = 0; i < angles.length; i++) {
    const thickness = item.readings[i];
    if (thickness == null) continue; // Skip missing angles
    
    await createTmlReading({
      id: nanoid(),
      inspectionId: inspection2017Id,
      legacyLocationId: item.cml.toString(),
      component: 'Vessel Shell',
      componentType: 'Shell',
      location: item.desc,
      sliceNumber: item.cml,
      angleDeg: angles[i],
      tActual: thickness.toString(),
      currentThickness: thickness.toString(),
      nominalThickness: '0.813',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    count2017Shell++;
  }
}
console.log(`✅ Imported ${count2017Shell} shell readings (with explicit angles)\n`);

console.log('Importing 2017 head seam readings (angle-per-row)...');
let count2017HeadSeam = 0;
for (const item of headSeam2017Data) {
  for (let i = 0; i < angles.length; i++) {
    const thickness = item.readings[i];
    if (thickness == null) continue; // Skip missing angles
    
    await createTmlReading({
      id: nanoid(),
      inspectionId: inspection2017Id,
      legacyLocationId: item.cml.toString(),
      component: item.component,
      componentType: item.component.includes('Shell') ? 'Shell' : 'Head',
      location: item.desc,
      sliceNumber: item.cml,
      angleDeg: angles[i],
      tActual: thickness.toString(),
      currentThickness: thickness.toString(),
      nominalThickness: item.component.includes('Shell') ? '0.813' : '0.530',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    count2017HeadSeam++;
  }
}
console.log(`✅ Imported ${count2017HeadSeam} head seam readings (with explicit angles)\n`);

// Head spot readings (single point, no angles)
const head2017Data = [
  { cml: 1, desc: "South Head 12 O'Clock", reading: 0.518, component: 'South Head' },
  { cml: 2, desc: "South Head 3 O'Clock", reading: 0.526, component: 'South Head' },
  { cml: 3, desc: "South Head 6 O'Clock", reading: 0.526, component: 'South Head' },
  { cml: 4, desc: "South Head 9 O'Clock", reading: 0.515, component: 'South Head' },
  { cml: 5, desc: "South Head Center", reading: 0.52, component: 'South Head' },
  { cml: 27, desc: "North Head 12 O'Clock", reading: 0.516, component: 'North Head' },
  { cml: 28, desc: "North Head 3 O'Clock", reading: 0.521, component: 'North Head' },
  { cml: 29, desc: "North Head 6 O'Clock", reading: 0.503, component: 'North Head' },
  { cml: 30, desc: "North Head 9 O'Clock", reading: 0.512, component: 'North Head' },
  { cml: 31, desc: "North Head Center", reading: 0.507, component: 'North Head' },
];

console.log('Importing 2017 head spot readings...');
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
console.log(`✅ Imported ${count2017Head} head spot readings\n`);

console.log(`\n✅ Import complete!`);
console.log(`   Total 2017 readings: ${count2017Shell + count2017HeadSeam + count2017Head}`);

await connection.end();
