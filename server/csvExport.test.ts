import { describe, it, expect } from 'vitest';
import { arrayToCSV, generateInspectionCSV } from './csvExport';

describe('CSV Export', () => {
  describe('arrayToCSV', () => {
    it('should convert array of objects to CSV format', () => {
      const data = [
        { name: 'Shell', thickness: '0.625', material: 'SSA-304' },
        { name: 'East Head', thickness: '0.500', material: 'SSA-304' },
      ];
      
      const headers = ['name', 'thickness', 'material'];
      const csv = arrayToCSV(data, headers);
      
      const lines = csv.split('\n');
      expect(lines[0]).toBe('name,thickness,material');
      expect(lines[1]).toBe('Shell,0.625,SSA-304');
      expect(lines[2]).toBe('East Head,0.500,SSA-304');
    });

    it('should handle values with commas by wrapping in quotes', () => {
      const data = [
        { name: 'Shell', notes: 'Good condition, no issues' },
      ];
      
      const headers = ['name', 'notes'];
      const csv = arrayToCSV(data, headers);
      
      const lines = csv.split('\n');
      expect(lines[1]).toBe('Shell,"Good condition, no issues"');
    });

    it('should handle null and undefined values', () => {
      const data = [
        { name: 'Shell', thickness: null, material: undefined },
      ];
      
      const headers = ['name', 'thickness', 'material'];
      const csv = arrayToCSV(data, headers);
      
      const lines = csv.split('\n');
      expect(lines[1]).toBe('Shell,,');
    });

    it('should escape quotes in values', () => {
      const data = [
        { name: 'Shell', notes: 'Inspector said "excellent"' },
      ];
      
      const headers = ['name', 'notes'];
      const csv = arrayToCSV(data, headers);
      
      const lines = csv.split('\n');
      expect(lines[1]).toBe('Shell,"Inspector said ""excellent"""');
    });

    it('should return headers only for empty array', () => {
      const data: any[] = [];
      const headers = ['name', 'thickness'];
      const csv = arrayToCSV(data, headers);
      
      expect(csv).toBe('name,thickness\n');
    });
  });

  describe('generateInspectionCSV', () => {
    it('should generate comprehensive CSV with all sections', () => {
      const mockData = {
        inspection: {
          vesselTagNumber: '54-11-067',
          vesselName: 'Test Vessel',
          manufacturer: 'ACME Corp',
          serialNumber: 'SN-12345',
          yearBuilt: '2010',
          inspectionDate: '2025-01-15',
          designPressure: '250',
          designTemperature: '200',
          operatingPressure: '225',
          materialSpec: 'SSA-304',
          allowableStress: '20000',
          jointEfficiency: '0.85',
          radiographyType: 'Full',
          specificGravity: '0.92',
          vesselType: 'Horizontal',
          insideDiameter: '70.750',
          overallLength: '240',
        },
        components: [
          {
            componentName: 'Shell',
            componentType: 'shell',
            materialCode: 'SSA-304',
            designTemp: '200',
            designMAWP: '250',
            insideDiameter: '70.750',
            nominalThickness: '0.625',
            previousThickness: '0.625',
            actualThickness: '0.652',
            minimumThickness: '0.530',
            corrosionRate: '0.00000',
            remainingLife: '>20',
            timeSpan: '12.0',
            nextInspectionYears: '10.0',
            allowableStress: '20000',
            jointEfficiency: '0.85',
            corrosionAllowance: '0.122',
            calculatedMAWP: '307.5',
            dataQualityStatus: 'Complete',
          },
        ],
        tmlReadings: [
          {
            legacyLocationId: 'CML-001',
            componentType: 'shell',
            location: 'Top',
            readingType: 'spot',
            nozzleSize: null,
            angle: '0',
            service: null,
            nominalThickness: '0.625',
            previousThickness: '0.625',
            actualThickness: '0.652',
            tml1: '0.652',
            tml2: null,
            tml3: null,
            tml4: null,
            minimumThickness: '0.530',
            corrosionRate: '0.00000',
            remainingLife: '>20',
            notes: 'Good condition',
          },
        ],
        nozzles: [],
      };

      const csv = generateInspectionCSV(mockData);

      // Check for section headers
      expect(csv).toContain('INSPECTION METADATA');
      expect(csv).toContain('COMPONENT CALCULATIONS');
      expect(csv).toContain('TML READINGS');
      expect(csv).toContain('NOZZLE EVALUATIONS');

      // Check for inspection metadata
      expect(csv).toContain('Vessel Tag,54-11-067');
      expect(csv).toContain('Vessel Name,Test Vessel');
      expect(csv).toContain('Manufacturer,ACME Corp');
      expect(csv).toContain('Design Pressure,250');

      // Check for component data
      expect(csv).toContain('componentName');
      expect(csv).toContain('Shell');
      expect(csv).toContain('0.652');
      expect(csv).toContain('307.5');

      // Check for TML readings
      expect(csv).toContain('CML-001');
      expect(csv).toContain('Good condition');
    });

    it('should handle empty components and TML readings', () => {
      const mockData = {
        inspection: {
          vesselTagNumber: '54-11-002',
          vesselName: 'Empty Vessel',
        },
        components: [],
        tmlReadings: [],
        nozzles: [],
      };

      const csv = generateInspectionCSV(mockData);

      // Should still have section headers
      expect(csv).toContain('INSPECTION METADATA');
      expect(csv).toContain('COMPONENT CALCULATIONS');
      expect(csv).toContain('TML READINGS');

      // Should have vessel tag
      expect(csv).toContain('54-11-002');
    });

    it('should properly format multi-line CSV structure', () => {
      const mockData = {
        inspection: { vesselTagNumber: 'TEST-001' },
        components: [{ componentName: 'Shell', actualThickness: '0.625' }],
        tmlReadings: [{ legacyLocationId: 'CML-001', actualThickness: '0.625' }],
        nozzles: [],
      };

      const csv = generateInspectionCSV(mockData);
      const lines = csv.split('\n');

      // Should have multiple sections separated by blank lines
      expect(lines.length).toBeGreaterThan(10);
      
      // Check for proper CSV structure (header rows followed by data rows)
      expect(csv).toMatch(/componentName.*\n.*Shell/);
      expect(csv).toMatch(/legacyLocationId.*\n.*CML-001/);
    });
  });
});
