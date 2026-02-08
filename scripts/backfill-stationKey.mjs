/**
 * Backfill Script: Populate stationKey for Existing TML Readings
 * 
 * This script processes all existing TML readings and generates:
 * - stationKey (canonical location identifier)
 * - componentGroup (SHELL, EASTHEAD, WESTHEAD, NOZZLE, OTHER)
 * - sliceNumber (axial station)
 * - angleDeg (circumferential angle)
 * - schemaVersion (set to 1)
 * 
 * SAFE TO RUN MULTIPLE TIMES - idempotent operation
 * 
 * Run with: pnpm tsx scripts/backfill-stationKey.mjs
 */

import { getDb } from '../server/db';
import { tmlReadings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { generateStationKey } from '../server/lib/stationKeyNormalization';

async function main() {
  console.log('🔄 Starting stationKey backfill...\n');
  
  const db = await getDb();
  if (!db) {
    console.error('❌ Database not available (DATABASE_URL missing?)');
    process.exit(1);
  }
  
  // Fetch all TML readings
  console.log('📊 Fetching TML readings from database...');
  const rows = await db.select().from(tmlReadings);
  console.log(`Found ${rows.length} TML readings to process\n`);
  
  if (rows.length === 0) {
    console.log('✅ No data to backfill. Exiting.');
    return;
  }
  
  let updated = 0;
  let skipped = 0;
  const stats = {
    SHELL: 0,
    EASTHEAD: 0,
    WESTHEAD: 0,
    NOZZLE: 0,
    OTHER: 0,
  };
  
  console.log('Processing readings...\n');
  
  for (const row of rows) {
    // Skip if already has stationKey and schemaVersion = 1
    if (row.stationKey && row.schemaVersion === 1) {
      skipped++;
      continue;
    }
    
    try {
      // Generate stationKey from existing data
      const result = generateStationKey({
        component: row.component,
        componentType: row.componentType,
        location: row.location,
        sliceNumber: row.sliceNumber,
        angleDeg: row.angleDeg,
        legacyLocationId: row.legacyLocationId,
        service: row.service,
      });
      
      // Update the row
      await db
        .update(tmlReadings)
        .set({
          stationKey: result.stationKey,
          componentGroup: result.componentGroup,
          sliceNumber: result.sliceNumber,
          angleDeg: result.angleDeg,
          trueCmlId: result.trueCmlId || row.trueCmlId,
          axialPosition: result.axialPosition || row.axialPosition,
          schemaVersion: 1,
          updatedAt: new Date(),
        })
        .where(eq(tmlReadings.id, row.id));
      
      stats[result.componentGroup] = (stats[result.componentGroup] || 0) + 1;
      updated++;
      
      if (updated % 100 === 0) {
        console.log(`  Processed ${updated} readings...`);
      }
    } catch (error) {
      console.error(`❌ Error processing reading ${row.id}:`, error.message);
      console.error(`   Data: legacyLocationId=${row.legacyLocationId}, location=${row.location}, component=${row.componentType}`);
    }
  }
  
  console.log('\n✅ Backfill complete!\n');
  console.log('Summary:');
  console.log(`  Total readings: ${rows.length}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already processed): ${skipped}`);
  console.log('\nComponent group distribution:');
  for (const [group, count] of Object.entries(stats)) {
    if (count > 0) {
      console.log(`  ${group}: ${count}`);
    }
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Verify data in database: SELECT stationKey, componentGroup, legacyLocationId FROM tmlReadings LIMIT 10;');
  console.log('2. Check for any readings with confidence="low" that may need manual review');
  console.log('3. Update professional report calculation to use stationKey for pairing');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
