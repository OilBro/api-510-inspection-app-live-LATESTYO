import { describe, it, expect } from 'vitest';
import { parseExcelFile } from './fileParser';
import * as XLSX from 'xlsx';

describe('Excel Parser - Comprehensive Template Support', () => {
  it('should parse vessel information from Field/Value format', async () => {
    // Create a mock workbook with Vessel Information sheet
    const wb = XLSX.utils.book_new();
    
    const vesselData = [
      ['Field', 'Value', 'Notes'],
      ['Vessel Tag Number', 'V-1001', 'Required'],
      ['Vessel Name', 'Test Separator', ''],
      ['Manufacturer', 'ABC Fabricators', ''],
      ['Serial Number', 'SN-12345', ''],
      ['Year Built', 2010, ''],
      ['Design Pressure (psig)', '250', ''],
      ['Design Temperature (°F)', '450', ''],
      ['Operating Pressure (psig)', '200', ''],
      ['Material Specification', 'SA-516 Gr. 70', ''],
      ['Joint Efficiency', '0.85', ''],
      ['Inside Diameter (in)', '48', ''],
      ['Overall Length (in)', '120', ''],
      ['Head Type', '2:1 Elliptical', ''],
      ['NB Number', 'NB-123456', ''],
      ['Construction Code', 'ASME Section VIII Div. 1', ''],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(vesselData);
    XLSX.utils.book_append_sheet(wb, ws, 'Vessel Information');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const result = await parseExcelFile(buffer);
    
    expect(result.vesselTagNumber).toBe('V-1001');
    expect(result.vesselName).toBe('Test Separator');
    expect(result.manufacturer).toBe('ABC Fabricators');
    expect(result.serialNumber).toBe('SN-12345');
    expect(result.yearBuilt).toBe(2010);
    expect(result.designPressure).toBe('250');
    expect(result.designTemperature).toBe('450');
    expect(result.materialSpec).toBe('SA-516 Gr. 70');
    expect(result.jointEfficiency).toBe('0.85');
    expect(result.insideDiameter).toBe('48');
    expect(result.headType).toBe('2:1 Elliptical');
    expect(result.nbNumber).toBe('NB-123456');
  });

  it('should parse TML readings with multi-angle measurements', async () => {
    const wb = XLSX.utils.book_new();
    
    const tmlData = [
      ['CML Number', 'TML ID', 'Location', 'Component Type', 'TML 1 (in)', 'TML 2 (in)', 'TML 3 (in)', 'TML 4 (in)', 'T Actual (in)', 'Nominal Thickness (in)', 'Previous Thickness (in)', 'Corrosion Rate (mpy)', 'Status'],
      ['001', 'TML-001', '7-0', 'Shell', 0.485, 0.490, 0.488, 0.492, 0.485, 0.500, 0.495, 2.0, 'good'],
      ['002', 'TML-002', '7-45', 'Shell', 0.475, 0.480, 0.478, 0.482, 0.475, 0.500, 0.490, 3.0, 'monitor'],
      ['003', 'TML-003', '11B-C', 'East Head', 0.450, 0.455, 0.452, 0.458, 0.450, 0.500, 0.470, 4.0, 'critical'],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(tmlData);
    XLSX.utils.book_append_sheet(wb, ws, 'TML Readings');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const result = await parseExcelFile(buffer);
    
    expect(result.tmlReadings).toHaveLength(3);
    
    // Check first reading
    expect(result.tmlReadings![0].cmlNumber).toBe('001');
    expect(result.tmlReadings![0].tmlId).toBe('TML-001');
    expect(result.tmlReadings![0].location).toBe('7-0');
    expect(result.tmlReadings![0].component).toBe('Shell');
    expect(result.tmlReadings![0].tml1).toBe(0.485);
    expect(result.tmlReadings![0].tml2).toBe(0.490);
    expect(result.tmlReadings![0].tActual).toBe(0.485);
    expect(result.tmlReadings![0].nominalThickness).toBe(0.500);
    expect(result.tmlReadings![0].previousThickness).toBe(0.495);
    expect(result.tmlReadings![0].corrosionRate).toBe(2.0);
    expect(result.tmlReadings![0].status).toBe('good');
    
    // Check critical reading
    expect(result.tmlReadings![2].status).toBe('critical');
    expect(result.tmlReadings![2].component).toBe('East Head');
  });

  it('should parse nozzles sheet', async () => {
    const wb = XLSX.utils.book_new();
    
    const nozzleData = [
      ['Nozzle Number', 'Description', 'Location', 'Nominal Size', 'Schedule', 'Actual Thickness (in)', 'Pipe Nominal Thickness (in)', 'Minimum Required (in)', 'Acceptable', 'Notes'],
      ['N1', 'Inlet', 'Top', '6"', 'STD', 0.280, 0.280, 0.125, 'Yes', 'Good condition'],
      ['N2', 'Outlet', 'Bottom', '4"', 'XS', 0.337, 0.337, 0.100, 'Yes', ''],
      ['M1', 'Manhole', 'Side', '24"', 'STD', 0.500, 0.500, 0.250, 'Yes', 'Gasket replaced'],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(nozzleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Nozzles');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const result = await parseExcelFile(buffer);
    
    expect(result.nozzles).toHaveLength(3);
    
    expect(result.nozzles![0].nozzleNumber).toBe('N1');
    expect(result.nozzles![0].nozzleDescription).toBe('Inlet');
    expect(result.nozzles![0].nominalSize).toBe('6"');
    expect(result.nozzles![0].schedule).toBe('STD');
    expect(result.nozzles![0].actualThickness).toBe(0.280);
    expect(result.nozzles![0].acceptable).toBe(true);
    expect(result.nozzles![0].notes).toBe('Good condition');
    
    expect(result.nozzles![2].nozzleNumber).toBe('M1');
    expect(result.nozzles![2].nozzleDescription).toBe('Manhole');
  });

  it('should parse inspection details sheet', async () => {
    const wb = XLSX.utils.book_new();
    
    const detailsData = [
      ['Field', 'Value', 'Notes'],
      ['Report Number', 'RPT-2024-001', ''],
      ['Report Date', '2024-01-15', ''],
      ['Inspection Date', '2024-01-10', ''],
      ['Inspection Type', 'Internal', ''],
      ['Inspection Company', 'ABC Inspection Services', ''],
      ['Inspector Name', 'John Smith', ''],
      ['Inspector Certification', 'API-510-12345', ''],
      ['Client Name', 'XYZ Refinery', ''],
      ['Client Location', 'Houston, TX', ''],
      ['', '', ''],
      ['Executive Summary', 'Vessel is in satisfactory condition.', ''],
      ['', '', ''],
      ['Recommendations', 'Continue monitoring TML-002.', ''],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(detailsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Inspection Details');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const result = await parseExcelFile(buffer);
    
    expect(result.reportNumber).toBe('RPT-2024-001');
    expect(result.reportDate).toBe('2024-01-15');
    expect(result.inspectionDate).toBe('2024-01-10');
    expect(result.inspectionType).toBe('Internal');
    expect(result.inspectionCompany).toBe('ABC Inspection Services');
    expect(result.inspectorName).toBe('John Smith');
    expect(result.inspectorCert).toBe('API-510-12345');
    expect(result.clientName).toBe('XYZ Refinery');
    expect(result.clientLocation).toBe('Houston, TX');
    expect(result.executiveSummary).toBe('Vessel is in satisfactory condition.');
    expect(result.recommendations).toBe('Continue monitoring TML-002.');
  });

  it('should parse complete multi-sheet workbook', async () => {
    const wb = XLSX.utils.book_new();
    
    // Vessel Information sheet
    const vesselData = [
      ['Field', 'Value'],
      ['Vessel Tag Number', 'V-2001'],
      ['Manufacturer', 'Test Mfg'],
      ['Year Built', 2015],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vesselData), 'Vessel Information');
    
    // TML Readings sheet
    const tmlData = [
      ['CML Number', 'Location', 'T Actual (in)', 'Nominal Thickness (in)'],
      ['001', 'Shell-1', 0.480, 0.500],
      ['002', 'Shell-2', 0.475, 0.500],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tmlData), 'TML Readings');
    
    // Nozzles sheet
    const nozzleData = [
      ['Nozzle Number', 'Description', 'Nominal Size'],
      ['N1', 'Inlet', '4"'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(nozzleData), 'Nozzles');
    
    // Inspection Details sheet
    const detailsData = [
      ['Field', 'Value'],
      ['Report Number', 'RPT-2024-002'],
      ['Inspector Name', 'Jane Doe'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailsData), 'Inspection Details');
    
    // Instructions sheet (should be ignored)
    const instructionsData = [
      ['API 510 Inspection App - Excel Import Template'],
      ['Instructions:'],
      ['1. Fill in all data'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructionsData), 'Instructions');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const result = await parseExcelFile(buffer);
    
    // Verify all sections parsed
    expect(result.vesselTagNumber).toBe('V-2001');
    expect(result.manufacturer).toBe('Test Mfg');
    expect(result.yearBuilt).toBe(2015);
    
    expect(result.tmlReadings).toHaveLength(2);
    expect(result.tmlReadings![0].cmlNumber).toBe('001');
    
    expect(result.nozzles).toHaveLength(1);
    expect(result.nozzles![0].nozzleNumber).toBe('N1');
    
    expect(result.reportNumber).toBe('RPT-2024-002');
    expect(result.inspectorName).toBe('Jane Doe');
  });
});
