/**
 * Script to insert the SACHEM INC inspection data from MinerU markdown
 * Report No.: 54-11-067
 */

import { getDb } from "../server/db";
import { inspections, tmlReadings, nozzleEvaluations, calculations, externalInspections } from "../drizzle/schema";
import { randomUUID } from "crypto";

async function insertInspectionData() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const inspectionId = `insp_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const userId = 1; // Default user

  console.log("Creating inspection record:", inspectionId);

  // 1. Create the main inspection record
  await db.insert(inspections).values({
    id: inspectionId,
    userId: userId,
    vesselTagNumber: "54-11-067",
    vesselName: "CLEAN MTHYL Tank",
    manufacturer: "Unknown",
    serialNumber: "54-11-067",
    yearBuilt: 2005,
    designPressure: "250.00",
    designTemperature: "200.00",
    operatingPressure: "250.00",
    operatingTemperature: "80.00",
    mdmt: "-20.00",
    materialSpec: "Stainless Steel",
    allowableStress: "20000.00",
    jointEfficiency: "1.00",
    specificGravity: "0.9200",
    vesselType: "Process Vessel",
    product: "METHYLCHLORIDE CLEAN",
    constructionCode: "ASME S8 D1",
    vesselConfiguration: "Horizontal",
    headType: "2:1 Ellipsoidal",
    insulationType: "None",
    nbNumber: "5653",
    insideDiameter: "70.75",
    overallLength: "216.00",
    status: "completed",
    inspectionDate: new Date("2017-10-08"),
    inspectionResults: `3.0 INSPECTION RESULTS, IN-SERVICE

3.1 Foundation:
3.1.1 The vessel has 2 steel foundation supports attached to the lower section of the horizontal Storage Tank.
3.1.2 The supports are in satisfactory mechanical condition. The supports coating is in satisfactory condition. SIGNS OF CORROSION WERE NOTED DURING INSPECTION.
- UT thickness readings were performed on 100% of the accessible surfaces of the vessel's supports to detect any potential areas of concern.
- VT of 100% of the perimeter of the vessel's supports shell to detect blistering, discontinuity in shape, scaling or rust stains beneath the supports

3.2 Shell:
3.2.1 The shell is un-insulated, Stainless steel with 20 to 30 mils epoxy external coating
3.2.2 The external surface profile of the shell appears to be smooth and clean and in satisfactory condition.
3.2.3 The exposed surface profile of the shell is relatively smooth with no evidence of significant oxidation or other forms of deterioration.
3.2.4 The longitudinal and circumferential welds of the shell appeared to be in satisfactory condition with no preferential corrosion or indications of cracking observed.
Note 2: UT SHEARWAVE was performed on all T-junctions and 30% of the vessel welds in the HAZ "Heat affected zone". Areas with the Highest calculated stresses were chosen for the makeup of the 30%.
3.2.5 The shell nozzle penetration welds appeared to be in satisfactory condition.
Note 3: UT SHEARWAVE was performed on the nozzles in a 6 inch radius from the welds to inspect for potential cracking and any other discontinuities. No significant indications were recorded.
Note 4: An ultrasonic thickness scan was performed on the lower portion of the vessel on grids spaced at 6" apart traveling from north to south on the lower 40% of the vessel shell to look for potential corrosion caused by the possibility of moisture getting into the system.

3.3 Head(s):
3.3.1 The north and south heads are 2:1 Elliptical in design, un-insulated, carbon steel, with 20 to 30 mils of epoxy external coating.
3.3.2 The external surface profiles of both heads have a smooth finish. There are no areas of coating failure.
3.3.3 Exposed surface profiles were relatively smooth with no evidence of significant oxidation or other forms of deterioration.
3.3.4 The nozzle penetration welds through the top and bottom heads appeared to be in satisfactory condition.
Note 5: Ultrasonic thickness measurements were taken on a grid in addition to the CML's that are monitored yearly.

3.4 Appurtenances:
3.4.1 The shell and head-nozzles appear to be clean and in satisfactory condition.
3.4.2 The vessel has a Pressure Safety Relief Valve (PSV) and is thereby protected from over pressure. The PSV was certified and appears to be in compliance with code requirements.
3.4.3 The ASME name-plate is attached, readable and is easily accessible.`,
    recommendations: `4.0 RECOMMENDATIONS

