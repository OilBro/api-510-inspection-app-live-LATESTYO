import { describe, it, expect } from 'vitest';
import { isDocumentAiConfigured, getDocumentAiStatus } from './documentAiParser';

describe('Document AI Configuration', () => {
  it('should have Document AI environment variables configured', () => {
    const status = getDocumentAiStatus();
    
    // Check that project ID is set
    expect(status.projectId).toBeTruthy();
    expect(typeof status.projectId).toBe('string');
    expect(status.projectId!.length).toBeGreaterThan(0);
    
    // Check that processor ID is set
    expect(status.processorId).toBeTruthy();
    expect(typeof status.processorId).toBe('string');
    expect(status.processorId!.length).toBeGreaterThan(0);
    
    // Check that location is set (defaults to 'us')
    expect(status.location).toBeTruthy();
    // Location can be 'us', 'eu', or a custom value
    expect(typeof status.location).toBe('string');
    expect(status.location.length).toBeGreaterThan(0);
    
    // Check that service account key is set
    expect(status.hasServiceAccount).toBe(true);
    
    // Overall configuration check
    expect(status.configured).toBe(true);
  });

  it('isDocumentAiConfigured should return true when configured', () => {
    expect(isDocumentAiConfigured()).toBe(true);
  });
  
  it('should have valid service account JSON structure', () => {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    expect(serviceAccountKey).toBeTruthy();
    
    // Parse and validate structure
    const parsed = JSON.parse(serviceAccountKey!);
    expect(parsed.type).toBe('service_account');
    expect(parsed.private_key).toBeTruthy();
    expect(parsed.client_email).toBeTruthy();
    expect(parsed.client_email).toContain('@');
    // Private key should contain BEGIN marker (with or without spaces)
    expect(parsed.private_key).toMatch(/-----BEGIN\s*PRIVATE\s*KEY-----/);
  });
});
