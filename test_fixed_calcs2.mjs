import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Get TML readings
  const [tml] = await connection.execute(
    "SELECT componentType, component, location, tActual, previousThickness, nominalThickness FROM tmlReadings WHERE inspectionId = 'UZNDBONAZepnbaTGt99W3'"
  );
  
  // Apply the CORRECTED filtering logic (location 7 is head, not shell)
  const shellTMLs = tml.filter(t => {
    const compType = (t.componentType || '').toLowerCase();
    const comp = (t.component || '').toLowerCase();
    const loc = (t.location || '').toLowerCase();
    
    // Exclude nozzles
    if (compType.startsWith('n') || comp.startsWith('n') || loc.includes('nozzle')) {
      return false;
    }
    
    // Shell: numeric location >= 8 AND degree component type AND not head
    const locNum = parseInt(loc.trim(), 10);
    const isShellLocation = !isNaN(locNum) && locNum >= 8; // Shell starts at location 8
    const isDegreeComponent = /^\d+$/.test(compType.trim());
    const isNotHead = !loc.includes('head');
    
    return isShellLocation && isDegreeComponent && isNotHead;
  });
  
  const southHeadTMLs = tml.filter(t => {
    const loc = (t.location || '').toLowerCase();
    return loc.includes('south head');
  });
  
  const northHeadTMLs = tml.filter(t => {
    const compType = (t.componentType || '').toLowerCase();
    const loc = (t.location || '').toLowerCase();
    
    // Location 7 with degree components is North head
    const locNum = parseInt(loc.trim(), 10);
    const isDegreeComponent = /^\d+$/.test(compType.trim());
    return locNum === 7 && isDegreeComponent;
  });
  
  console.log("=== SHELL TMLs (locations 8-12) ===");
  console.log("Count:", shellTMLs.length);
  const shellActuals = shellTMLs.map(t => parseFloat(t.tActual || '0')).filter(v => v > 0);
  const shellPrevs = shellTMLs.map(t => parseFloat(t.previousThickness || '0')).filter(v => v > 0);
  console.log("Min actual:", Math.min(...shellActuals).toFixed(4));
  console.log("Max actual:", Math.max(...shellActuals).toFixed(4));
  console.log("Min prev:", Math.min(...shellPrevs).toFixed(4));
  
  console.log("\n=== SOUTH HEAD TMLs ===");
  console.log("Count:", southHeadTMLs.length);
  const southActuals = southHeadTMLs.map(t => parseFloat(t.tActual || '0')).filter(v => v > 0);
  const southPrevs = southHeadTMLs.map(t => parseFloat(t.previousThickness || '0')).filter(v => v > 0);
  console.log("Actuals:", southActuals);
  console.log("Min actual:", southActuals.length ? Math.min(...southActuals).toFixed(4) : 'N/A');
  
  console.log("\n=== NORTH HEAD TMLs (location 7) ===");
  console.log("Count:", northHeadTMLs.length);
  const northActuals = northHeadTMLs.map(t => parseFloat(t.tActual || '0')).filter(v => v > 0);
  const northPrevs = northHeadTMLs.map(t => parseFloat(t.previousThickness || '0')).filter(v => v > 0);
  console.log("Actuals:", northActuals);
  console.log("Min actual:", northActuals.length ? Math.min(...northActuals).toFixed(4) : 'N/A');
  
  // Now calculate with CORRECT values
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
  
  // Shell calculation with CORRECT filtered data (locations 8-12 only)
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
  
  // North Head calculation (location 7)
  const headTact = northActuals.length ? Math.min(...northActuals) : 0.493;
  const headTprev = northPrevs.length ? Math.min(...northPrevs) : 0.813;
  // Hemispherical head: t_min = PR / (2SE - 0.2P)
  const headTmin = (totalP * R) / (2 * S * E - 0.2 * totalP);
  const headCR = (headTprev - headTact) / 10;
  const headCA = headTact - headTmin;
  const headRL = headCR > 0 ? headCA / headCR : 999;
  // Hemispherical MAWP: P = 2SEt / (R + 0.2t)
  const headMAWP = (2 * S * E * headTact) / (R + 0.2 * headTact) - staticHead;
  
  console.log("\n=== NORTH HEAD CALCULATIONS (location 7, Hemispherical) ===");
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
