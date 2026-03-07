import 'dotenv/config';
import { getDb } from '../server/db';
import { inspections, tmlReadings, nozzleEvaluations } from '../drizzle/schema';
import { eq, desc, like } from 'drizzle-orm';

async function check005() {
    const db = await getDb();
    if (!db) { console.error('No DB'); process.exit(1); }

    const recent005 = await db.select()
        .from(inspections)
        .where(like(inspections.vesselTagNumber, '%54-11-005%'))
        .orderBy(desc(inspections.createdAt))
        .limit(1)
        .execute();

    if (recent005.length === 0) {
        console.log('No 54-11-005 found');
        process.exit(1);
    }

    const insp = recent005[0];
    console.log("=== VESSEL DATA ===");
    console.log(`Material: ${insp.materialSpec}`);
    console.log(`Allowable Stress: ${insp.allowableStress}`);
    console.log(`Joint Eval: ${insp.jointEfficiency}`);
    console.log(`Design Temp: ${insp.designTemperature}`);
    console.log(`Design Pressure: ${insp.designPressure}`);
    console.log(`Operating Temp: ${insp.operatingTemperature}`);
    console.log(`Operating Pressure: ${insp.operatingPressure}`);
    console.log(`Diameter: ${insp.insideDiameter}`);
    console.log(`Head Type: ${insp.headType}`);

    console.log("\n=== TML READINGS ===");
    const tmls = await db.select().from(tmlReadings).where(eq(tmlReadings.inspectionId, insp.id)).execute();
    console.log(`Count: ${tmls.length}`);
    if (tmls.length > 0) {
        console.log("Sample TML:");
        console.log(`  Component: ${tmls[0].component}`);
        console.log(`  Reading Type: ${tmls[0].readingType}`);
        console.log(`  Current Thickness: ${tmls[0].currentThickness}`);
    }

    process.exit(0);
}
check005().catch(console.error);
