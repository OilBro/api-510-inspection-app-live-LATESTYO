/**
 * Data Quality Indicator Component
 * Industry Leader Feature: Visual indicators for data quality status
 */

import { AlertCircle, AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export type DataQualityStatus = 'good' | 'anomaly' | 'growth_error' | 'below_minimum' | 'confirmed';

interface DataQualityIndicatorProps {
  status: DataQualityStatus;
  notes?: string;
  className?: string;
}

export function DataQualityIndicator({ status, notes, className }: DataQualityIndicatorProps) {
  const config = {
    good: {
      icon: CheckCircle,
      variant: "default" as const,
      color: "text-green-600",
      bgColor: "bg-green-50 border-green-200",
      title: "Data Quality: Good",
      badge: "✓ Verified"
    },
    anomaly: {
      icon: AlertTriangle,
      variant: "default" as const,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 border-yellow-200",
      title: "Data Quality: Anomaly Detected",
      badge: "⚠ Review Required"
    },
    growth_error: {
      icon: XCircle,
      variant: "destructive" as const,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-200",
      title: "Data Quality: Growth Error",
      badge: "✗ Invalid Reading"
    },
    below_minimum: {
      icon: AlertCircle,
      variant: "destructive" as const,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-200",
      title: "UNSAFE: Below Minimum Thickness",
      badge: "⚠ REJECTED"
    },
    confirmed: {
      icon: Info,
      variant: "default" as const,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200",
      title: "Data Quality: Confirmed by Inspector",
      badge: "✓ Confirmed"
    }
  };

  const { icon: Icon, variant, color, bgColor, title, badge } = config[status];

  if (status === 'good' && !notes) {
    return null; // Don't show indicator for good data with no notes
  }

  return (
    <Alert className={`${bgColor} ${className}`} variant={variant}>
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <AlertTitle className="flex items-center gap-2">
            {title}
            <Badge variant={variant === "destructive" ? "destructive" : "secondary"} className="text-xs">
              {badge}
            </Badge>
          </AlertTitle>
          {notes && (
            <AlertDescription className="mt-2 text-sm">
              {notes}
            </AlertDescription>
          )}
        </div>
      </div>
    </Alert>
  );
}

/**
 * Corrosion Rate Display Component
 * Shows dual corrosion rates with governing rate indicator
 */
interface CorrosionRateDisplayProps {
  longTermRate: number;
  shortTermRate: number;
  governingRate: number;
  governingType: 'long_term' | 'short_term' | 'nominal';
  governingReason?: string;
  className?: string;
}

export function CorrosionRateDisplay({
  longTermRate,
  shortTermRate,
  governingRate,
  governingType,
  governingReason,
  className
}: CorrosionRateDisplayProps) {
  const formatRate = (rate: number) => (rate * 1000).toFixed(1); // Convert to mpy

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-muted-foreground">Long-Term Rate</div>
          <div className={`text-2xl font-bold ${governingType === 'long_term' ? 'text-primary' : 'text-muted-foreground'}`}>
            {formatRate(longTermRate)} mpy
          </div>
          {governingType === 'long_term' && (
            <Badge variant="default" className="text-xs">
              ★ Governing
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium text-muted-foreground">Short-Term Rate</div>
          <div className={`text-2xl font-bold ${governingType === 'short_term' ? 'text-primary' : 'text-muted-foreground'}`}>
            {formatRate(shortTermRate)} mpy
          </div>
          {governingType === 'short_term' && (
            <Badge variant="default" className="text-xs">
              ★ Governing
            </Badge>
          )}
        </div>
      </div>

      {governingType === 'nominal' && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm">
            Using nominal rate of {formatRate(governingRate)} mpy (no measurable corrosion)
          </AlertDescription>
        </Alert>
      )}

      {governingReason && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
          <strong>Governing Rate Selection:</strong> {governingReason}
        </div>
      )}
    </div>
  );
}
