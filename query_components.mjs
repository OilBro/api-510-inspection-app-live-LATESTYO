import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '3Jh4Vv9xqT9Bm7e.root',
  password: 'Hy5ysNHHBHIEYZj6',
  database: '3Jh4Vv9xqT9Bm7e',
  ssl: { rejectUnauthorized: true }
});

const [rows] = await connection.execute(
  'SELECT componentName, componentType, previousThickness, actualThickness, nominalThickness FROM componentCalculations LIMIT 5'
);
console.log(JSON.stringify(rows, null, 2));
await connection.end();
