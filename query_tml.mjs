import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Get column names
  const [cols] = await connection.execute("SHOW COLUMNS FROM tmlReadings");
  console.log("=== TML COLUMNS ===");
  for (const col of cols) {
    console.log(col.Field);
  }
  
  // Get TML readings for vessel 54-11-001
  const [tml] = await connection.execute(
    "SELECT * FROM tmlReadings WHERE inspectionId = 'UZNDBONAZepnbaTGt99W3' LIMIT 10"
  );
  console.log("\n=== TML READINGS ===");
  console.log(JSON.stringify(tml, null, 2));
  
  await connection.end();
}

main().catch(console.error);
