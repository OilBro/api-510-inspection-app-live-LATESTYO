import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Find TMLs where tActual is 0 or null but currentThickness has a value
const [outOfSync] = await conn.execute(
    `SELECT id, legacyLocationId, tActual, currentThickness 
   FROM tmlReadings 
   WHERE (tActual IS NULL OR tActual = 0 OR tActual = '0.0000')
     AND currentThickness IS NOT NULL AND currentThickness > 0
   LIMIT 20`
);
console.log(`Found ${outOfSync.length} TMLs with tActual=0 but valid currentThickness`);
for (const r of outOfSync) {
    console.log(`  CML ${r.legacyLocationId}: tActual=${r.tActual}, currentThickness=${r.currentThickness}`);
}

// Sync: Set tActual = currentThickness where tActual is missing/zero
const [result1] = await conn.execute(
    `UPDATE tmlReadings 
   SET tActual = currentThickness 
   WHERE (tActual IS NULL OR tActual = 0 OR tActual = '0.0000')
     AND currentThickness IS NOT NULL AND currentThickness > 0`
);
console.log(`\nFixed ${result1.affectedRows} TMLs: set tActual = currentThickness`);

// Also sync the reverse: currentThickness = tActual where currentThickness is missing
const [result2] = await conn.execute(
    `UPDATE tmlReadings 
   SET currentThickness = tActual 
   WHERE (currentThickness IS NULL OR currentThickness = 0 OR currentThickness = '0.0000')
     AND tActual IS NOT NULL AND tActual > 0`
);
console.log(`Fixed ${result2.affectedRows} TMLs: set currentThickness = tActual`);

// Show remaining zero-value TMLs
const [remaining] = await conn.execute(
    `SELECT legacyLocationId, tActual, currentThickness, tml1, tml2, tml3, tml4
   FROM tmlReadings 
   WHERE (tActual IS NULL OR tActual = 0 OR tActual = '0.0000')
   LIMIT 10`
);
console.log(`\nRemaining TMLs with zero tActual: ${remaining.length}`);
for (const r of remaining) {
    console.log(`  CML ${r.legacyLocationId}: tActual=${r.tActual}, ct=${r.currentThickness}, tmls=[${r.tml1},${r.tml2},${r.tml3},${r.tml4}]`);
}

await conn.end();
console.log('\nDone!');
