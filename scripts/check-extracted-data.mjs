import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  const [rows] = await connection.execute(
    'SELECT extractedData FROM importedFiles WHERE inspectionId = ? LIMIT 1',
    ['31Szaxnol2E9ueSa-k4Tm']
  );
  
  if (rows.length > 0) {
    const extractedData = JSON.parse(rows[0].extractedData);
    console.log('=== TML Readings from PDF ===');
    if (extractedData.tmlReadings) {
      extractedData.tmlReadings.forEach((tml, i) => {
        console.log(`${i+1}. CML: ${tml.cmlNumber}, Component: ${tml.component}, Location: ${tml.location}`);
      });
    }
    console.log('\n=== Nozzles from PDF ===');
    if (extractedData.nozzles) {
      extractedData.nozzles.forEach((n, i) => {
        console.log(`${i+1}. ${n.nozzleNumber}: ${n.service || n.nozzleDescription || 'N/A'}`);
      });
    }
    console.log('\n=== Checklist from PDF ===');
    if (extractedData.inspectionChecklist) {
      extractedData.inspectionChecklist.forEach((item, i) => {
        console.log(`${i+1}. ${item.itemText}: ${item.status}`);
      });
    }
  }
  
  await connection.end();
}

main().catch(console.error);
