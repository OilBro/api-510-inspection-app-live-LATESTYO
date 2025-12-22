import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../drizzle/schema.js';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection, { schema, mode: 'default' });

  const inspectionId = '31Szaxnol2E9ueSa-k4Tm';

  // Get all TML readings
  const readings = await db.select({
    cmlNumber: schema.tmlReadings.cmlNumber,
    component: schema.tmlReadings.component,
    componentType: schema.tmlReadings.componentType,
    location: schema.tmlReadings.location,
    currentThickness: schema.tmlReadings.currentThickness,
  })
  .from(schema.tmlReadings)
  .where(eq(schema.tmlReadings.inspectionId, inspectionId))
  .orderBy(sql`CAST(cmlNumber AS UNSIGNED)`);

  console.log('TML Readings for inspection:', inspectionId);
  console.log('Total readings:', readings.length);
  console.log('\nReadings:');
  readings.forEach(r => {
    console.log(`  CML ${r.cmlNumber}: component="${r.component}" | componentType="${r.componentType}" | location="${r.location}" | thickness=${r.currentThickness}`);
  });

  await connection.end();
}

main().catch(console.error);
