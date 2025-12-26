import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

interface InspectionReportTabProps {
  inspection: any;
}

export default function InspectionReportTab({ inspection }: InspectionReportTabProps) {
  const { data: calculations } = trpc.calculations.get.useQuery({ inspectionId: inspection.id });
  const { data: tmlReadings } = trpc.tmlReadings.list.useQuery({ inspectionId: inspection.id });
  const { data: externalInspection } = trpc.externalInspection.get.useQuery({ inspectionId: inspection.id });
  const { data: internalInspection } = trpc.internalInspection.get.useQuery({ inspectionId: inspection.id });

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      let yPos = 20;
      const pageHeight = 280;
      const lineHeight = 6;
      const sectionSpacing = 10;

      // Helper function to add text with automatic page breaks
      const addText = (text: string, x: number, fontSize: number = 10, isBold: boolean = false) => {
        if (yPos > pageHeight) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.text(text, x, yPos);
        yPos += lineHeight;
      };

      const addMultilineText = (text: string, x: number, maxWidth: number = 170) => {
        if (yPos > pageHeight) {
          doc.addPage();
          yPos = 20;
        }
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, yPos);
        yPos += lines.length * lineHeight;
      };

      const addSection = (title: string) => {
        yPos += sectionSpacing;
        if (yPos > pageHeight) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, 20, yPos);
        yPos += 8;
      };

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("API 510 Pressure Vessel Inspection Report", 105, yPos, { align: "center" });
      yPos += 15;

      // Report Information (if available from Docupipe)
      if (inspection.reportNumber || inspection.inspectionDate) {
        addSection("Report Information");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        if (inspection.reportNumber) addText(`Report Number: ${inspection.reportNumber}`, 20);
        if (inspection.inspectionDate) addText(`Inspection Date: ${new Date(inspection.inspectionDate).toLocaleDateString()}`, 20);
        if (inspection.reportDate) addText(`Report Date: ${new Date(inspection.reportDate).toLocaleDateString()}`, 20);
        if (inspection.inspectionType) addText(`Inspection Type: ${inspection.inspectionType}`, 20);
        if (inspection.inspectionCompany) addText(`Inspection Company: ${inspection.inspectionCompany}`, 20);
        if (inspection.inspectorName) addText(`Inspector: ${inspection.inspectorName}`, 20);
        if (inspection.inspectorCert) addText(`Certification: ${inspection.inspectorCert}`, 20);
      }

      // Client Information
      if (inspection.clientName || inspection.clientLocation) {
        addSection("Client Information");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        if (inspection.clientName) addText(`Company: ${inspection.clientName}`, 20);
        if (inspection.clientLocation) addText(`Location: ${inspection.clientLocation}`, 20);
      }

      // Vessel Information
      addSection("Vessel Information");
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      addText(`Vessel Tag Number: ${inspection.vesselTagNumber || "N/A"}`, 20);
      if (inspection.vesselName) addText(`Vessel Name: ${inspection.vesselName}`, 20);
      if (inspection.product) addText(`Product/Service: ${inspection.product}`, 20);
      if (inspection.manufacturer) addText(`Manufacturer: ${inspection.manufacturer}`, 20);
      if (inspection.yearBuilt) addText(`Year Built: ${inspection.yearBuilt}`, 20);
      if (inspection.nbNumber) addText(`NB Number: ${inspection.nbNumber}`, 20);
      if (inspection.constructionCode) addText(`Construction Code: ${inspection.constructionCode}`, 20);
      if (inspection.vesselType || inspection.vesselConfiguration) {
        addText(`Vessel Type: ${inspection.vesselConfiguration || inspection.vesselType || "N/A"}`, 20);
      }
      if (inspection.headType) addText(`Head Type: ${inspection.headType}`, 20);
      if (inspection.insulationType) addText(`Insulation: ${inspection.insulationType}`, 20);

      // Design Parameters
      addSection("Design Parameters");
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      if (inspection.designPressure) addText(`Design Pressure (MAWP): ${inspection.designPressure} psig`, 20);
      if (inspection.designTemperature) addText(`Design Temperature: ${inspection.designTemperature} °F`, 20);
      if (inspection.operatingPressure) addText(`Operating Pressure: ${inspection.operatingPressure} psig`, 20);
      if (inspection.materialSpec) addText(`Material Specification: ${inspection.materialSpec}`, 20);
      if (inspection.insideDiameter) addText(`Inside Diameter: ${inspection.insideDiameter} inches`, 20);
      if (inspection.overallLength) addText(`Overall Length: ${inspection.overallLength} inches`, 20);

      // Executive Summary
      if (inspection.executiveSummary) {
        addSection("Executive Summary");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        addMultilineText(inspection.executiveSummary, 20);
      }

      // Calculations
      if (calculations) {
        addSection("Calculation Results");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        if (calculations.minThicknessResult) {
          addText(`Minimum Required Thickness (Shell): ${calculations.minThicknessResult} inches`, 20);
        }
        
        if (calculations.mawpResult) {
          addText(`Maximum Allowable Working Pressure (Shell): ${calculations.mawpResult} psig`, 20);
        }
        
        if (calculations.remainingLifeResult) {
          addText(`Remaining Life: ${calculations.remainingLifeResult} years`, 20);
          
          if (calculations.remainingLifeNextInspection) {
            addText(`Next Inspection Due: ${calculations.remainingLifeNextInspection} years`, 20);
          }
        }

        // Note: Head calculations would be separate calculation records
      }

      // TML Readings
      if (tmlReadings && tmlReadings.length > 0) {
        addSection("Thickness Measurement Locations");
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        
        // Table header
        const headerY = yPos;
        doc.text("TML ID", 20, headerY);
        doc.text("Component", 50, headerY);
        doc.text("Nominal", 95, headerY);
        doc.text("Previous", 125, headerY);
        doc.text("Current", 155, headerY);
        doc.text("Status", 180, headerY);
        yPos += lineHeight;

        doc.setFont("helvetica", "normal");
        
        for (const reading of tmlReadings) {
          if (yPos > pageHeight) {
            doc.addPage();
            yPos = 20;
            
            // Repeat header on new page
            doc.setFont("helvetica", "bold");
            doc.text("TML ID", 20, yPos);
            doc.text("Component", 50, yPos);
            doc.text("Nominal", 95, yPos);
            doc.text("Previous", 125, yPos);
            doc.text("Current", 155, yPos);
            doc.text("Status", 180, yPos);
            yPos += lineHeight;
            doc.setFont("helvetica", "normal");
          }

          doc.text(String(reading.tmlId || ""), 20, yPos);
          doc.text(String(reading.component || "").substring(0, 20), 50, yPos);
          doc.text(String(reading.nominalThickness || ""), 95, yPos);
          doc.text(String(reading.previousThickness || ""), 125, yPos);
          doc.text(String(reading.currentThickness || ""), 155, yPos);
          doc.text(String(reading.status || ""), 180, yPos);
          yPos += 5;
        }
      }

      // External Inspection
      if (externalInspection) {
        addSection("External Inspection Findings");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        if (externalInspection.visualCondition) {
          doc.setFont("helvetica", "bold");
          addText("Visual Condition:", 20);
          doc.setFont("helvetica", "normal");
          addMultilineText(externalInspection.visualCondition, 20);
          yPos += 2;
        }

        if (externalInspection.corrosionObserved) {
          doc.setFont("helvetica", "bold");
          addText("Corrosion Observed: Yes", 20);
          doc.setFont("helvetica", "normal");
          yPos += 2;
        }

        if (externalInspection.damageMechanism) {
          doc.setFont("helvetica", "bold");
          addText("Damage Mechanism:", 20);
          doc.setFont("helvetica", "normal");
          addMultilineText(externalInspection.damageMechanism, 20);
          yPos += 2;
        }

        if (externalInspection.findings) {
          doc.setFont("helvetica", "bold");
          addText("Findings:", 20);
          doc.setFont("helvetica", "normal");
          addMultilineText(externalInspection.findings, 20);
          yPos += 2;
        }

        if (externalInspection.recommendations) {
          doc.setFont("helvetica", "bold");
          addText("Recommendations:", 20);
          doc.setFont("helvetica", "normal");
          addMultilineText(externalInspection.recommendations, 20);
        }
      }

      // Internal Inspection
      if (internalInspection) {
        addSection("Internal Inspection Findings");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        if (internalInspection.internalCondition) {
          doc.setFont("helvetica", "bold");
          addText("Internal Condition:", 20);
          doc.setFont("helvetica", "normal");
          addMultilineText(internalInspection.internalCondition, 20);
          yPos += 2;
        }

        if (internalInspection.corrosionPattern) {
          doc.setFont("helvetica", "bold");
          addText("Corrosion Pattern:", 20);
          doc.setFont("helvetica", "normal");
          addMultilineText(internalInspection.corrosionPattern, 20);
          yPos += 2;
        }

        if (internalInspection.findings) {
          doc.setFont("helvetica", "bold");
          addText("Findings:", 20);
          doc.setFont("helvetica", "normal");
          addMultilineText(internalInspection.findings, 20);
          yPos += 2;
        }

        if (internalInspection.recommendations) {
          doc.setFont("helvetica", "bold");
          addText("Recommendations:", 20);
          doc.setFont("helvetica", "normal");
          addMultilineText(internalInspection.recommendations, 20);
        }
      }

      // Save the PDF
      const filename = `Inspection_Report_${inspection.vesselTagNumber || "Unknown"}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      toast.success("PDF report generated successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Inspection Report</h2>
        </div>
        <Button onClick={generatePDF} className="gap-2">
          <Download className="h-4 w-4" />
          Generate PDF Report
        </Button>
      </div>

      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4">Report Preview</h3>
        <p className="text-sm text-gray-600">
          Click the "Generate PDF Report" button above to create a comprehensive inspection report
          including all vessel data, calculations, thickness measurements, and inspection findings.
        </p>
      </div>
    </div>
  );
}

