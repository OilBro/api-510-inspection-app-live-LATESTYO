/**
 * ASME B36.10M and B36.19M Pipe Schedule Database
 * Complete pipe dimensions for nozzle calculations per UG-45
 * 
 * Reference Standards:
 * - ASME B36.10M: Welded and Seamless Wrought Steel Pipe
 * - ASME B36.19M: Stainless Steel Pipe
 * 
 * All dimensions in inches
 */

export interface PipeScheduleEntry {
  nominalSize: string;      // NPS (e.g., "1/2", "1", "2", "24")
  nominalSizeInches: number; // Numeric value
  schedule: string;         // Schedule designation (e.g., "STD", "40", "XS", "80")
  outsideDiameter: number;  // OD in inches
  wallThickness: number;    // Wall thickness in inches
  insideDiameter: number;   // ID in inches (calculated)
  weight: number;           // Weight per foot (lb/ft)
}

// ============================================================================
// PIPE SCHEDULE DATA
// ============================================================================

export const PIPE_SCHEDULE_DATABASE: PipeScheduleEntry[] = [
  // 1/2" NPS
  { nominalSize: '1/2', nominalSizeInches: 0.5, schedule: '5S', outsideDiameter: 0.840, wallThickness: 0.065, insideDiameter: 0.710, weight: 0.54 },
  { nominalSize: '1/2', nominalSizeInches: 0.5, schedule: '10S', outsideDiameter: 0.840, wallThickness: 0.083, insideDiameter: 0.674, weight: 0.67 },
  { nominalSize: '1/2', nominalSizeInches: 0.5, schedule: 'STD', outsideDiameter: 0.840, wallThickness: 0.109, insideDiameter: 0.622, weight: 0.85 },
  { nominalSize: '1/2', nominalSizeInches: 0.5, schedule: '40', outsideDiameter: 0.840, wallThickness: 0.109, insideDiameter: 0.622, weight: 0.85 },
  { nominalSize: '1/2', nominalSizeInches: 0.5, schedule: 'XS', outsideDiameter: 0.840, wallThickness: 0.147, insideDiameter: 0.546, weight: 1.09 },
  { nominalSize: '1/2', nominalSizeInches: 0.5, schedule: '80', outsideDiameter: 0.840, wallThickness: 0.147, insideDiameter: 0.546, weight: 1.09 },
  { nominalSize: '1/2', nominalSizeInches: 0.5, schedule: '160', outsideDiameter: 0.840, wallThickness: 0.188, insideDiameter: 0.464, weight: 1.31 },
  { nominalSize: '1/2', nominalSizeInches: 0.5, schedule: 'XXS', outsideDiameter: 0.840, wallThickness: 0.294, insideDiameter: 0.252, weight: 1.71 },

  // 3/4" NPS
  { nominalSize: '3/4', nominalSizeInches: 0.75, schedule: '5S', outsideDiameter: 1.050, wallThickness: 0.065, insideDiameter: 0.920, weight: 0.69 },
  { nominalSize: '3/4', nominalSizeInches: 0.75, schedule: '10S', outsideDiameter: 1.050, wallThickness: 0.083, insideDiameter: 0.884, weight: 0.86 },
  { nominalSize: '3/4', nominalSizeInches: 0.75, schedule: 'STD', outsideDiameter: 1.050, wallThickness: 0.113, insideDiameter: 0.824, weight: 1.13 },
  { nominalSize: '3/4', nominalSizeInches: 0.75, schedule: '40', outsideDiameter: 1.050, wallThickness: 0.113, insideDiameter: 0.824, weight: 1.13 },
  { nominalSize: '3/4', nominalSizeInches: 0.75, schedule: 'XS', outsideDiameter: 1.050, wallThickness: 0.154, insideDiameter: 0.742, weight: 1.47 },
  { nominalSize: '3/4', nominalSizeInches: 0.75, schedule: '80', outsideDiameter: 1.050, wallThickness: 0.154, insideDiameter: 0.742, weight: 1.47 },
  { nominalSize: '3/4', nominalSizeInches: 0.75, schedule: '160', outsideDiameter: 1.050, wallThickness: 0.219, insideDiameter: 0.612, weight: 1.94 },
  { nominalSize: '3/4', nominalSizeInches: 0.75, schedule: 'XXS', outsideDiameter: 1.050, wallThickness: 0.308, insideDiameter: 0.434, weight: 2.44 },

  // 1" NPS
  { nominalSize: '1', nominalSizeInches: 1.0, schedule: '5S', outsideDiameter: 1.315, wallThickness: 0.065, insideDiameter: 1.185, weight: 0.87 },
  { nominalSize: '1', nominalSizeInches: 1.0, schedule: '10S', outsideDiameter: 1.315, wallThickness: 0.109, insideDiameter: 1.097, weight: 1.40 },
  { nominalSize: '1', nominalSizeInches: 1.0, schedule: 'STD', outsideDiameter: 1.315, wallThickness: 0.133, insideDiameter: 1.049, weight: 1.68 },
  { nominalSize: '1', nominalSizeInches: 1.0, schedule: '40', outsideDiameter: 1.315, wallThickness: 0.133, insideDiameter: 1.049, weight: 1.68 },
  { nominalSize: '1', nominalSizeInches: 1.0, schedule: 'XS', outsideDiameter: 1.315, wallThickness: 0.179, insideDiameter: 0.957, weight: 2.17 },
  { nominalSize: '1', nominalSizeInches: 1.0, schedule: '80', outsideDiameter: 1.315, wallThickness: 0.179, insideDiameter: 0.957, weight: 2.17 },
  { nominalSize: '1', nominalSizeInches: 1.0, schedule: '160', outsideDiameter: 1.315, wallThickness: 0.250, insideDiameter: 0.815, weight: 2.84 },
  { nominalSize: '1', nominalSizeInches: 1.0, schedule: 'XXS', outsideDiameter: 1.315, wallThickness: 0.358, insideDiameter: 0.599, weight: 3.66 },

  // 1-1/4" NPS
  { nominalSize: '1-1/4', nominalSizeInches: 1.25, schedule: '5S', outsideDiameter: 1.660, wallThickness: 0.065, insideDiameter: 1.530, weight: 1.11 },
  { nominalSize: '1-1/4', nominalSizeInches: 1.25, schedule: '10S', outsideDiameter: 1.660, wallThickness: 0.109, insideDiameter: 1.442, weight: 1.81 },
  { nominalSize: '1-1/4', nominalSizeInches: 1.25, schedule: 'STD', outsideDiameter: 1.660, wallThickness: 0.140, insideDiameter: 1.380, weight: 2.27 },
  { nominalSize: '1-1/4', nominalSizeInches: 1.25, schedule: '40', outsideDiameter: 1.660, wallThickness: 0.140, insideDiameter: 1.380, weight: 2.27 },
  { nominalSize: '1-1/4', nominalSizeInches: 1.25, schedule: 'XS', outsideDiameter: 1.660, wallThickness: 0.191, insideDiameter: 1.278, weight: 3.00 },
  { nominalSize: '1-1/4', nominalSizeInches: 1.25, schedule: '80', outsideDiameter: 1.660, wallThickness: 0.191, insideDiameter: 1.278, weight: 3.00 },
  { nominalSize: '1-1/4', nominalSizeInches: 1.25, schedule: '160', outsideDiameter: 1.660, wallThickness: 0.250, insideDiameter: 1.160, weight: 3.76 },
  { nominalSize: '1-1/4', nominalSizeInches: 1.25, schedule: 'XXS', outsideDiameter: 1.660, wallThickness: 0.382, insideDiameter: 0.896, weight: 5.21 },

  // 1-1/2" NPS
  { nominalSize: '1-1/2', nominalSizeInches: 1.5, schedule: '5S', outsideDiameter: 1.900, wallThickness: 0.065, insideDiameter: 1.770, weight: 1.27 },
  { nominalSize: '1-1/2', nominalSizeInches: 1.5, schedule: '10S', outsideDiameter: 1.900, wallThickness: 0.109, insideDiameter: 1.682, weight: 2.08 },
  { nominalSize: '1-1/2', nominalSizeInches: 1.5, schedule: 'STD', outsideDiameter: 1.900, wallThickness: 0.145, insideDiameter: 1.610, weight: 2.72 },
  { nominalSize: '1-1/2', nominalSizeInches: 1.5, schedule: '40', outsideDiameter: 1.900, wallThickness: 0.145, insideDiameter: 1.610, weight: 2.72 },
  { nominalSize: '1-1/2', nominalSizeInches: 1.5, schedule: 'XS', outsideDiameter: 1.900, wallThickness: 0.200, insideDiameter: 1.500, weight: 3.63 },
  { nominalSize: '1-1/2', nominalSizeInches: 1.5, schedule: '80', outsideDiameter: 1.900, wallThickness: 0.200, insideDiameter: 1.500, weight: 3.63 },
  { nominalSize: '1-1/2', nominalSizeInches: 1.5, schedule: '160', outsideDiameter: 1.900, wallThickness: 0.281, insideDiameter: 1.338, weight: 4.86 },
  { nominalSize: '1-1/2', nominalSizeInches: 1.5, schedule: 'XXS', outsideDiameter: 1.900, wallThickness: 0.400, insideDiameter: 1.100, weight: 6.41 },

  // 2" NPS
  { nominalSize: '2', nominalSizeInches: 2.0, schedule: '5S', outsideDiameter: 2.375, wallThickness: 0.065, insideDiameter: 2.245, weight: 1.60 },
  { nominalSize: '2', nominalSizeInches: 2.0, schedule: '10S', outsideDiameter: 2.375, wallThickness: 0.109, insideDiameter: 2.157, weight: 2.64 },
  { nominalSize: '2', nominalSizeInches: 2.0, schedule: 'STD', outsideDiameter: 2.375, wallThickness: 0.154, insideDiameter: 2.067, weight: 3.65 },
  { nominalSize: '2', nominalSizeInches: 2.0, schedule: '40', outsideDiameter: 2.375, wallThickness: 0.154, insideDiameter: 2.067, weight: 3.65 },
  { nominalSize: '2', nominalSizeInches: 2.0, schedule: 'XS', outsideDiameter: 2.375, wallThickness: 0.218, insideDiameter: 1.939, weight: 5.02 },
  { nominalSize: '2', nominalSizeInches: 2.0, schedule: '80', outsideDiameter: 2.375, wallThickness: 0.218, insideDiameter: 1.939, weight: 5.02 },
  { nominalSize: '2', nominalSizeInches: 2.0, schedule: '160', outsideDiameter: 2.375, wallThickness: 0.344, insideDiameter: 1.687, weight: 7.46 },
  { nominalSize: '2', nominalSizeInches: 2.0, schedule: 'XXS', outsideDiameter: 2.375, wallThickness: 0.436, insideDiameter: 1.503, weight: 9.03 },

  // 2-1/2" NPS
  { nominalSize: '2-1/2', nominalSizeInches: 2.5, schedule: '5S', outsideDiameter: 2.875, wallThickness: 0.083, insideDiameter: 2.709, weight: 2.48 },
  { nominalSize: '2-1/2', nominalSizeInches: 2.5, schedule: '10S', outsideDiameter: 2.875, wallThickness: 0.120, insideDiameter: 2.635, weight: 3.53 },
  { nominalSize: '2-1/2', nominalSizeInches: 2.5, schedule: 'STD', outsideDiameter: 2.875, wallThickness: 0.203, insideDiameter: 2.469, weight: 5.79 },
  { nominalSize: '2-1/2', nominalSizeInches: 2.5, schedule: '40', outsideDiameter: 2.875, wallThickness: 0.203, insideDiameter: 2.469, weight: 5.79 },
  { nominalSize: '2-1/2', nominalSizeInches: 2.5, schedule: 'XS', outsideDiameter: 2.875, wallThickness: 0.276, insideDiameter: 2.323, weight: 7.66 },
  { nominalSize: '2-1/2', nominalSizeInches: 2.5, schedule: '80', outsideDiameter: 2.875, wallThickness: 0.276, insideDiameter: 2.323, weight: 7.66 },
  { nominalSize: '2-1/2', nominalSizeInches: 2.5, schedule: '160', outsideDiameter: 2.875, wallThickness: 0.375, insideDiameter: 2.125, weight: 10.01 },
  { nominalSize: '2-1/2', nominalSizeInches: 2.5, schedule: 'XXS', outsideDiameter: 2.875, wallThickness: 0.552, insideDiameter: 1.771, weight: 13.69 },

  // 3" NPS
  { nominalSize: '3', nominalSizeInches: 3.0, schedule: '5S', outsideDiameter: 3.500, wallThickness: 0.083, insideDiameter: 3.334, weight: 3.03 },
  { nominalSize: '3', nominalSizeInches: 3.0, schedule: '10S', outsideDiameter: 3.500, wallThickness: 0.120, insideDiameter: 3.260, weight: 4.33 },
  { nominalSize: '3', nominalSizeInches: 3.0, schedule: 'STD', outsideDiameter: 3.500, wallThickness: 0.216, insideDiameter: 3.068, weight: 7.58 },
  { nominalSize: '3', nominalSizeInches: 3.0, schedule: '40', outsideDiameter: 3.500, wallThickness: 0.216, insideDiameter: 3.068, weight: 7.58 },
  { nominalSize: '3', nominalSizeInches: 3.0, schedule: 'XS', outsideDiameter: 3.500, wallThickness: 0.300, insideDiameter: 2.900, weight: 10.25 },
  { nominalSize: '3', nominalSizeInches: 3.0, schedule: '80', outsideDiameter: 3.500, wallThickness: 0.300, insideDiameter: 2.900, weight: 10.25 },
  { nominalSize: '3', nominalSizeInches: 3.0, schedule: '160', outsideDiameter: 3.500, wallThickness: 0.438, insideDiameter: 2.624, weight: 14.32 },
  { nominalSize: '3', nominalSizeInches: 3.0, schedule: 'XXS', outsideDiameter: 3.500, wallThickness: 0.600, insideDiameter: 2.300, weight: 18.58 },

  // 4" NPS
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: '5S', outsideDiameter: 4.500, wallThickness: 0.083, insideDiameter: 4.334, weight: 3.92 },
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: '10S', outsideDiameter: 4.500, wallThickness: 0.120, insideDiameter: 4.260, weight: 5.61 },
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: 'STD', outsideDiameter: 4.500, wallThickness: 0.237, insideDiameter: 4.026, weight: 10.79 },
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: '40', outsideDiameter: 4.500, wallThickness: 0.237, insideDiameter: 4.026, weight: 10.79 },
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: 'XS', outsideDiameter: 4.500, wallThickness: 0.337, insideDiameter: 3.826, weight: 14.98 },
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: '80', outsideDiameter: 4.500, wallThickness: 0.337, insideDiameter: 3.826, weight: 14.98 },
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: '120', outsideDiameter: 4.500, wallThickness: 0.438, insideDiameter: 3.624, weight: 19.00 },
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: '160', outsideDiameter: 4.500, wallThickness: 0.531, insideDiameter: 3.438, weight: 22.51 },
  { nominalSize: '4', nominalSizeInches: 4.0, schedule: 'XXS', outsideDiameter: 4.500, wallThickness: 0.674, insideDiameter: 3.152, weight: 27.54 },

  // 6" NPS
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: '5S', outsideDiameter: 6.625, wallThickness: 0.109, insideDiameter: 6.407, weight: 7.60 },
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: '10S', outsideDiameter: 6.625, wallThickness: 0.134, insideDiameter: 6.357, weight: 9.29 },
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: 'STD', outsideDiameter: 6.625, wallThickness: 0.280, insideDiameter: 6.065, weight: 18.97 },
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: '40', outsideDiameter: 6.625, wallThickness: 0.280, insideDiameter: 6.065, weight: 18.97 },
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: 'XS', outsideDiameter: 6.625, wallThickness: 0.432, insideDiameter: 5.761, weight: 28.57 },
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: '80', outsideDiameter: 6.625, wallThickness: 0.432, insideDiameter: 5.761, weight: 28.57 },
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: '120', outsideDiameter: 6.625, wallThickness: 0.562, insideDiameter: 5.501, weight: 36.39 },
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: '160', outsideDiameter: 6.625, wallThickness: 0.719, insideDiameter: 5.187, weight: 45.35 },
  { nominalSize: '6', nominalSizeInches: 6.0, schedule: 'XXS', outsideDiameter: 6.625, wallThickness: 0.864, insideDiameter: 4.897, weight: 53.16 },

  // 8" NPS
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '5S', outsideDiameter: 8.625, wallThickness: 0.109, insideDiameter: 8.407, weight: 9.93 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '10S', outsideDiameter: 8.625, wallThickness: 0.148, insideDiameter: 8.329, weight: 13.40 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '20', outsideDiameter: 8.625, wallThickness: 0.250, insideDiameter: 8.125, weight: 22.36 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '30', outsideDiameter: 8.625, wallThickness: 0.277, insideDiameter: 8.071, weight: 24.70 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: 'STD', outsideDiameter: 8.625, wallThickness: 0.322, insideDiameter: 7.981, weight: 28.55 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '40', outsideDiameter: 8.625, wallThickness: 0.322, insideDiameter: 7.981, weight: 28.55 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '60', outsideDiameter: 8.625, wallThickness: 0.406, insideDiameter: 7.813, weight: 35.64 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: 'XS', outsideDiameter: 8.625, wallThickness: 0.500, insideDiameter: 7.625, weight: 43.39 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '80', outsideDiameter: 8.625, wallThickness: 0.500, insideDiameter: 7.625, weight: 43.39 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '100', outsideDiameter: 8.625, wallThickness: 0.594, insideDiameter: 7.437, weight: 50.95 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '120', outsideDiameter: 8.625, wallThickness: 0.719, insideDiameter: 7.187, weight: 60.71 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '140', outsideDiameter: 8.625, wallThickness: 0.812, insideDiameter: 7.001, weight: 67.76 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: '160', outsideDiameter: 8.625, wallThickness: 0.906, insideDiameter: 6.813, weight: 74.69 },
  { nominalSize: '8', nominalSizeInches: 8.0, schedule: 'XXS', outsideDiameter: 8.625, wallThickness: 0.875, insideDiameter: 6.875, weight: 72.42 },

  // 10" NPS
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '5S', outsideDiameter: 10.750, wallThickness: 0.134, insideDiameter: 10.482, weight: 15.19 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '10S', outsideDiameter: 10.750, wallThickness: 0.165, insideDiameter: 10.420, weight: 18.65 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '20', outsideDiameter: 10.750, wallThickness: 0.250, insideDiameter: 10.250, weight: 28.04 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '30', outsideDiameter: 10.750, wallThickness: 0.307, insideDiameter: 10.136, weight: 34.24 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: 'STD', outsideDiameter: 10.750, wallThickness: 0.365, insideDiameter: 10.020, weight: 40.48 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '40', outsideDiameter: 10.750, wallThickness: 0.365, insideDiameter: 10.020, weight: 40.48 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: 'XS', outsideDiameter: 10.750, wallThickness: 0.500, insideDiameter: 9.750, weight: 54.74 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '60', outsideDiameter: 10.750, wallThickness: 0.500, insideDiameter: 9.750, weight: 54.74 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '80', outsideDiameter: 10.750, wallThickness: 0.594, insideDiameter: 9.562, weight: 64.43 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '100', outsideDiameter: 10.750, wallThickness: 0.719, insideDiameter: 9.312, weight: 77.03 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '120', outsideDiameter: 10.750, wallThickness: 0.844, insideDiameter: 9.062, weight: 89.29 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '140', outsideDiameter: 10.750, wallThickness: 1.000, insideDiameter: 8.750, weight: 104.13 },
  { nominalSize: '10', nominalSizeInches: 10.0, schedule: '160', outsideDiameter: 10.750, wallThickness: 1.125, insideDiameter: 8.500, weight: 115.64 },

  // 12" NPS
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '5S', outsideDiameter: 12.750, wallThickness: 0.156, insideDiameter: 12.438, weight: 21.00 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '10S', outsideDiameter: 12.750, wallThickness: 0.180, insideDiameter: 12.390, weight: 24.20 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '20', outsideDiameter: 12.750, wallThickness: 0.250, insideDiameter: 12.250, weight: 33.38 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '30', outsideDiameter: 12.750, wallThickness: 0.330, insideDiameter: 12.090, weight: 43.77 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: 'STD', outsideDiameter: 12.750, wallThickness: 0.375, insideDiameter: 12.000, weight: 49.56 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '40', outsideDiameter: 12.750, wallThickness: 0.406, insideDiameter: 11.938, weight: 53.52 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: 'XS', outsideDiameter: 12.750, wallThickness: 0.500, insideDiameter: 11.750, weight: 65.42 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '60', outsideDiameter: 12.750, wallThickness: 0.562, insideDiameter: 11.626, weight: 73.15 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '80', outsideDiameter: 12.750, wallThickness: 0.688, insideDiameter: 11.374, weight: 88.63 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '100', outsideDiameter: 12.750, wallThickness: 0.844, insideDiameter: 11.062, weight: 107.32 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '120', outsideDiameter: 12.750, wallThickness: 1.000, insideDiameter: 10.750, weight: 125.49 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '140', outsideDiameter: 12.750, wallThickness: 1.125, insideDiameter: 10.500, weight: 139.67 },
  { nominalSize: '12', nominalSizeInches: 12.0, schedule: '160', outsideDiameter: 12.750, wallThickness: 1.312, insideDiameter: 10.126, weight: 160.27 },

  // 14" NPS
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '5S', outsideDiameter: 14.000, wallThickness: 0.156, insideDiameter: 13.688, weight: 23.07 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '10S', outsideDiameter: 14.000, wallThickness: 0.188, insideDiameter: 13.624, weight: 27.73 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '10', outsideDiameter: 14.000, wallThickness: 0.250, insideDiameter: 13.500, weight: 36.71 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '20', outsideDiameter: 14.000, wallThickness: 0.312, insideDiameter: 13.376, weight: 45.61 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '30', outsideDiameter: 14.000, wallThickness: 0.375, insideDiameter: 13.250, weight: 54.57 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: 'STD', outsideDiameter: 14.000, wallThickness: 0.375, insideDiameter: 13.250, weight: 54.57 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '40', outsideDiameter: 14.000, wallThickness: 0.438, insideDiameter: 13.124, weight: 63.44 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: 'XS', outsideDiameter: 14.000, wallThickness: 0.500, insideDiameter: 13.000, weight: 72.09 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '60', outsideDiameter: 14.000, wallThickness: 0.594, insideDiameter: 12.812, weight: 85.05 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '80', outsideDiameter: 14.000, wallThickness: 0.750, insideDiameter: 12.500, weight: 106.13 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '100', outsideDiameter: 14.000, wallThickness: 0.938, insideDiameter: 12.124, weight: 130.85 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '120', outsideDiameter: 14.000, wallThickness: 1.094, insideDiameter: 11.812, weight: 150.79 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '140', outsideDiameter: 14.000, wallThickness: 1.250, insideDiameter: 11.500, weight: 170.21 },
  { nominalSize: '14', nominalSizeInches: 14.0, schedule: '160', outsideDiameter: 14.000, wallThickness: 1.406, insideDiameter: 11.188, weight: 189.11 },

  // 16" NPS
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '5S', outsideDiameter: 16.000, wallThickness: 0.165, insideDiameter: 15.670, weight: 27.90 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '10S', outsideDiameter: 16.000, wallThickness: 0.188, insideDiameter: 15.624, weight: 31.75 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '10', outsideDiameter: 16.000, wallThickness: 0.250, insideDiameter: 15.500, weight: 42.05 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '20', outsideDiameter: 16.000, wallThickness: 0.312, insideDiameter: 15.376, weight: 52.27 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '30', outsideDiameter: 16.000, wallThickness: 0.375, insideDiameter: 15.250, weight: 62.58 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: 'STD', outsideDiameter: 16.000, wallThickness: 0.375, insideDiameter: 15.250, weight: 62.58 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '40', outsideDiameter: 16.000, wallThickness: 0.500, insideDiameter: 15.000, weight: 82.77 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: 'XS', outsideDiameter: 16.000, wallThickness: 0.500, insideDiameter: 15.000, weight: 82.77 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '60', outsideDiameter: 16.000, wallThickness: 0.656, insideDiameter: 14.688, weight: 107.50 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '80', outsideDiameter: 16.000, wallThickness: 0.844, insideDiameter: 14.312, weight: 136.61 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '100', outsideDiameter: 16.000, wallThickness: 1.031, insideDiameter: 13.938, weight: 164.82 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '120', outsideDiameter: 16.000, wallThickness: 1.219, insideDiameter: 13.562, weight: 192.43 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '140', outsideDiameter: 16.000, wallThickness: 1.438, insideDiameter: 13.124, weight: 223.64 },
  { nominalSize: '16', nominalSizeInches: 16.0, schedule: '160', outsideDiameter: 16.000, wallThickness: 1.594, insideDiameter: 12.812, weight: 245.25 },

  // 18" NPS
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '5S', outsideDiameter: 18.000, wallThickness: 0.165, insideDiameter: 17.670, weight: 31.43 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '10S', outsideDiameter: 18.000, wallThickness: 0.188, insideDiameter: 17.624, weight: 35.76 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '10', outsideDiameter: 18.000, wallThickness: 0.250, insideDiameter: 17.500, weight: 47.39 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '20', outsideDiameter: 18.000, wallThickness: 0.312, insideDiameter: 17.376, weight: 58.94 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: 'STD', outsideDiameter: 18.000, wallThickness: 0.375, insideDiameter: 17.250, weight: 70.59 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '30', outsideDiameter: 18.000, wallThickness: 0.438, insideDiameter: 17.124, weight: 82.15 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: 'XS', outsideDiameter: 18.000, wallThickness: 0.500, insideDiameter: 17.000, weight: 93.45 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '40', outsideDiameter: 18.000, wallThickness: 0.562, insideDiameter: 16.876, weight: 104.67 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '60', outsideDiameter: 18.000, wallThickness: 0.750, insideDiameter: 16.500, weight: 138.17 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '80', outsideDiameter: 18.000, wallThickness: 0.938, insideDiameter: 16.124, weight: 170.92 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '100', outsideDiameter: 18.000, wallThickness: 1.156, insideDiameter: 15.688, weight: 207.96 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '120', outsideDiameter: 18.000, wallThickness: 1.375, insideDiameter: 15.250, weight: 244.14 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '140', outsideDiameter: 18.000, wallThickness: 1.562, insideDiameter: 14.876, weight: 274.22 },
  { nominalSize: '18', nominalSizeInches: 18.0, schedule: '160', outsideDiameter: 18.000, wallThickness: 1.781, insideDiameter: 14.438, weight: 308.50 },

  // 20" NPS
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '5S', outsideDiameter: 20.000, wallThickness: 0.188, insideDiameter: 19.624, weight: 39.78 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '10S', outsideDiameter: 20.000, wallThickness: 0.218, insideDiameter: 19.564, weight: 46.06 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '10', outsideDiameter: 20.000, wallThickness: 0.250, insideDiameter: 19.500, weight: 52.73 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '20', outsideDiameter: 20.000, wallThickness: 0.375, insideDiameter: 19.250, weight: 78.60 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: 'STD', outsideDiameter: 20.000, wallThickness: 0.375, insideDiameter: 19.250, weight: 78.60 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '30', outsideDiameter: 20.000, wallThickness: 0.500, insideDiameter: 19.000, weight: 104.13 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: 'XS', outsideDiameter: 20.000, wallThickness: 0.500, insideDiameter: 19.000, weight: 104.13 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '40', outsideDiameter: 20.000, wallThickness: 0.594, insideDiameter: 18.812, weight: 123.11 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '60', outsideDiameter: 20.000, wallThickness: 0.812, insideDiameter: 18.376, weight: 166.40 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '80', outsideDiameter: 20.000, wallThickness: 1.031, insideDiameter: 17.938, weight: 208.87 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '100', outsideDiameter: 20.000, wallThickness: 1.281, insideDiameter: 17.438, weight: 256.10 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '120', outsideDiameter: 20.000, wallThickness: 1.500, insideDiameter: 17.000, weight: 296.37 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '140', outsideDiameter: 20.000, wallThickness: 1.750, insideDiameter: 16.500, weight: 341.09 },
  { nominalSize: '20', nominalSizeInches: 20.0, schedule: '160', outsideDiameter: 20.000, wallThickness: 1.969, insideDiameter: 16.062, weight: 379.17 },

  // 24" NPS
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '5S', outsideDiameter: 24.000, wallThickness: 0.218, insideDiameter: 23.564, weight: 55.37 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '10S', outsideDiameter: 24.000, wallThickness: 0.250, insideDiameter: 23.500, weight: 63.41 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '10', outsideDiameter: 24.000, wallThickness: 0.250, insideDiameter: 23.500, weight: 63.41 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '20', outsideDiameter: 24.000, wallThickness: 0.375, insideDiameter: 23.250, weight: 94.62 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: 'STD', outsideDiameter: 24.000, wallThickness: 0.375, insideDiameter: 23.250, weight: 94.62 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: 'XS', outsideDiameter: 24.000, wallThickness: 0.500, insideDiameter: 23.000, weight: 125.49 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '30', outsideDiameter: 24.000, wallThickness: 0.562, insideDiameter: 22.876, weight: 140.68 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '40', outsideDiameter: 24.000, wallThickness: 0.688, insideDiameter: 22.624, weight: 171.29 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '60', outsideDiameter: 24.000, wallThickness: 0.969, insideDiameter: 22.062, weight: 238.35 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '80', outsideDiameter: 24.000, wallThickness: 1.219, insideDiameter: 21.562, weight: 296.58 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '100', outsideDiameter: 24.000, wallThickness: 1.531, insideDiameter: 20.938, weight: 367.39 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '120', outsideDiameter: 24.000, wallThickness: 1.812, insideDiameter: 20.376, weight: 429.39 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '140', outsideDiameter: 24.000, wallThickness: 2.062, insideDiameter: 19.876, weight: 483.12 },
  { nominalSize: '24', nominalSizeInches: 24.0, schedule: '160', outsideDiameter: 24.000, wallThickness: 2.344, insideDiameter: 19.312, weight: 542.13 },
];

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Normalize pipe size string for matching
 */
