import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Get inspection data
  const [inspections] = await connection.execute(
    `SELECT * FROM inspections WHERE vesselTagNumber LIKE '%54-11-001%' LIMIT 1`
  );
  console.log("=== INSPECTION DATA ===");
  if (inspections.length > 0) {
    const insp = inspections[0];
    console.log("ID:", insp.id);
    console.log("Vessel:", insp.vesselTagNumber);
    console.log("Design Pressure:", insp.designPressure, "psi");
    console.log("Design Temperature:", insp.designTemperature, "°F");
    console.log("Inside Diameter:", insp.insideDiameter, "inches");
    console.log("Material:", insp.materialSpec);
    console.log("Allowable Stress:", insp.allowableStress, "psi");
    console.log("Joint Efficiency:", insp.jointEfficiency);
    console.log("Specific Gravity:", insp.specificGravity);
    
    const inspectionId = insp.id;
    
    // Get component calculations
    const [components] = await connection.execute(
      `SELECT cc.* FROM componentCalculations cc 
       JOIN professionalReports pr ON cc.reportId = pr.id
       WHERE pr.inspectionId = ?`, [inspectionId]
    );
    console.log("\n=== COMPONENT CALCULATIONS ===");
    for (const comp of components) {
      console.log("\nComponent:", comp.componentName);
      console.log("  Actual Thickness:", comp.actualThickness);
      console.log("  Previous Thickness:", comp.previousThickness);
      console.log("  Nominal Thickness:", comp.nominalThickness);
      console.log("  Min Required:", comp.minRequired);
      console.log("  Corrosion Rate:", comp.corrosionRate);
      console.log("  Remaining Life:", comp.remainingLife);
      console.log("  MAWP:", comp.mawp);
    }
    
    // Get TML readings for shell
    const [tmlShell] = await connection.execute(
      `SELECT componentName, location, actualThickness, previousThickness, nominalThickness, minRequired
       FROM tmlReadings WHERE inspectionId = ? AND componentName LIKE '%Shell%' LIMIT 5`, [inspectionId]
    );
    console.log("\n=== TML READINGS (Shell) ===");
    for (const tml of tmlShell) {
      console.log(`${tml.componentName} - ${tml.location}: actual=${tml.actualThickness}, prev=${tml.previousThickness}, nom=${tml.nominalThickness}, min=${tml.minRequired}`);
    }
    
    // Get TML readings for heads
    const [tmlHead] = await connection.execute(
      `SELECT componentName, location, actualThickness, previousThickness, nominalThickness, minRequired
       FROM tmlReadings WHERE inspectionId = ? AND (componentName LIKE '%Head%' OR componentName LIKE '%North%' OR componentName LIKE '%South%') LIMIT 10`, [inspectionId]
    );
    console.log("\n=== TML READINGS (Heads) ===");
    for (const tml of tmlHead) {
      console.log(`${tml.componentName} - ${tml.location}: actual=${tml.actualThickness}, prev=${tml.previousThickness}, nom=${tml.nominalThickness}, min=${tml.minRequired}`);
    }
  }
  
  await connection.end();
}

main().catch(console.error);
