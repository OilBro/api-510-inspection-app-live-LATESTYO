import Database from 'better-sqlite3';

const db = new Database('./data.db');
const inspection = db.prepare('SELECT vesselTagNumber, headType, insideDiameter, designPressure, allowableStress, jointEfficiency FROM inspections WHERE vesselTagNumber = ?').get('54-11-001');
console.log(JSON.stringify(inspection, null, 2));
db.close();
