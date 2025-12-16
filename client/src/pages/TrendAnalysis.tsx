/**
 * Trend Analysis Page
 * Phase 4: Multi-inspection trend visualization and corrosion rate analysis
 */

import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, ArrowLeft, Target, Activity } from "lucide-react";
import { ThicknessTrendChart } from "@/components/charts/ThicknessTrendChart";

export default function TrendAnalysis() {
  const params = useParams<{ vesselTagNumber: string }>();
  const [, setLocation] = useLocation();
  const vesselTagNumber = params.vesselTagNumber || '';
  const [selectedComponent, setSelectedComponent] = useState<string>('');

  // Fetch inspection history
  const { data: history, isLoading: historyLoading } = trpc.trendAnalysis.getVesselInspectionHistory.useQuery(
    { vesselTagNumber },
    { enabled: !!vesselTagNumber }
  );

  // Fetch multi-component trends
  const { data: componentTrends, isLoading: trendsLoading } = trpc.trendAnalysis.getMultiComponentTrends.useQuery(
    { vesselTagNumber },
    { enabled: !!vesselTagNumber }
  );

  // Fetch life-limiting component
  const { data: lifeLimiting } = trpc.trendAnalysis.getLifeLimitingComponent.useQuery(
    { vesselTagNumber },
    { enabled: !!vesselTagNumber }
  );

  // Fetch thickness trend for selected component
  const { data: thicknessTrend } = trpc.trendAnalysis.getComponentThicknessTrend.useQuery(
    { vesselTagNumber, componentName: selectedComponent },
    { enabled: !!vesselTagNumber && !!selectedComponent }
  );

  // Fetch acceleration data for selected component
  const { data: acceleration } = trpc.trendAnalysis.getCorrosionRateAcceleration.useQuery(
    { vesselTagNumber, componentName: selectedComponent },
    { enabled: !!vesselTagNumber && !!selectedComponent }
  );

  // Fetch prediction for selected component
  const { data: prediction } = trpc.trendAnalysis.getTrendPrediction.useQuery(
    { vesselTagNumber, componentName: selectedComponent },
    { enabled: !!vesselTagNumber && !!selectedComponent }
  );

  // Auto-select first component
  if (componentTrends && componentTrends.length > 0 && !selectedComponent) {
    setSelectedComponent(componentTrends[0].componentName);
  }

  const isLoading = historyLoading || trendsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/inspections')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Trend Analysis</h1>
            <p className="text-muted-foreground">Vessel: {vesselTagNumber}</p>
          </div>
        </div>
        
        {/* Component selector */}
        <Select value={selectedComponent} onValueChange={setSelectedComponent}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select component" />
          </SelectTrigger>
          <SelectContent>
            {componentTrends?.map((comp) => (
              <SelectItem key={comp.componentName} value={comp.componentName}>
                {comp.componentName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Inspections</CardDescription>
            <CardTitle className="text-3xl">{history?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Components Tracked</CardDescription>
            <CardTitle className="text-3xl">{componentTrends?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card className={lifeLimiting && lifeLimiting.remainingLife < 10 ? 'border-red-500' : ''}>
          <CardHeader className="pb-2">
            <CardDescription>Life-Limiting Component</CardDescription>
            <CardTitle className="text-lg">{lifeLimiting?.componentName || 'N/A'}</CardTitle>
            {lifeLimiting && (
              <Badge variant={lifeLimiting.remainingLife < 5 ? 'destructive' : lifeLimiting.remainingLife < 10 ? 'default' : 'secondary'}>
                {lifeLimiting.remainingLife.toFixed(1)} years remaining
              </Badge>
            )}
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prediction Confidence</CardDescription>
            <CardTitle className="text-lg capitalize">{prediction?.confidenceLevel || 'N/A'}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Thickness Trend Chart */}
      {thicknessTrend && thicknessTrend.length > 0 && (
        <ThicknessTrendChart
          componentName={selectedComponent}
          dataPoints={thicknessTrend.map(d => ({
            inspectionDate: d.inspectionDate,
            thickness: d.thickness,
            corrosionRate: d.corrosionRate,
            remainingLife: d.remainingLife,
          }))}
          minimumThickness={componentTrends?.find(c => c.componentName === selectedComponent)?.minimumThickness || 0}
        />
      )}

      {/* Corrosion Rate Acceleration */}
      {acceleration && acceleration.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Corrosion Rate Acceleration
            </CardTitle>
            <CardDescription>
              Changes in corrosion rate between consecutive inspections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {acceleration.map((acc, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {acc.trend === 'accelerating' ? (
                      <TrendingUp className="h-5 w-5 text-red-600" />
                    ) : acc.trend === 'decelerating' ? (
                      <TrendingDown className="h-5 w-5 text-green-600" />
                    ) : (
                      <Target className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {acc.previousRate.toFixed(4)} → {acc.currentRate.toFixed(4)} in/yr
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {acc.changePercent > 0 ? '+' : ''}{acc.changePercent.toFixed(1)}% change
                      </p>
                    </div>
                  </div>
                  <Badge variant={acc.severity === 'critical' ? 'destructive' : acc.severity === 'elevated' ? 'default' : 'secondary'}>
                    {acc.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Component Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Component Summary</CardTitle>
          <CardDescription>Current status of all tracked components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Component</th>
                  <th className="text-left py-2 px-3">Type</th>
                  <th className="text-right py-2 px-3">Actual (in)</th>
                  <th className="text-right py-2 px-3">Minimum (in)</th>
                  <th className="text-right py-2 px-3">Rate (mpy)</th>
                  <th className="text-right py-2 px-3">Remaining Life</th>
                  <th className="text-center py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {componentTrends?.map((comp) => (
                  <tr 
                    key={comp.componentName} 
                    className={`border-b hover:bg-muted/50 cursor-pointer ${selectedComponent === comp.componentName ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelectedComponent(comp.componentName)}
                  >
                    <td className="py-2 px-3 font-medium">{comp.componentName}</td>
                    <td className="py-2 px-3 capitalize">{comp.componentType}</td>
                    <td className="py-2 px-3 text-right">{comp.actualThickness.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right">{comp.minimumThickness.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right">{(comp.corrosionRate * 1000).toFixed(1)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${comp.remainingLife < 5 ? 'text-red-600' : comp.remainingLife < 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {comp.remainingLife > 50 ? '>50' : comp.remainingLife.toFixed(1)} yr
                    </td>
                    <td className="py-2 px-3 text-center">
                      {comp.dataQualityStatus === 'below_minimum' ? (
                        <Badge variant="destructive">UNSAFE</Badge>
                      ) : comp.governingRateType === 'short_term' ? (
                        <Badge variant="default">Accelerating</Badge>
                      ) : (
                        <Badge variant="secondary">Normal</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
