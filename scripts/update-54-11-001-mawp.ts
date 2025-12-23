import { getDb } from '../server/db';
import { componentCalculations, professionalReports } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

async function updateMAWPValues() {
  const db = await getDb();
  if (!db) {
    console.error('No database connection');
    process.exit(1);
  }

  const inspectionId = 'AeT7KIXu7Nx1pOv7TwpTj';
  
  // Get the professional report for this inspection
  const reports = await db.select().from(professionalReports)
    .where(eq(professionalReports.inspectionId, inspectionId));
  
  if (reports.length === 0) {
    console.error('No professional report found for inspection');
    process.exit(1);
  }
  
  const reportId = reports[0].id;
  console.log(`Found report ID: ${reportId}`);

  // Get all component calculations for this report
  const calculations = await db.select().from(componentCalculations)
    .where(eq(componentCalculations.reportId, reportId));
  
  console.log(`Found ${calculations.length} component calculations`);

  // Corrected values based on ASME calculations:
  // Shell: t=0.8006, S=20000, E=1.0, R=65.13 → MAWP = 244.0 psi
  // Head: t=0.507, S=20000, E=1.0, D=130.26 → MAWP = 155.6 psi (2:1 ellipsoidal)
  // Governing MAWP = 155.6 psi (head is limiting)

  for (const calc of calculations) {
    console.log(`\nUpdating ${calc.componentName} (${calc.componentType})...`);
    
    let newMAWP: number;
    let newMinThickness: number;
    let newStatus: string;
    
    if (calc.componentType === 'shell') {
      // Shell MAWP = SEt / (R + 0.6t)
      // With t=0.8006, S=20000, E=1.0, R=65.13
      newMAWP = 244.0;
      newMinThickness = 0.9195; // For 280 psi design pressure
      newStatus = 'unsafe'; // Current thickness below minimum for design pressure
    } else {
      // Head MAWP = 2SEt / (D + 0.2t) for 2:1 ellipsoidal
      // With t=0.507, S=20000, E=1.0, D=130.26
      newMAWP = 155.6;
      newMinThickness = 0.4528; // For 280 psi design pressure
      newStatus = 'acceptable'; // Head thickness is above minimum
    }
    
    // Calculate remaining life based on corrosion rate
    const actualThickness = calc.actualThickness || 0;
    const corrosionRate = calc.corrosionRate || 0;
    let remainingLife = 0;
    
    if (corrosionRate > 0 && actualThickness > newMinThickness) {
      remainingLife = (actualThickness - newMinThickness) / (corrosionRate / 1000); // Convert mpy to inches/year
    }
    
    // Update the calculation
    await db.update(componentCalculations)
      .set({
        designMAWP: newMAWP,
        minThickness: newMinThickness,
        status: newStatus,
        remainingLife: remainingLife > 0 ? remainingLife : calc.remainingLife,
      })
      .where(eq(componentCalculations.id, calc.id));
    
    console.log(`  Design MAWP: ${calc.designMAWP} → ${newMAWP} psi`);
    console.log(`  Min Thickness: ${calc.minThickness} → ${newMinThickness} in`);
    console.log(`  Status: ${calc.status} → ${newStatus}`);
    console.log(`  Remaining Life: ${remainingLife > 0 ? remainingLife.toFixed(2) : calc.remainingLife} years`);
  }

  // Update the inspection's governing MAWP
  console.log('\n=== SUMMARY ===');
  console.log('Governing MAWP: 155.6 psi (limited by head)');
  console.log('Shell MAWP: 244.0 psi');
  console.log('Head MAWP: 155.6 psi');
  console.log('\nVessel must be de-rated from 280 psi to 155 psi for safe operation.');
  
  console.log('\nComponent calculations updated successfully!');
  process.exit(0);
}

updateMAWPValues();
