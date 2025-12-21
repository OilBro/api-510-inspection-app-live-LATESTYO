import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Get inspection data
  const [inspections] = await connection.execute(
    `SELECT id, vesselTagNumber, designPressure, designTemperature, insideDiameter, 
            materialSpec, allowableStress, jointEfficiency, specificGravity
     FROM inspections WHERE vesselTagNumber LIKE '%54-11-001%' LIMIT 1`
  );
  console.log("=== INSPECTION DATA ===");
  console.log(JSON.stringify(inspections, null, 2));
  
  if (inspections.length > 0) {
    const inspectionId = inspections[0].id;
    
    // Get component calculations
    const [components] = await connection.execute(
      `SELECT cc.* FROM componentCalculations cc 
       JOIN professionalReports pr ON cc.reportId = pr.id
       WHERE pr.inspectionId = ?`, [inspectionId]
    );
    console.log("\n=== COMPONENT CALCULATIONS ===");
    console.log(JSON.stringify(components, null, 2));
    
    // Get TML readings
    const [tml] = await connection.execute(
      `SELECT componentName, location, actualThickness, previousThickness, nominalThickness, minRequired
       FROM tmlReadings WHERE inspectionId = ? LIMIT 20`, [inspectionId]
    );
    console.log("\n=== TML READINGS (sample) ===");
    console.log(JSON.stringify(tml, null, 2));
  }
  
  await connection.end();
}

main().catch(console.error);
