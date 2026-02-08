import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read correlation data
const correlationDataPath = join(__dirname, '../data/cml-correlations-54-11-005.json');
const correlationData = JSON.parse(readFileSync(correlationDataPath, 'utf-8'));

console.log(`Loaded ${correlationData.length} CML correlation mappings for vessel 54-11-005`);
console.log('\nSample mappings:');
console.log(JSON.stringify(correlationData.slice(0, 3), null, 2));
console.log('\n✓ CML correlation data ready for import');
console.log('\nTo import these correlations, use the importCMLCorrelations() function in your application:');
console.log('  await importCMLCorrelations(inspectionId, correlationData);');