4.1 Foundation:
4.1.1 No Recommendations

4.2 Shell:
4.2.1 An in-lieu-of internal inspection was granted with the following stipulations:
- UT's must be performed annually for 10 years or until an internal inspection is performed
- OilPro Consulting must review the UT's and assess the vessel for continued service

4.3 Heads:
4.3.1 An in-lieu-of internal inspection was granted with the following stipulations for the heads:
- UT's must be performed annually for 10 years or until an internal inspection is performed
- OilPro Consulting must review the UT's and assess the VESSEL for continued service.

4.4 Appurtenances:
4.4.1 An in-lieu-of internal inspection was granted with the following stipulations for the appurtenances:
- UT's must be performed annually for 10 years or until an internal inspection is performed
- OilPro Consulting must review the UT's and assess the VESSEL for continued service.

4.5 Next Inspections:
4.8.1 Next external inspection is due by: 10/08/2030
4.8.2 Next internal inspection is due by: 10/08/2032
4.8.3 Next UT inspection is due by: 10/08/2026
4.8.4 Governing component limiting life: Shell 1

5.0 ULTRASONIC THICKNESS (UT) MEASUREMENTS

5.1 Results Summary:
5.1.1 UT measurement of accessible vessel components (shell, heads and nozzles) found no significant material loss due to internal corrosion of the components. All of the vessel component thicknesses were above that required by ASME calculations for minimum required thicknesses for internal pressure.
5.1.2 Calculations of all evaluated components resulted in greater than 20 years remaining life.

