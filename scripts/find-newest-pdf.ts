import fs from 'fs';
import path from 'path';

const dir1 = path.join(process.cwd(), 'local-storage', 'vision-parser');
const dir2 = path.join(process.cwd(), 'local-storage', 'drawings');

function findNewestPdf(dir: string) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
    if (files.length === 0) return null;

    let newest = null;
    let newestTime = 0;

    for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs > newestTime) {
            newestTime = stat.mtimeMs;
            newest = fullPath;
        }
    }
    return newest;
}

const n1 = findNewestPdf(dir1);
const n2 = findNewestPdf(dir2);

console.log('Newest in vision-parser:', n1);
console.log('Newest in drawings:', n2);
