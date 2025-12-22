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
    
    if (file.extractedData) {
      try {
        const data = JSON.parse(file.extractedData);
        const tmlReadings = data.tmlReadings || data.thicknessReadings || [];
        
        console.log('\nTotal TML readings:', tmlReadings.length);
        
        // Group by component
        const byComponent: Record<string, any[]> = {};
        tmlReadings.forEach((r: any) => {
          const comp = r.component || 'Unknown';
          if (!byComponent[comp]) byComponent[comp] = [];
          byComponent[comp].push(r);
        });
        
        console.log('\n=== Readings by Component ===');
        Object.entries(byComponent).forEach(([comp, readings]) => {
          console.log(`\n${comp}: ${readings.length} readings`);
          readings.forEach((r: any) => {
            console.log(`  CML ${r.cmlNumber}: location="${r.location}" thickness=${r.currentThickness}`);
          });
        });
        
      } catch (e) {
        console.log('Parse error:', e);
      }
    }
  }

  await connection.end();
}

main().catch(console.error);
