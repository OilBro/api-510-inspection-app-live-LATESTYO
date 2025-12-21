import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Get the report ID for this inspection
  const [reports] = await connection.execute(
    "SELECT id FROM professionalReports WHERE inspectionId = 'UZNDBONAZepnbaTGt99W3' LIMIT 1"
  );
  
  if (reports.length === 0) {
    console.log("No professional report found for this inspection");
    await connection.end();
    return;
  }
  
  const reportId = reports[0].id;
  console.log("Report ID:", reportId);
  
  // Delete existing calculations
  await connection.execute(
    "DELETE FROM componentCalculations WHERE reportId = ?", [reportId]
  );
  console.log("Deleted existing calculations");
  
  // Get inspection data
  const [inspections] = await connection.execute(
    "SELECT * FROM inspections WHERE id = 'UZNDBONAZepnbaTGt99W3' LIMIT 1"
  );
  const inspection = inspections[0];
  console.log("\n=== INSPECTION DATA ===");
  console.log("Design Pressure:", inspection.designPressure);
  console.log("Inside Diameter:", inspection.insideDiameter);
  console.log("Allowable Stress:", inspection.allowableStress);
  console.log("Joint Efficiency:", inspection.jointEfficiency);
  console.log("Specific Gravity:", inspection.specificGravity);
  
  // Get TML readings for shell
  const [shellTML] = await connection.execute(
    "SELECT tActual, previousThickness, nominalThickness FROM tmlReadings WHERE inspectionId = 'UZNDBONAZepnbaTGt99W3' AND nominalThickness = '0.8130'"
  );
  
  console.log("\n=== SHELL TML READINGS ===");
  console.log("Count:", shellTML.length);
  
  const shellActuals = shellTML.map(t => parseFloat(t.tActual || '0')).filter(v => v > 0);
  const shellPrevs = shellTML.map(t => parseFloat(t.previousThickness || '0')).filter(v => v > 0);
  const shellNominals = shellTML.map(t => parseFloat(t.nominalThickness || '0')).filter(v => v > 0);
  
  console.log("Actual thicknesses:", shellActuals.slice(0, 5), "...");
  console.log("Previous thicknesses:", shellPrevs.slice(0, 5), "...");
  console.log("Nominal thicknesses:", shellNominals.slice(0, 5), "...");
  
  // Calculate shell values
  const P = parseFloat(inspection.designPressure || '225');
  const D = parseFloat(inspection.insideDiameter || '130.25');
  const R = D / 2;
  const S = parseFloat(inspection.allowableStress || '20000');
  const E = parseFloat(inspection.jointEfficiency || '1.0');
  const SG = parseFloat(inspection.specificGravity || '0.63');
  
  // Static head for horizontal vessel
  const heightFeet = D / 12;
  const density = SG * 62.4;
  const staticHead = (density * heightFeet) / 144;
  
  const totalP = P + staticHead;
  
  // Shell t_min = PR / (SE - 0.6P)
  const shellTmin = (totalP * R) / (S * E - 0.6 * totalP);
  
  // Use minimum actual thickness
  const shellTact = shellActuals.length ? Math.min(...shellActuals) : 0.800;
  const shellTprev = shellPrevs.length ? Math.min(...shellPrevs) : 0.813;
  const shellTnom = shellNominals.length ? Math.min(...shellNominals) : 0.813;
  
  // Corrosion rate (assuming 10 years between inspections)
  const years = 10;
  const shellCR = (shellTprev - shellTact) / years;
  const shellCA = shellTact - shellTmin;
  const shellRL = shellCR > 0 ? shellCA / shellCR : 999;
  
  // Shell MAWP
  const P_hoop = (S * E * shellTact) / (R + 0.6 * shellTact);
  const P_long = (2 * S * E * shellTact) / (R - 0.4 * shellTact);
  const shellMAWP = Math.min(P_hoop, P_long) - staticHead;
  
  console.log("\n=== SHELL CALCULATIONS ===");
  console.log("P (design):", P, "psi");
  console.log("D (diameter):", D, "in");
  console.log("R (radius):", R, "in");
  console.log("S (stress):", S, "psi");
  console.log("E (efficiency):", E);
  console.log("SG:", SG);
  console.log("Static Head:", staticHead.toFixed(2), "psi");
  console.log("Total P:", totalP.toFixed(2), "psi");
  console.log("t_min:", shellTmin.toFixed(4), "in");
  console.log("t_act:", shellTact.toFixed(4), "in");
  console.log("t_prev:", shellTprev.toFixed(4), "in");
  console.log("t_nom:", shellTnom.toFixed(4), "in");
  console.log("CR:", shellCR.toFixed(6), "in/yr");
  console.log("CA:", shellCA.toFixed(4), "in");
  console.log("RL:", shellRL.toFixed(2), "years");
  console.log("MAWP:", shellMAWP.toFixed(2), "psi");
  
  await connection.end();
}

main().catch(console.error);
