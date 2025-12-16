import { getDb } from '../server/db';
import { inspections, tmlReadings, componentCalculations, professionalReports } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

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
        staticHead: '6.0',
        specificGravity: '0.92',
        designTemperature: '200',
        operatingTemperature: '80',
        operatingPressure: '250',
        yearBuilt: '2005',
        vesselMaterial: 'SS A-304',
        headType: '2:1 Ellipsoidal',
        headMaterial: 'SS A-304',
        vesselOrientation: 'Horizontal',
        insideDiameter: '70.750',
        vesselLength: '216',
        nominalThickness: '0.625',
        headNominalThickness: '0.500',
        constructionCode: 'ASME S8 D1',
        nationalBoardNumber: '5653',
        mdmt: '-20',
        corrosionAllowance: '0.095',
        nextExternalInspection: new Date('2022-06-20'),
        nextInternalInspection: new Date('2027-06-20'),
        nextUtInspection: new Date('2027-06-20'),
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
  
  const [newInspection] = await db.insert(inspections).values({
    userId: 1, // Default user
    vesselTagNumber: '54-11-067',
    inspectionDate: new Date('2017-06-20'),
    inspectorName: 'Christopher Welch',
    clientName: 'SACHEM INC',
    facilityLocation: 'CLEBURNE TX',
    inspectionType: 'In-Service',
    mawp: '250',
    designTemperature: '200',
    operatingTemperature: '80',
    operatingPressure: '250',
    vesselMaterial: 'SS A-304',
    headType: '2:1 Ellipsoidal',
    headMaterial: 'SS A-304',
    vesselOrientation: 'Horizontal',
    insideDiameter: '70.750',
    vesselLength: '216',
    nominalThickness: '0.625',
    headNominalThickness: '0.500',
    allowableStress: '20000',
    jointEfficiency: '0.85',
    staticHead: '6.0',
    specificGravity: '0.92',
    constructionCode: 'ASME S8 D1',
    nationalBoardNumber: '5653',
    yearBuilt: '2005',
    mdmt: '-20',
    corrosionAllowance: '0.095',
    nextExternalInspection: new Date('2022-06-20'),
    nextInternalInspection: new Date('2027-06-20'),
    nextUtInspection: new Date('2027-06-20'),
    status: 'completed',
  }).returning();

  console.log('Created inspection with ID:', newInspection.id);

  // Create professional report
  const [report] = await db.insert(professionalReports).values({
    inspectionId: newInspection.id,
    reportNumber: `RPT-54-11-067-2017`,
    status: 'completed',
  }).returning();

  console.log('Created professional report with ID:', report.id);

  // Insert component calculations
  await insertComponentCalculations(db, report.id);

  // Insert TML readings
  await insertTmlReadings(db, newInspection.id);

  console.log('Data insertion complete!');
}

async function insertComponentCalculations(db: any, reportId: number) {
  // Shell calculation
  await db.insert(componentCalculations).values({
    reportId,
    componentName: 'Vessel Shell',
    componentType: 'shell',
    nominalThickness: '0.625',
    actualThickness: '0.652',
    minimumThickness: '0.530',
    previousThickness: '0.625',
    corrosionRate: '0.00000',
    remainingLife: '>20',
    calculatedMawp: '307.5',
    designMawp: '250',
    allowableStress: '20000',
    jointEfficiency: '0.85',
    insideDiameter: '70.750',
    designPressure: '252.4',
    timeSpan: '12.0',
    staticHead: '6.0',
    specificGravity: '0.92',
  }).execute();

  // East Head calculation
  await db.insert(componentCalculations).values({
    reportId,
    componentName: 'East Head',
    componentType: 'head',
    nominalThickness: '0.500',
    actualThickness: '0.555',
    minimumThickness: '0.526',
    previousThickness: '0.500',
    corrosionRate: '0.00000',
    remainingLife: '>20',
    calculatedMawp: '263.9',
    designMawp: '250',
    allowableStress: '20000',
    jointEfficiency: '0.85',
    insideDiameter: '70.750',
    designPressure: '252.4',
    timeSpan: '12.0',
    staticHead: '6.0',
    specificGravity: '0.92',
  }).execute();

  // West Head calculation
  await db.insert(componentCalculations).values({
    reportId,
    componentName: 'West Head',
    componentType: 'head',
    nominalThickness: '0.500',
    actualThickness: '0.552',
    minimumThickness: '0.526',
    previousThickness: '0.500',
    corrosionRate: '0.00000',
    remainingLife: '>20',
    calculatedMawp: '262.5',
    designMawp: '250',
    allowableStress: '20000',
    jointEfficiency: '0.85',
    insideDiameter: '70.750',
    designPressure: '252.4',
    timeSpan: '12.0',
    staticHead: '6.0',
    specificGravity: '0.92',
  }).execute();

  console.log('Inserted 3 component calculations (Shell, East Head, West Head)');
}

