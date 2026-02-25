/**
 * Run calculations directly via the server-side calculation engine
 * Bypasses the browser UI which times out with large CML dropdowns
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const c = await mysql.createConnection(process.env.DATABASE_URL);
    const iid = 'GAq6JqJAj5dctmttUudSk';

    // Get inspection data
    const [insp] = await c.execute(`SELECT * FROM inspections WHERE id = ?`, [iid]);
    const inspection = insp[0];
    console.log('=== VESSEL DATA ===');
    console.log(`  Tag: ${inspection.vesselTagNumber}`);
    console.log(`  Design Pressure: ${inspection.designPressure} psig`);
    console.log(`  Design Temp: ${inspection.designTemperature} °F`);
    console.log(`  Material: ${inspection.materialSpec}`);
    console.log(`  Allowable Stress: ${inspection.allowableStress} psi`);
    console.log(`  Joint Efficiency: ${inspection.jointEfficiency}`);
    console.log(`  Inside Diameter: ${inspection.insideDiameter}"`);
    console.log(`  Shell Nominal: ${inspection.shellNominalThickness}"`);
    console.log(`  Head Nominal: ${inspection.headNominalThickness}"`);
    console.log(`  Head Type: ${inspection.headType}`);
    console.log(`  Orientation: ${inspection.vesselOrientation}`);
    console.log(`  Specific Gravity: ${inspection.specificGravity}`);

    const P = parseFloat(inspection.designPressure) || 250;
    const S = parseFloat(inspection.allowableStress) || 20000;
    const E = parseFloat(inspection.jointEfficiency) || 0.85;
    const D = parseFloat(inspection.insideDiameter) || 70.75;
    const R = D / 2; // Inside radius
    const SG = parseFloat(inspection.specificGravity) || 0.92;
    const shellNom = parseFloat(inspection.shellNominalThickness) || 0.625;
    const headNom = parseFloat(inspection.headNominalThickness) || 0.500;

    // Static head calculation (for horizontal vessel)
    const SH_ft = D / 12; // Static head in feet (for horizontal vessel, max = diameter)
    const staticHead = SH_ft * 0.433 * SG;
    const totalP = P + staticHead;

    console.log(`\n=== STATIC HEAD ===`);
    console.log(`  SH (ft): ${SH_ft.toFixed(2)}`);
    console.log(`  Static Head Pressure: ${staticHead.toFixed(1)} psi`);
    console.log(`  Total Design Pressure (P + SH): ${totalP.toFixed(1)} psi`);

    // === SHELL CALCULATIONS (UG-27) ===
    // Get governing shell reading
    const [shellReadings] = await c.execute(
        `SELECT legacyLocationId, tActual, location FROM tmlReadings 
     WHERE inspectionId = ? AND (component LIKE '%hell%')
     AND tActual IS NOT NULL AND tActual != '' AND CAST(tActual AS DECIMAL(10,4)) > 0
     ORDER BY CAST(tActual AS DECIMAL(10,4)) ASC LIMIT 1`, [iid]
    );

    const shellGov = shellReadings[0];
    const t_actual_shell = parseFloat(shellGov.tActual);

    // t_min = PR / (SE - 0.6P)  [UG-27(c)(1)]
    const t_min_shell = (totalP * R) / (S * E - 0.6 * totalP);

    // MAWP = SEt / (R + 0.6t)  [UG-27(c)(1)]
    const MAWP_shell_raw = (S * E * t_actual_shell) / (R + 0.6 * t_actual_shell);
    const MAWP_shell = MAWP_shell_raw - staticHead; // Subtract static head

    // Corrosion allowance
    const CA_shell = t_actual_shell - t_min_shell;

    // Corrosion rate (from PDF: t_prev = 0.625, years = 12)
    // Per PDF: Cr = (t_prev - t_act) / years = (0.625 - 0.652) / 12 = negative → 0
    const t_prev_shell = shellNom; // Using nominal as previous (first inspection)
    const years = 12; // From PDF: 12 years between inspections
    const CR_shell = Math.max(0, (t_prev_shell - t_actual_shell) / years);

    // Remaining life
    const RL_shell = CR_shell > 0 ? CA_shell / CR_shell : Infinity;

    console.log(`\n========================================`);
    console.log(`  SHELL EVALUATION (UG-27)`);
    console.log(`========================================`);
    console.log(`  Governing CML: ${shellGov.legacyLocationId} at ${shellGov.location}`);
    console.log(`  t_actual: ${t_actual_shell.toFixed(4)}"`);
    console.log(`  t_nominal: ${shellNom}"`);
    console.log(`  t_previous: ${t_prev_shell}" (nominal, first inspection)`);
    console.log(`  t_min (required): ${t_min_shell.toFixed(4)}" [PR/(SE-0.6P)]`);
    console.log(`  MAWP: ${MAWP_shell.toFixed(1)} psi [SEt/(R+0.6t) - SH]`);
    console.log(`  Corrosion Allowance (CA): ${CA_shell.toFixed(4)}"`);
    console.log(`  Corrosion Rate (CR): ${CR_shell.toFixed(6)} in/yr`);
    console.log(`  Remaining Life: ${RL_shell === Infinity ? '>20 years' : RL_shell.toFixed(1) + ' years'}`);
    console.log(`  Status: ${t_actual_shell >= t_min_shell ? '✅ ACCEPTABLE' : '❌ BELOW MINIMUM'}`);

    // === HEAD CALCULATIONS (UG-32 for 2:1 Ellipsoidal) ===
    // Get governing head readings (East and West separately)
    for (const headName of ['East Head', 'West Head']) {
        const [headReadings] = await c.execute(
            `SELECT legacyLocationId, tActual, location FROM tmlReadings 
       WHERE inspectionId = ? AND component = ?
       AND tActual IS NOT NULL AND tActual != '' AND CAST(tActual AS DECIMAL(10,4)) > 0
       ORDER BY CAST(tActual AS DECIMAL(10,4)) ASC LIMIT 1`, [iid, headName]
        );

        if (headReadings.length === 0) {
            console.log(`\n  ${headName}: No readings found`);
            continue;
        }

        const headGov = headReadings[0];
        const t_actual_head = parseFloat(headGov.tActual);

        // 2:1 Ellipsoidal head: t = PD / (2SE - 0.2P)  [UG-32(d)]
        const t_min_head = (totalP * D) / (2 * S * E - 0.2 * totalP);

        // MAWP for 2:1 Ellipsoidal: P = 2SEt / (D + 0.2t)
        const MAWP_head_raw = (2 * S * E * t_actual_head) / (D + 0.2 * t_actual_head);
        const MAWP_head = MAWP_head_raw - staticHead;

        const CA_head = t_actual_head - t_min_head;
        const CR_head = Math.max(0, (headNom - t_actual_head) / years);
        const RL_head = CR_head > 0 ? CA_head / CR_head : Infinity;

        console.log(`\n========================================`);
        console.log(`  ${headName.toUpperCase()} EVALUATION (UG-32(d))`);
        console.log(`========================================`);
        console.log(`  Governing CML: ${headGov.legacyLocationId} at ${headGov.location}`);
        console.log(`  t_actual: ${t_actual_head.toFixed(4)}"`);
        console.log(`  t_nominal: ${headNom}"`);
        console.log(`  t_min (required): ${t_min_head.toFixed(4)}" [PD/(2SE-0.2P)]`);
        console.log(`  MAWP: ${MAWP_head.toFixed(1)} psi [2SEt/(D+0.2t) - SH]`);
        console.log(`  CA: ${CA_head.toFixed(4)}"`);
        console.log(`  CR: ${CR_head.toFixed(6)} in/yr`);
        console.log(`  Remaining Life: ${RL_head === Infinity ? '>20 years' : RL_head.toFixed(1) + ' years'}`);
        console.log(`  Status: ${t_actual_head >= t_min_head ? '✅ ACCEPTABLE' : '❌ BELOW MINIMUM'}`);
    }

    // === COMPARISON WITH PDF REPORT ===
    console.log(`\n========================================`);
    console.log(`  COMPARISON WITH 2017 PDF REPORT`);
    console.log(`========================================`);
    console.log(`  | Component    | PDF t_min | Calc t_min | PDF MAWP | Calc MAWP |`);
    console.log(`  |--------------|-----------|------------|----------|-----------|`);
    console.log(`  | Shell        | 0.530"    | ${t_min_shell.toFixed(3)}"    | 307.5    | ${MAWP_shell.toFixed(1)}     |`);

    await c.end();
    console.log('\nDone!');
}
main().catch(console.error);
