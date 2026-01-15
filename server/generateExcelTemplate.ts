import * as XLSX from "xlsx";

/**
 * Generate an Excel template for API 510 inspection data import
 * Returns a Buffer containing the .xlsx file
 */
export function generateExcelTemplate(): Buffer {
  const workbook = XLSX.utils.book_new();

  // ============================================
  // Sheet 1: Instructions
  // ============================================
  const instructionsData = [
    ["API 510 Pressure Vessel Inspection - Data Import Template"],
    [""],
    ["INSTRUCTIONS:"],
    ["1. Fill in the data in each sheet according to the column headers"],
    ["2. Do not modify the column headers - they are used for data mapping"],
    ["3. Required fields are marked with * in the header"],
    ["4. Dates should be in YYYY-MM-DD format (e.g., 2024-01-15)"],
    ["5. Thickness values should be in inches (decimal format, e.g., 0.485)"],
    ["6. Pressure values should be in psig"],
    ["7. Temperature values should be in °F"],
    [""],
    ["SHEETS INCLUDED:"],
    ["- Vessel Information: Basic vessel identification and design parameters"],
    ["- TML Readings: Thickness measurement locations and readings"],
    ["- Nozzles: Nozzle evaluation data"],
    ["- Inspection Details: Report and inspector information"],
    [""],
    ["TIPS:"],
    ["- You can import partial data - not all fields are required"],
    ["- The system will attempt to match your data to existing inspections by Vessel Tag Number"],
    ["- Multi-angle TML readings (TML 1-4) are optional - T Actual is the primary value"],
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  // ============================================
  // Sheet 2: Vessel Information (Field/Value format)
  // ============================================
  const vesselInfoData = [
    ["Field", "Value", "Notes"],
    ["Vessel Tag Number *", "", "Required - unique identifier (e.g., V-1001)"],
    ["Vessel Name", "", "Description or name of vessel"],
    ["Manufacturer", "", "Vessel manufacturer/fabricator"],
    ["Serial Number", "", "Manufacturer serial number"],
    ["Year Built", "", "Year vessel was constructed (e.g., 2010)"],
    ["NB Number", "", "National Board Number"],
    ["Design Pressure (psig)", "", "Maximum allowable working pressure"],
    ["Design Temperature (°F)", "", "Design temperature"],
    ["Operating Pressure (psig)", "", "Normal operating pressure"],
    ["Operating Temperature (°F)", "", "Normal operating temperature"],
    ["MDMT (°F)", "", "Minimum Design Metal Temperature"],
    ["Material Specification", "", "e.g., SA-516 Gr. 70"],
    ["Allowable Stress (psi)", "", "Material allowable stress at design temp"],
    ["Joint Efficiency", "", "E value (0.60 to 1.00)"],
    ["Radiography Type", "", "RT-1, RT-2, RT-3, or RT-4"],
    ["Inside Diameter (in)", "", "Vessel inside diameter"],
    ["Overall Length (in)", "", "Vessel overall length"],
    ["Head Type", "", "2:1 Elliptical, Hemispherical, Torispherical"],
    ["Crown Radius (in)", "", "L parameter for torispherical heads"],
    ["Knuckle Radius (in)", "", "r parameter for torispherical heads"],
    ["Vessel Configuration", "", "Horizontal or Vertical"],
    ["Product/Service", "", "Contents or service description"],
    ["Construction Code", "", "e.g., ASME Section VIII Div. 1"],
    ["Corrosion Allowance (in)", "", "Design corrosion allowance"],
    ["Insulation Type", "", "Type of insulation if applicable"],
  ];
  const vesselInfoSheet = XLSX.utils.aoa_to_sheet(vesselInfoData);
  vesselInfoSheet["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, vesselInfoSheet, "Vessel Information");

  // ============================================
  // Sheet 3: TML Readings (Tabular format)
  // ============================================
  const tmlReadingsData = [
    [
      "CML Number *",
      "TML ID",
      "Location",
      "Component Type",
      "TML 1 (in)",
      "TML 2 (in)",
      "TML 3 (in)",
      "TML 4 (in)",
      "T Actual (in) *",
      "Nominal Thickness (in)",
      "Previous Thickness (in)",
      "Corrosion Rate (mpy)",
      "Status",
    ],
    [
      "001",
      "TML-001",
      "7-0",
      "Shell",
      "0.485",
      "0.490",
      "0.488",
      "0.492",
      "0.485",
      "0.500",
      "0.495",
      "2.0",
      "good",
    ],
    [
      "002",
      "TML-002",
      "7-45",
      "Shell",
      "0.475",
      "0.480",
      "0.478",
      "0.482",
      "0.475",
      "0.500",
      "0.490",
      "3.0",
      "monitor",
    ],
    [
      "003",
      "TML-003",
      "11B-C",
      "East Head",
      "0.450",
      "0.455",
      "0.452",
      "0.458",
      "0.450",
      "0.500",
      "0.470",
      "4.0",
      "critical",
    ],
    ["", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", ""],
  ];
  const tmlReadingsSheet = XLSX.utils.aoa_to_sheet(tmlReadingsData);
  tmlReadingsSheet["!cols"] = [
    { wch: 12 }, // CML Number
    { wch: 12 }, // TML ID
    { wch: 15 }, // Location
    { wch: 15 }, // Component Type
    { wch: 12 }, // TML 1
    { wch: 12 }, // TML 2
    { wch: 12 }, // TML 3
    { wch: 12 }, // TML 4
    { wch: 15 }, // T Actual
    { wch: 20 }, // Nominal Thickness
    { wch: 20 }, // Previous Thickness
    { wch: 18 }, // Corrosion Rate
    { wch: 10 }, // Status
  ];
  XLSX.utils.book_append_sheet(workbook, tmlReadingsSheet, "TML Readings");

  // ============================================
  // Sheet 4: Nozzles (Tabular format)
  // ============================================
  const nozzlesData = [
    [
      "Nozzle Number *",
      "Description",
      "Location",
      "Nominal Size",
      "Schedule",
      "Actual Thickness (in)",
      "Pipe Nominal Thickness (in)",
      "Minimum Required (in)",
      "Acceptable",
      "Notes",
    ],
    ["N1", "Inlet", "Top", '6"', "STD", "0.280", "0.280", "0.125", "Yes", "Good condition"],
    ["N2", "Outlet", "Bottom", '4"', "XS", "0.337", "0.337", "0.100", "Yes", ""],
    ["M1", "Manhole", "Side", '24"', "STD", "0.500", "0.500", "0.250", "Yes", "Gasket replaced"],
    ["R1", "Relief Valve", "Top", '3"', "STD", "0.216", "0.216", "0.100", "Yes", ""],
    ["", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", ""],
  ];
  const nozzlesSheet = XLSX.utils.aoa_to_sheet(nozzlesData);
  nozzlesSheet["!cols"] = [
    { wch: 15 }, // Nozzle Number
    { wch: 15 }, // Description
    { wch: 12 }, // Location
    { wch: 12 }, // Nominal Size
    { wch: 10 }, // Schedule
    { wch: 20 }, // Actual Thickness
    { wch: 25 }, // Pipe Nominal Thickness
    { wch: 18 }, // Minimum Required
    { wch: 12 }, // Acceptable
    { wch: 30 }, // Notes
  ];
  XLSX.utils.book_append_sheet(workbook, nozzlesSheet, "Nozzles");

  // ============================================
  // Sheet 5: Inspection Details (Field/Value format)
  // ============================================
  const inspectionDetailsData = [
    ["Field", "Value", "Notes"],
    ["Report Number", "", "Unique report identifier"],
    ["Report Date", "", "Date report was issued (YYYY-MM-DD)"],
    ["Inspection Date", "", "Date inspection was performed (YYYY-MM-DD)"],
    ["Inspection Type", "", "Internal, External, or On-Stream"],
    ["Inspection Company", "", "Company performing inspection"],
    ["Inspector Name", "", "Name of inspector"],
    ["Inspector Certification", "", "API certification number"],
    ["Client Name", "", "Owner/operator company name"],
    ["Client Location", "", "Facility location"],
    ["", "", ""],
    ["Executive Summary", "", "Summary of inspection findings"],
    ["", "", ""],
    ["Recommendations", "", "Recommended actions"],
  ];
  const inspectionDetailsSheet = XLSX.utils.aoa_to_sheet(inspectionDetailsData);
  inspectionDetailsSheet["!cols"] = [{ wch: 25 }, { wch: 40 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, inspectionDetailsSheet, "Inspection Details");

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer;
}
