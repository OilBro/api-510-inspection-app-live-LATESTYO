/**
 * Unit tests for Audit Trail Service
 * Verifies comprehensive audit logging for regulatory compliance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  logAuditEntry,
  logCalculationAudit,
  logDataChange,
  queryAuditLog,
  getEntityAuditHistory,
  verifyChecksum,
  exportAuditLog,
  generateInspectionAuditReport,
  _clearAuditLogForTesting
} from './auditTrailService';

describe('Audit Trail Service', () => {
  beforeEach(() => {
    // Clear audit log before each test
    process.env.NODE_ENV = 'test';
    _clearAuditLogForTesting();
  });

  describe('logAuditEntry', () => {
    it('should create audit entry with all required fields', () => {
      const entry = logAuditEntry(
        'CREATE',
        'inspection',
        'INS-001',
        'user-123',
        'John Inspector'
      );
      
      expect(entry.id).toMatch(/^AUD-/);
      expect(entry.timestamp).toBeDefined();
      expect(entry.action).toBe('CREATE');
      expect(entry.entityType).toBe('inspection');
      expect(entry.entityId).toBe('INS-001');
      expect(entry.userId).toBe('user-123');
      expect(entry.userName).toBe('John Inspector');
      expect(entry.checksum).toBeDefined();
    });

    it('should include optional metadata', () => {
      const entry = logAuditEntry(
        'UPDATE',
        'tml_reading',
        'TML-001',
        'user-123',
        'John Inspector',
        {
          previousValues: { thickness: 0.500 },
          newValues: { thickness: 0.485 },
          codeReferences: ['API 510 §7.1.1'],
          metadata: { inspectionId: 'INS-001' }
        }
      );
      
      expect(entry.previousValues).toEqual({ thickness: 0.500 });
      expect(entry.newValues).toEqual({ thickness: 0.485 });
      expect(entry.codeReferences).toContain('API 510 §7.1.1');
      expect(entry.metadata?.inspectionId).toBe('INS-001');
    });
  });

  describe('logCalculationAudit', () => {
    it('should log calculation with full traceability', () => {
      const entry = logCalculationAudit(
        'calculation',
        'CALC-001',
        'user-123',
        'John Inspector',
        {
          calculationType: 'shell_thickness',
          inputs: { P: 150, S: 20000, E: 1.0, D: 48 },
          outputs: { t_min: 0.180, MAWP: 833.33 },
          intermediateValues: { R: 24, denom_circ: 19910 },
          codeReferences: ['UG-27(c)(1)', 'UG-27(c)(2)'],
          formulas: ['t = PR / (SE - 0.6P)', 'P = SEt / (R + 0.6t)'],
          materialLookup: {
            materialSpec: 'SA-516 Gr 70',
            temperature: 100,
            stress: 20000,
            source: 'database',
            databaseVersion: 'ASME-BPVC-2023'
          }
        }
      );
      
      expect(entry.action).toBe('CALCULATE');
      expect(entry.calculationInputs).toEqual({ P: 150, S: 20000, E: 1.0, D: 48 });
      expect(entry.calculationOutputs).toEqual({ t_min: 0.180, MAWP: 833.33 });
      expect(entry.codeReferences).toContain('UG-27(c)(1)');
      expect(entry.metadata?.calculationType).toBe('shell_thickness');
      expect(entry.metadata?.materialLookup).toBeDefined();
    });
  });

  describe('logDataChange', () => {
    it('should log CREATE action with new values', () => {
      const entry = logDataChange(
        'CREATE',
        'inspection',
        'INS-001',
        'user-123',
        'John Inspector',
        null,
        { vesselId: 'V-001', inspectionDate: '2026-01-28' }
      );
      
      expect(entry.action).toBe('CREATE');
      expect(entry.previousValues).toBeUndefined();
      expect(entry.newValues).toEqual({ vesselId: 'V-001', inspectionDate: '2026-01-28' });
    });

    it('should log UPDATE action with before/after values', () => {
      const entry = logDataChange(
        'UPDATE',
        'tml_reading',
        'TML-001',
        'user-123',
        'John Inspector',
        { thickness: 0.500 },
        { thickness: 0.485 }
      );
      
      expect(entry.action).toBe('UPDATE');
      expect(entry.previousValues).toEqual({ thickness: 0.500 });
      expect(entry.newValues).toEqual({ thickness: 0.485 });
    });

    it('should log DELETE action with previous values', () => {
      const entry = logDataChange(
        'DELETE',
        'finding',
        'FND-001',
        'user-123',
        'John Inspector',
        { description: 'Corrosion found', severity: 'medium' },
        null
      );
      
      expect(entry.action).toBe('DELETE');
      expect(entry.previousValues).toEqual({ description: 'Corrosion found', severity: 'medium' });
      expect(entry.newValues).toBeUndefined();
    });
  });

  describe('verifyChecksum', () => {
    it('should verify valid checksum', () => {
      const entry = logAuditEntry(
        'CREATE',
        'inspection',
        'INS-001',
        'user-123',
        'John Inspector'
      );
      
      expect(verifyChecksum(entry)).toBe(true);
    });

    it('should detect tampered entry', () => {
      const entry = logAuditEntry(
        'CREATE',
        'inspection',
        'INS-001',
        'user-123',
        'John Inspector'
      );
      
      // Tamper with the entry
      entry.userId = 'tampered-user';
      
      expect(verifyChecksum(entry)).toBe(false);
    });
  });

  describe('queryAuditLog', () => {
    beforeEach(() => {
      // Create test entries
      logAuditEntry('CREATE', 'inspection', 'INS-001', 'user-1', 'User One');
      logAuditEntry('UPDATE', 'inspection', 'INS-001', 'user-2', 'User Two');
      logAuditEntry('CREATE', 'tml_reading', 'TML-001', 'user-1', 'User One');
      logCalculationAudit('calculation', 'CALC-001', 'user-1', 'User One', {
        calculationType: 'shell_thickness',
        inputs: {},
        outputs: {},
        codeReferences: [],
        formulas: []
      });
    });

    it('should filter by entity type', () => {
      const results = queryAuditLog({ entityType: 'inspection' });
      expect(results).toHaveLength(2);
      expect(results.every(e => e.entityType === 'inspection')).toBe(true);
    });

    it('should filter by entity ID', () => {
      const results = queryAuditLog({ entityId: 'INS-001' });
      expect(results).toHaveLength(2);
    });

    it('should filter by action', () => {
      const results = queryAuditLog({ action: 'CREATE' });
      expect(results).toHaveLength(2);
    });

    it('should filter by user ID', () => {
      const results = queryAuditLog({ userId: 'user-1' });
      expect(results).toHaveLength(3);
    });

    it('should apply pagination', () => {
      const results = queryAuditLog({ limit: 2, offset: 0 });
      expect(results).toHaveLength(2);
    });
  });

  describe('getEntityAuditHistory', () => {
    it('should return all audit entries for an entity', () => {
      logAuditEntry('CREATE', 'inspection', 'INS-001', 'user-1', 'User One');
      logAuditEntry('UPDATE', 'inspection', 'INS-001', 'user-1', 'User One');
      logAuditEntry('UPDATE', 'inspection', 'INS-001', 'user-2', 'User Two');
      
      const history = getEntityAuditHistory('inspection', 'INS-001');
      expect(history).toHaveLength(3);
    });
  });

  describe('exportAuditLog', () => {
    it('should export all entries with integrity verification', () => {
      logAuditEntry('CREATE', 'inspection', 'INS-001', 'user-1', 'User One');
      logAuditEntry('UPDATE', 'inspection', 'INS-001', 'user-2', 'User Two');
      
      const exported = exportAuditLog();
      
      expect(exported.exportDate).toBeDefined();
      expect(exported.totalEntries).toBe(2);
      expect(exported.entries).toHaveLength(2);
      expect(exported.integrityVerified).toBe(true);
    });
  });

  describe('generateInspectionAuditReport', () => {
    it('should generate markdown report for inspection', () => {
      logAuditEntry('CREATE', 'inspection', 'INS-001', 'user-1', 'User One');
      logCalculationAudit('inspection', 'INS-001', 'user-1', 'User One', {
        calculationType: 'shell_thickness',
        inputs: { P: 150, S: 20000 },
        outputs: { t_min: 0.180 },
        codeReferences: ['UG-27(c)(1)'],
        formulas: ['t = PR / (SE - 0.6P)']
      });
      
      const report = generateInspectionAuditReport('INS-001');
      
      expect(report).toContain('# Inspection Audit Report');
      expect(report).toContain('INS-001');
      expect(report).toContain('shell_thickness');
      expect(report).toContain('UG-27(c)(1)');
    });
  });
});
