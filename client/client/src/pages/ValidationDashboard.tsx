import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ValidationDashboard() {
  const params = useParams<{ inspectionId: string }>();
  const [, setLocation] = useLocation();
  const inspectionId = params.inspectionId!;

  const { data: validationData, isLoading } = trpc.validation.getValidationData.useQuery({
    inspectionId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!validationData) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Validation Data Not Found</CardTitle>
            <CardDescription>
              Unable to load validation data for this inspection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation(`/inspections/${inspectionId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inspection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'minor':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'major':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'match':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Match</Badge>;
      case 'minor':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Minor Diff</Badge>;
      case 'major':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Major Diff</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatValue = (value: number | null | undefined, decimals = 3) => {
    if (value === null || value === undefined) return 'N/A';
    return typeof value === 'number' ? value.toFixed(decimals) : value;
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return `(${value.toFixed(2)}%)`;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calculation Validation</h1>
          <p className="text-muted-foreground mt-1">
            Compare app-calculated values with PDF original data
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation(`/inspections/${inspectionId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inspection
        </Button>
      </div>

      {/* Inspection Info */}
      <Card>
        <CardHeader>
          <CardTitle>Inspection Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Vessel Tag</p>
            <p className="font-semibold">{validationData.vesselTag}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Inspection Date</p>
            <p className="font-semibold">
              {validationData.inspectionDate 
                ? new Date(validationData.inspectionDate).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">PDF Data Available</p>
            <p className="font-semibold">
              {validationData.hasPdfOriginalValues ? (
                <Badge className="bg-green-100 text-green-800">Yes</Badge>
              ) : (
                <Badge variant="outline">No - Manual Entry Required</Badge>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Tables */}
      {validationData.comparisonData.map((component) => (
        <Card key={component.componentName}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {component.componentName}
                  {getStatusIcon(component.status)}
                </CardTitle>
                <CardDescription>
                  Comparison of calculated values vs. PDF original values
                </CardDescription>
              </div>
              {getStatusBadge(component.status)}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parameter</TableHead>
                  <TableHead className="text-right">App Calculated</TableHead>
                  <TableHead className="text-right">PDF Original</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Actual Thickness (in)</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.appValues.actualThickness)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.pdfValues.actualThickness)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {component.discrepancies.actualThickness.absolute > 0 && (
                      <>
                        {formatValue(component.discrepancies.actualThickness.absolute)}{' '}
                        {formatPercentage(component.discrepancies.actualThickness.percentage)}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusIcon(component.discrepancies.actualThickness.status)}
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell className="font-medium">Minimum Thickness (in)</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.appValues.minimumThickness)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.pdfValues.minimumThickness)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {component.discrepancies.minimumThickness.absolute > 0 && (
                      <>
                        {formatValue(component.discrepancies.minimumThickness.absolute)}{' '}
                        {formatPercentage(component.discrepancies.minimumThickness.percentage)}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusIcon(component.discrepancies.minimumThickness.status)}
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell className="font-medium">MAWP (psi)</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.appValues.mawp, 1)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.pdfValues.mawp, 1)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {component.discrepancies.mawp.absolute > 0 && (
                      <>
                        {formatValue(component.discrepancies.mawp.absolute, 1)}{' '}
                        {formatPercentage(component.discrepancies.mawp.percentage)}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusIcon(component.discrepancies.mawp.status)}
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell className="font-medium">Corrosion Rate (mpy)</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.appValues.corrosionRate, 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.pdfValues.corrosionRate, 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {component.discrepancies.corrosionRate.absolute > 0 && (
                      <>
                        {formatValue(component.discrepancies.corrosionRate.absolute, 2)}{' '}
                        {formatPercentage(component.discrepancies.corrosionRate.percentage)}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusIcon(component.discrepancies.corrosionRate.status)}
                  </TableCell>
                </TableRow>
                
                {/* Enhanced Dual Corrosion Rate Display */}
                {component.appValues.corrosionRateLongTerm !== null && (
                  <TableRow className="bg-blue-50">
                    <TableCell className="font-medium pl-8 text-sm">
                      ↳ Long-Term Rate (mpy)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatValue(component.appValues.corrosionRateLongTerm, 3)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      —
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      Enhanced
                    </TableCell>
                    <TableCell className="text-center">
                      {component.appValues.governingRateType === 'long_term' && (
                        <Badge variant="outline" className="bg-green-100 text-green-800">Governing</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                
                {component.appValues.corrosionRateShortTerm !== null && (
                  <TableRow className="bg-blue-50">
                    <TableCell className="font-medium pl-8 text-sm">
                      ↳ Short-Term Rate (mpy)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatValue(component.appValues.corrosionRateShortTerm, 3)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      —
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      Enhanced
                    </TableCell>
                    <TableCell className="text-center">
                      {component.appValues.governingRateType === 'short_term' && (
                        <Badge variant="outline" className="bg-green-100 text-green-800">Governing</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                
                {component.appValues.dataQualityStatus && component.appValues.dataQualityStatus !== 'ok' && (
                  <TableRow className="bg-yellow-50">
                    <TableCell className="font-medium pl-8 text-sm">
                      ↳ Data Quality Alert
                    </TableCell>
                    <TableCell colSpan={4} className="text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-800">
                          {component.appValues.dataQualityStatus === 'anomaly' && 'Anomaly Detected'}
                          {component.appValues.dataQualityStatus === 'growth_error' && 'Metal Growth Detected'}
                          {component.appValues.dataQualityStatus === 'below_minimum' && 'Below Minimum Thickness'}
                        </span>
                        {component.appValues.dataQualityNotes && (
                          <span className="text-muted-foreground">— {component.appValues.dataQualityNotes}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                
                <TableRow>
                  <TableCell className="font-medium">Remaining Life (years)</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.appValues.remainingLife, 1)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatValue(component.pdfValues.remainingLife, 1)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {component.discrepancies.remainingLife.absolute > 0 && (
                      <>
                        {formatValue(component.discrepancies.remainingLife.absolute, 1)}{' '}
                        {formatPercentage(component.discrepancies.remainingLife.percentage)}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusIcon(component.discrepancies.remainingLife.status)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold">Match</p>
              <p className="text-sm text-muted-foreground">&lt; 1% difference</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-semibold">Minor Difference</p>
              <p className="text-sm text-muted-foreground">1-5% difference</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-semibold">Major Difference</p>
              <p className="text-sm text-muted-foreground">&gt; 5% difference</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note about PDF data */}
      {!validationData.hasPdfOriginalValues && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Manual PDF Data Entry Required</CardTitle>
            <CardDescription className="text-yellow-700">
              This inspection does not have PDF original values stored. To enable validation:
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700 space-y-2">
            <ol className="list-decimal list-inside space-y-1">
              <li>Open the original PDF inspection report</li>
              <li>Manually record the calculated values from the PDF</li>
              <li>Store them in the inspection metadata for comparison</li>
            </ol>
            <p className="mt-4 font-semibold">
              Future enhancement: Automatic extraction of PDF original values during import
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
