import { getDb } from '../server/db';
import { tmlReadings, inspections, componentCalculations, professionalReports } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { generateDefaultCalculationsForInspection } from '../server/professionalReportDb';

async function main() {
  const db = await getDb();
  
  // Get inspection for 54-11-067
  const [inspection] = await db.select().from(inspections)
    .where(eq(inspections.vesselTagNumber, '54-11-067'))
    .limit(1);
  
  if (!inspection) {
    console.log('Inspection not found');
    process.exit(1);
  }
  
  // Get report
  const [report] = await db.select().from(professionalReports)
    .where(eq(professionalReports.inspectionId, inspection.id))
    .limit(1);
  
  if (!report) {
    console.log('Report not found');
    process.exit(1);
  }
  
  console.log('Regenerating calculations for report:', report.id);
  
  // Call the function
  await generateDefaultCalculationsForInspection(inspection.id, report.id);
  
  // Check results
  const calcs = await db.select().from(componentCalculations)
    .where(eq(componentCalculations.reportId, report.id));
  
  console.log('\nComponent calculations after regeneration:');
  calcs.forEach(c => {
    console.log(`  ${c.componentName}: actual=${c.actualThickness}, min=${c.minimumThickness}, nominal=${c.nominalThickness}`);
  });
  
  process.exit(0);
}

main().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
