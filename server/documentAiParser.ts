/**
 * Google Cloud Document AI Parser
 * 
 * Uses Google Cloud Document AI to extract text from PDFs with high-quality OCR,
 * then passes the extracted text to Manus AI for structured data parsing.
 * 
 * Authentication: Uses service account credentials stored in environment variable
 */

import { invokeLLM } from "./_core/llm";
import { SignJWT, importPKCS8 } from 'jose';

// Environment variables for Document AI configuration
const DOCUMENT_AI_PROJECT_ID = process.env.DOCUMENT_AI_PROJECT_ID;
const DOCUMENT_AI_LOCATION = process.env.DOCUMENT_AI_LOCATION || 'us';
const DOCUMENT_AI_PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface DocumentAiConfig {
  projectId: string;
  location: string;
  processorId: string;
}

interface DocumentAiResponse {
  document: {
    text: string;
    pages: Array<{
      pageNumber: number;
      dimension: {
        width: number;
        height: number;
        unit: string;
      };
      layout: {
        textAnchor: {
          textSegments: Array<{
            startIndex: string;
            endIndex: string;
          }>;
        };
        confidence: number;
        boundingPoly: {
          vertices: Array<{ x: number; y: number }>;
          normalizedVertices: Array<{ x: number; y: number }>;
        };
        orientation: string;
      };
      blocks: Array<{
        layout: {
          textAnchor: {
            textSegments: Array<{
              startIndex: string;
              endIndex: string;
            }>;
          };
          confidence: number;
        };
      }>;
      paragraphs: Array<{
        layout: {
          textAnchor: {
            textSegments: Array<{
              startIndex: string;
              endIndex: string;
            }>;
          };
          confidence: number;
        };
      }>;
      lines: Array<{
        layout: {
          textAnchor: {
            textSegments: Array<{
              startIndex: string;
              endIndex: string;
            }>;
          };
          confidence: number;
        };
      }>;
      tokens: Array<{
        layout: {
          textAnchor: {
            textSegments: Array<{
              startIndex: string;
              endIndex: string;
            }>;
          };
          confidence: number;
        };
        detectedBreak?: {
          type: string;
        };
      }>;
      tables: Array<{
        layout: {
          textAnchor: {
            textSegments: Array<{
              startIndex: string;
              endIndex: string;
            }>;
          };
          confidence: number;
        };
        headerRows: Array<{
          cells: Array<{
            layout: {
              textAnchor: {
                textSegments: Array<{
                  startIndex: string;
                  endIndex: string;
                }>;
              };
            };
            rowSpan: number;
            colSpan: number;
          }>;
        }>;
        bodyRows: Array<{
          cells: Array<{
            layout: {
              textAnchor: {
                textSegments: Array<{
                  startIndex: string;
                  endIndex: string;
                }>;
              };
            };
            rowSpan: number;
            colSpan: number;
          }>;
        }>;
      }>;
    }>;
    entities?: Array<{
      type: string;
      mentionText: string;
      confidence: number;
      pageAnchor?: {
        pageRefs: Array<{
          page: string;
        }>;
      };
    }>;
  };
  humanReviewStatus?: {
    state: string;
  };
}

/**
 * Generate an access token from service account credentials using JWT
 */
