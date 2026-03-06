const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'E:\\jerry\\Dropbox\\MANUS\\004\\api-510-inspection-app-live-LATESTYO\\local-storage\\vision-parser\\1772809008953-inspection.pdf';

const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function (data) {
    fs.writeFileSync('extracted_text.log', data.text);
    console.log('Successfully wrote text to extracted_text.log');
}).catch(function (error) {
    console.error('Error parsing PDF:', error);
});
