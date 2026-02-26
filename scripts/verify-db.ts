import 'dotenv/config';
import { getDb } from './server/db';
import { inspections, tmlReadings, professionalReports, componentCalculations } from './drizzle/schema';
import { eq, sql } from 'drizzle-orm';

async function verify() {
    const db = await getDb();
    if (!db) { console.error('No DB'); process.exit(1); }

    const allInsp = await db.select({
        id: inspections.id,
        tag: inspections.vesselTagNumber,
        date: inspections.inspectionDate,
        status: inspections.status,
        prevId: inspections.previousInspectionId,
    }).from(inspections).where(eq(inspections.vesselTagNumber, '54-11-067')).execute();

    console.log('=== INSPECTIONS (54-11-067) ===');
    for (const i of allInsp) {
        console.log(JSON.stringify(i));
        const tmls = await db.select({ count: sql<number>`count(*)` })
            .from(tmlReadings).where(eq(tmlReadings.inspectionId, i.id)).execute();
        console.log('  TML count:', tmls[0].count);
        const rpts = await db.select({ id: professionalReports.id, rn: professionalReports.reportNumber })
            .from(professionalReports).where(eq(professionalReports.inspectionId, i.id)).execute();
        console.log('  Reports:', JSON.stringify(rpts));
        for (const r of rpts) {
            const calcs = await db.select({ name: componentCalculations.componentName, type: componentCalculations.componentType })
                .from(componentCalculations).where(eq(componentCalculations.reportId, r.id)).execute();
            console.log('  Calcs:', JSON.stringify(calcs));
        }
    }
    process.exit(0);
}
verify();
