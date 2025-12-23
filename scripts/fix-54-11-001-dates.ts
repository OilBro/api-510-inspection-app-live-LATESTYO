import { getDb } from '../server/db';
import { tmlReadings, componentCalculations, professionalReports } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function fixDates() {
  console.log('Fixing dates for 54-11-001...');
  
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }
  
  const inspectionId = 'AeT7KIXu7Nx1pOv7TwpTj';
  
  // Previous inspection date (2017)
  const previousDate = new Date('2017-06-20');
  // Current inspection date (2025)
  const currentDate = new Date('2025-11-04');
  
  // Get all TML readings for this inspection
  const tmls = await db.select().from(tmlReadings).where(eq(tmlReadings.inspectionId, inspectionId));
  console.log(`Found ${tmls.length} TML readings`);
  
  // Update each TML reading with correct dates
  let updatedCount = 0;
  for (const tml of tmls) {
    // The previousThickness should be the nominal thickness (original from 2017)
    // tActual is the current 2025 reading
    const prevThickness = tml.nominalThickness || tml.tActual;
    
    await db.update(tmlReadings)
      .set({
        previousThickness: prevThickness,
        previousInspectionDate: previousDate,
        currentInspectionDate: currentDate
      })
      .where(eq(tmlReadings.id, tml.id));
    updatedCount++;
  }
  
  console.log(`Updated ${updatedCount} TML readings with correct dates`);
  
  // Get the professional report for this inspection
  const [report] = await db.select().from(professionalReports).where(eq(professionalReports.inspectionId, inspectionId)).limit(1);
  
  if (report) {
    // Get component calculations for this report
    const calculations = await db.select().from(componentCalculations).where(eq(componentCalculations.reportId, report.id));
    console.log(`Found ${calculations.length} component calculations`);
    
    // Update each calculation with correct dates
    for (const calc of calculations) {
      await db.update(componentCalculations)
        .set({
          previousInspectionDate: previousDate,
          currentInspectionDate: currentDate
        })
        .where(eq(componentCalculations.id, calc.id));
    }
    
    console.log(`Updated ${calculations.length} component calculations with correct dates`);
  }
  
  console.log('Date fix complete!');
  process.exit(0);
}

fixDates().catch(console.error);
