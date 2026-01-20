const PDF_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/87887481/rVKzyJmdGWjiCiYJ.pdf';
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('Starting PDF extraction for vessel 54-11-001...');
  console.log('PDF URL:', PDF_URL);
  
  // Make direct HTTP request to the extraction endpoint
  const extractResponse = await fetch(`${BASE_URL}/api/trpc/pdfImport.extractFromPDF`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      json: {
        pdfUrl: PDF_URL,
        fileName: '54-11-001-Trimethylamine.pdf'
      }
    })
  });
  
  if (!extractResponse.ok) {
    const errorText = await extractResponse.text();
    console.error('Extraction failed:', extractResponse.status, errorText);
    process.exit(1);
  }
  
  const extractResult = await extractResponse.json();
  console.log('Extraction response received');
  
  if (extractResult.result?.data?.json) {
    const data = extractResult.result.data.json;
    console.log('Extraction successful:', data.success);
    
    if (data.data) {
      console.log('Vessel:', data.data.vesselData?.vesselTagNumber);
      console.log('TML Readings:', data.data.thicknessMeasurements?.length || 0);
      console.log('Recommendations:', data.data.recommendations ? 'YES (' + data.data.recommendations.length + ' chars)' : 'NO');
      console.log('Inspection Results:', data.data.inspectionResults ? 'YES (' + data.data.inspectionResults.length + ' chars)' : 'NO');
      
      // Save the extracted data
      console.log('\nSaving extracted data...');
      const saveResponse = await fetch(`${BASE_URL}/api/trpc/pdfImport.saveExtractedData`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: data.data
        })
      });
      
      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        console.error('Save failed:', saveResponse.status, errorText);
        process.exit(1);
      }
      
      const saveResult = await saveResponse.json();
      console.log('Save result:', saveResult.result?.data?.json);
    }
  } else {
    console.log('Unexpected response format:', JSON.stringify(extractResult, null, 2).substring(0, 1000));
  }
}

main().catch(console.error);
