import { getDb } from "../server/db";
import { componentCalculations, inspections, professionalReports } from "../drizzle/schema";
import { eq, like } from "drizzle-orm";

async function check() {
  const db = await getDb();
  
  // Find inspections for vessel 54-11-005
  const insp = await db.select()
    .from(inspections)
    .where(like(inspections.vesselTagNumber, '%54-11-005%'))
    .limit(1);
  
  if (insp.length === 0) {
    console.log("No inspection found for 54-11-005");
    return;
  }
  
  console.log("Inspection:", insp[0].id, insp[0].vesselTagNumber);
  
  // Find professional report
  const reports = await db.select()
    .from(professionalReports)
    .where(eq(professionalReports.inspectionId, insp[0].id));
  
  if (reports.length === 0) {
    console.log("No professional report found");
    return;
  }
  
  console.log("Professional Report:", reports[0].id);
  
  // Get component calculations
  const calcs = await db.select({
    componentName: componentCalculations.componentName,
    allowableStress: componentCalculations.allowableStress,
    jointEfficiency: componentCalculations.jointEfficiency,
    staticHead: componentCalculations.staticHead,
    timeSpan: componentCalculations.timeSpan,
    actualThickness: componentCalculations.actualThickness,
    minimumThickness: componentCalculations.minimumThickness
  })
  .from(componentCalculations)
  .where(eq(componentCalculations.reportId, reports[0].id));
  
  console.log("Component Calculations:");
  console.log(JSON.stringify(calcs, null, 2));
}

check().catch(console.error);
