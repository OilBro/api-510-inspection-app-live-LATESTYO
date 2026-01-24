import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

const results = await connection.execute(
  "SELECT id, vesselTagNumber, inspectionResults, recommendations FROM inspections LIMIT 5"
);

console.log("Inspections with results/recommendations:");
results[0].forEach(row => {
  console.log(`\n--- ${row.vesselTagNumber} (${row.id}) ---`);
  console.log("Results:", row.inspectionResults ? row.inspectionResults.substring(0, 200) + "..." : "NULL");
  console.log("Recommendations:", row.recommendations ? row.recommendations.substring(0, 200) + "..." : "NULL");
});

await connection.end();
