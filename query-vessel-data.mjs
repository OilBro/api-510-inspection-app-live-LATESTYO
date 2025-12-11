import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, like } from 'drizzle-orm';
import * as schema from './drizzle/schema.js';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

console.log('Querying vessel 54-11-005 component calculations...\n');

const results = await db
  .select({
    componentName: schema.componentCalculations.componentName,
    componentType: schema.componentCalculations.componentType,
    allowableStress: schema.componentCalculations.allowableStress,
    jointEfficiency: schema.componentCalculations.jointEfficiency,
    actualThickness: schema.componentCalculations.actualThickness,
    minimumThickness: schema.componentCalculations.minimumThickness,
    timeSpan: schema.componentCalculations.timeSpan,
    vesselTagNumber: schema.inspections.vesselTagNumber,
  })
  .from(schema.componentCalculations)
  .innerJoin(
    schema.professionalReports,
    eq(schema.componentCalculations.reportId, schema.professionalReports.id)
  )
  .innerJoin(
    schema.inspections,
    eq(schema.professionalReports.inspectionId, schema.inspections.id)
  )
  .where(like(schema.inspections.vesselTagNumber, '%54-11-005%'));

console.log('Results:');
console.log(JSON.stringify(results, null, 2));

await connection.end();