function normalizeSize(size: string): string {
  return size
    .replace(/\s+/g, '')
    .replace(/inch(es)?/gi, '')
    .replace(/"/g, '')
    .replace(/NPS/gi, '')
    .trim();
}

/**
 * Normalize schedule string for matching
 */
function normalizeSchedule(schedule: string): string {
  return schedule
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/SCH(EDULE)?/gi, '')
    .replace(/STANDARD/gi, 'STD')
    .replace(/EXTRA\s*STRONG/gi, 'XS')
    .replace(/DOUBLE\s*EXTRA\s*STRONG/gi, 'XXS')
    .trim();
}

/**
 * Get pipe schedule entry by nominal size and schedule
 */
export function getPipeSchedule(
  nominalSize: string | number,
  schedule: string
): PipeScheduleEntry | null {
  const normalizedSize = typeof nominalSize === 'number' 
    ? nominalSize.toString() 
    : normalizeSize(nominalSize);
  const normalizedSchedule = normalizeSchedule(schedule);
  
  // Try exact match first
  let entry = PIPE_SCHEDULE_DATABASE.find(p => 
    normalizeSize(p.nominalSize) === normalizedSize &&
    normalizeSchedule(p.schedule) === normalizedSchedule
  );
  
  if (entry) return entry;
  
  // Try numeric size match
  const numericSize = parseFloat(normalizedSize);
  if (!isNaN(numericSize)) {
    entry = PIPE_SCHEDULE_DATABASE.find(p => 
      p.nominalSizeInches === numericSize &&
      normalizeSchedule(p.schedule) === normalizedSchedule
    );
  }
  
  return entry ?? null;
}

