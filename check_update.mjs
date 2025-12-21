import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Check inspection
  const [insp] = await connection.execute(
    "SELECT materialSpec, allowableStress, jointEfficiency, specificGravity FROM inspections WHERE id = 'UZNDBONAZepnbaTGt99W3'"
  );
  console.log("=== INSPECTION AFTER UPDATE ===");
  console.log(JSON.stringify(insp, null, 2));
  
  // Check TML readings
  const [tml] = await connection.execute(
    "SELECT COUNT(*) as total, SUM(CASE WHEN previousThickness IS NOT NULL THEN 1 ELSE 0 END) as withPrev FROM tmlReadings WHERE inspectionId = 'UZNDBONAZepnbaTGt99W3'"
  );
  console.log("\n=== TML READINGS SUMMARY ===");
  console.log(JSON.stringify(tml, null, 2));
  
  // Check distinct previousThickness values
  const [prev] = await connection.execute(
    "SELECT DISTINCT previousThickness, COUNT(*) as cnt FROM tmlReadings WHERE inspectionId = 'UZNDBONAZepnbaTGt99W3' GROUP BY previousThickness"
  );
  console.log("\n=== PREVIOUS THICKNESS VALUES ===");
  console.log(JSON.stringify(prev, null, 2));
  
  await connection.end();
}

main().catch(console.error);
