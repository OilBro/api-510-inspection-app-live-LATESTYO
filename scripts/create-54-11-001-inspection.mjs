// Script to create inspection for vessel 54-11-001 from user's spreadsheet data
import { createClient } from '@libsql/client';
import { nanoid } from 'nanoid';

const db = createClient({
  url: process.env.DATABASE_URL,
});

async function createInspection() {
  const inspectionId = nanoid();
  const reportId = nanoid();
  const now = Date.now();
  const inspectionDate = new Date('2017-06-20').getTime();
  
  console.log('Creating inspection with ID:', inspectionId);
  console.log('Creating report with ID:', reportId);

  // 1. Create the inspection record
  await db.execute({
    sql: `INSERT INTO inspections (
      id, vesselTagNumber, vesselName, manufacturer, serialNumber, yearBuilt,
      inspectionDate, designPressure, designTemperature, operatingPressure,
      materialSpec, allowableStress, jointEfficiency, radiographyType,
      specificGravity, vesselType, insideDiameter, overallLength,
      createdAt, updatedAt, userId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      inspectionId,
      '54-11-001',
      'Triethylamine Storage Tank',
      'Riley Beard Inc.',
      '1408365-01-A',
      1977,
      inspectionDate,
      280,
      125,
      170,
      'SA-612',
      20000,
      1,
      'RT-1',
      0.68,
      'Pressure Vessel',
      130.26,
      402.5,
      now,
      now,
      'system'
    ]
  });
  console.log('✓ Inspection record created');

  // 2. Create the professional report
  await db.execute({
    sql: `INSERT INTO professionalReports (
      id, inspectionId, reportNumber, clientName, inspectorName,
      inspectionDate, createdAt, updatedAt, userId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      reportId,
      inspectionId,
      '54-11-001-2017',
      'Valero',
      'Inspector',
      inspectionDate,
      now,
      now,
      'system'
    ]
  });
  console.log('✓ Professional report created');

  // 3. Create component calculations
  const components = [
    {
      id: nanoid(),
      componentName: 'East Head',
      componentType: 'ehead',
      materialCode: 'SA-612',
      designTemperature: 125,
      designMAWP: 294,
      insideDiameter: 130.26,
      nominalThickness: 0.53,
      previousThickness: 0.514,
      actualThickness: 0.508,
      minRequiredThickness: 0.3485029,
      corrosionRate: 0.0025,
      remainingLife: 8.16,
      allowableStress: 20000,
      jointEfficiency: 1
    },
    {
      id: nanoid(),
      componentName: 'Shell',
      componentType: 'shell',
      materialCode: 'SA-612',
      designTemperature: 125,
      designMAWP: 259,
      insideDiameter: 130.26,
      nominalThickness: 0.813,
      previousThickness: 0.3826,
      actualThickness: 0.3826,
      minRequiredThickness: 0.1190038,
      corrosionRate: null,
      remainingLife: 8.16,
      allowableStress: 20000,
      jointEfficiency: 1
    },
    {
      id: nanoid(),
      componentName: 'South Head',
      componentType: 'whead',
      materialCode: 'SA-612',
      designTemperature: 125,
      designMAWP: 259,
      insideDiameter: 130.26,
      nominalThickness: 0.53,
      previousThickness: null,
      actualThickness: null,
      minRequiredThickness: null,
      corrosionRate: null,
      remainingLife: null,
      allowableStress: 20000,
      jointEfficiency: 1
    }
  ];

  for (const comp of components) {
    await db.execute({
      sql: `INSERT INTO componentCalculations (
        id, reportId, componentName, componentType, materialCode,
        designTemperature, designMAWP, insideDiameter, nominalThickness,
        previousThickness, actualThickness, minRequiredThickness,
        corrosionRate, remainingLife, allowableStress, jointEfficiency,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        comp.id,
        reportId,
        comp.componentName,
        comp.componentType,
        comp.materialCode,
        comp.designTemperature,
        comp.designMAWP,
        comp.insideDiameter,
        comp.nominalThickness,
        comp.previousThickness,
        comp.actualThickness,
        comp.minRequiredThickness,
        comp.corrosionRate,
        comp.remainingLife,
        comp.allowableStress,
        comp.jointEfficiency,
        now,
        now
      ]
    });
    console.log(`✓ Component calculation created: ${comp.componentName}`);
  }

  // 4. Create TML readings
  const tmlReadings = [
    // South Head readings (CML 1-13)
    { cml: '1', component: 'South Head', location: '1', nominal: 0.53, actual: 0.502 },
    { cml: '2', component: 'South Head', location: '2', nominal: 0.53, actual: 0.524 },
    { cml: '3', component: 'South Head', location: '3', nominal: 0.53, actual: 0.518 },
    { cml: '4', component: 'South Head', location: '4', nominal: 0.53, actual: 0.516 },
    { cml: '5', component: 'South Head', location: '5', nominal: 0.53, actual: 0.52 },
    { cml: '6', component: 'South Head', location: '6', nominal: 0.53, actual: 0.507 },
    { cml: '7', component: 'South Head', location: '90', nominal: 0.53, actual: 0.503 },
    { cml: '8', component: 'South Head', location: '90', nominal: 0.53, actual: 0.508 },
    { cml: '9', component: 'South Head', location: '135', nominal: 0.53, actual: 0.498 },
    { cml: '10', component: 'South Head', location: '180', nominal: 0.53, actual: 0.51 },
    { cml: '11', component: 'South Head', location: '225', nominal: 0.53, actual: 0.508 },
    { cml: '12', component: 'South Head', location: '270', nominal: 0.53, actual: 0.505 },
    { cml: '13', component: 'South Head', location: '315', nominal: 0.53, actual: 0.494 },
    // Shell readings (CML 14-157)
    { cml: '14', component: 'Shell', location: '0', nominal: 0.813, actual: 0.81 },
    { cml: '15', component: 'Shell', location: '45', nominal: 0.813, actual: 0.809 },
    { cml: '16', component: 'Shell', location: '90', nominal: 0.813, actual: 0.808 },
    { cml: '17', component: 'Shell', location: '135', nominal: 0.813, actual: 0.807 },
    { cml: '18', component: 'Shell', location: '180', nominal: 0.813, actual: 0.807 },
    { cml: '19', component: 'Shell', location: '225', nominal: 0.813, actual: 0.813 },
    { cml: '20', component: 'Shell', location: '270', nominal: 0.813, actual: 0.813 },
    { cml: '21', component: 'Shell', location: '315', nominal: 0.813, actual: 0.813 },
    { cml: '22', component: 'Shell', location: '0', nominal: 0.813, actual: 0.811 },
    { cml: '23', component: 'Shell', location: '45', nominal: 0.813, actual: 0.811 },
    { cml: '24', component: 'Shell', location: '90', nominal: 0.813, actual: 0.811 },
    { cml: '25', component: 'Shell', location: '135', nominal: 0.813, actual: 0.809 },
    { cml: '26', component: 'Shell', location: '180', nominal: 0.813, actual: 0.809 },
    { cml: '27', component: 'Shell', location: '225', nominal: 0.813, actual: 0.809 },
    { cml: '28', component: 'Shell', location: '270', nominal: 0.813, actual: 0.81 },
    { cml: '29', component: 'Shell', location: '315', nominal: 0.813, actual: 0.807 },
    { cml: '30', component: 'Shell', location: '0', nominal: 0.813, actual: 0.81 },
    { cml: '31', component: 'Shell', location: '90', nominal: 0.813, actual: 0.809 },
    { cml: '32', component: 'Shell', location: '135', nominal: 0.813, actual: 0.807 },
    { cml: '33', component: 'Shell', location: '180', nominal: 0.813, actual: 0.807 },
    { cml: '34', component: 'Shell', location: '225', nominal: 0.813, actual: 0.81 },
    { cml: '35', component: 'Shell', location: '315', nominal: 0.813, actual: 0.811 },
    { cml: '36', component: 'Shell', location: '0', nominal: 0.813, actual: 0.81 },
    { cml: '37', component: 'Shell', location: '45', nominal: 0.813, actual: 0.81 },
    { cml: '38', component: 'Shell', location: '90', nominal: 0.813, actual: 0.805 },
    { cml: '39', component: 'Shell', location: '135', nominal: 0.813, actual: 0.809 },
    { cml: '40', component: 'Shell', location: '180', nominal: 0.813, actual: 0.808 },
    { cml: '41', component: 'Shell', location: '225', nominal: 0.813, actual: 0.808 },
    { cml: '42', component: 'Shell', location: '270', nominal: 0.813, actual: 0.808 },
    { cml: '43', component: 'Shell', location: '0', nominal: 0.813, actual: 0.807 },
    { cml: '44', component: 'Shell', location: '45', nominal: 0.813, actual: 0.812 },
    { cml: '45', component: 'Shell', location: '90', nominal: 0.813, actual: 0.812 },
    { cml: '46', component: 'Shell', location: '135', nominal: 0.813, actual: 0.812 },
    { cml: '47', component: 'Shell', location: '180', nominal: 0.813, actual: 0.812 },
    { cml: '48', component: 'Shell', location: '225', nominal: 0.813, actual: 0.812 },
    { cml: '49', component: 'Shell', location: '270', nominal: 0.813, actual: 0.812 },
    { cml: '50', component: 'Shell', location: '315', nominal: 0.813, actual: 0.812 },
    { cml: '51', component: 'Shell', location: '0', nominal: 0.813, actual: 0.807 },
    { cml: '52', component: 'Shell', location: '90', nominal: 0.813, actual: 0.807 },
    { cml: '53', component: 'Shell', location: '135', nominal: 0.813, actual: 0.807 },
    { cml: '54', component: 'Shell', location: '180', nominal: 0.813, actual: 0.807 },
    { cml: '55', component: 'Shell', location: '225', nominal: 0.813, actual: 0.807 },
    { cml: '56', component: 'Shell', location: '270', nominal: 0.813, actual: 0.807 },
    { cml: '57', component: 'Shell', location: '315', nominal: 0.813, actual: 0.807 },
    { cml: '58', component: 'Shell', location: '180', nominal: 0.813, actual: 0.807 },
    { cml: '59', component: 'Shell', location: '270', nominal: 0.813, actual: 0.811 },
    { cml: '60', component: 'Shell', location: '210', nominal: 0.813, actual: 0.811 },
    { cml: '61', component: 'Shell', location: '0', nominal: 0.813, actual: 0.807 },
    { cml: '62', component: 'Shell', location: '45', nominal: 0.813, actual: 0.807 },
    { cml: '63', component: 'Shell', location: '90', nominal: 0.813, actual: 0.807 },
    { cml: '64', component: 'Shell', location: '135', nominal: 0.812, actual: 0.807 },
    { cml: '65', component: 'Shell', location: '180', nominal: 0.812, actual: 0.807 },
    { cml: '66', component: 'Shell', location: '225', nominal: 0.812, actual: 0.808 },
    { cml: '67', component: 'Shell', location: '270', nominal: 0.812, actual: 0.808 },
    { cml: '68', component: 'Shell', location: '315', nominal: 0.812, actual: 0.808 },
    { cml: '69', component: 'Shell', location: '0', nominal: 0.813, actual: 0.808 },
    { cml: '70', component: 'Shell', location: '45', nominal: 0.813, actual: 0.808 },
    { cml: '71', component: 'Shell', location: '90', nominal: 0.813, actual: 0.808 },
    { cml: '72', component: 'Shell', location: '135', nominal: 0.813, actual: 0.808 },
    { cml: '73', component: 'Shell', location: '180', nominal: 0.813, actual: 0.808 },
    { cml: '74', component: 'Shell', location: '225', nominal: 0.813, actual: 0.808 },
    { cml: '75', component: 'Shell', location: '270', nominal: 0.813, actual: 0.808 },
    { cml: '76', component: 'Shell', location: '0', nominal: 0.813, actual: 0.877 },
    { cml: '77', component: 'Shell', location: '45', nominal: 0.813, actual: 0.817 },
    { cml: '78', component: 'Shell', location: '90', nominal: 0.813, actual: 0.817 },
    { cml: '79', component: 'Shell', location: '135', nominal: 0.813, actual: 0.807 },
    { cml: '80', component: 'Shell', location: '180', nominal: 0.813, actual: 0.807 },
    { cml: '81', component: 'Shell', location: '225', nominal: 0.813, actual: 0.807 },
    { cml: '82', component: 'Shell', location: '270', nominal: 0.813, actual: 0.807 },
    { cml: '83', component: 'Shell', location: '315', nominal: 0.813, actual: 0.807 },
    { cml: '84', component: 'Shell', location: '0', nominal: 0.813, actual: 0.811 },
    { cml: '85', component: 'Shell', location: '45', nominal: 0.813, actual: 0.811 },
    { cml: '86', component: 'Shell', location: '90', nominal: 0.813, actual: 0.811 },
    { cml: '87', component: 'Shell', location: '135', nominal: 0.813, actual: 0.812 },
    { cml: '88', component: 'Shell', location: '180', nominal: 0.813, actual: 0.812 },
    { cml: '89', component: 'Shell', location: '225', nominal: 0.813, actual: 0.812 },
    { cml: '90', component: 'Shell', location: '270', nominal: 0.813, actual: 0.812 },
    { cml: '91', component: 'Shell', location: '315', nominal: 0.813, actual: 0.811 },
    { cml: '92', component: 'Shell', location: '0', nominal: 0.813, actual: 0.808 },
    { cml: '93', component: 'Shell', location: '45', nominal: 0.813, actual: 0.808 },
    { cml: '94', component: 'Shell', location: '90', nominal: 0.813, actual: 0.808 },
    { cml: '95', component: 'Shell', location: '135', nominal: 0.813, actual: 0.808 },
    { cml: '96', component: 'Shell', location: '0', nominal: 0.813, actual: 0.808 },
    { cml: '97', component: 'Shell', location: '45', nominal: 0.813, actual: 0.808 },
    { cml: '98', component: 'Shell', location: '90', nominal: 0.813, actual: 0.807 },
    { cml: '99', component: 'Shell', location: '135', nominal: 0.813, actual: 0.817 },
    { cml: '100', component: 'Shell', location: '180', nominal: 0.813, actual: 0.808 },
    { cml: '101', component: 'Shell', location: '225', nominal: 0.813, actual: 0.808 },
    { cml: '102', component: 'Shell', location: '270', nominal: 0.813, actual: 0.808 },
    { cml: '103', component: 'Shell', location: '315', nominal: 0.813, actual: 0.808 },
    { cml: '104', component: 'Shell', location: '0', nominal: 0.813, actual: 0.808 },
    { cml: '105', component: 'Shell', location: '45', nominal: 0.813, actual: 0.808 },
    { cml: '106', component: 'Shell', location: '90', nominal: 0.813, actual: 0.808 },
    { cml: '107', component: 'Shell', location: '135', nominal: 0.813, actual: 0.808 },
    { cml: '108', component: 'Shell', location: '180', nominal: 0.813, actual: 0.808 },
    { cml: '109', component: 'Shell', location: '270', nominal: 0.813, actual: 0.807 },
    { cml: '110', component: 'Shell', location: '0', nominal: 0.813, actual: 0.817 },
    { cml: '111', component: 'Shell', location: '45', nominal: 0.813, actual: 0.801 },
    { cml: '112', component: 'Shell', location: '90', nominal: 0.813, actual: 0.805 },
    { cml: '113', component: 'Shell', location: '135', nominal: 0.813, actual: 0.807 },
    { cml: '114', component: 'Shell', location: '180', nominal: 0.813, actual: 0.807 },
    { cml: '115', component: 'Shell', location: '270', nominal: 0.813, actual: 0.807 },
    { cml: '116', component: 'Shell', location: '315', nominal: 0.813, actual: 0.811 },
    { cml: '117', component: 'Shell', location: '0', nominal: 0.813, actual: 0.811 },
    { cml: '118', component: 'Shell', location: '45', nominal: 0.813, actual: 0.811 },
    { cml: '119', component: 'Shell', location: '90', nominal: 0.813, actual: 0.811 },
    { cml: '120', component: 'Shell', location: '135', nominal: 0.813, actual: 0.811 },
    { cml: '121', component: 'Shell', location: '180', nominal: 0.813, actual: 0.811 },
    { cml: '122', component: 'Shell', location: '225', nominal: 0.813, actual: 0.811 },
    { cml: '123', component: 'Shell', location: '270', nominal: 0.813, actual: 0.808 },
    { cml: '124', component: 'Shell', location: '315', nominal: 0.813, actual: 0.808 },
    { cml: '125', component: 'Shell', location: '0', nominal: 0.813, actual: 0.808 },
    { cml: '126', component: 'Shell', location: '45', nominal: 0.813, actual: 0.808 },
    { cml: '127', component: 'Shell', location: '90', nominal: 0.813, actual: 0.808 },
    { cml: '128', component: 'Shell', location: '135', nominal: 0.813, actual: 0.808 },
    { cml: '129', component: 'Shell', location: '180', nominal: 0.813, actual: 0.808 },
    { cml: '130', component: 'Shell', location: '270', nominal: 0.813, actual: 0.81 },
    { cml: '131', component: 'Shell', location: '315', nominal: 0.813, actual: 0.81 },
    { cml: '132', component: 'Shell', location: '0', nominal: 0.813, actual: 0.81 },
    { cml: '133', component: 'Shell', location: '45', nominal: 0.813, actual: 0.808 },
    { cml: '134', component: 'Shell', location: '90', nominal: 0.813, actual: 0.808 },
    { cml: '135', component: 'Shell', location: '180', nominal: 0.813, actual: 0.808 },
    { cml: '136', component: 'Shell', location: '225', nominal: 0.813, actual: 0.808 },
    { cml: '137', component: 'Shell', location: '270', nominal: 0.813, actual: 0.808 },
    { cml: '138', component: 'Shell', location: '315', nominal: 0.813, actual: 0.808 },
    { cml: '139', component: 'Shell', location: '0', nominal: 0.813, actual: 0.813 },
    { cml: '140', component: 'Shell', location: '270', nominal: 0.813, actual: 0.813 },
    { cml: '141', component: 'Shell', location: '180', nominal: 0.813, actual: 0.813 },
    { cml: '142', component: 'Shell', location: '270', nominal: 0.813, actual: 0.807 },
    { cml: '143', component: 'Shell', location: '45', nominal: 0.813, actual: 0.807 },
    { cml: '144', component: 'Shell', location: '90', nominal: 0.813, actual: 0.806 },
    { cml: '145', component: 'Shell', location: '135', nominal: 0.813, actual: 0.807 },
    { cml: '146', component: 'Shell', location: '180', nominal: 0.813, actual: 0.807 },
    { cml: '147', component: 'Shell', location: '270', nominal: 0.813, actual: 0.807 },
    { cml: '148', component: 'Shell', location: '0', nominal: 0.813, actual: 0.813 },
    { cml: '149', component: 'Shell', location: '45', nominal: 0.813, actual: 0.808 },
    { cml: '150', component: 'Shell', location: '90', nominal: 0.813, actual: 0.808 },
    { cml: '151', component: 'Shell', location: '135', nominal: 0.813, actual: 0.807 },
    { cml: '152', component: 'Shell', location: '180', nominal: 0.813, actual: 0.807 },
    { cml: '153', component: 'Shell', location: '225', nominal: 0.813, actual: 0.808 },
    { cml: '154', component: 'Shell', location: '270', nominal: 0.813, actual: 0.808 },
    { cml: '155', component: 'Shell', location: '315', nominal: 0.813, actual: 0.807 },
    { cml: '156', component: 'Shell', location: '135', nominal: 0.813, actual: 0.807 },
    { cml: '157', component: 'Shell', location: '315', nominal: 0.813, actual: 0.501 },
    // North Head readings (CML 158-169)
    { cml: '158', component: 'North Head', location: '45', nominal: 0.53, actual: 0.501 },
    { cml: '159', component: 'North Head', location: '90', nominal: 0.53, actual: 0.501 },
    { cml: '160', component: 'North Head', location: '135', nominal: 0.53, actual: 0.509 },
    { cml: '161', component: 'North Head', location: '180', nominal: 0.53, actual: 0.509 },
    { cml: '162', component: 'North Head', location: '225', nominal: 0.53, actual: 0.53 },
    { cml: '163', component: 'North Head', location: '270', nominal: 0.53, actual: 0.53 },
    { cml: '164', component: 'North Head', location: '315', nominal: 0.53, actual: 0.508 },
    { cml: '165', component: 'North Head', location: '27', nominal: 0.53, actual: 0.508 },
    { cml: '166', component: 'North Head', location: '90', nominal: 0.53, actual: 0.501 },
    { cml: '167', component: 'North Head', location: '25', nominal: 0.53, actual: 0.501 },
    { cml: '168', component: 'North Head', location: '90', nominal: 0.53, actual: 0.507 },
    { cml: '169', component: 'North Head', location: '81', nominal: 0.53, actual: 0.507 },
  ];

  for (const tml of tmlReadings) {
    await db.execute({
      sql: `INSERT INTO tmlReadings (
        id, inspectionId, cmlNumber, component, location,
        nominalThickness, tActual, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        nanoid(),
        inspectionId,
        tml.cml,
        tml.component,
        tml.location,
        tml.nominal,
        tml.actual,
        'good',
        now,
        now
      ]
    });
  }
  console.log(`✓ Created ${tmlReadings.length} TML readings`);

  // 5. Create nozzle evaluations
  const nozzles = [
    { id: nanoid(), nozzleId: 'N1', service: '18" Noz', size: '18', nominal: 0.44, previous: 0.395, actual: 0.377 },
    { id: nanoid(), nozzleId: 'N2', service: 'Vapor Out', size: '2', nominal: 0.88, previous: 0.535, actual: 0.104 },
    { id: nanoid(), nozzleId: 'N3', service: 'Thermowell', size: '1', nominal: 0.54, previous: 0.198, actual: 0.198 },
    { id: nanoid(), nozzleId: 'N4', service: 'Sight Gauge', size: '2', nominal: 3.84, previous: 0.198, actual: 0.198 },
    { id: nanoid(), nozzleId: 'N5', service: 'Liquid In', size: '3', nominal: 3.12, previous: 0.308, actual: 0.3 },
    { id: nanoid(), nozzleId: 'N6', service: 'Liquid Out', size: '3', nominal: 3.12, previous: 0.308, actual: 0.308 },
    { id: nanoid(), nozzleId: 'N7', service: 'Pressure Gauge', size: '1', nominal: 0.25, previous: null, actual: null },
  ];

  for (const noz of nozzles) {
    await db.execute({
      sql: `INSERT INTO nozzleEvaluations (
        id, inspectionId, nozzleId, service, nozzleSize,
        nominalThickness, previousThickness, actualThickness,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        noz.id,
        inspectionId,
        noz.nozzleId,
        noz.service,
        noz.size,
        noz.nominal,
        noz.previous,
        noz.actual,
        now,
        now
      ]
    });
  }
  console.log(`✓ Created ${nozzles.length} nozzle evaluations`);

  console.log('\n========================================');
  console.log('INSPECTION CREATED SUCCESSFULLY!');
  console.log('========================================');
  console.log('Inspection ID:', inspectionId);
  console.log('Report ID:', reportId);
  console.log('Vessel Tag: 54-11-001');
  console.log('Vessel Name: Triethylamine Storage Tank');
  console.log('TML Readings:', tmlReadings.length);
  console.log('Nozzle Evaluations:', nozzles.length);
  console.log('Component Calculations:', components.length);
  console.log('========================================');
}

createInspection().catch(console.error);
