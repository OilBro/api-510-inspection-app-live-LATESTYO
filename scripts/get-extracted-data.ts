import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../drizzle/schema.js';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection, { schema, mode: 'default' });

  const inspectionId = '31Szaxnol2E9ueSa-k4Tm';

  // Get the imported file with extracted data
  const files = await db.select()
    .from(schema.importedFiles)
    .where(eq(schema.importedFiles.inspectionId, inspectionId))
    .orderBy(desc(schema.importedFiles.createdAt))
    .limit(1);

  if (files.length > 0) {
    const file = files[0];
    console.log('File:', file.fileName);
    console.log('Parser:', file.parserType);
    console.log('\nExtracted Data:');
    
    if (file.extractedData) {
      try {
        const data = JSON.parse(file.extractedData);
        // Look for head-related data
        console.log('\n=== Vessel Data ===');
        console.log(JSON.stringify(data.vesselData || data.vessel || {}, null, 2));
        
        console.log('\n=== TML Readings (first 20) ===');
        const tmlReadings = data.tmlReadings || data.thicknessReadings || [];
        tmlReadings.slice(0, 20).forEach((r: any, i: number) => {
          console.log(`${i+1}. CML: ${r.cmlNumber || r.cml} | Component: ${r.component} | Type: ${r.componentType} | Location: ${r.location}`);
        });
        
        // Look for any head mentions
        console.log('\n=== Head-related readings ===');
        const headReadings = tmlReadings.filter((r: any) => {
          const str = JSON.stringify(r).toLowerCase();
          return str.includes('head') || str.includes('north') || str.includes('south');
        });
        headReadings.forEach((r: any, i: number) => {
          console.log(`${i+1}. ${JSON.stringify(r)}`);
        });
        
      } catch (e) {
        console.log('Raw data (not JSON):', file.extractedData?.substring(0, 5000));
      }
    }
  } else {
    console.log('No imported files found');
  }

  await connection.end();
}

main().catch(console.error);
