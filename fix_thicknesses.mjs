import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1); }

    const c = await mysql.createConnection(dbUrl);
    const iid = 'GAq6JqJAj5dctmttUudSk';

    // 1. Fix Vessel Data in inspections table
    await c.execute(
        `UPDATE inspections 
     SET shellNominalThickness = '0.6250', 
         headNominalThickness = '0.5000'
     WHERE id = ?`,
        [iid]
    );
    console.log('✅ Updated inspections table with correct nominal thicknesses (0.625 shell, 0.500 head)');

    // 2. Fix TML Readings previous & nominal thickness for Shell
    await c.execute(
        `UPDATE tmlReadings 
     SET nominalThickness = '0.6250',
         previousThickness = '0.6250'
     WHERE inspectionId = ? AND component LIKE '%hell%'`,
        [iid]
    );
    console.log('✅ Updated Shell TML readings to Nominal/Prev = 0.6250');

    // 3. Fix TML Readings for Heads
    await c.execute(
        `UPDATE tmlReadings 
     SET nominalThickness = '0.5000',
         previousThickness = '0.5000'
     WHERE inspectionId = ? AND component LIKE '%Head%'`,
        [iid]
    );
    console.log('✅ Updated Head TML readings to Nominal/Prev = 0.5000');

    // 4. Delete the bad component calculations so the user can re-run them
    await c.execute(
        `DELETE FROM componentCalculations 
     WHERE reportId IN (SELECT id FROM professionalReports WHERE inspectionId = ?)`,
        [iid]
    );
    console.log('✅ Cleared old component calculations so they can be re-run');

    await c.end();
    console.log('Done!');
}

main().catch(console.error);
