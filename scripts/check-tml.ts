import { getDb } from '../server/db';
import { tmlReadings, inspections } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  
  // Get inspection ID for 54-11-067
  const [inspection] = await db.select().from(inspections).where(eq(inspections.vesselTagNumber, '54-11-067')).limit(1);
  
  if (!inspection) {
    console.log('Inspection not found');
    return;
  }
  
  console.log('Inspection ID:', inspection.id);
  
  // Get TML readings
  const tmls = await db.select().from(tmlReadings).where(eq(tmlReadings.inspectionId, inspection.id));
  
  // Get distinct component values
  const distinctComponents = new Set<string>();
  tmls.forEach(t => {
    const key = `component="${t.component}", componentType="${t.componentType}", location="${t.location}"`;
    distinctComponents.add(key);
  });
  
  console.log('\\nDistinct TML component values:');
  distinctComponents.forEach(c => console.log('  ' + c));
  
  // Check head detection with UPDATED logic (includes location field)
  console.log('\\n--- Head Detection Analysis (UPDATED with location field) ---');
  
  const eastHeadTMLs = tmls.filter(t => {
    const compType = (t.componentType || '').toLowerCase();
    const comp = (t.component || '').toLowerCase();
    const loc = (t.location || '').toLowerCase();
    const combined = `${comp} ${compType}`;
    
    // Check location field for east head
    if (combined.includes('east') || loc.includes('east head')) return true;
    if (combined.includes('e head')) return true;
    if (combined.includes('head 1') || combined.includes('head-1')) return true;
    if (combined.includes('left head')) return true;
    // Generic head but not west
    if ((combined.includes('head') && !combined.includes('shell')) && 
        !combined.includes('west') && !combined.includes('w head') &&
        !combined.includes('head 2') && !combined.includes('head-2') &&
        !combined.includes('right') && !loc.includes('west')) return true;
    return false;
  });
  
  const westHeadTMLs = tmls.filter(t => {
    const compType = (t.componentType || '').toLowerCase();
    const comp = (t.component || '').toLowerCase();
    const loc = (t.location || '').toLowerCase();
    const combined = `${comp} ${compType}`;
    
    // Check location field for west head
    if (combined.includes('west') || loc.includes('west head')) return true;
    if (combined.includes('w head')) return true;
    if (combined.includes('head 2') || combined.includes('head-2')) return true;
    if (combined.includes('right head')) return true;
    return false;
  });
  
  console.log(`East Head TMLs found: ${eastHeadTMLs.length}`);
  if (eastHeadTMLs.length > 0) {
    console.log('  Sample:', eastHeadTMLs[0].component, eastHeadTMLs[0].componentType, 'location:', eastHeadTMLs[0].location);
  }
  
  console.log(`West Head TMLs found: ${westHeadTMLs.length}`);
  if (westHeadTMLs.length > 0) {
    console.log('  Sample:', westHeadTMLs[0].component, westHeadTMLs[0].componentType, 'location:', westHeadTMLs[0].location);
  }
  
  process.exit(0);
}

main().catch(console.error);
