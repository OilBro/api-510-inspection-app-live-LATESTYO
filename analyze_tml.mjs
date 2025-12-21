import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Get all TML readings with their component info
  const [tml] = await connection.execute(
    "SELECT cmlNumber, componentType, component, location, tActual, previousThickness, nominalThickness FROM tmlReadings WHERE inspectionId = 'UZNDBONAZepnbaTGt99W3' ORDER BY CAST(cmlNumber AS UNSIGNED)"
  );
  
  console.log("=== ALL TML READINGS ===");
  console.log("CML | Component Type | Component | Location | t_act | t_prev | t_nom");
  console.log("-".repeat(80));
  
  for (const t of tml) {
    console.log(`${t.cmlNumber.padStart(3)} | ${(t.componentType || '').padEnd(14)} | ${(t.component || '').padEnd(9)} | ${(t.location || '').padEnd(8)} | ${t.tActual} | ${t.previousThickness || 'null'} | ${t.nominalThickness}`);
  }
  
  // Group by component type
  console.log("\n=== GROUPED BY COMPONENT TYPE ===");
  const grouped = {};
  for (const t of tml) {
    const key = t.componentType || 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(parseFloat(t.tActual || '0'));
  }
  
  for (const [type, values] of Object.entries(grouped)) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    console.log(`${type}: count=${values.length}, min=${min.toFixed(4)}, max=${max.toFixed(4)}`);
  }
  
  await connection.end();
}

main().catch(console.error);
