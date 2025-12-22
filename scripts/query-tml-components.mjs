import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DATABASE_HOST || 'gateway01.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: true }
});

const [rows] = await conn.execute(
  "SELECT DISTINCT componentType, component FROM tmlReadings WHERE inspectionId = '31Szaxnol2E9ueSa-k4Tm'"
);

console.log('Distinct component types:');
rows.forEach(r => console.log(`  componentType: "${r.componentType}", component: "${r.component}"`));

const [allRows] = await conn.execute(
  "SELECT cmlNumber, componentType, component, location, tActual FROM tmlReadings WHERE inspectionId = '31Szaxnol2E9ueSa-k4Tm' ORDER BY cmlNumber LIMIT 50"
);

console.log('\nAll TML readings:');
allRows.forEach(r => console.log(`  CML ${r.cmlNumber}: type="${r.componentType}", comp="${r.component}", loc="${r.location}", t=${r.tActual}`));

await conn.end();
