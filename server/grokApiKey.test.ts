import { describe, it, expect } from 'vitest';
import { ENV } from './_core/env';

describe('Grok API Key Configuration', () => {
  it('should have GROK_API_KEY configured in environment', () => {
    expect(ENV.grokApiKey).toBeDefined();
    expect(ENV.grokApiKey).not.toBe('');
    expect(typeof ENV.grokApiKey).toBe('string');
    expect(ENV.grokApiKey.length).toBeGreaterThan(10);
  });

  it('should be able to make a simple API call to Grok', async () => {
    // Skip if API key is not configured
    if (!ENV.grokApiKey || ENV.grokApiKey === '') {
      console.log('Skipping Grok API test - no API key configured');
      return;
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.grokApiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-2-vision-1212',
        messages: [
          {
            role: 'user',
            content: 'Say "API key is valid" if you can read this message.'
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    expect(response.ok).toBe(true);
    
    const result = await response.json();
    expect(result).toBeDefined();
    expect(result.choices).toBeDefined();
    expect(result.choices.length).toBeGreaterThan(0);
    expect(result.choices[0].message).toBeDefined();
    expect(result.choices[0].message.content).toBeDefined();
    
    console.log('Grok API Response:', result.choices[0].message.content);
  }, 30000); // 30 second timeout for API call
});
