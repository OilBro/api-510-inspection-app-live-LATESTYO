/**
 * U-1 Nozzle Data Parser
 * 
 * Extracts nozzle schedule data from U-1 forms (ASME Data Reports)
 * using the LLM vision API. Focuses specifically on:
 * - Nozzle designations (N1, N2, MW, etc.)
 * - Pipe size (NPS)
 * - Material specification (SA-106 Gr B, SA-105, etc.)
 * - Nominal wall thickness
 * - Schedule (STD, 40, 80, XS, etc.)
 * - Service/description (Inlet, Outlet, Manway, Drain, Vent, Relief)
 */

import { invokeLLM } from './_core/llm';
import { logger } from './_core/logger';
import { storagePut } from './storage';

export interface U1NozzleData {
    nozzleNumber: string;     // e.g., "N1", "N2", "MW-1"
    size: string;             // e.g., "2", "4", "24"
    material: string;         // e.g., "SA-106 Gr B", "SA-105"
    nominalThickness: number; // Wall thickness in inches
    schedule: string;         // e.g., "STD", "40", "80", "XS"
    service: string;          // e.g., "Inlet", "Outlet", "Manway"
    description: string;      // Full description if available
}

export interface U1ParseResult {
    nozzles: U1NozzleData[];
    rawText?: string;
    confidence: 'high' | 'medium' | 'low';
    parseMethod: 'vision' | 'fallback';
}

/**
 * Parse a U-1 form image/PDF to extract nozzle schedule data
 */
export async function parseU1ForNozzleData(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
): Promise<U1ParseResult> {
    try {
        logger.info(`[U1 Parser] Starting nozzle extraction from: ${fileName} (${mimeType})`);

        // Upload file to S3 for LLM access
        const timestamp = Date.now();
        const ext = fileName.split('.').pop() || 'pdf';
        const key = `u1-parser/${timestamp}-u1-form.${ext}`;
        const { url: fileUrl } = await storagePut(key, fileBuffer, mimeType);
        logger.info(`[U1 Parser] File uploaded to S3: ${fileUrl}`);

        const extractionPrompt = `You are an expert at reading ASME U-1 Manufacturer's Data Reports for pressure vessels.

Extract ALL nozzle/opening data from this U-1 form. The nozzle schedule is typically in a table near the end of the form.

Look for sections labeled:
- "OPENINGS" or "NOZZLES" 
- Table columns like: Purpose, No., Diameter, Type, Material, Nominal Thickness, Reinforcement Material
- May also appear as "CONNECTIONS" or "FITTINGS"

For EACH nozzle/opening found, extract:
- nozzleNumber: The designation (N1, N2, N3, MW, MH, D, V, R, etc.)
- size: Pipe diameter in inches (just the number, e.g. "2" not "2 inch")
- material: Pipe material specification (e.g., "SA-106 Gr B", "SA-105", "SA-312 TP304")
- nominalThickness: Wall thickness in inches (decimal, e.g., 0.154)
- schedule: Pipe schedule (STD, 40, 80, XS, XXS, 160, etc.)
- service: Purpose/service (Inlet, Outlet, Manway, Drain, Vent, Relief Valve, Level, Pressure, etc.)
- description: Full description text if available

ALSO check for:
- Flanged connections - note the flange rating (150#, 300#, etc.)
- Reinforcing pads - note pad material and thickness
- Weld types or attachment details

Return ONLY valid JSON, no explanations.`;

        const contentParts: any[] = [
            { type: 'text', text: extractionPrompt }
        ];

        // For PDFs use file_url, for images use image_url
        if (mimeType.includes('pdf')) {
            contentParts.push({
                type: 'file_url',
                file_url: {
                    url: fileUrl,
                    mime_type: 'application/pdf' as const
                }
            });
        } else {
            contentParts.push({
                type: 'image_url',
                image_url: {
                    url: fileUrl,
                    detail: 'high'
                }
            });
        }

        const response = await invokeLLM({
            messages: [
                {
                    role: 'user',
                    content: contentParts
                }
            ],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'u1_nozzle_data',
                    schema: {
                        type: 'object',
                        properties: {
                            nozzles: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        nozzleNumber: { type: 'string' },
                                        size: { type: 'string' },
                                        material: { type: 'string' },
                                        nominalThickness: { type: 'number' },
                                        schedule: { type: 'string' },
                                        service: { type: 'string' },
                                        description: { type: 'string' }
                                    },
                                    required: ['nozzleNumber', 'size'],
                                    additionalProperties: false
                                }
                            },
                            parseConfidence: {
                                type: 'string',
                                enum: ['high', 'medium', 'low']
                            }
                        },
                        required: ['nozzles', 'parseConfidence'],
                        additionalProperties: false
                    }
                }
            }
        });

        if (!response?.choices?.[0]?.message?.content) {
            logger.error('[U1 Parser] Empty LLM response');
            return { nozzles: [], confidence: 'low', parseMethod: 'vision' };
        }

        const content = response.choices[0].message.content;
        let cleanedContent = typeof content === 'string' ? content.trim() : '';

        // Strip markdown code blocks
        if (cleanedContent.startsWith('```json')) cleanedContent = cleanedContent.slice(7);
        else if (cleanedContent.startsWith('```')) cleanedContent = cleanedContent.slice(3);
        if (cleanedContent.endsWith('```')) cleanedContent = cleanedContent.slice(0, -3);
        cleanedContent = cleanedContent.trim();

        const parsed = JSON.parse(cleanedContent);
        const nozzles: U1NozzleData[] = (parsed.nozzles || []).map((n: any) => ({
            nozzleNumber: n.nozzleNumber || '',
            size: n.size || '',
            material: n.material || '',
            nominalThickness: parseFloat(n.nominalThickness) || 0,
            schedule: n.schedule || 'STD',
            service: n.service || '',
            description: n.description || ''
        }));

        logger.info(`[U1 Parser] Extracted ${nozzles.length} nozzles from U-1 form`);
        nozzles.forEach((n, i) => {
            logger.info(`[U1 Parser]   #${i}: ${n.nozzleNumber} size=${n.size}" mat=${n.material} sch=${n.schedule} nomThick=${n.nominalThickness} svc=${n.service}`);
        });

        return {
            nozzles,
            confidence: parsed.parseConfidence || 'medium',
            parseMethod: 'vision'
        };

    } catch (error: any) {
        logger.error(`[U1 Parser] Error parsing U-1 form: ${error.message}`);
        return { nozzles: [], confidence: 'low', parseMethod: 'vision' };
    }
}