async function getAccessTokenFromServiceAccount(): Promise<string> {
  if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. Please provide the service account JSON key.');
  }

  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  } catch (e) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY format. Must be valid JSON.');
  }

  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Service account key missing required fields (private_key, client_email).');
  }
  
  // Normalize private key format - some keys have spaces removed from headers
  let normalizedPrivateKey = serviceAccount.private_key;
  if (normalizedPrivateKey.includes('-----BEGINPRIVATEKEY-----')) {
    normalizedPrivateKey = normalizedPrivateKey
      .replace('-----BEGINPRIVATEKEY-----', '-----BEGIN PRIVATE KEY-----')
      .replace('-----ENDPRIVATEKEY-----', '-----END PRIVATE KEY-----');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // Token valid for 1 hour

  // Create JWT for Google OAuth
  const privateKey = await importPKCS8(normalizedPrivateKey, 'RS256');
  
  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(expiry)
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .sign(privateKey);

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[DocumentAI] Token exchange failed:', errorText);
    throw new Error(`Failed to get access token: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json() as { access_token: string };
  return tokenData.access_token;
}

/**
 * Extract text from a PDF using Google Cloud Document AI
 */
export async function extractTextWithDocumentAi(
  pdfBuffer: Buffer,
  accessToken?: string,
  config?: Partial<DocumentAiConfig>
): Promise<{ text: string; pages: number; confidence: number }> {
  const projectId = config?.projectId || DOCUMENT_AI_PROJECT_ID;
  const location = config?.location || DOCUMENT_AI_LOCATION || 'us';
  const processorId = config?.processorId || DOCUMENT_AI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error('Document AI configuration missing. Please provide Project ID and Processor ID.');
  }

  // Get access token from service account if not provided
  const token = accessToken || await getAccessTokenFromServiceAccount();

  // Determine the correct endpoint based on location
  let endpoint = 'documentai.googleapis.com';
  if (location === 'us') {
    endpoint = 'us-documentai.googleapis.com';
  } else if (location === 'eu') {
    endpoint = 'eu-documentai.googleapis.com';
  }

  const url = `https://${endpoint}/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

  // Convert PDF buffer to base64
  const base64Content = pdfBuffer.toString('base64');

  const requestBody = {
    rawDocument: {
      content: base64Content,
      mimeType: 'application/pdf'
    },
    skipHumanReview: true
  };

  console.log(`[DocumentAI] Calling Document AI API at ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[DocumentAI] API error: ${response.status} - ${errorText}`);
    throw new Error(`Document AI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as DocumentAiResponse;

  // Extract the full text
  const text = result.document?.text || '';
  const pages = result.document?.pages?.length || 0;

  // Calculate average confidence across all pages
  let totalConfidence = 0;
  let confidenceCount = 0;
  if (result.document?.pages) {
    for (const page of result.document.pages) {
      if (page.layout?.confidence) {
        totalConfidence += page.layout.confidence;
        confidenceCount++;
      }
    }
  }
  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  console.log(`[DocumentAI] Extracted ${text.length} characters from ${pages} pages (confidence: ${(avgConfidence * 100).toFixed(1)}%)`);

  return {
    text,
    pages,
    confidence: avgConfidence
  };
}

/**
 * Parse extracted text using Manus AI to get structured vessel data
 */
export async function parseExtractedTextWithManusAi(extractedText: string): Promise<any> {
  const systemPrompt = `You are an expert at extracting structured data from API 510 pressure vessel inspection reports.
Given the OCR-extracted text from an inspection report, extract all relevant information into a structured JSON format.

Extract the following categories of information:

1. REPORT INFO: report number, report date, inspector name, inspector API number, inspection type, inspection method
2. CLIENT INFO: client name, contact person, address, phone, email
3. VESSEL DATA: equipment name, equipment number, NB number, serial number, manufacturer, year built, 
   design code, construction code, design pressure, MAWP, design temperature, MDMT, operating pressure,
   operating temperature, service/contents, material specification, head type, joint efficiency,
   corrosion allowance, nominal thickness, actual thickness, required thickness
4. ASME CALCULATION PARAMETERS: S value, E value, radiography type, crown radius, knuckle radius
5. EXECUTIVE SUMMARY: overall condition, fitness for service determination
6. INSPECTION RESULTS: detailed findings, observations
7. RECOMMENDATIONS: maintenance items, repairs needed, next inspection date
8. TML READINGS: thickness measurement locations with readings (location ID, description, nominal, actual, min required, corrosion rate)
9. NOZZLE EVALUATIONS: nozzle data (nozzle ID, size, rating, type, schedule, service description, condition)

Return a JSON object with these fields. Use null for missing values. For arrays (TML readings, nozzles), return empty arrays if none found.`;

  const userPrompt = `Extract structured data from this inspection report text:

${extractedText}

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '{}';
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    return JSON.parse(cleanedContent);
  } catch (error) {
    console.error('[DocumentAI] Error parsing with Manus AI:', error);
    throw new Error(`Failed to parse extracted text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Full pipeline: Extract text with Document AI, then parse with Manus AI
 */
export async function parseWithDocumentAi(
  pdfBuffer: Buffer,
  accessToken?: string,
  config?: Partial<DocumentAiConfig>
): Promise<{
  extractedText: string;
  parsedData: any;
  metadata: {
    pages: number;
    ocrConfidence: number;
    textLength: number;
  };
}> {
  // Step 1: Extract text using Document AI
  console.log('[DocumentAI] Step 1: Extracting text with Document AI...');
  const { text, pages, confidence } = await extractTextWithDocumentAi(pdfBuffer, accessToken, config);

  if (!text || text.trim().length === 0) {
    throw new Error('Document AI extracted no text from the PDF. The document may be empty or unreadable.');
  }

  // Step 2: Parse extracted text with Manus AI
  console.log('[DocumentAI] Step 2: Parsing extracted text with Manus AI...');
  const parsedData = await parseExtractedTextWithManusAi(text);

  return {
    extractedText: text,
    parsedData,
    metadata: {
      pages,
      ocrConfidence: confidence,
      textLength: text.length
    }
  };
}

/**
 * Check if Document AI is configured
 */
export function isDocumentAiConfigured(): boolean {
  return !!(DOCUMENT_AI_PROJECT_ID && DOCUMENT_AI_PROCESSOR_ID && GOOGLE_SERVICE_ACCOUNT_KEY);
}

/**
 * Get Document AI configuration status
 */
export function getDocumentAiStatus(): {
  configured: boolean;
  projectId: string | null;
  location: string;
  processorId: string | null;
  hasServiceAccount: boolean;
} {
  return {
    configured: isDocumentAiConfigured(),
    projectId: DOCUMENT_AI_PROJECT_ID || null,
    location: DOCUMENT_AI_LOCATION || 'us',
    processorId: DOCUMENT_AI_PROCESSOR_ID || null,
    hasServiceAccount: !!GOOGLE_SERVICE_ACCOUNT_KEY
  };
}
