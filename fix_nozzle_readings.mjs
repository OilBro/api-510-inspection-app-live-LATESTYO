import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const c = await mysql.createConnection(process.env.DATABASE_URL);
    const iid = 'GAq6JqJAj5dctmttUudSk';

    // 1. Restore CML 001-012 (zero-padded) back to Head
    const [heads] = await c.execute(
        `SELECT id, legacyLocationId, component, componentType, tActual, location 
     FROM tmlReadings WHERE inspectionId = ?
     AND legacyLocationId IN ('001','002','003','004','005','006','007','008','009','010','011','012')
     ORDER BY legacyLocationId`, [iid]
    );
    console.log(`=== CML 001-012 (Heads) - ${heads.length} found ===`);
    for (const r of heads) console.log(`  ${r.legacyLocationId}: comp="${r.component}" t=${r.tActual} loc="${r.location}"`);

    if (heads.length > 0) {
        const ids = heads.map(r => r.id);
        // Determine East vs West based on location info  
        for (const r of heads) {
            const loc = (r.location || '').toLowerCase();
            let headName = 'East Head'; // default
            if (loc.includes('west') || loc.includes('w ') || loc.includes('south')) headName = 'West Head';
            await c.execute(
                `UPDATE tmlReadings SET component = ?, componentType = 'Head', componentGroup = 'Head', updatedAt = NOW() WHERE id = ?`,
                [headName, r.id]
            );
        }
        console.log(`✅ Restored ${heads.length} CML 001-012 to Head`);
    }

    // 2. Ensure CML 1-12 (no padding) are Nozzle
    const [nozzles] = await c.execute(
        `SELECT id, legacyLocationId, component, tActual, location 
     FROM tmlReadings WHERE inspectionId = ?
     AND legacyLocationId IN ('1','2','3','4','5','6','7','8','9','10','11','12')
     ORDER BY CAST(legacyLocationId AS UNSIGNED)`, [iid]
    );
    console.log(`\n=== CML 1-12 (Nozzles) - ${nozzles.length} found ===`);
    for (const r of nozzles) console.log(`  ${r.legacyLocationId}: comp="${r.component}" t=${r.tActual} loc="${r.location}"`);

    if (nozzles.length > 0) {
        const ids = nozzles.map(r => r.id);
        const ph = ids.map(() => '?').join(',');
        const [res] = await c.execute(
            `UPDATE tmlReadings SET component = 'Nozzle', componentType = 'Nozzle', componentGroup = 'Nozzle', updatedAt = NOW()
       WHERE id IN (${ph})`, ids
        );
        console.log(`✅ Set ${res.affectedRows} CML 1-12 to Nozzle`);
    }

    // 3. Ensure N1-N12 prefixed are Nozzle
    const [npre] = await c.execute(
        `SELECT id, legacyLocationId, component FROM tmlReadings WHERE inspectionId = ?
     AND legacyLocationId LIKE 'N%' AND component != 'Nozzle'`, [iid]
    );
    if (npre.length > 0) {
        const ids = npre.map(r => r.id);
        const ph = ids.map(() => '?').join(',');
        await c.execute(
            `UPDATE tmlReadings SET component = 'Nozzle', componentType = 'Nozzle', componentGroup = 'Nozzle', updatedAt = NOW()
       WHERE id IN (${ph})`, ids
        );
        console.log(`✅ Set ${npre.length} N-prefixed to Nozzle`);
    }

    // Final summary
    const [counts] = await c.execute(
        `SELECT COALESCE(component,'NULL') as comp, COUNT(*) as cnt FROM tmlReadings WHERE inspectionId = ? GROUP BY component ORDER BY cnt DESC`, [iid]
    );
    console.log(`\n=== FINAL COMPONENT COUNTS ===`);
    for (const r of counts) console.log(`  ${r.comp}: ${r.cnt}`);

    // Show governing shell reading
    const [sMin] = await c.execute(
        `SELECT legacyLocationId, tActual, location FROM tmlReadings 
     WHERE inspectionId = ? AND (component LIKE '%hell%') AND tActual IS NOT NULL AND tActual != '' AND CAST(tActual AS DECIMAL(10,4)) > 0
     ORDER BY CAST(tActual AS DECIMAL(10,4)) ASC LIMIT 5`, [iid]
    );
    console.log(`\n=== Governing Shell readings ===`);
    for (const r of sMin) console.log(`  CML ${r.legacyLocationId}: ${r.tActual}" (${r.location})`);

    // Show governing head readings
    const [hMin] = await c.execute(
        `SELECT legacyLocationId, component, tActual, location FROM tmlReadings 
     WHERE inspectionId = ? AND component LIKE '%Head%' AND tActual IS NOT NULL AND tActual != '' AND CAST(tActual AS DECIMAL(10,4)) > 0
     ORDER BY CAST(tActual AS DECIMAL(10,4)) ASC LIMIT 5`, [iid]
    );
    console.log(`\n=== Governing Head readings ===`);
    for (const r of hMin) console.log(`  CML ${r.legacyLocationId}: ${r.tActual}" ${r.component} (${r.location})`);

    await c.end();
    console.log('\nDone!');
}
main().catch(console.error);
