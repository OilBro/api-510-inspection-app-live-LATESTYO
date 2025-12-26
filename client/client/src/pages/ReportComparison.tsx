import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Loader2, TrendingDown, TrendingUp, Minus, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import ThicknessTrendChart from "@/components/ThicknessTrendChart";

export default function ReportComparison() {
  const [selectedInspections, setSelectedInspections] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: availableInspections, isLoading: loadingInspections } =
    trpc.reportComparison.getAvailableInspections.useQuery({
      limit: 20,
      status: statusFilter === "all" ? undefined : statusFilter,
    });

  const { data: comparisonData, isLoading: loadingComparison } =
    trpc.reportComparison.compare.useQuery(
      { inspectionIds: selectedInspections },
      { enabled: selectedInspections.length >= 2 }
    );

  const handleInspectionToggle = (inspectionId: string) => {
    setSelectedInspections((prev) => {
      if (prev.includes(inspectionId)) {
        return prev.filter((id) => id !== inspectionId);
      } else if (prev.length < 5) {
        return [...prev, inspectionId];
      } else {
        return prev; // Max 5 inspections
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "warning":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "caution":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "stable":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTrendIcon = (corrosionRate: string) => {
    const rate = parseFloat(corrosionRate);
    if (rate > 0.005) return <TrendingDown className="h-4 w-4 text-red-500" />;
    if (rate > 0.002) return <TrendingDown className="h-4 w-4 text-orange-500" />;
    return <Minus className="h-4 w-4 text-green-500" />;
  };

  if (loadingInspections) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Button asChild variant="outline" size="sm" className="mb-4">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Report Comparison</h1>
        <p className="text-muted-foreground">
          Compare multiple inspection reports to identify thickness trends and component degradation patterns
        </p>
      </div>

      {/* Status Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700 mr-2">Filter by Status:</span>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All
            </Button>
            <Button
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Completed
            </Button>
            <Button
              variant={statusFilter === "in_progress" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("in_progress")}
            >
              <Loader2 className="h-4 w-4 mr-1" />
              In Progress
            </Button>
            <Button
              variant={statusFilter === "draft" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("draft")}
            >
              Draft
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inspection Selector */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Select Inspections to Compare</CardTitle>
          <CardDescription>
            Choose 2-5 inspection reports to analyze (selected: {selectedInspections.length}/5)
            {statusFilter !== "all" && (
              <span className="ml-2 text-blue-600">• Filtered by: {statusFilter.replace("_", " ")}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableInspections?.map((inspection: any) => (
              <Card
                key={inspection.id}
                className={`cursor-pointer transition-all ${
                  selectedInspections.includes(inspection.id)
                    ? "border-blue-500 bg-blue-50"
                    : "hover:border-gray-400"
                }`}
                onClick={() => handleInspectionToggle(inspection.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {inspection.vesselTagNumber}
                    </CardTitle>
                    {selectedInspections.includes(inspection.id) && (
                      <CheckCircle2 className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  <CardDescription className="text-sm">
                    {inspection.vesselName || "No name"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground">
                    {new Date(inspection.inspectionDate || inspection.createdAt).toLocaleDateString()}
                  </div>
                  <Badge className="mt-2" variant="outline">
                    {inspection.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {selectedInspections.length >= 2 && (
        <>
          {loadingComparison ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : comparisonData ? (
            <>
              {/* Export Button */}
              <div className="flex justify-end mb-6">
                <Button
                  onClick={() => {
                    toast.info("PDF export feature coming soon!");
                    // TODO: Implement PDF export
                  }}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Export Analysis to PDF
                </Button>
              </div>

              {/* Thickness Trend Charts */}
              {comparisonData.chartData && comparisonData.chartData.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">Thickness Trend Visualization</h2>
                  <p className="text-muted-foreground mb-6">
                    Interactive charts showing thickness measurements over time for each component
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {comparisonData.chartData.map((chart: any, index: number) => (
                      <ThicknessTrendChart
                        key={index}
                        component={chart.component}
                        location={chart.location}
                        labels={chart.labels}
                        datasets={chart.datasets}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Thickness Trends */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Thickness Trends Analysis</CardTitle>
                  <CardDescription>
                    Corrosion rates and thickness loss patterns across inspection periods
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Corrosion Rate</TableHead>
                        <TableHead>Thickness Loss</TableHead>
                        <TableHead>Time Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonData.thicknessTrends.map((trend: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{trend.component}</TableCell>
                          <TableCell>{trend.location}</TableCell>
                          <TableCell>
                            <span className="font-mono">{trend.corrosionRate} in/yr</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono">{trend.thicknessLoss} in</span>
                          </TableCell>
                          <TableCell>{trend.timePeriodYears} years</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(trend.status)}>
                              {trend.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{getTrendIcon(trend.corrosionRate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Findings Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      New Findings
                    </CardTitle>
                    <CardDescription>
                      Issues identified in the latest inspection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {comparisonData.findingsComparison.new.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No new findings</p>
                    ) : (
                      <div className="space-y-2">
                        {comparisonData.findingsComparison.new.map((finding: any) => (
                          <div key={finding.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="font-medium text-sm">{finding.findingType}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {finding.description?.substring(0, 100)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Resolved Findings
                    </CardTitle>
                    <CardDescription>
                      Issues no longer present in latest inspection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {comparisonData.findingsComparison.resolved.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No resolved findings</p>
                    ) : (
                      <div className="space-y-2">
                        {comparisonData.findingsComparison.resolved.map((finding: any) => (
                          <div key={finding.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="font-medium text-sm">{finding.findingType}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {finding.description?.substring(0, 100)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRight className="h-5 w-5 text-orange-500" />
                      Recurring Findings
                    </CardTitle>
                    <CardDescription>
                      Issues present in multiple inspections
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {comparisonData.findingsComparison.recurring.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recurring findings</p>
                    ) : (
                      <div className="space-y-2">
                        {comparisonData.findingsComparison.recurring.map((item: any, index: number) => (
                          <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="font-medium text-sm">{item.finding.findingType}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Occurred {item.occurrences} times
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Degradation Rates */}
              {comparisonData.degradationRates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Component Degradation Analysis</CardTitle>
                    <CardDescription>
                      Remaining life trends and acceleration factors
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead>Previous Remaining Life</TableHead>
                          <TableHead>Current Remaining Life</TableHead>
                          <TableHead>Time Period</TableHead>
                          <TableHead>Acceleration Factor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonData.degradationRates.map((rate: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{rate.component}</TableCell>
                            <TableCell>{rate.previousRemainingLife.toFixed(1)} years</TableCell>
                            <TableCell>{rate.currentRemainingLife.toFixed(1)} years</TableCell>
                            <TableCell>{rate.timePeriodYears} years</TableCell>
                            <TableCell>
                              <span className="font-mono">{rate.accelerationFactor}x</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  rate.status === "accelerating"
                                    ? "bg-red-100 text-red-800"
                                    : rate.status === "normal"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-green-100 text-green-800"
                                }
                              >
                                {rate.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </>
      )}

      {selectedInspections.length < 2 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Select at least 2 inspections to begin comparison analysis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

