import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { tmlReadings } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

const results = await db
  .select({
    id: tmlReadings.id,
    legacyLocationId: tmlReadings.legacyLocationId,
    location: tmlReadings.location,
    sliceNumber: tmlReadings.sliceNumber,
    angleDeg: tmlReadings.angleDeg,
    stationKey: tmlReadings.stationKey,
    componentGroup: tmlReadings.componentGroup,
  })
  .from(tmlReadings)
  .where(eq(tmlReadings.legacyLocationId, '9'))
  .orderBy(tmlReadings.angleDeg);

console.log('\n=== CML 9 Database Values ===');
console.log('Total rows:', results.length);
console.log('\nRow details:');
results.forEach((row, i) => {
  console.log(`\n[${i + 1}]`);
  console.log(`  sliceNumber: ${row.sliceNumber}`);
  console.log(`  angleDeg: ${row.angleDeg}`);
  console.log(`  stationKey: ${row.stationKey}`);
  console.log(`  componentGroup: ${row.componentGroup}`);
  console.log(`  location: ${row.location}`);
});

await connection.end();