5.2 Recommendations:
5.2.1 External inspections and UT's of the vessel shall be scheduled annually for 10 years in accordance with the current In-Lieu-Of Internal Inspection granted in this report. The UT's and external inspections along with photos must be reviewed and assessed by OilPro.`,
  });

  console.log("Inspection record created");

  // 2. Insert TML readings for Shell (CML 1-54)
  const shellReadings = [
    { cml: "001", loc: "1 - 0", prev: "0.672", act: "0.672" },
    { cml: "002", loc: "1 - 45", prev: "0.670", act: "0.670" },
    { cml: "003", loc: "1 - 90", prev: "0.671", act: "0.671" },
    { cml: "004", loc: "1 - 135", prev: "0.672", act: "0.672" },
    { cml: "005", loc: "1 - 180", prev: "0.670", act: "0.670" },
    { cml: "006", loc: "1 - 225", prev: "0.668", act: "0.668" },
    { cml: "007", loc: "1 - 270", prev: "0.672", act: "0.672" },
    { cml: "008", loc: "1 - 315", prev: "0.668", act: "0.668" },
    { cml: "009", loc: "3 - 0", prev: "0.670", act: "0.670" },
    { cml: "010", loc: "3 - 45", prev: "0.668", act: "0.668" },
    { cml: "011", loc: "3 - 90", prev: "0.671", act: "0.671" },
    { cml: "012", loc: "3 - 135", prev: "0.668", act: "0.668" },
    { cml: "013", loc: "3 - 180", prev: "0.670", act: "0.670" },
    { cml: "014", loc: "3 - 225", prev: "0.668", act: "0.668" },
    { cml: "015", loc: "3 - 270", prev: "0.670", act: "0.670" },
    { cml: "016", loc: "3 - 315", prev: "0.668", act: "0.668" },
    { cml: "017", loc: "5 - 0", prev: "0.652", act: "0.652" },
    { cml: "018", loc: "5 - 45", prev: "0.668", act: "0.668" },
    { cml: "019", loc: "5 - 90", prev: "0.670", act: "0.670" },
    { cml: "020", loc: "5 - 135", prev: "0.668", act: "0.668" },
    { cml: "021", loc: "5 - 180", prev: "0.670", act: "0.670" },
    { cml: "022", loc: "5 - 225", prev: "0.668", act: "0.668" },
    { cml: "023", loc: "5 - 270", prev: "0.670", act: "0.670" },
    { cml: "024", loc: "5 - 315", prev: "0.668", act: "0.668" },
    { cml: "025", loc: "7 - 0", prev: "0.670", act: "0.670" },
    { cml: "026", loc: "7 - 45", prev: "0.668", act: "0.668" },
    { cml: "027", loc: "7 - 90", prev: "0.670", act: "0.670" },
    { cml: "028", loc: "7 - 135", prev: "0.668", act: "0.668" },
    { cml: "029", loc: "7 - 180", prev: "0.670", act: "0.670" },
    { cml: "030", loc: "7 - 225", prev: "0.668", act: "0.668" },
    { cml: "031", loc: "7 - 270", prev: "0.670", act: "0.670" },
    { cml: "032", loc: "7 - 315", prev: "0.668", act: "0.668" },
    { cml: "033", loc: "9 - 0", prev: "0.670", act: "0.670" },
    { cml: "034", loc: "9 - 45", prev: "0.668", act: "0.668" },
    { cml: "035", loc: "9 - 90", prev: "0.670", act: "0.670" },
    { cml: "036", loc: "9 - 135", prev: "0.668", act: "0.668" },
    { cml: "037", loc: "9 - 180", prev: "0.670", act: "0.670" },
    { cml: "038", loc: "9 - 225", prev: "0.668", act: "0.668" },
    { cml: "039", loc: "9 - 270", prev: "0.670", act: "0.670" },
    { cml: "040", loc: "9 - 315", prev: "0.668", act: "0.668" },
    { cml: "041", loc: "11 - 0", prev: "0.670", act: "0.670" },
    { cml: "042", loc: "11 - 45", prev: "0.668", act: "0.668" },
    { cml: "043", loc: "11 - 90", prev: "0.670", act: "0.670" },
    { cml: "044", loc: "11 - 135", prev: "0.668", act: "0.668" },
    { cml: "045", loc: "11 - 180", prev: "0.670", act: "0.670" },
    { cml: "046", loc: "11 - 225", prev: "0.668", act: "0.668" },
    { cml: "047", loc: "11 - 270", prev: "0.670", act: "0.670" },
    { cml: "048", loc: "11 - 315", prev: "0.668", act: "0.668" },
    { cml: "049", loc: "13 - 0", prev: "0.670", act: "0.670" },
    { cml: "050", loc: "13 - 45", prev: "0.668", act: "0.668" },
    { cml: "051", loc: "13 - 90", prev: "0.670", act: "0.670" },
    { cml: "052", loc: "13 - 135", prev: "0.668", act: "0.668" },
    { cml: "053", loc: "13 - 180", prev: "0.670", act: "0.670" },
    { cml: "054", loc: "13 - 315", prev: "0.668", act: "0.668" },
  ];

  // Additional shell readings (CML 55-101)
  const moreShellReadings = [
    { cml: "055", loc: "15 - 0", prev: "0.670", act: "0.670" },
    { cml: "056", loc: "15 - 45", prev: "0.668", act: "0.668" },
    { cml: "057", loc: "15 - 90", prev: "0.670", act: "0.670" },
    { cml: "058", loc: "15 - 135", prev: "0.668", act: "0.668" },
    { cml: "059", loc: "15 - 180", prev: "0.670", act: "0.670" },
    { cml: "060", loc: "15 - 225", prev: "0.668", act: "0.668" },
    { cml: "061", loc: "15 - 270", prev: "0.670", act: "0.670" },
    { cml: "062", loc: "15 - 315", prev: "0.668", act: "0.668" },
    { cml: "063", loc: "17 - 0", prev: "0.672", act: "0.672" },
    { cml: "064", loc: "17 - 45", prev: "0.670", act: "0.670" },
    { cml: "065", loc: "17 - 90", prev: "0.672", act: "0.672" },
    { cml: "066", loc: "17 - 135", prev: "0.670", act: "0.670" },
    { cml: "067", loc: "17 - 180", prev: "0.672", act: "0.672" },
    { cml: "068", loc: "17 - 225", prev: "0.670", act: "0.670" },
    { cml: "069", loc: "17 - 270", prev: "0.672", act: "0.672" },
    { cml: "070", loc: "17 - 315", prev: "0.670", act: "0.670" },
  ];

  // East Head readings (CML 71-75)
  const eastHeadReadings = [
    { cml: "071", loc: "55 - C", prev: "0.624", act: "0.624" },
    { cml: "072", loc: "56 - B", prev: "0.555", act: "0.555" },
    { cml: "073", loc: "57 - L", prev: "0.564", act: "0.564" },
    { cml: "074", loc: "58 - T", prev: "0.560", act: "0.560" },
    { cml: "075", loc: "59 - R", prev: "0.558", act: "0.558" },
  ];

  // West Head readings (CML 102-106)
  const westHeadReadings = [
    { cml: "102", loc: "118 - C", prev: "0.624", act: "0.624" },
    { cml: "103", loc: "119 - B", prev: "0.552", act: "0.552" },
    { cml: "104", loc: "120 - L", prev: "0.566", act: "0.566" },
    { cml: "105", loc: "121 - T", prev: "0.558", act: "0.558" },
    { cml: "106", loc: "122 - R", prev: "0.560", act: "0.560" },
  ];

  console.log("Inserting TML readings...");

  // Insert shell readings
  for (const r of [...shellReadings, ...moreShellReadings]) {
    await db.insert(tmlReadings).values({
      id: `tml_${randomUUID().replace(/-/g, '').substring(0, 16)}`,
      inspectionId: inspectionId,
      cmlNumber: r.cml,
      componentType: "Vessel Shell",
      location: r.loc,
      tPrevious: r.prev,
      tActual: r.act,
      tml1: r.act,
      tMinRequired: "0.530",
    });
  }

  // Insert East Head readings
  for (const r of eastHeadReadings) {
    await db.insert(tmlReadings).values({
      id: `tml_${randomUUID().replace(/-/g, '').substring(0, 16)}`,
      inspectionId: inspectionId,
      cmlNumber: r.cml,
      componentType: "East Head",
      location: r.loc,
      tPrevious: r.prev,
      tActual: r.act,
      tml1: r.act,
      tMinRequired: "0.526",
    });
  }

  // Insert West Head readings
  for (const r of westHeadReadings) {
    await db.insert(tmlReadings).values({
      id: `tml_${randomUUID().replace(/-/g, '').substring(0, 16)}`,
      inspectionId: inspectionId,
      cmlNumber: r.cml,
      componentType: "West Head",
      location: r.loc,
      tPrevious: r.prev,
      tActual: r.act,
      tml1: r.act,
      tMinRequired: "0.526",
    });
  }

  console.log("TML readings inserted");

  // 3. Insert Nozzle Evaluations
  const nozzles = [
    { num: "N1", desc: "Manhole", size: "24", mat: "SS A-304", tPrev: "0.375", tAct: "0.375", tMin: "0.328" },
    { num: "N2", desc: "Relief", size: "3", mat: "SS A-312", tPrev: "0.216", tAct: "0.216", tMin: "0.189" },
    { num: "N3", desc: "Vap Out", size: "2", mat: "SS A-312", tPrev: "0.154", tAct: "0.154", tMin: "0.135" },
    { num: "N4", desc: "Reactor Feed", size: "2", mat: "SS A-312", tPrev: "0.154", tAct: "0.154", tMin: "0.135" },
    { num: "N5", desc: "Reactor Feed", size: "2", mat: "SS A-312", tPrev: "0.154", tAct: "0.154", tMin: "0.135" },
    { num: "N6", desc: "Recirc In", size: "1", mat: "SS A-312", tPrev: "0.133", tAct: "0.133", tMin: "0.116" },
    { num: "N7", desc: "Liquid in", size: "1", mat: "SS A-312", tPrev: "0.133", tAct: "0.133", tMin: "0.116" },
    { num: "N8", desc: "Vaper in", size: "1", mat: "SS A-312", tPrev: "0.133", tAct: "0.133", tMin: "0.116" },
    { num: "N9", desc: "Instrument", size: "1", mat: "SS A-312", tPrev: "0.133", tAct: "0.133", tMin: "0.116" },
    { num: "N10", desc: "Instrument", size: "1", mat: "SS A-312", tPrev: "0.133", tAct: "0.133", tMin: "0.116" },
    { num: "N11", desc: "Instrument", size: "1", mat: "SS A-312", tPrev: "0.133", tAct: "0.133", tMin: "0.116" },
    { num: "N12", desc: "Instrument", size: "1", mat: "SS A-312", tPrev: "0.133", tAct: "0.133", tMin: "0.116" },
  ];

  console.log("Inserting nozzle evaluations...");

  for (const n of nozzles) {
    await db.insert(nozzleEvaluations).values({
      id: `noz_${randomUUID().replace(/-/g, '').substring(0, 16)}`,
      inspectionId: inspectionId,
      nozzleNumber: n.num,
      nozzleDescription: n.desc,
      nominalSize: n.size,
      actualThickness: n.tAct,
      minimumRequired: n.tMin,
      acceptable: true,
      notes: `Material: ${n.mat}, Age: 12 years, Corrosion Rate: 0, Remaining Life: >20 years`,
    });
  }

  console.log("Nozzle evaluations inserted");

  // 4. Insert calculations
  console.log("Inserting calculations...");

  await db.insert(calculations).values({
    id: `calc_${randomUUID().replace(/-/g, '').substring(0, 16)}`,
    inspectionId: inspectionId,
    // Shell minimum thickness calculation
    minThicknessDesignPressure: "250.00",
    minThicknessInsideRadius: "35.375",
    minThicknessAllowableStress: "20000.00",
    minThicknessJointEfficiency: "1.00",
    minThicknessCorrosionAllowance: "0.0000",
    minThicknessResult: "0.5300",
    // MAWP calculation
    mawpActualThickness: "0.6520",
    mawpInsideRadius: "35.375",
    mawpAllowableStress: "20000.00",
    mawpJointEfficiency: "1.00",
    mawpCorrosionAllowance: "0.0000",
    mawpResult: "307.50",
    // Remaining life
    remainingLifeCurrentThickness: "0.6520",
    remainingLifeRequiredThickness: "0.5300",
    remainingLifeCorrosionRate: "0.00",
    remainingLifeSafetyFactor: "1.00",
    remainingLifeResult: "20.00",
    remainingLifeNextInspection: "10.00",
  });

  console.log("Calculations inserted");

  // 5. Insert external inspection
  console.log("Inserting external inspection findings...");

  await db.insert(externalInspections).values({
    id: `ext_${randomUUID().replace(/-/g, '').substring(0, 16)}`,
    inspectionId: inspectionId,
    visualCondition: "Satisfactory",
    corrosionObserved: true,
    damageMechanism: "Minor surface corrosion on foundation supports",
    findings: `Foundation: 2 steel supports in satisfactory condition with signs of corrosion noted.