/**
 * Get all schedules available for a given pipe size
 */
export function getAvailableSchedules(nominalSize: string | number): string[] {
  const normalizedSize = typeof nominalSize === 'number' 
    ? nominalSize.toString() 
    : normalizeSize(nominalSize);
  const numericSize = parseFloat(normalizedSize);
  
  return PIPE_SCHEDULE_DATABASE
    .filter(p => 
      normalizeSize(p.nominalSize) === normalizedSize ||
      p.nominalSizeInches === numericSize
    )
    .map(p => p.schedule);
}

/**
 * Get all available nominal pipe sizes
 */
export function getAvailableSizes(): string[] {
  const sizes = new Set<string>();
  PIPE_SCHEDULE_DATABASE.forEach(p => sizes.add(p.nominalSize));
  return Array.from(sizes);
}

/**
 * Calculate nozzle minimum thickness per UG-45
 * Returns the pipe wall minus 12.5% manufacturing tolerance
 */
export function getNozzleMinThickness(
  nominalSize: string | number,
  schedule: string = 'STD'
): number | null {
  const entry = getPipeSchedule(nominalSize, schedule);
  if (!entry) return null;
  
  // UG-45: Pipe wall minus 12.5% manufacturing tolerance
  return entry.wallThickness * 0.875;
}

/**
 * Get pipe OD for a given nominal size
 */
export function getPipeOD(nominalSize: string | number): number | null {
  const normalizedSize = typeof nominalSize === 'number' 
    ? nominalSize.toString() 
    : normalizeSize(nominalSize);
  const numericSize = parseFloat(normalizedSize);
  
  const entry = PIPE_SCHEDULE_DATABASE.find(p => 
    normalizeSize(p.nominalSize) === normalizedSize ||
    p.nominalSizeInches === numericSize
  );
  
  return entry?.outsideDiameter ?? null;
}
