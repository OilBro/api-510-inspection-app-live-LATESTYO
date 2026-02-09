/**
 * Verification Script for StationKey Pairing
 * 
 * Tests that 2017 and 2025 readings for vessel 54-11-001 are correctly paired by stationKey
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { inspections, tmlReadings } from '../drizzle/schema.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log('🔍 Verifying stationKey pairing for vessel 54-11-001...\n');

// Get 2017 inspection
const [inspection2017] = await db
  .select()
  .from(inspections)
  .where(and(
    eq(inspections.vesselTagNumber, '54-11-001'),
    eq(inspections.inspectionDate, new Date('2017-06-20'))
  ))
  .limit(1);

if (!inspection2017) {
  console.error('❌ 2017 inspection not found');
  process.exit(1);
}

// Get 2025 inspection
const [inspection2025] = await db
  .select()
  .from(inspections)
  .where(and(
    eq(inspections.vesselTagNumber, '54-11-001'),
    eq(inspections.inspectionDate, new Date('2025-11-04'))
  ))
  .limit(1);

if (!inspection2025) {
  console.error('❌ 2025 inspection not found');
  process.exit(1);
}

console.log(`✅ Found 2017 inspection: ${inspection2017.id}`);
console.log(`✅ Found 2025 inspection: ${inspection2025.id}\n`);

// Get all 2017 readings
const readings2017 = await db
  .select()
  .from(tmlReadings)
  .where(eq(tmlReadings.inspectionId, inspection2017.id));

console.log(`📊 2017 readings: ${readings2017.length}`);

// Get all 2025 readings
const readings2025 = await db
  .select()
  .from(tmlReadings)
  .where(eq(tmlReadings.inspectionId, inspection2025.id));

console.log(`📊 2025 readings: ${readings2025.length}\n`);

// Create a map of 2017 readings by stationKey
const readings2017Map = new Map();
for (const reading of readings2017) {
  if (reading.stationKey) {
    readings2017Map.set(reading.stationKey, reading);
  }
}

console.log('🔗 Pairing Analysis:\n');

let matchedCount = 0;
let unmatchedCount = 0;
const pairingResults = [];

for (const reading2025 of readings2025) {
  const stationKey = reading2025.stationKey;
  const reading2017 = stationKey ? readings2017Map.get(stationKey) : null;
  
  if (reading2017) {
    matchedCount++;
    const thickness2017 = parseFloat(reading2017.tActual || '0');
    const thickness2025 = parseFloat(reading2025.tActual || '0');
    const loss = thickness2017 - thickness2025;
    const timeDelta = (new Date('2025-11-04') - new Date('2017-06-20')) / (365.25 * 24 * 60 * 60 * 1000); // years
    const corrosionRate = timeDelta > 0 ? (loss / timeDelta) : 0;
    
    pairingResults.push({
      stationKey,
      legacyLocationId2017: reading2017.legacyLocationId,
      legacyLocationId2025: reading2025.legacyLocationId,
      location2017: reading2017.location,
      location2025: reading2025.location,
      thickness2017,
      thickness2025,
      loss,
      corrosionRate: corrosionRate.toFixed(4),
      matched: true,
    });
  } else {
    unmatchedCount++;
    pairingResults.push({
      stationKey: stationKey || 'MISSING',
      legacyLocationId2025: reading2025.legacyLocationId,
      location2025: reading2025.location,
      thickness2025: parseFloat(reading2025.tActual || '0'),
      matched: false,
    });
  }
}

console.log(`✅ Matched pairs: ${matchedCount}`);
console.log(`❌ Unmatched 2025 readings: ${unmatchedCount}\n`);

// Show sample pairings
console.log('📋 Sample Pairings (first 10):\n');
for (let i = 0; i < Math.min(10, pairingResults.length); i++) {
  const result = pairingResults[i];
  if (result.matched) {
    console.log(`  ${result.stationKey}`);
    console.log(`    2017: CML ${result.legacyLocationId2017} | ${result.location2017} | ${result.thickness2017}"`);
    console.log(`    2025: CML ${result.legacyLocationId2025} | ${result.location2025} | ${result.thickness2025}"`);
    console.log(`    Loss: ${result.loss.toFixed(3)}" | Rate: ${result.corrosionRate} mpy`);
    console.log('');
  } else {
    console.log(`  ❌ UNMATCHED: ${result.stationKey}`);
    console.log(`    2025: CML ${result.legacyLocationId2025} | ${result.location2025} | ${result.thickness2025}"`);
    console.log('');
  }
}

// Calculate statistics
const matchedPairs = pairingResults.filter(r => r.matched);
const avgCorrosionRate = matchedPairs.reduce((sum, r) => sum + parseFloat(r.corrosionRate), 0) / matchedPairs.length;
const maxCorrosionRate = Math.max(...matchedPairs.map(r => parseFloat(r.corrosionRate)));
const minCorrosionRate = Math.min(...matchedPairs.map(r => parseFloat(r.corrosionRate)));

console.log('📊 Corrosion Rate Statistics:\n');
console.log(`  Average: ${avgCorrosionRate.toFixed(4)} mpy`);
console.log(`  Maximum: ${maxCorrosionRate.toFixed(4)} mpy`);
console.log(`  Minimum: ${minCorrosionRate.toFixed(4)} mpy`);
console.log('');

// Check for any readings with missing stationKeys
const missingStationKeys2017 = readings2017.filter(r => !r.stationKey);
const missingStationKeys2025 = readings2025.filter(r => !r.stationKey);

if (missingStationKeys2017.length > 0 || missingStationKeys2025.length > 0) {
  console.log('⚠️  Warnings:\n');
  if (missingStationKeys2017.length > 0) {
    console.log(`  ${missingStationKeys2017.length} readings in 2017 missing stationKey`);
  }
  if (missingStationKeys2025.length > 0) {
    console.log(`  ${missingStationKeys2025.length} readings in 2025 missing stationKey`);
  }
  console.log('');
}

if (matchedCount === readings2025.length && matchedCount > 0) {
  console.log('✅ SUCCESS: All 2025 readings were successfully paired with 2017 baseline!');
} else if (matchedCount > 0) {
  console.log(`⚠️  PARTIAL SUCCESS: ${matchedCount}/${readings2025.length} readings paired`);
} else {
  console.log('❌ FAILURE: No readings were paired');
}

await connection.end();
