import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertCircle, CheckCircle } from "lucide-react";

interface InspectionResultsTabProps {
  inspectionResults: string | null | undefined;
  recommendations: string | null | undefined;
}

export default function InspectionResultsTab({ 
  inspectionResults, 
  recommendations 
}: InspectionResultsTabProps) {
  const hasResults = inspectionResults && inspectionResults.trim().length > 0;
  const hasRecommendations = recommendations && recommendations.trim().length > 0;

  // Parse the inspection results into sections if possible
  const parseResults = (text: string) => {
    // Try to split by common section patterns
    const sections: { title: string; content: string }[] = [];
    
    // Common section headers in API 510 reports
    const sectionPatterns = [
      /(?:^|\n)(Foundation[:\s].*?)(?=\n[A-Z]|\n\d+\.|$)/gi,
      /(?:^|\n)(Shell[:\s].*?)(?=\n[A-Z]|\n\d+\.|$)/gi,
      /(?:^|\n)(Heads?[:\s].*?)(?=\n[A-Z]|\n\d+\.|$)/gi,
      /(?:^|\n)(Appurtenances[:\s].*?)(?=\n[A-Z]|\n\d+\.|$)/gi,
      /(?:^|\n)(Nozzles?[:\s].*?)(?=\n[A-Z]|\n\d+\.|$)/gi,
      /(?:^|\n)(Corrosion[:\s].*?)(?=\n[A-Z]|\n\d+\.|$)/gi,
    ];

    // If we can't parse sections, return the whole text as one section
    if (!text.includes('\n') || text.length < 100) {
      return [{ title: 'Inspection Findings', content: text }];
    }

    // Split by numbered sections (3.1, 3.2, etc.)
    const numberedSections = text.split(/(?=\d+\.\d+\s)/);
    if (numberedSections.length > 1) {
      return numberedSections
        .filter(s => s.trim())
        .map(section => {
          const lines = section.trim().split('\n');
          const title = lines[0].replace(/^\d+\.\d+\s*/, '').trim() || 'Section';
          const content = lines.slice(1).join('\n').trim() || lines[0];
          return { title, content };
        });
    }

    // Return as single section
    return [{ title: 'Inspection Findings', content: text }];
  };

  const resultsSections = hasResults ? parseResults(inspectionResults!) : [];

  return (
    <div className="space-y-6">
      {/* Inspection Results Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <CardTitle>Section 3.0 - Inspection Results</CardTitle>
            </div>
            {hasResults ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Extracted
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Available
              </Badge>
            )}
          </div>
          <CardDescription>
            Findings and observations from the inspection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasResults ? (
            <div className="space-y-4">
              {resultsSections.map((section, index) => (
                <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                  <h4 className="font-medium text-gray-900 mb-2">{section.title}</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No inspection results extracted from the PDF.</p>
              <p className="text-sm mt-2">
                Re-import the PDF to extract Section 3.0 content.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <CardTitle>Section 4.0 - Recommendations</CardTitle>
            </div>
            {hasRecommendations ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Extracted
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Available
              </Badge>
            )}
          </div>
          <CardDescription>
            Recommendations for repairs, replacements, and next inspection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasRecommendations ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{recommendations}</p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No recommendations extracted from the PDF.</p>
              <p className="text-sm mt-2">
                Re-import the PDF to extract Section 4.0 content.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
