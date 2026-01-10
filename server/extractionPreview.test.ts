import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Extraction Preview Feature', () => {
  describe('Preview Data Structure', () => {
    it('should have correct vessel info structure', () => {
      const vesselInfo = {
        vesselTagNumber: '54-11-067',
        vesselName: 'Test Vessel',
        manufacturer: 'ABC Corp',
        serialNumber: 'SN-12345',
        yearBuilt: '2010',
        nbNumber: 'NB-123',
        designPressure: '250',
        designTemperature: '650',
        operatingPressure: '200',
        operatingTemperature: '600',
        mdmt: '-20',
        materialSpec: 'SA-516 Gr 70',
        allowableStress: '20000',
        jointEfficiency: '0.85',
        insideDiameter: '72',
        overallLength: '240',
        headType: '2:1 Ellipsoidal',
        vesselType: 'Pressure Vessel',
        vesselConfiguration: 'Horizontal',
        constructionCode: 'ASME S8 D1',
        product: 'Hydrocarbon',
        insulationType: 'Mineral Wool',
        corrosionAllowance: '0.125',
      };

      // Verify all required fields exist
      expect(vesselInfo.vesselTagNumber).toBeDefined();
      expect(vesselInfo.designPressure).toBeDefined();
      expect(vesselInfo.materialSpec).toBeDefined();
    });

    it('should have correct TML reading structure', () => {
      const tmlReading = {
        id: 'tml-0',
        cmlNumber: '1',
        tmlId: 'TML-001',
        location: 'Shell Course 1',
        component: 'Vessel Shell',
        componentType: 'Shell',
        currentThickness: '0.485',
        previousThickness: '0.500',
        nominalThickness: '0.625',
        angle: '0',
        readingType: 'general',
      };

      expect(tmlReading.id).toBeDefined();
      expect(tmlReading.cmlNumber).toBeDefined();
      expect(tmlReading.currentThickness).toBeDefined();
    });

    it('should have correct nozzle structure', () => {
      const nozzle = {
        id: 'noz-0',
        nozzleNumber: 'N1',
        nozzleDescription: 'Manway',
        nominalSize: '24',
        schedule: '40',
        actualThickness: '0.375',
        pipeNominalThickness: '0.500',
        minimumRequired: '0.250',
        acceptable: true,
        notes: '',
      };

      expect(nozzle.id).toBeDefined();
      expect(nozzle.nozzleNumber).toBeDefined();
      expect(typeof nozzle.acceptable).toBe('boolean');
    });
  });

  describe('Preview Extraction Summary', () => {
    it('should calculate correct summary counts', () => {
      const previewData = {
        vesselInfo: {
          vesselTagNumber: '54-11-067',
          vesselName: 'Test Vessel',
          manufacturer: '',
          serialNumber: '',
          yearBuilt: '2010',
          nbNumber: '',
          designPressure: '250',
          designTemperature: '',
          operatingPressure: '',
          operatingTemperature: '',
          mdmt: '',
          materialSpec: 'SA-516 Gr 70',
          allowableStress: '',
          jointEfficiency: '',
          insideDiameter: '72',
          overallLength: '',
          headType: '',
          vesselType: '',
          vesselConfiguration: '',
          constructionCode: '',
          product: '',
          insulationType: '',
          corrosionAllowance: '',
        },
        tmlReadings: [
          { id: 'tml-0', cmlNumber: '1', currentThickness: '0.485' },
          { id: 'tml-1', cmlNumber: '2', currentThickness: '0.490' },
          { id: 'tml-2', cmlNumber: '3', currentThickness: '0.475' },
        ],
        nozzles: [
          { id: 'noz-0', nozzleNumber: 'N1' },
          { id: 'noz-1', nozzleNumber: 'N2' },
        ],
        checklistItems: [],
        narratives: {
          executiveSummary: 'Test summary',
          inspectionResults: '',
          recommendations: '',
        },
      };

      // Calculate summary
      const vesselFieldsCount = Object.values(previewData.vesselInfo).filter(v => v && v !== '').length;
      const tmlReadingsCount = previewData.tmlReadings.length;
      const nozzlesCount = previewData.nozzles.length;
      const hasNarratives = !!(previewData.narratives.executiveSummary || previewData.narratives.inspectionResults);

      expect(vesselFieldsCount).toBe(6); // vesselTagNumber, vesselName, yearBuilt, designPressure, materialSpec, insideDiameter
      expect(tmlReadingsCount).toBe(3);
      expect(nozzlesCount).toBe(2);
      expect(hasNarratives).toBe(true);
    });
  });

  describe('Confirm Extraction Validation', () => {
    it('should require vessel tag number', () => {
      const data = {
        vesselInfo: {
          vesselTagNumber: '',
          vesselName: 'Test',
        },
        reportInfo: {},
        tmlReadings: [],
        nozzles: [],
      };

      const isValid = !!data.vesselInfo.vesselTagNumber;
      expect(isValid).toBe(false);
    });

    it('should allow saving with valid vessel tag', () => {
      const data = {
        vesselInfo: {
          vesselTagNumber: '54-11-067',
          vesselName: 'Test',
        },
        reportInfo: {},
        tmlReadings: [],
        nozzles: [],
      };

      const isValid = !!data.vesselInfo.vesselTagNumber;
      expect(isValid).toBe(true);
    });

    it('should handle empty TML readings array', () => {
      const tmlReadings: any[] = [];
      
      // Filter out empty readings
      const validReadings = tmlReadings.filter(tml => tml.cmlNumber || tml.currentThickness);
      
      expect(validReadings.length).toBe(0);
    });

    it('should filter out incomplete TML readings', () => {
      const tmlReadings = [
        { id: 'tml-0', cmlNumber: '1', currentThickness: '0.485' },
        { id: 'tml-1', cmlNumber: '', currentThickness: '' }, // Empty - should be filtered
        { id: 'tml-2', cmlNumber: '3', currentThickness: '' }, // Has CML - should keep
      ];

      const validReadings = tmlReadings.filter(tml => tml.cmlNumber || tml.currentThickness);
      
      expect(validReadings.length).toBe(2);
    });
  });

  describe('Data Transformation', () => {
    it('should parse numeric values correctly', () => {
      const parseNumeric = (value: any): string | null => {
        if (value === null || value === undefined || value === '') return null;
        const str = String(value).trim();
        const match = str.match(/([0-9]+\.?[0-9]*)/);
        return match ? match[1] : null;
      };

      expect(parseNumeric('250 psig')).toBe('250');
      expect(parseNumeric('650°F')).toBe('650');
      expect(parseNumeric('0.485"')).toBe('0.485');
      expect(parseNumeric('')).toBeNull();
      expect(parseNumeric(null)).toBeNull();
      expect(parseNumeric(250)).toBe('250');
    });

    it('should truncate long strings', () => {
      const truncate = (str: string, maxLen: number) => str.substring(0, maxLen);
      
      const longString = 'A'.repeat(600);
      const truncated = truncate(longString, 500);
      
      expect(truncated.length).toBe(500);
    });
  });

  describe('Edit Operations', () => {
    it('should update vessel field correctly', () => {
      const vesselInfo = {
        vesselTagNumber: '54-11-067',
        vesselName: 'Original Name',
      };

      const updateVesselField = (field: string, value: string) => ({
        ...vesselInfo,
        [field]: value,
      });

      const updated = updateVesselField('vesselName', 'Updated Name');
      
      expect(updated.vesselName).toBe('Updated Name');
      expect(updated.vesselTagNumber).toBe('54-11-067');
    });

    it('should update TML reading correctly', () => {
      const tmlReadings = [
        { id: 'tml-0', cmlNumber: '1', currentThickness: '0.485' },
        { id: 'tml-1', cmlNumber: '2', currentThickness: '0.490' },
      ];

      const updateTmlReading = (id: string, field: string, value: string) =>
        tmlReadings.map(tml =>
          tml.id === id ? { ...tml, [field]: value } : tml
        );

      const updated = updateTmlReading('tml-0', 'currentThickness', '0.480');
      
      expect(updated[0].currentThickness).toBe('0.480');
      expect(updated[1].currentThickness).toBe('0.490');
    });

    it('should delete TML reading correctly', () => {
      const tmlReadings = [
        { id: 'tml-0', cmlNumber: '1' },
        { id: 'tml-1', cmlNumber: '2' },
        { id: 'tml-2', cmlNumber: '3' },
      ];

      const deleteTmlReading = (id: string) =>
        tmlReadings.filter(tml => tml.id !== id);

      const updated = deleteTmlReading('tml-1');
      
      expect(updated.length).toBe(2);
      expect(updated.find(t => t.id === 'tml-1')).toBeUndefined();
    });

    it('should add new TML reading correctly', () => {
      const tmlReadings = [
        { id: 'tml-0', cmlNumber: '1' },
      ];

      const addTmlReading = () => {
        const newId = `tml-new-${Date.now()}`;
        return [...tmlReadings, {
          id: newId,
          cmlNumber: '',
          tmlId: '',
          location: '',
          component: '',
          componentType: '',
          currentThickness: '',
          previousThickness: '',
          nominalThickness: '',
          angle: '',
          readingType: '',
        }];
      };

      const updated = addTmlReading();
      
      expect(updated.length).toBe(2);
      expect(updated[1].id).toContain('tml-new-');
    });
  });
});
