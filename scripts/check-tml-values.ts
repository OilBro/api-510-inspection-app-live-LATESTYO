import { getDb } from '../server/db';
import { tmlReadings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const db = await getDb();
  if (!db) {
    console.error('No db');
    process.exit(1);
  }
  
  const results = await db.select({
    cml: tmlReadings.cmlNumber,
    comp: tmlReadings.componentType,
    nominal: tmlReadings.nominalThickness,
    previous: tmlReadings.previousThickness,
    tActual: tmlReadings.tActual,
    current: tmlReadings.currentThickness
  }).from(tmlReadings)
    .where(eq(tmlReadings.inspectionId, 'AeT7KIXu7Nx1pOv7TwpTj'))
    .limit(15);
  
  console.log('Sample TML readings:');
  results.forEach(r => {
    console.log(`CML ${r.cml}: comp=${r.comp}, nominal=${r.nominal}, prev=${r.previous}, tActual=${r.tActual}, current=${r.current}`);
  });
  process.exit(0);
}
check();
