import { getDb } from '../server/db';
import { tmlReadings, inspections, componentCalculations, professionalReports } from '../drizzle/schema';
import { eq, and, like, or } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  
  // Get inspection for 54-11-067
  const [inspection] = await db.select().from(inspections)
    .where(eq(inspections.vesselTagNumber, '54-11-067'))
    .limit(1);
  
  if (!inspection) {
    console.log('Inspection 54-11-067 not found');
    process.exit(1);
  }
  
  console.log('=== Inspection 54-11-067 ===');
  console.log('ID:', inspection.id);
  
  // Get all TML readings
  const tmls = await db.select().from(tmlReadings)
    .where(eq(tmlReadings.inspectionId, inspection.id));
  
  console.log('\\nTotal TML readings:', tmls.length);
  
  // Filter head TMLs
  const headTmls = tmls.filter(t => {
    const comp = (t.component || '').toLowerCase();
    const compType = (t.componentType || '').toLowerCase();
    const loc = (t.location || '').toLowerCase();
    return comp.includes('head') || compType.includes('head') || loc.includes('head');
  });
  
  console.log('Head TML readings:', headTmls.length);
  
  // Group by location pattern
  const byLocation: Record<string, number> = {};
  headTmls.forEach(t => {
    const loc = t.location || 'unknown';
    byLocation[loc] = (byLocation[loc] || 0) + 1;
  });
  
  console.log('\\nHead TMLs by location:');
  Object.entries(byLocation).forEach(([loc, count]) => {
    console.log(`  "${loc}": ${count}`);
  });
  
  // Check component calculations
  const [report] = await db.select().from(professionalReports)
    .where(eq(professionalReports.inspectionId, inspection.id))
    .limit(1);
  
  if (report) {
    console.log('\\n=== Component Calculations ===');
    const calcs = await db.select().from(componentCalculations)
      .where(eq(componentCalculations.reportId, report.id));
    
    calcs.forEach(c => {
      console.log(`${c.componentName}: actualThick=${c.actualThickness}, minThick=${c.minimumThickness}`);
    });
  }
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
