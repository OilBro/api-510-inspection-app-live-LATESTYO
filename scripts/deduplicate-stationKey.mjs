/**
 * Deduplication Script for StationKey Duplicates
 * 
 * Merges duplicate TML readings that have the same (inspectionId, stationKey)
 * by consolidating multi-angle readings into a single row.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { tmlReadings } from '../drizzle/schema.ts';
import { eq, and, sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log('🔍 Finding duplicate (inspectionId, stationKey) pairs...\n');

// Find all duplicates
const duplicatesQuery = sql`
  SELECT inspectionId, stationKey, COUNT(*) as count
  FROM tmlReadings
  WHERE stationKey IS NOT NULL AND stationKey != ''
  GROUP BY inspectionId, stationKey
  HAVING COUNT(*) > 1
`;

const duplicates = await db.execute(duplicatesQuery);
const duplicateCount = duplicates.length;

console.log(`Found ${duplicateCount} duplicate (inspectionId, stationKey) pairs\n`);

if (duplicateCount === 0) {
  console.log('✅ No duplicates found. Exiting.');
  await connection.end();
  process.exit(0);
}

let mergedCount = 0;
let deletedCount = 0;

for (const dup of duplicates) {
  const { inspectionId, stationKey, count } = dup;
  
  console.log(`\n📍 Processing: inspectionId=${inspectionId}, stationKey=${stationKey} (${count} duplicates)`);
  
  // Get all readings for this (inspectionId, stationKey)
  const readings = await db
    .select()
    .from(tmlReadings)
    .where(
      and(
        eq(tmlReadings.inspectionId, inspectionId),
        eq(tmlReadings.stationKey, stationKey)
      )
    );
  
  if (readings.length === 0) continue;
  
  // Keep the first reading and merge data from others
  const [primary, ...duplicatesToDelete] = readings;
  
  // Collect all thickness values
  const allThicknesses = [];
  
  for (const reading of readings) {
    if (reading.tml1) allThicknesses.push(parseFloat(reading.tml1));
    if (reading.tml2) allThicknesses.push(parseFloat(reading.tml2));
    if (reading.tml3) allThicknesses.push(parseFloat(reading.tml3));
    if (reading.tml4) allThicknesses.push(parseFloat(reading.tml4));
    if (reading.tml5) allThicknesses.push(parseFloat(reading.tml5));
    if (reading.tml6) allThicknesses.push(parseFloat(reading.tml6));
    if (reading.tml7) allThicknesses.push(parseFloat(reading.tml7));
    if (reading.tml8) allThicknesses.push(parseFloat(reading.tml8));
    if (reading.tActual) allThicknesses.push(parseFloat(reading.tActual));
    if (reading.currentThickness) allThicknesses.push(parseFloat(reading.currentThickness));
  }
  
  // Filter out NaN and get minimum
  const validThicknesses = allThicknesses.filter(t => !isNaN(t) && t > 0);
  const minThickness = validThicknesses.length > 0 
    ? Math.min(...validThicknesses).toFixed(3)
    : primary.tActual;
  
  console.log(`  Min thickness: ${minThickness} (from ${validThicknesses.length} readings)`);
  
  // Update primary reading with minimum thickness
  await db
    .update(tmlReadings)
    .set({
      tActual: minThickness,
      currentThickness: minThickness,
      updatedAt: new Date(),
    })
    .where(eq(tmlReadings.id, primary.id));
  
  console.log(`  ✅ Updated primary reading ${primary.id}`);
  mergedCount++;
  
  // Delete duplicates
  for (const dupReading of duplicatesToDelete) {
    await db
      .delete(tmlReadings)
      .where(eq(tmlReadings.id, dupReading.id));
    
    console.log(`  🗑️  Deleted duplicate reading ${dupReading.id}`);
    deletedCount++;
  }
}

console.log(`\n✅ Deduplication complete!`);
console.log(`   Merged: ${mergedCount} groups`);
console.log(`   Deleted: ${deletedCount} duplicate rows`);

await connection.end();
