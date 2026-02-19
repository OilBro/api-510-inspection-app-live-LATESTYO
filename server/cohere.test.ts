/**
 * Cohere API Integration Validation Test
 * Verifies the COHERE_API_KEY is valid and all three endpoints are accessible.
 */
import { describe, it, expect } from 'vitest';
import { CohereClient } from 'cohere-ai';

const COHERE_API_KEY = process.env.COHERE_API_KEY;

describe('Cohere API Integration', () => {
  it('should have COHERE_API_KEY configured', () => {
    expect(COHERE_API_KEY).toBeDefined();
    expect(COHERE_API_KEY!.length).toBeGreaterThan(0);
  });

  it('should successfully call Cohere Rerank endpoint', async () => {
    const cohere = new CohereClient({ token: COHERE_API_KEY! });
    
    const response = await cohere.v2.rerank({
      model: 'rerank-v3.5',
      query: 'minimum required thickness for cylindrical shell',
      documents: [
        'UG-27: Thickness of shells under internal pressure. t = PR/(SE - 0.6P)',
        'UG-32: Formed heads and sections, including ellipsoidal and torispherical.',
        'UG-34: Unstayed flat heads and covers.',
        'UG-37: Reinforcement required for openings in shells and formed heads.',
      ],
      topN: 2,
    });

    expect(response.results).toBeDefined();
    expect(response.results.length).toBe(2);
    // UG-27 should rank first for shell thickness query
    expect(response.results[0].index).toBe(0);
    console.log('[Cohere Rerank] Top result index:', response.results[0].index, 
      'relevance:', response.results[0].relevanceScore);
  }, 15000);

  it('should successfully call Cohere Embed endpoint', async () => {
    const cohere = new CohereClient({ token: COHERE_API_KEY! });
    
    const response = await cohere.v2.embed({
      model: 'embed-english-v3.0',
      texts: ['Pitting corrosion on lower shell near bottom head weld'],
      inputType: 'search_document',
      embeddingTypes: ['float'],
    });

    expect(response.embeddings).toBeDefined();
    expect(response.embeddings.float).toBeDefined();
    expect(response.embeddings.float!.length).toBe(1);
    expect(response.embeddings.float![0].length).toBe(1024); // embed-v3 dimension
    console.log('[Cohere Embed] Embedding dimension:', response.embeddings.float![0].length);
  }, 15000);

  it('should successfully call Cohere Chat endpoint (Command R+)', async () => {
    const cohere = new CohereClient({ token: COHERE_API_KEY! });
    
    const response = await cohere.v2.chat({
      model: 'command-r-plus-08-2024',
      messages: [
        {
          role: 'system',
          content: 'You are an API 510 pressure vessel inspection expert. Answer strictly per ASME/API codes.',
        },
        {
          role: 'user',
          content: 'What is the formula for minimum required thickness of a cylindrical shell per ASME VIII-1 UG-27?',
        },
      ],
    });

    expect(response.message).toBeDefined();
    const text = response.message?.content?.[0]?.type === 'text' 
      ? response.message.content[0].text 
      : '';
    expect(text.length).toBeGreaterThan(0);
    // Should mention UG-27 or the formula
    expect(text.toLowerCase()).toMatch(/ug-27|pr.*se|thickness/i);
    console.log('[Cohere Chat] Response length:', text.length, 'chars');
  }, 30000);
});