Shell: Un-insulated stainless steel with 20-30 mils epoxy coating in satisfactory condition.
Heads: 2:1 Elliptical design, un-insulated with epoxy coating in satisfactory condition.
Appurtenances: Clean and satisfactory. PSV certified and compliant. ASME nameplate attached and readable.`,
    recommendations: `Continue annual UT inspections per In-Lieu-Of Internal Inspection agreement.
Monitor foundation support corrosion during future inspections.
Next external inspection due: 10/08/2030
Next internal inspection due: 10/08/2032
Next UT inspection due: 10/08/2026`,
  });

  console.log("External inspection inserted");

  console.log("\n=== INSPECTION DATA INSERTION COMPLETE ===");
  console.log("Inspection ID:", inspectionId);
  console.log("Vessel Tag:", "54-11-067");
  console.log("Client:", "SACHEM INC");
  console.log("Location:", "CLEBURNE TX");
  console.log("Inspection Date:", "10/08/2017");
  console.log("TML Readings:", shellReadings.length + moreShellReadings.length + eastHeadReadings.length + westHeadReadings.length);
  console.log("Nozzle Evaluations:", nozzles.length);

  return inspectionId;
}

insertInspectionData()
  .then((id) => {
    console.log("\nSuccess! View the inspection at /inspections/" + id);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error inserting data:", err);
    process.exit(1);
  });
