#!/usr/bin/env node
/**
 * Script to check TML readings for an inspection
 */

import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'gateway01.us-west-2.prod.aws.tidbcloud.com',
    port: parseInt(process.env.DB_PORT || '4000'),
    user: process.env.DB_USER || '4FYhYLbBR8Rrq2S.root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'api_510_inspection_app_live',
    ssl: { rejectUnauthorized: true }
  });

  const inspectionId = '31Szaxnol2E9ueSa-k4Tm';

  // Get all TML readings
  const [readings] = await connection.query(`
    SELECT cmlNumber, component, componentType, location, service, nozzleSize, currentThickness
    FROM tmlReadings 
    WHERE inspectionId = ?
    ORDER BY cmlNumber
  `, [inspectionId]);

  console.log('TML Readings for inspection:', inspectionId);
  console.log('Total readings:', readings.length);
  console.log('\\nReadings:');
  readings.forEach(r => {
    console.log(`  CML ${r.cmlNumber}: ${r.component} | ${r.componentType} | ${r.location} | ${r.service || '-'} | ${r.nozzleSize || '-'} | ${r.currentThickness}`);
  });

  // Get component calculations
  const [calcs] = await connection.query(`
    SELECT cc.componentName, cc.componentType, cc.actualThickness, cc.minimumThickness
    FROM componentCalculations cc
    JOIN professionalReports pr ON cc.reportId = pr.id
    WHERE pr.inspectionId = ?
  `, [inspectionId]);

  console.log('\\nComponent Calculations:');
  calcs.forEach(c => {
    console.log(`  ${c.componentName}: ${c.componentType} | actual: ${c.actualThickness} | min: ${c.minimumThickness}`);
  });

  await connection.end();
}

main().catch(console.error);
