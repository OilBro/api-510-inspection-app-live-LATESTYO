import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Get TML readings
  const [tml] = await connection.execute(
    "SELECT componentType, component, location, tActual, previousThickness, nominalThickness FROM tmlReadings WHERE inspectionId = 'UZNDBONAZepnbaTGt99W3'"
  );
  
  // Apply the same filtering logic as the app
  const shellTMLs = tml.filter(t => {
    const compType = (t.componentType || '').toLowerCase();
    const comp = (t.component || '').toLowerCase();
    const loc = (t.location || '').toLowerCase();
    
    // Exclude nozzles
    if (compType.startsWith('n') || comp.startsWith('n') || loc.includes('nozzle')) {
      return false;
    }
    
    // Shell: numeric location AND degree component type AND not head
    const isNumericLocation = /^\d+$/.test(loc.trim());
    const isDegreeComponent = /^\d+$/.test(compType.trim());
    const isNotHead = !loc.includes('head');
    
    return isNumericLocation && isDegreeComponent && isNotHead;
  });
  
  const southHeadTMLs = tml.filter(t => {
    const loc = (t.location || '').toLowerCase();
    return loc.includes('south head');
  });
  
  console.log("=== SHELL TMLs (filtered) ===");
  console.log("Count:", shellTMLs.length);
  const shellActuals = shellTMLs.map(t => parseFloat(t.tActual || '0')).filter(v => v > 0);
  const shellPrevs = shellTMLs.map(t => parseFloat(t.previousThickness || '0')).filter(v => v > 0);
  console.log("Actual thicknesses:", shellActuals.slice(0, 5), "...");
  console.log("Min actual:", Math.min(...shellActuals).toFixed(4));
  console.log("Max actual:", Math.max(...shellActuals).toFixed(4));
  console.log("Previous thicknesses:", shellPrevs.slice(0, 5), "...");
  console.log("Min prev:", Math.min(...shellPrevs).toFixed(4));
  
  console.log("\n=== SOUTH HEAD TMLs ===");
  console.log("Count:", southHeadTMLs.length);
  const headActuals = southHeadTMLs.map(t => parseFloat(t.tActual || '0')).filter(v => v > 0);
  const headPrevs = southHeadTMLs.map(t => parseFloat(t.previousThickness || '0')).filter(v => v > 0);
  console.log("Actual thicknesses:", headActuals);
  console.log("Min actual:", headActuals.length ? Math.min(...headActuals).toFixed(4) : 'N/A');
  console.log("Previous thicknesses:", headPrevs);
  console.log("Min prev:", headPrevs.length ? Math.min(...headPrevs).toFixed(4) : 'N/A');
  
  // Now calculate with correct values
  const P = 225;
  const D = 130.25;
  const R = D / 2;
  const S = 20000;
  const E = 1.0;
  const SG = 0.63;
  
  const heightFeet = D / 12;
  const density = SG * 62.4;
  const staticHead = (density * heightFeet) / 144;
  const totalP = P + staticHead;
  
  // Shell calculation with CORRECT filtered data
  const shellTact = shellActuals.length ? Math.min(...shellActuals) : 0.800;
  const shellTprev = shellPrevs.length ? Math.min(...shellPrevs) : 0.813;
  const shellTmin = (totalP * R) / (S * E - 0.6 * totalP);
  const shellCR = (shellTprev - shellTact) / 10;
  const shellCA = shellTact - shellTmin;
  const shellRL = shellCR > 0 ? shellCA / shellCR : 999;
  const P_hoop = (S * E * shellTact) / (R + 0.6 * shellTact);
  const P_long = (2 * S * E * shellTact) / (R - 0.4 * shellTact);
  const shellMAWP = Math.min(P_hoop, P_long) - staticHead;
  
  console.log("\n=== CORRECTED SHELL CALCULATIONS ===");
  console.log("t_min:", shellTmin.toFixed(4), "in");
  console.log("t_act:", shellTact.toFixed(4), "in");
  console.log("t_prev:", shellTprev.toFixed(4), "in");
  console.log("CR:", shellCR.toFixed(6), "in/yr");
  console.log("CA:", shellCA.toFixed(4), "in");
  console.log("RL:", shellRL.toFixed(2), "years");
  console.log("MAWP:", shellMAWP.toFixed(2), "psi");
  
  // Head calculation
  const headTact = headActuals.length ? Math.min(...headActuals) : 0.502;
  const headTprev = headPrevs.length ? Math.min(...headPrevs) : 0.530;
  // Hemispherical head: t_min = PR / (2SE - 0.2P)
  const headTmin = (totalP * R) / (2 * S * E - 0.2 * totalP);
  const headCR = (headTprev - headTact) / 10;
  const headCA = headTact - headTmin;
  const headRL = headCR > 0 ? headCA / headCR : 999;
  // Hemispherical MAWP: P = 2SEt / (R + 0.2t)
  const headMAWP = (2 * S * E * headTact) / (R + 0.2 * headTact) - staticHead;
  
  console.log("\n=== CORRECTED HEAD CALCULATIONS (Hemispherical) ===");
  console.log("t_min:", headTmin.toFixed(4), "in");
  console.log("t_act:", headTact.toFixed(4), "in");
  console.log("t_prev:", headTprev.toFixed(4), "in");
  console.log("CR:", headCR.toFixed(6), "in/yr");
  console.log("CA:", headCA.toFixed(4), "in");
  console.log("RL:", headRL.toFixed(2), "years");
  console.log("MAWP:", headMAWP.toFixed(2), "psi");
  
  await connection.end();
}

main().catch(console.error);
