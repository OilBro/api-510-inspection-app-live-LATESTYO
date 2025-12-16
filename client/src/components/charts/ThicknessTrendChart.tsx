/**
 * Enhanced Thickness Trend Chart
 * Phase 4: Multi-inspection trend visualization with predictions
 */

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, AlertTriangle, Target } from "lucide-react";

interface DataPoint {
  inspectionDate: string;
  thickness: number;
  corrosionRate: number;
  remainingLife: number;
}

interface ThicknessTrendChartProps {
  componentName: string;
  dataPoints: DataPoint[];
  minimumThickness: number;
  nominalThickness?: number;
  className?: string;
}

export function ThicknessTrendChart({
  componentName,
  dataPoints,
  minimumThickness,
  nominalThickness,
  className,
}: ThicknessTrendChartProps) {
  // Calculate chart dimensions
  const chartWidth = 600;
  const chartHeight = 300;
  const padding = { top: 20, right: 60, bottom: 40, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Calculate scales and predictions
  const { xScale, yScale, trendLine, prediction } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { xScale: () => 0, yScale: () => 0, trendLine: null, prediction: null };
    }

    // Parse dates
    const dates = dataPoints.map(d => new Date(d.inspectionDate).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    
    // Extend prediction 10 years into future
    const futureDate = maxDate + (10 * 365.25 * 24 * 60 * 60 * 1000);
    
    // Calculate thickness range
    const thicknesses = dataPoints.map(d => d.thickness);
    const minThickness = Math.min(...thicknesses, minimumThickness);
    const maxThickness = Math.max(...thicknesses, nominalThickness || 0);
    const thicknessRange = maxThickness - minThickness;
    
    // X scale (time)
    const xScale = (date: number) => {
      const range = futureDate - minDate;
      return padding.left + ((date - minDate) / range) * innerWidth;
    };
    
    // Y scale (thickness)
    const yScale = (thickness: number) => {
      return padding.top + innerHeight - ((thickness - minThickness + thicknessRange * 0.1) / (thicknessRange * 1.2)) * innerHeight;
    };
    
    // Calculate linear regression for trend line
    let trendLine = null;
    let prediction = null;
    
    if (dataPoints.length >= 2) {
      const n = dataPoints.length;
      const sumX = dates.reduce((a, b) => a + b, 0);
      const sumY = thicknesses.reduce((a, b) => a + b, 0);
      const sumXY = dates.reduce((sum, x, i) => sum + x * thicknesses[i], 0);
      const sumXX = dates.reduce((sum, x) => sum + x * x, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Trend line points
      const startY = slope * minDate + intercept;
      const endY = slope * futureDate + intercept;
      
      trendLine = {
        x1: xScale(minDate),
        y1: yScale(startY),
        x2: xScale(futureDate),
        y2: yScale(endY),
      };
      
      // Prediction: when will it hit minimum?
      if (slope < 0) {
        const timeToMin = (minimumThickness - intercept) / slope;
        const yearsToMin = (timeToMin - maxDate) / (365.25 * 24 * 60 * 60 * 1000);
        
        prediction = {
          yearsToMinimum: Math.max(0, yearsToMin),
          thicknessIn5Years: slope * (maxDate + 5 * 365.25 * 24 * 60 * 60 * 1000) + intercept,
          thicknessIn10Years: slope * (maxDate + 10 * 365.25 * 24 * 60 * 60 * 1000) + intercept,
        };
      }
    }
    
    return { xScale, yScale, trendLine, prediction };
  }, [dataPoints, minimumThickness, nominalThickness, innerWidth, innerHeight, padding]);

  // Determine trend direction
  const trendDirection = useMemo(() => {
    if (dataPoints.length < 2) return 'stable';
    const first = dataPoints[0].thickness;
    const last = dataPoints[dataPoints.length - 1].thickness;
    const change = ((last - first) / first) * 100;
    
    if (change < -5) return 'decreasing';
    if (change > 5) return 'increasing';
    return 'stable';
  }, [dataPoints]);

  if (dataPoints.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {componentName} Thickness Trend
          </CardTitle>
          <CardDescription>No historical data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {componentName} Thickness Trend
            </CardTitle>
            <CardDescription>
              {dataPoints.length} inspection{dataPoints.length !== 1 ? 's' : ''} recorded
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {trendDirection === 'decreasing' && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Decreasing
              </Badge>
            )}
            {trendDirection === 'increasing' && (
              <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                <TrendingUp className="h-3 w-3" />
                Increasing
              </Badge>
            )}
            {trendDirection === 'stable' && (
              <Badge variant="secondary">Stable</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <svg width={chartWidth} height={chartHeight} className="w-full h-auto">
          {/* Grid lines */}
          <g className="text-muted-foreground/20">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
              <line
                key={i}
                x1={padding.left}
                y1={padding.top + innerHeight * ratio}
                x2={chartWidth - padding.right}
                y2={padding.top + innerHeight * ratio}
                stroke="currentColor"
                strokeDasharray="4,4"
              />
            ))}
          </g>
          
          {/* Minimum thickness line */}
          <line
            x1={padding.left}
            y1={yScale(minimumThickness)}
            x2={chartWidth - padding.right}
            y2={yScale(minimumThickness)}
            stroke="rgb(239 68 68)"
            strokeWidth={2}
            strokeDasharray="8,4"
          />
          <text
            x={chartWidth - padding.right + 5}
            y={yScale(minimumThickness)}
            fill="rgb(239 68 68)"
            fontSize={10}
            dominantBaseline="middle"
          >
            Min
          </text>
          
          {/* Nominal thickness line */}
          {nominalThickness && (
            <>
              <line
                x1={padding.left}
                y1={yScale(nominalThickness)}
                x2={chartWidth - padding.right}
                y2={yScale(nominalThickness)}
                stroke="rgb(34 197 94)"
                strokeWidth={2}
                strokeDasharray="8,4"
              />
              <text
                x={chartWidth - padding.right + 5}
                y={yScale(nominalThickness)}
                fill="rgb(34 197 94)"
                fontSize={10}
                dominantBaseline="middle"
              >
                Nom
              </text>
            </>
          )}
          
          {/* Trend line (prediction) */}
          {trendLine && (
            <line
              x1={trendLine.x1}
              y1={trendLine.y1}
              x2={trendLine.x2}
              y2={trendLine.y2}
              stroke="rgb(59 130 246)"
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.6}
            />
          )}
          
          {/* Data line */}
          <polyline
            points={dataPoints.map(d => 
              `${xScale(new Date(d.inspectionDate).getTime())},${yScale(d.thickness)}`
            ).join(' ')}
            fill="none"
            stroke="rgb(59 130 246)"
            strokeWidth={2}
          />
          
          {/* Data points */}
          {dataPoints.map((d, i) => (
            <g key={i}>
              <circle
                cx={xScale(new Date(d.inspectionDate).getTime())}
                cy={yScale(d.thickness)}
                r={6}
                fill="rgb(59 130 246)"
                stroke="white"
                strokeWidth={2}
              />
              <title>
                {new Date(d.inspectionDate).toLocaleDateString()}: {d.thickness.toFixed(4)}"
              </title>
            </g>
          ))}
          
          {/* Y-axis label */}
          <text
            x={15}
            y={chartHeight / 2}
            fill="currentColor"
            fontSize={12}
            textAnchor="middle"
            transform={`rotate(-90, 15, ${chartHeight / 2})`}
          >
            Thickness (in)
          </text>
          
          {/* X-axis label */}
          <text
            x={chartWidth / 2}
            y={chartHeight - 5}
            fill="currentColor"
            fontSize={12}
            textAnchor="middle"
          >
            Inspection Date
          </text>
        </svg>
        
        {/* Prediction summary */}
        {prediction && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Trend Prediction
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Years to Minimum</p>
                <p className={`font-bold ${prediction.yearsToMinimum < 5 ? 'text-red-600' : prediction.yearsToMinimum < 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {prediction.yearsToMinimum > 50 ? '>50' : prediction.yearsToMinimum.toFixed(1)} years
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Thickness in 5 Years</p>
                <p className={`font-bold ${prediction.thicknessIn5Years < minimumThickness ? 'text-red-600' : ''}`}>
                  {prediction.thicknessIn5Years.toFixed(4)}"
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Thickness in 10 Years</p>
                <p className={`font-bold ${prediction.thicknessIn10Years < minimumThickness ? 'text-red-600' : ''}`}>
                  {prediction.thicknessIn10Years.toFixed(4)}"
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ThicknessTrendChart;
