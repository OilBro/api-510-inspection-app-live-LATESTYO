import 'dotenv/config';
import { getDb } from '../server/db';
import { inspections, tmlReadings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

async function auditData() {
    const db = await getDb();
    if (!db) { console.error('No DB'); process.exit(1); }

    const allInsp = await db.select().from(inspections).execute();
    const result = [];

    for (const i of allInsp) {
        const tmls = await db.select({
            comp: tmlReadings.component,
            nomThick: tmlReadings.nominalThickness
        }).from(tmlReadings).where(eq(tmlReadings.inspectionId, i.id)).execute();

        result.push({
            vesselTag: i.vesselTagNumber,
            id: i.id,
            reportNumber: i.reportNumber,
            yearBuilt: i.yearBuilt,
            materialSpec: i.materialSpec,
            allowableStress: i.allowableStress,
            designTemp: i.designTemperature,
            operatingTemp: i.operatingTemperature,
            tmlCount: tmls.length,
            sampleTmls: tmls.slice(0, 5)
        });
    }

    fs.writeFileSync('db_audit.json', JSON.stringify(result, null, 2));
    console.log('Saved to db_audit.json');
    process.exit(0);
}
auditData().catch(console.error);
