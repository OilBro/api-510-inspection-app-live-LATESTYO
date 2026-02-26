import XLSX from 'xlsx';

const wb = XLSX.readFile('e:\\jerry\\Dropbox\\MANUS\\067\\067 TO INPUT NOW A .xlsx');

for (const name of wb.SheetNames) {
    console.log(`\n=== Sheet: ${name} ===`);
    const ws = wb.Sheets[name];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (const row of data) {
        console.log(row.join('\t'));
    }
}
