/**
 * Component Normalization Tests
 * 
 * Tests the component type normalization logic to ensure consistent
 * naming across different PDF extraction formats.
 */

import { describe, it, expect } from 'vitest';
import { normalizeComponent, getCalculationComponentType } from './componentNormalization';

describe('Component Normalization', () => {
  describe('Shell Detection', () => {
    it('should normalize "Vessel Shell" to standard format', () => {
      const result = normalizeComponent('Vessel Shell', 'Shell', '7-0');
      expect(result.component).toBe('Vessel Shell');
      expect(result.componentType).toBe('shell');
    });

    it('should normalize "Shell" to standard format', () => {
      const result = normalizeComponent('Shell', 'shell', '8-45');
      expect(result.component).toBe('Vessel Shell');
      expect(result.componentType).toBe('shell');
    });

    it('should detect shell from numeric location pattern', () => {
      const result = normalizeComponent('', 'Shell', '9-90');
      expect(result.component).toBe('Vessel Shell');
      expect(result.componentType).toBe('shell');
    });

    it('should normalize null component with Shell type', () => {
      const result = normalizeComponent(null, 'Shell', '10-135');
      expect(result.component).toBe('Vessel Shell');
      expect(result.componentType).toBe('shell');
    });
  });

  describe('East Head Detection', () => {
    it('should detect "East Head" explicitly', () => {
      const result = normalizeComponent('East Head', 'head', '1-C');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "E Head" variant', () => {
      const result = normalizeComponent('E Head', '', '');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "Head 1" as East Head', () => {
      const result = normalizeComponent('Head 1', 'head', '');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "North Head" as East Head', () => {
      const result = normalizeComponent('North Head', '', '');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "Top Head" as East Head for horizontal vessels', () => {
      const result = normalizeComponent('Top Head', 'Top Head', '');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect East Head from location field', () => {
      const result = normalizeComponent('Head', 'Head', 'East Head 6-0');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });

    it('should default generic head to East Head', () => {
      const result = normalizeComponent('Head', 'head', '12 o\'clock');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });
  });

  describe('West Head Detection', () => {
    it('should detect "West Head" explicitly', () => {
      const result = normalizeComponent('West Head', 'head', '118-C');
      expect(result.component).toBe('West Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "W Head" variant', () => {
      const result = normalizeComponent('W Head', '', '');
      expect(result.component).toBe('West Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "Head 2" as West Head', () => {
      const result = normalizeComponent('Head 2', 'head', '');
      expect(result.component).toBe('West Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "South Head" as West Head', () => {
      const result = normalizeComponent('South Head', '', '');
      expect(result.component).toBe('West Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "Bottom Head" as West Head', () => {
      const result = normalizeComponent('Bottom Head', 'Bottom Head', '');
      expect(result.component).toBe('West Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect "Bttm Head" as West Head', () => {
      const result = normalizeComponent('Bttm Head', 'Bttm Head', '');
      expect(result.component).toBe('West Head');
      expect(result.componentType).toBe('head');
    });

    it('should detect West Head from location field', () => {
      const result = normalizeComponent('Head', 'Head', 'West Head 118-C');
      expect(result.component).toBe('West Head');
      expect(result.componentType).toBe('head');
    });

    it('should NOT detect generic head as West Head when location says East', () => {
      const result = normalizeComponent('Head', 'Head', 'East Head');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });
  });

  describe('Nozzle Detection', () => {
    it('should detect "Nozzle" component', () => {
      const result = normalizeComponent('Nozzle', 'nozzle', 'N1');
      expect(result.component).toBe('Nozzle');
      expect(result.componentType).toBe('nozzle');
    });

    it('should detect "Manway" as nozzle', () => {
      const result = normalizeComponent('24" Manway', '', 'N1');
      expect(result.component).toBe('Nozzle');
      expect(result.componentType).toBe('nozzle');
    });

    it('should detect nozzle from N# pattern in location', () => {
      const result = normalizeComponent('', '', 'N1 Manhole');
      expect(result.component).toBe('Nozzle');
      expect(result.componentType).toBe('nozzle');
    });

    it('should detect "Relief" as nozzle', () => {
      const result = normalizeComponent('3" Relief', '', 'N2');
      expect(result.component).toBe('Nozzle');
      expect(result.componentType).toBe('nozzle');
    });
  });

  describe('PDF 54-11-067 Component Types', () => {
    // Test the exact component types from the PDF
    it('should normalize PDF East Head readings correctly', () => {
      const result = normalizeComponent('East Head', 'East Head', '1 - C');
      expect(result.component).toBe('East Head');
      expect(result.componentType).toBe('head');
    });

    it('should normalize PDF West Head readings correctly', () => {
      const result = normalizeComponent('West Head', 'West Head', '118 - C');
      expect(result.component).toBe('West Head');
      expect(result.componentType).toBe('head');
    });

    it('should normalize PDF Vessel Shell readings correctly', () => {
      const result = normalizeComponent('Vessel Shell', 'Vessel Shell', '7 - 0');
      expect(result.component).toBe('Vessel Shell');
      expect(result.componentType).toBe('shell');
    });
  });

  describe('getCalculationComponentType', () => {
    it('should return "shell" for shell components', () => {
      expect(getCalculationComponentType('Vessel Shell')).toBe('shell');
      expect(getCalculationComponentType('Shell')).toBe('shell');
      expect(getCalculationComponentType('Cylinder')).toBe('shell');
    });

    it('should return "head" for head components', () => {
      expect(getCalculationComponentType('East Head')).toBe('head');
      expect(getCalculationComponentType('West Head')).toBe('head');
      expect(getCalculationComponentType('North Head')).toBe('head');
    });

    it('should return "nozzle" for nozzle components', () => {
      expect(getCalculationComponentType('Nozzle')).toBe('nozzle');
      expect(getCalculationComponentType('24" Manway')).toBe('nozzle');
    });
  });
});
