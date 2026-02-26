import 'dotenv/config';
import { getDb } from '../server/db';
import { inspections, tmlReadings, componentCalculations, professionalReports } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import XLSX from 'xlsx';

/**
 * Insert 2025 inspection for vessel 54-11-067
 * Links to the 2017 inspection as "previousInspectionId" for trend analysis
 * Uses the Excel spreadsheet "067 TO INPUT NOW A .xlsx" for TML readings
 */
async function insert2025Inspection() {
    const db = await getDb();
    if (!db) {
        console.error('Database not available');
        process.exit(1);
    }

    // ===== Step 1: Find the existing 2017 inspection to link as previous =====
    const existing2017 = await db.select().from(inspections)
        .where(eq(inspections.vesselTagNumber, '54-11-067'))
        .execute();

    const prev = existing2017.find(i => {
        if (!i.inspectionDate) return false;
        const d = new Date(i.inspectionDate);
        return d.getFullYear() === 2017;
    });

    if (!prev) {
        console.error('ERROR: Cannot find 2017 inspection to link. Run insert-54-11-067-2017.ts first.');
        process.exit(1);
    }
    console.log('Found 2017 inspection:', prev.id);

    // ===== Step 2: Check for existing 2025 inspection to avoid duplicates =====
    const existing2025 = existing2017.find(i => {
        if (!i.inspectionDate) return false;
        const d = new Date(i.inspectionDate);
        return d.getFullYear() === 2025;
    });

    if (existing2025) {
        console.log('2025 inspection already exists (ID:', existing2025.id, '). Deleting and recreating...');
        // Clean up old data
        await db.delete(tmlReadings).where(eq(tmlReadings.inspectionId, existing2025.id)).execute();
        const oldReports = await db.select().from(professionalReports).where(eq(professionalReports.inspectionId, existing2025.id)).execute();
        for (const r of oldReports) {
            await db.delete(componentCalculations).where(eq(componentCalculations.reportId, r.id)).execute();
        }
        await db.delete(professionalReports).where(eq(professionalReports.inspectionId, existing2025.id)).execute();
        await db.delete(inspections).where(eq(inspections.id, existing2025.id)).execute();
        console.log('Cleaned up old 2025 data.');
    }

    // ===== Step 3: Read the 2025 Excel Data =====
    console.log('\nReading Excel file...');
    const wb = XLSX.readFile('e:\\jerry\\Dropbox\\MANUS\\067\\067 TO INPUT NOW A .xlsx');
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Skip header row
    const dataRows = rows.slice(1).filter(r => r.length >= 4);
    console.log(`Read ${dataRows.length} data rows from Excel`);

    // ===== Step 4: Create the 2025 inspection =====
    const inspectionId = randomUUID();
    const inspectionDate = new Date('2025-02-15'); // Approximate date for the 2025 inspection

    await db.insert(inspections).values({
        id: inspectionId,
        userId: 1,
        previousInspectionId: prev.id, // Link to 2017 inspection!
        vesselTagNumber: '54-11-067',
        vesselName: '54-11-067 SACHEM Horizontal Vessel',
        inspectionDate: inspectionDate,
        designPressure: '250',
        designTemperature: '200',
        operatingTemperature: '80',
        operatingPressure: '250',
        materialSpec: 'SA-240 Type 304',
        product: 'METHYLCHLORIDE CLEAN',
        headType: '2:1 Ellipsoidal',
        vesselOrientation: 'Horizontal',
        insideDiameter: '70.75',
        overallLength: '216',
        shellNominalThickness: '0.6250',
        headNominalThickness: '0.5000',
        allowableStress: '20000',
        jointEfficiency: '0.85',
        liquidHeight: '6.00',
        specificGravity: '0.9200',
        constructionCode: 'ASME S8 D1',
        nbNumber: '5653',
        yearBuilt: 2005,
        mdmt: '-20',
        status: 'completed',
    }).execute();

    console.log('Created 2025 inspection with ID:', inspectionId);
    console.log('  -> Linked to 2017 inspection:', prev.id);

    // ===== Step 5: Create professional report =====
    const reportId = randomUUID();

    await db.insert(professionalReports).values({
        id: reportId,
        inspectionId: inspectionId,
        userId: 1,
        reportNumber: 'RPT-54-11-067-2025',
        inspectorName: 'Christopher Welch',
        clientName: 'SACHEM INC',
        clientLocation: 'CLEBURNE TX',
    }).execute();

    console.log('Created professional report with ID:', reportId);

    // ===== Step 6: Insert all TML readings from Excel =====
    let headCount = 0;
    let shellCount = 0;
    let nozzleCount = 0;
    let skippedCount = 0;
    const dataQualityIssues: string[] = [];

    // Previous inspection date for corrosion rate calc
    const prevInspDate = prev.inspectionDate ? new Date(prev.inspectionDate) : new Date('2017-06-20');

    // Track which head we're in (first batch = East/South Head, second batch = West/North Head)
    let firstHeadDone = false;

    for (const row of dataRows) {
        const tmlId = String(row[0]).trim();
        const component = String(row[1]).trim();
        const nominal = row[2] !== undefined ? String(row[2]) : null;
        const previous = row[3] !== undefined && row[3] !== '' ? String(row[3]) : null;
        const current = row[4] !== undefined && row[4] !== '' ? String(row[4]) : null;

        // Skip rows with no current reading
        if (!current) {
            dataQualityIssues.push(`TML ${tmlId}: Missing current reading (skipping)`);
            skippedCount++;
            continue;
        }

        // Data quality: detect suspicious previous values
        if (previous && parseFloat(previous) > 1.0 && component.startsWith('N')) {
            dataQualityIssues.push(`TML ${tmlId} (${component}): Previous reading ${previous} looks erroneous (>1.0" for nozzle)`);
        }

        // Determine component group and type
        let componentGroup = 'OTHER';
        let componentType = component;
        let readingType: string | null = null;
        let service: string | null = null;
        let nozzleSize: string | null = null;

        if (component === 'HEAD') {
            // First batch of HEAD readings = East Head (TML 1-13)
            // Second batch = West Head (TML 102-106)
            const tmlNum = parseInt(tmlId);
            if (tmlNum > 100) {
                componentGroup = 'WESTHEAD';
                componentType = 'West Head';
            } else {
                componentGroup = 'EASTHEAD';
                componentType = 'East Head';
            }
            headCount++;
        } else if (component === 'Vessel Shell') {
            componentGroup = 'SHELL';
            componentType = 'Vessel Shell';
            shellCount++;
        } else if (component.startsWith('N')) {
            componentGroup = 'NOZZLE';
            readingType = 'nozzle';
            // Map nozzle service from original report
            const nozzleServices: Record<string, { service: string; size: string }> = {
                'N1': { service: 'Manway', size: '24"' },
                'N2': { service: 'Relief', size: '3"' },
                'N3': { service: 'Vapor Out', size: '2"' },
                'N4': { service: 'Sight Gauge', size: '1"' },
                'N5': { service: 'Sight Gauge', size: '1"' },
                'N6': { service: 'Reactor Feed', size: '2"' },
                'N7': { service: 'Gauge', size: '1"' },
                'N8': { service: 'Vapor In', size: '1"' },
                'N9': { service: 'Out', size: '1"' },
                'N10': { service: 'Out', size: '1"' },
                'N11': { service: 'Gauge', size: '1"' },
                'N12': { service: 'Gauge', size: '1"' },
            };
            const nozInfo = nozzleServices[component];
            if (nozInfo) {
                service = nozInfo.service;
                nozzleSize = nozInfo.size;
            }
            nozzleCount++;
        }

        await db.insert(tmlReadings).values({
            id: randomUUID(),
            inspectionId: inspectionId,
            legacyLocationId: tmlId,
            componentType: componentType,
            location: `${tmlId}`,
            componentGroup: componentGroup,
            schemaVersion: 1,
            tActual: current,
            nominalThickness: nominal,
            previousThickness: previous,
            previousInspectionDate: prevInspDate,
            currentInspectionDate: inspectionDate,
            readingType: readingType,
            service: service,
            nozzleSize: nozzleSize,
            status: 'good',
        }).execute();
    }

    console.log(`\nInserted TML readings:`);
    console.log(`  Shell:   ${shellCount}`);
    console.log(`  Head:    ${headCount}`);
    console.log(`  Nozzle:  ${nozzleCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log(`  Total:   ${shellCount + headCount + nozzleCount}`);

    if (dataQualityIssues.length > 0) {
        console.log(`\n⚠️  Data Quality Issues Found:`);
        for (const issue of dataQualityIssues) {
            console.log(`  - ${issue}`);
        }
    }

    // ===== Step 7: Summary =====
    // Find governing (minimum) thickness for shell and heads
    const shellReadings = dataRows
        .filter(r => String(r[1]).trim() === 'Vessel Shell' && r[4])
        .map(r => parseFloat(String(r[4])));
    const minShell = Math.min(...shellReadings);

    const headReadings = dataRows
        .filter(r => String(r[1]).trim() === 'HEAD' && r[4])
        .map(r => parseFloat(String(r[4])));
    const minHead = Math.min(...headReadings);

    console.log(`\n📊 2025 Inspection Summary:`);
    console.log(`  Vessel: 54-11-067 (SACHEM INC, CLEBURNE TX)`);
    console.log(`  Previous inspection: 2017-06-20`);
    console.log(`  Time span: ~${((inspectionDate.getTime() - prevInspDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)} years`);
    console.log(`  Min shell thickness: ${minShell.toFixed(4)}" (nominal: 0.6250")`);
    console.log(`  Min head thickness:  ${minHead.toFixed(4)}" (nominal: 0.5000")`);
    console.log(`\n✅ Import complete. Run Full Calculation Suite in the app to compute t_required, MAWP, corrosion rates, and remaining life.`);

    process.exit(0);
}

insert2025Inspection().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
