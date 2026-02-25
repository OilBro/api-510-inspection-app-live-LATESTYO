import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const c = await mysql.createConnection(process.env.DATABASE_URL);
    const iid = 'GAq6JqJAj5dctmttUudSk';

    // Get inspection
    const [insp] = await c.execute(`SELECT * FROM inspections WHERE id = ?`, [iid]);
    const i = insp[0];

    const P_design = parseFloat(i.designPressure) || 250;
    const S = parseFloat(i.allowableStress) || 20000;
    const E = parseFloat(i.jointEfficiency) || 0.85;
    const D = parseFloat(i.insideDiameter) || 70.75;
    const R = D / 2;
    const SG = parseFloat(i.specificGravity) || 0.92;
    const shellNom = parseFloat(i.shellNominalThickness) || 0.625;
    const headNom = parseFloat(i.headNominalThickness) || 0.500;

    // PDF says SH = 6.0 ft, SG = 0.92
    const SH_ft = 6.0; // From PDF
    const staticHead = SH_ft * 0.433 * SG;
    const P = P_design + staticHead; // Total pressure including static head = 252.4 psi per PDF

    console.log('=== VESSEL 54-11-067 ===');
    console.log(`P_design=${P_design}, S=${S}, E=${E}, D=${D}, R=${R}`);
    console.log(`SH=${SH_ft}ft, SG=${SG}, Static Head=${staticHead.toFixed(1)}psi, P_total=${P.toFixed(1)}psi`);
    console.log(`Shell Nominal=${shellNom}", Head Nominal=${headNom}"`);

    // SHELL: Get governing (minimum) thickness
    const [shellRows] = await c.execute(
        `SELECT legacyLocationId, tActual, location FROM tmlReadings 
     WHERE inspectionId = ? AND component = 'Vessel Shell'
     AND tActual IS NOT NULL AND tActual != '' AND CAST(tActual AS DECIMAL(10,4)) > 0
     ORDER BY CAST(tActual AS DECIMAL(10,4)) ASC LIMIT 1`, [iid]);

    // Also try 'Shell' component
    const [shellRows2] = await c.execute(
        `SELECT legacyLocationId, tActual, location FROM tmlReadings 
     WHERE inspectionId = ? AND component = 'Shell'
     AND tActual IS NOT NULL AND tActual != '' AND CAST(tActual AS DECIMAL(10,4)) > 0
     ORDER BY CAST(tActual AS DECIMAL(10,4)) ASC LIMIT 1`, [iid]);

    const shellGov = shellRows[0] || shellRows2[0];
    if (!shellGov) { console.log('ERROR: No shell readings found!'); await c.end(); return; }

    const t_shell = parseFloat(shellGov.tActual);

    // UG-27(c)(1): t = PR/(SE - 0.6P)
    const tmin_shell = (P * R) / (S * E - 0.6 * P);
    // UG-27(c)(1): MAWP = SEt/(R + 0.6t)  
    const mawp_shell_raw = (S * E * t_shell) / (R + 0.6 * t_shell);
    const mawp_shell = mawp_shell_raw - staticHead;
    const ca_shell = t_shell - tmin_shell;
    // PDF: Cr = (t_prev - t_act) / years = (0.625 - 0.652)/12 = negative => 0
    const cr_shell = Math.max(0, (shellNom - t_shell) / 12);
    const rl_shell = cr_shell > 0 ? ca_shell / cr_shell : 999;

    console.log('\n========== SHELL (UG-27) ==========');
    console.log(`Governing: CML ${shellGov.legacyLocationId}, t_act=${t_shell}" (${shellGov.location})`);
    console.log(`t_min = PR/(SE-0.6P) = ${P.toFixed(1)}*${R}/(${S}*${E}-0.6*${P.toFixed(1)}) = ${tmin_shell.toFixed(4)}"`);
    console.log(`MAWP = SEt/(R+0.6t) - SH = ${mawp_shell_raw.toFixed(1)} - ${staticHead.toFixed(1)} = ${mawp_shell.toFixed(1)} psi`);
    console.log(`CA = t_act - t_min = ${t_shell} - ${tmin_shell.toFixed(4)} = ${ca_shell.toFixed(4)}"`);
    console.log(`CR = (t_nom - t_act)/years = (${shellNom} - ${t_shell})/${12} = ${cr_shell.toFixed(6)} in/yr`);
    console.log(`RL = ${rl_shell > 20 ? '>20 years' : rl_shell.toFixed(1) + ' years'}`);
    console.log(`Status: ${t_shell >= tmin_shell ? 'ACCEPTABLE' : 'BELOW MINIMUM'}`);
    console.log(`\nPDF Reference: t_min=0.530", MAWP=307.5psi, CR=0.00000, RL=>20`);

    // HEADS
    for (const [headComp, headLabel] of [['East Head', 'EAST HEAD'], ['West Head', 'WEST HEAD']]) {
        const [headRows] = await c.execute(
            `SELECT legacyLocationId, tActual, location FROM tmlReadings 
       WHERE inspectionId = ? AND component = ?
       AND tActual IS NOT NULL AND tActual != '' AND CAST(tActual AS DECIMAL(10,4)) > 0
       ORDER BY CAST(tActual AS DECIMAL(10,4)) ASC LIMIT 1`, [iid, headComp]);

        if (!headRows[0]) { console.log(`\n${headLabel}: No readings`); continue; }
        const t_head = parseFloat(headRows[0].tActual);

        // UG-32(d) 2:1 Ellipsoidal: t = PD/(2SE - 0.2P)
        const tmin_head = (P * D) / (2 * S * E - 0.2 * P);
        // MAWP = 2SEt/(D + 0.2t)
        const mawp_head_raw = (2 * S * E * t_head) / (D + 0.2 * t_head);
        const mawp_head = mawp_head_raw - staticHead;
        const cr_head = Math.max(0, (headNom - t_head) / 12);
        const ca_head = t_head - tmin_head;
        const rl_head = cr_head > 0 ? ca_head / cr_head : 999;

        console.log(`\n========== ${headLabel} (UG-32d) ==========`);
        console.log(`Governing: CML ${headRows[0].legacyLocationId}, t_act=${t_head}" (${headRows[0].location})`);
        console.log(`t_min = PD/(2SE-0.2P) = ${tmin_head.toFixed(4)}"`);
        console.log(`MAWP = 2SEt/(D+0.2t) - SH = ${mawp_head_raw.toFixed(1)} - ${staticHead.toFixed(1)} = ${mawp_head.toFixed(1)} psi`);
        console.log(`CA = ${ca_head.toFixed(4)}", CR = ${cr_head.toFixed(6)} in/yr`);
        console.log(`RL = ${rl_head > 20 ? '>20 years' : rl_head.toFixed(1) + ' years'}`);
        console.log(`Status: ${t_head >= tmin_head ? 'ACCEPTABLE' : 'BELOW MINIMUM'}`);
    }

    // PDF comparison
    console.log('\n========== PDF vs CALCULATED ==========');
    console.log('Component    | PDF t_min | Calc t_min | PDF MAWP | Calc MAWP | Match?');
    console.log(`Shell        | 0.530"    | ${tmin_shell.toFixed(3)}"    | 307.5    | ${mawp_shell.toFixed(1)}      | ${Math.abs(tmin_shell - 0.530) < 0.002 ? 'YES' : 'NO'}`);

    await c.end();
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
