import { getDb } from './server/db.js';

const db = await getDb();
if (!db) {
  console.error('Database not available');
  process.exit(1);
}

// Query sample TML readings
const results = await db.execute(`
  SELECT 
    cmlNumber,
    location,
    component,
    componentType,
    tActual
  FROM tmlReadings 
  WHERE cmlNumber IS NOT NULL 
  ORDER BY id
  LIMIT 20
`);

console.log('Sample TML Readings:');
console.log(JSON.stringify(results.rows, null, 2));

// Get min/max/count
const stats = await db.execute(`
  SELECT 
    MIN(CAST(cmlNumber AS UNSIGNED)) as min_cml,
    MAX(CAST(cmlNumber AS UNSIGNED)) as max_cml,
    COUNT(DISTINCT cmlNumber) as distinct_count
  FROM tmlReadings 
  WHERE cmlNumber IS NOT NULL 
    AND cmlNumber REGEXP '^[0-9]+$'
`);

console.log('\nCML Number Statistics:');
console.log(JSON.stringify(stats.rows, null, 2));

process.exit(0);
