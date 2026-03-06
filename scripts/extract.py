import PyPDF2

def extract_pdf(pdf_path, output_path):
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ''
            for page in reader.pages:
                text += page.extract_text() + '\n'
                
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Done: {output_path}")
    except Exception as e:
        print(f"Error on {pdf_path}: {e}")

extract_pdf(r'E:\jerry\Dropbox\MANUS\004\54-11-004.pdf', 'extracted_text_004.log')
extract_pdf(r'E:\jerry\Dropbox\MANUS\005\54-11-005 final.pdf', 'extracted_text_005.log')
