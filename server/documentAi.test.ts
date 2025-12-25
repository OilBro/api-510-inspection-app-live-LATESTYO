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
    
    // Overall configuration check
    expect(status.configured).toBe(true);
  });

  it('isDocumentAiConfigured should return true when configured', () => {
    expect(isDocumentAiConfigured()).toBe(true);
  });
});
