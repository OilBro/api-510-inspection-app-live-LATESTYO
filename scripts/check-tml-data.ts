import { getDb } from '../server/db';
import { tmlReadings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('No database connection');
    return;
  }
  
  const readings = await db.select({
    cmlNumber: tmlReadings.cmlNumber,
    componentType: tmlReadings.componentType,
    component: tmlReadings.component,
    location: tmlReadings.location,
    tActual: tmlReadings.tActual,
  }).from(tmlReadings).where(eq(tmlReadings.inspectionId, '31Szaxnol2E9ueSa-k4Tm'));
  
  console.log('TML Readings for inspection 31Szaxnol2E9ueSa-k4Tm:');
  console.log('Total readings:', readings.length);
  
  const componentTypes = new Set(readings.map(r => r.componentType));
  const components = new Set(readings.map(r => r.component));
  
  console.log('\nUnique componentType values:', [...componentTypes]);
  console.log('\nUnique component values:', [...components]);
  
  console.log('\nSample readings:');
  readings.slice(0, 10).forEach(r => {
    console.log(`  CML ${r.cmlNumber}: type="${r.componentType}", comp="${r.component}", loc="${r.location}", t=${r.tActual}`);
  });
}

main().catch(console.error);
