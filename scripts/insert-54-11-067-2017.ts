import 'dotenv/config';
import { getDb } from '../server/db';
import { inspections, tmlReadings, componentCalculations, professionalReports } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function insertInspectionData() {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }

  // Check if inspection already exists for this vessel and date
  const existing = await db.select().from(inspections)
    .where(eq(inspections.vesselTagNumber, '54-11-067'))
    .execute();

  const existingReport = existing.find(i => {
    if (!i.inspectionDate) return false;
    const date = new Date(i.inspectionDate);
    return date.getFullYear() === 2017 && date.getMonth() === 5; // June 2017
  });

  if (existingReport) {
    console.log('Inspection for 54-11-067 (June 2017) already exists with ID:', existingReport.id);
    console.log('Updating existing record...');

    // Update the existing inspection with correct values
    await db.update(inspections)
      .set({
        allowableStress: '20000',
        jointEfficiency: '0.85',
        specificGravity: '0.9200',
        designTemperature: '200',
        operatingTemperature: '80',
        operatingPressure: '250',
        yearBuilt: 2005,
        materialSpec: 'SA-240 Type 304',
        headType: '2:1 Ellipsoidal',
        vesselOrientation: 'Horizontal',
        insideDiameter: '70.75',
        overallLength: '216',
        shellNominalThickness: '0.6250',
        headNominalThickness: '0.5000',
        constructionCode: 'ASME S8 D1',
        nbNumber: '5653',
        mdmt: '-20',
        liquidHeight: '6.00',
      })
      .where(eq(inspections.id, existingReport.id))
      .execute();

    console.log('Updated inspection record');

    // Delete existing component calculations for this report
    const reports = await db.select().from(professionalReports)
      .where(eq(professionalReports.inspectionId, existingReport.id))
      .execute();

    if (reports.length > 0) {
      await db.delete(componentCalculations)
        .where(eq(componentCalculations.reportId, reports[0].id))
        .execute();

      // Insert correct component calculations
      await insertComponentCalculations(db, reports[0].id);
    }

    return;
  }

  // Create new inspection
  console.log('Creating new inspection for 54-11-067 (June 2017)...');

  const inspectionId = randomUUID();

  await db.insert(inspections).values({
    id: inspectionId,
    userId: 1, // Default user
    vesselTagNumber: '54-11-067',
    vesselName: '54-11-067 SACHEM Horizontal Vessel',
    inspectionDate: new Date('2017-06-20'),
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

  console.log('Created inspection with ID:', inspectionId);

  // Create professional report
  const reportId = randomUUID();

  await db.insert(professionalReports).values({
    id: reportId,
    inspectionId: inspectionId,
    userId: 1,
    reportNumber: 'RPT-54-11-067-2017',
    inspectorName: 'Christopher Welch',
    clientName: 'SACHEM INC',
    clientLocation: 'CLEBURNE TX',
  }).execute();

  console.log('Created professional report with ID:', reportId);

  // Insert component calculations
  await insertComponentCalculations(db, reportId);

  // Insert TML readings
  await insertTmlReadings(db, inspectionId);

  console.log('Data insertion complete!');
}

async function insertComponentCalculations(db: any, reportId: string) {
  // Shell calculation
  await db.insert(componentCalculations).values({
    id: randomUUID(),
    reportId,
    componentName: 'Vessel Shell',
    componentType: 'shell',
    nominalThickness: '0.6250',
    actualThickness: '0.6520',
    minimumThickness: '0.5300',
    previousThickness: '0.6250',
    corrosionRate: '0.000000',
    remainingLife: '20.00',
    calculatedMAWP: '307.50',
    designMAWP: '250.00',
    allowableStress: '20000.00',
    jointEfficiency: '0.85',
    insideDiameter: '70.750',
    staticHead: '6.00',
    specificGravity: '0.9200',
    timeSpan: '12.00',
  }).execute();

  // East Head calculation
  await db.insert(componentCalculations).values({
    id: randomUUID(),
    reportId,
    componentName: 'East Head',
    componentType: 'head',
    nominalThickness: '0.5000',
    actualThickness: '0.5550',
    minimumThickness: '0.5260',
    previousThickness: '0.5000',
    corrosionRate: '0.000000',
    remainingLife: '20.00',
    calculatedMAWP: '263.90',
    designMAWP: '250.00',
    allowableStress: '20000.00',
    jointEfficiency: '0.85',
    insideDiameter: '70.750',
    staticHead: '6.00',
    specificGravity: '0.9200',
    timeSpan: '12.00',
  }).execute();

  // West Head calculation
  await db.insert(componentCalculations).values({
    id: randomUUID(),
    reportId,
    componentName: 'West Head',
    componentType: 'head',
    nominalThickness: '0.5000',
    actualThickness: '0.5520',
    minimumThickness: '0.5260',
    previousThickness: '0.5000',
    corrosionRate: '0.000000',
    remainingLife: '20.00',
    calculatedMAWP: '262.50',
    designMAWP: '250.00',
    allowableStress: '20000.00',
    jointEfficiency: '0.85',
    insideDiameter: '70.750',
    staticHead: '6.00',
    specificGravity: '0.9200',
    timeSpan: '12.00',
  }).execute();

  console.log('Inserted 3 component calculations (Shell, East Head, West Head)');
}

async function insertTmlReadings(db: any, inspectionId: string) {
  // Shell TML readings (CML 1-17 based on drawing)
  const shellReadings = [
    { cml: '1', location: '1-0', actual: '0.660', nominal: '0.625' },
    { cml: '2', location: '2-0', actual: '0.658', nominal: '0.625' },
    { cml: '3', location: '3-0', actual: '0.655', nominal: '0.625' },
    { cml: '4', location: '4-0', actual: '0.652', nominal: '0.625' },
    { cml: '5', location: '5-0', actual: '0.654', nominal: '0.625' },
    { cml: '6', location: '6-0', actual: '0.656', nominal: '0.625' },
    { cml: '7', location: '7-0', actual: '0.653', nominal: '0.625' },
    { cml: '8', location: '8-0', actual: '0.657', nominal: '0.625' },
    { cml: '9', location: '9-0', actual: '0.659', nominal: '0.625' },
    { cml: '10', location: '10-0', actual: '0.655', nominal: '0.625' },
    { cml: '11', location: '11-0', actual: '0.654', nominal: '0.625' },
    { cml: '12', location: '12-0', actual: '0.656', nominal: '0.625' },
    { cml: '13', location: '13-0', actual: '0.658', nominal: '0.625' },
    { cml: '14', location: '14-0', actual: '0.657', nominal: '0.625' },
    { cml: '15', location: '15-0', actual: '0.655', nominal: '0.625' },
    { cml: '16', location: '16-0', actual: '0.653', nominal: '0.625' },
    { cml: '17', location: '17-0', actual: '0.652', nominal: '0.625' },
  ];

  // East Head TML readings
  const eastHeadReadings = [
    { cml: '1', location: 'EH-1', actual: '0.555', nominal: '0.500' },
    { cml: '2', location: 'EH-2', actual: '0.557', nominal: '0.500' },
    { cml: '3', location: 'EH-3', actual: '0.556', nominal: '0.500' },
    { cml: '4', location: 'EH-4', actual: '0.558', nominal: '0.500' },
    { cml: '5', location: 'EH-5', actual: '0.555', nominal: '0.500' },
  ];

  // West Head TML readings
  const westHeadReadings = [
    { cml: '118', location: 'WH-1', actual: '0.552', nominal: '0.500' },
    { cml: '119', location: 'WH-2', actual: '0.554', nominal: '0.500' },
    { cml: '120', location: 'WH-3', actual: '0.553', nominal: '0.500' },
    { cml: '121', location: 'WH-4', actual: '0.555', nominal: '0.500' },
    { cml: '122', location: 'WH-5', actual: '0.552', nominal: '0.500' },
  ];

  // Nozzle TML readings (N1-N12 with multi-angle data)
  // tmin* values from original report, tActual = min of all 4 angles
  const nozzleReadings = [
    { cml: 'N1', location: 'N1', service: 'Manway', size: '24', tml1: '0.574', tml2: '0.576', tml3: '0.578', tml4: '0.578', actual: '0.574', nominal: '0.375' },
    { cml: 'N2', location: 'N2', service: 'Relief', size: '3', tml1: '0.300', tml2: '0.301', tml3: '0.298', tml4: '0.300', actual: '0.298', nominal: '0.216' },
    { cml: 'N3', location: 'N3', service: 'Vapor Out', size: '2', tml1: '0.164', tml2: '0.164', tml3: '0.163', tml4: '0.162', actual: '0.162', nominal: '0.154' },
    { cml: 'N4', location: 'N4', service: 'Sight Gauge', size: '1', tml1: '0.137', tml2: '0.131', tml3: '0.130', tml4: '0.131', actual: '0.130', nominal: '0.133' },
    { cml: 'N5', location: 'N5', service: 'Sight Gauge', size: '1', tml1: '0.131', tml2: '0.132', tml3: '0.128', tml4: '0.130', actual: '0.128', nominal: '0.133' },
    { cml: 'N6', location: 'N6', service: 'Reactor Feed', size: '2', tml1: '0.163', tml2: '0.163', tml3: '0.164', tml4: '0.166', actual: '0.163', nominal: '0.154' },
    { cml: 'N7', location: 'N7', service: 'Gauge', size: '1', tml1: '0.162', tml2: '0.161', tml3: '0.128', tml4: '0.163', actual: '0.128', nominal: '0.133' },
    { cml: 'N8', location: 'N8', service: 'Vapor In', size: '1', tml1: '0.130', tml2: '0.131', tml3: '0.130', tml4: '0.134', actual: '0.130', nominal: '0.133' },
    { cml: 'N9', location: 'N9', service: 'Out', size: '1', tml1: '0.128', tml2: '0.134', tml3: '0.133', tml4: '0.132', actual: '0.128', nominal: '0.133' },
    { cml: 'N10', location: 'N10', service: 'Out', size: '1', tml1: '0.132', tml2: '0.130', tml3: '0.130', tml4: '0.133', actual: '0.130', nominal: '0.133' },
    { cml: 'N11', location: 'N11', service: 'Gauge', size: '1', tml1: '0.133', tml2: '0.132', tml3: '0.132', tml4: '0.131', actual: '0.131', nominal: '0.133' },
    { cml: 'N12', location: 'N12', service: 'Gauge', size: '1', tml1: '0.133', tml2: '0.132', tml3: '0.132', tml4: '0.130', actual: '0.130', nominal: '0.133' },
  ];

  interface ReadingInput {
    cml: string;
    location: string;
    actual: string;
    nominal: string;
    componentType: string;
    componentGroup: string;
  }

  const allReadings: ReadingInput[] = [
    ...shellReadings.map(r => ({ ...r, componentType: 'Vessel Shell', componentGroup: 'SHELL' })),
    ...eastHeadReadings.map(r => ({ ...r, componentType: 'East Head', componentGroup: 'EASTHEAD' })),
    ...westHeadReadings.map(r => ({ ...r, componentType: 'West Head', componentGroup: 'WESTHEAD' })),
  ];

  // Insert shell + head readings
  for (const reading of allReadings) {
    await db.insert(tmlReadings).values({
      id: randomUUID(),
      inspectionId,
      legacyLocationId: reading.cml,
      componentType: reading.componentType,
      location: reading.location,
      componentGroup: reading.componentGroup,
      schemaVersion: 1,
      tActual: reading.actual,
      nominalThickness: reading.nominal,
      previousThickness: reading.nominal,
      currentInspectionDate: new Date('2017-06-20'),
      status: 'good',
    }).execute();
  }

  // Insert nozzle readings with multi-angle data
  for (const noz of nozzleReadings) {
    await db.insert(tmlReadings).values({
      id: randomUUID(),
      inspectionId,
      legacyLocationId: noz.cml,
      componentType: noz.size + '"',
      location: noz.location,
      componentGroup: 'NOZZLE',
      schemaVersion: 1,
      service: noz.service,
      nozzleSize: noz.size + '"',
      readingType: 'nozzle',
      tml1: noz.tml1,
      tml2: noz.tml2,
      tml3: noz.tml3,
      tml4: noz.tml4,
      tActual: noz.actual,
      nominalThickness: noz.nominal,
      previousThickness: noz.nominal,
      currentInspectionDate: new Date('2017-06-20'),
      status: 'good',
    }).execute();
  }

  console.log(`Inserted ${allReadings.length} shell/head + ${nozzleReadings.length} nozzle TML readings (${allReadings.length + nozzleReadings.length} total)`);
}

insertInspectionData().catch(console.error);
