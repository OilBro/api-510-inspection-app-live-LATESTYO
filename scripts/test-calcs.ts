import 'dotenv/config';
import { getDb } from '../server/db';
import { inspections, tmlReadings } from '../drizzle/schema';
import { eq, desc, like } from 'drizzle-orm';
import { calculateTMLStatus } from '../server/tmlStatusCalculator';

async function testCalcs() {
    const db = await getDb();
    if (!db) { console.error('No DB'); process.exit(1); }

    const recent005 = await db.select()
        .from(inspections)
        .where(like(inspections.vesselTagNumber, '%54-11-005%'))
        .orderBy(desc(inspections.createdAt))
        .limit(1)
        .execute();

    if (recent005.length === 0) return;
    const insp = recent005[0];

    const tmls = await db.select().from(tmlReadings).where(eq(tmlReadings.inspectionId, insp.id)).execute();

    console.log("Testing calculations for TML 1...");
    try {
        const result = calculateTMLStatus({
            currentThickness: parseFloat(String(tmls[0].tActual || tmls[0].currentThickness)),
            nominalThickness: parseFloat(String(tmls[0].nominalThickness)),
            designPressure: parseFloat(String(insp.designPressure)),
            insideDiameter: parseFloat(String(insp.insideDiameter)),
            materialSpec: insp.materialSpec || "Unknown",
            designTemperature: parseFloat(String(insp.designTemperature)),
            corrosionAllowance: (insp as any).corrosionAllowance ? parseFloat(String((insp as any).corrosionAllowance)) : undefined,
            jointEfficiency: (insp as any).jointEfficiency ? parseFloat(String((insp as any).jointEfficiency)) : undefined
        });
        console.log("Calculated Status:", result);
    } catch (e) {
        console.error("Calculation failed:", e);
    }

    process.exit(0);
}
testCalcs().catch(console.error);
