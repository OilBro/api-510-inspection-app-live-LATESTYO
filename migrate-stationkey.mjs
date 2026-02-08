import { getDb } from './server/db.js';

const db = await getDb();
if (!db) {
  console.error('Database not available');
  process.exit(1);
}

console.log('Adding stationKey system columns to tmlReadings table...');

try {
  // Add new columns
  await db.execute(`
    ALTER TABLE tmlReadings 
    ADD COLUMN IF NOT EXISTS stationKey VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sliceNumber INT,
    ADD COLUMN IF NOT EXISTS angleDeg INT,
    ADD COLUMN IF NOT EXISTS trueCmlId VARCHAR(10),
    ADD COLUMN IF NOT EXISTS axialPosition VARCHAR(50)
  `);
  
  console.log('✓ Successfully added stationKey system columns');
  
  // Create index on stationKey for fast lookups
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_tmlReadings_stationKey 
    ON tmlReadings(inspectionId, stationKey)
  `);
  
  console.log('✓ Successfully created stationKey index');
  
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}

process.exit(0);