async function insertTmlReadings(db: any, inspectionId: number) {
  // Shell TML readings (CML 1-17 based on drawing)
  const shellReadings = [
    { cml: '1', location: 'Shell', actual: '0.660', nominal: '0.625' },
    { cml: '2', location: 'Shell', actual: '0.658', nominal: '0.625' },
    { cml: '3', location: 'Shell', actual: '0.655', nominal: '0.625' },
    { cml: '4', location: 'Shell', actual: '0.652', nominal: '0.625' },
    { cml: '5', location: 'Shell', actual: '0.654', nominal: '0.625' },
    { cml: '6', location: 'Shell', actual: '0.656', nominal: '0.625' },
    { cml: '7', location: 'Shell', actual: '0.653', nominal: '0.625' },
    { cml: '8', location: 'Shell', actual: '0.657', nominal: '0.625' },
    { cml: '9', location: 'Shell', actual: '0.659', nominal: '0.625' },
    { cml: '10', location: 'Shell', actual: '0.655', nominal: '0.625' },
    { cml: '11', location: 'Shell', actual: '0.654', nominal: '0.625' },
    { cml: '12', location: 'Shell', actual: '0.656', nominal: '0.625' },
    { cml: '13', location: 'Shell', actual: '0.658', nominal: '0.625' },
    { cml: '14', location: 'Shell', actual: '0.657', nominal: '0.625' },
    { cml: '15', location: 'Shell', actual: '0.655', nominal: '0.625' },
    { cml: '16', location: 'Shell', actual: '0.653', nominal: '0.625' },
    { cml: '17', location: 'Shell', actual: '0.652', nominal: '0.625' },
  ];

  // East Head TML readings (CML 1-5 on East Head)
  const eastHeadReadings = [
    { cml: '1', location: 'East Head', actual: '0.555', nominal: '0.500' },
    { cml: '2', location: 'East Head', actual: '0.557', nominal: '0.500' },
    { cml: '3', location: 'East Head', actual: '0.556', nominal: '0.500' },
    { cml: '4', location: 'East Head', actual: '0.558', nominal: '0.500' },
    { cml: '5', location: 'East Head', actual: '0.555', nominal: '0.500' },
  ];

  // West Head TML readings (CML 118-122 on West Head)
  const westHeadReadings = [
    { cml: '118', location: 'West Head', actual: '0.552', nominal: '0.500' },
    { cml: '119', location: 'West Head', actual: '0.554', nominal: '0.500' },
    { cml: '120', location: 'West Head', actual: '0.553', nominal: '0.500' },
    { cml: '121', location: 'West Head', actual: '0.555', nominal: '0.500' },
    { cml: '122', location: 'West Head', actual: '0.552', nominal: '0.500' },
  ];

  const allReadings = [...shellReadings, ...eastHeadReadings, ...westHeadReadings];

  for (const reading of allReadings) {
    await db.insert(tmlReadings).values({
      inspectionId,
      cmlNumber: reading.cml,
      location: reading.location,
      component: reading.location.includes('Head') ? 'Head' : 'Shell',
      componentType: reading.location.includes('Head') ? 'head' : 'shell',
      actualThickness: reading.actual,
      nominalThickness: reading.nominal,
      previousThickness: reading.nominal,
      measurementDate: new Date('2017-06-20'),
    }).execute();
  }

  console.log(`Inserted ${allReadings.length} TML readings`);
}

insertInspectionData().catch(console.error);
