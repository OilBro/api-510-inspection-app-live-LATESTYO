/**
 * Validation Service Tests
 * 
 * Tests for the gold-standard validation service including:
 * - Inspector certification validation
 * - Report finalization validation
 * - Content hashing for signature verification
 * - Compliance determination basis generation
 */

import { describe, it, expect } from 'vitest';
import {
  validateInspectorCertification,
  validateReportForFinalization,
  hashReportContent,
  generateComplianceDeterminationBasis,
  APP_VERSION,
} from './validationService';

describe('Validation Service', () => {
  describe('validateInspectorCertification', () => {
    it('should return valid for non-expired certification', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = validateInspectorCertification({
        inspectorCertExpiry: futureDate.toISOString(),
        reportDate: new Date().toISOString(),
      });
      
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
    
    it('should return invalid for expired certification', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      
      const result = validateInspectorCertification({
        inspectorCertExpiry: pastDate.toISOString(),
        reportDate: new Date().toISOString(),
      });
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('expired');
    });
    
    it('should warn when certification expires within 30 days', () => {
      const nearFutureDate = new Date();
      nearFutureDate.setDate(nearFutureDate.getDate() + 15);
      
      const result = validateInspectorCertification({
        inspectorCertExpiry: nearFutureDate.toISOString(),
        reportDate: new Date().toISOString(),
      });
      
      expect(result.valid).toBe(true);
      expect(result.message).toContain('expires within 30 days');
    });
    
    it('should return valid when no expiry date provided', () => {
      const result = validateInspectorCertification({});
      
      expect(result.valid).toBe(true);
    });
    
    it('should use current date as report date when not provided', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = validateInspectorCertification({
        inspectorCertExpiry: futureDate.toISOString(),
      });
      
      expect(result.valid).toBe(true);
    });
  });
  
  describe('validateReportForFinalization', () => {
    it('should allow finalization when all requirements are met', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = validateReportForFinalization({
        inspectorName: 'John Smith',
        inspectorCertification: 'API-510-12345',
        inspectorCertExpiry: futureDate.toISOString(),
        reportDate: new Date().toISOString(),
        api510Compliant: true,
      });
      
      expect(result.canFinalize).toBe(true);
      expect(result.blockingIssues).toHaveLength(0);
    });
    
    it('should block finalization for expired certification', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      
      const result = validateReportForFinalization({
        inspectorName: 'John Smith',
        inspectorCertification: 'API-510-12345',
        inspectorCertExpiry: pastDate.toISOString(),
        reportDate: new Date().toISOString(),
        api510Compliant: true,
      });
      
      expect(result.canFinalize).toBe(false);
      expect(result.blockingIssues.length).toBeGreaterThan(0);
    });
    
    it('should block finalization for missing report date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = validateReportForFinalization({
        inspectorName: 'John Smith',
        inspectorCertification: 'API-510-12345',
        inspectorCertExpiry: futureDate.toISOString(),
        api510Compliant: true,
      });
      
      expect(result.canFinalize).toBe(false);
      expect(result.blockingIssues).toContain('Report date is required');
    });
    
    it('should block finalization for non-compliant report without details', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = validateReportForFinalization({
        inspectorName: 'John Smith',
        inspectorCertification: 'API-510-12345',
        inspectorCertExpiry: futureDate.toISOString(),
        reportDate: new Date().toISOString(),
        api510Compliant: false,
      });
      
      expect(result.canFinalize).toBe(false);
      expect(result.blockingIssues.some(issue => issue.toLowerCase().includes('non-compliant') || issue.includes('details'))).toBe(true);
    });
    
    it('should allow finalization for non-compliant report with details', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = validateReportForFinalization({
        inspectorName: 'John Smith',
        inspectorCertification: 'API-510-12345',
        inspectorCertExpiry: futureDate.toISOString(),
        reportDate: new Date().toISOString(),
        api510Compliant: false,
        nonComplianceDetails: 'Wall thickness below minimum required. Repair recommended.',
      });
      
      expect(result.canFinalize).toBe(true);
    });
  });
  
  describe('hashReportContent', () => {
    it('should generate consistent SHA-256 hash for same content', () => {
      const content = 'Test report content';
      const hash1 = hashReportContent(content);
      const hash2 = hashReportContent(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });
    
    it('should generate different hash for different content', () => {
      const hash1 = hashReportContent('Content A');
      const hash2 = hashReportContent('Content B');
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should handle complex JSON content', () => {
      const complexContent = JSON.stringify({
        reportId: 'test-123',
        calculations: [
          { component: 'Shell', tMin: 0.5 },
          { component: 'Head', tMin: 0.4 },
        ],
        timestamp: '2026-01-30T00:00:00Z',
      });
      
      const hash = hashReportContent(complexContent);
      expect(hash).toHaveLength(64);
    });
  });
  
  describe('generateComplianceDeterminationBasis', () => {
    it('should generate compliant basis for passing vessel', () => {
      const report = {
        api510Compliant: true,
        asmeCompliant: true,
        inspectorName: 'John Smith',
        inspectorCertification: 'API-510-12345',
      };
      
      const calculations = [
        {
          componentName: 'Shell',
          actualThickness: 0.6,
          minimumThickness: 0.5,
          calculatedMAWP: 200,
          remainingLife: 15,
        },
      ];
      
      const basis = generateComplianceDeterminationBasis(report, calculations);
      
      expect(basis).toContain('API 510');
      expect(basis).toContain('ASME');
      expect(basis).toContain('COMPLIANT');
    });
    
    it('should generate non-compliant basis for failing vessel', () => {
      const report = {
        api510Compliant: false,
        asmeCompliant: false,
        inspectorName: 'John Smith',
        inspectorCertification: 'API-510-12345',
      };
      
      const calculations = [
        {
          componentName: 'Shell',
          actualThickness: 0.4,
          minimumThickness: 0.5,
          calculatedMAWP: 150,
          remainingLife: 0,
        },
      ];
      
      const basis = generateComplianceDeterminationBasis(report, calculations);
      
      expect(basis).toContain('NON-COMPLIANT');
    });
    
    it('should include component details in basis', () => {
      const report = {
        api510Compliant: true,
        asmeCompliant: true,
      };
      
      const calculations = [
        {
          componentName: 'Shell',
          actualThickness: 0.6,
          minimumThickness: 0.5,
          calculatedMAWP: 200,
          remainingLife: 15,
        },
        {
          componentName: 'Head',
          actualThickness: 0.55,
          minimumThickness: 0.45,
          calculatedMAWP: 180,
          remainingLife: 12,
        },
      ];
      
      const basis = generateComplianceDeterminationBasis(report, calculations);
      
      expect(basis).toContain('Shell');
      expect(basis).toContain('Head');
    });
  });
  
  describe('APP_VERSION', () => {
    it('should be defined and follow semantic versioning', () => {
      expect(APP_VERSION).toBeDefined();
      expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/); // Allow suffix like -gold-standard
    });
  });
});
