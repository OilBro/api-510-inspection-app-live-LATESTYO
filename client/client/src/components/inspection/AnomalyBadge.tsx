import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AnomalyBadgeProps {
  count: number;
  severity?: "critical" | "warning" | "info";
  showIcon?: boolean;
}

export function AnomalyBadge({ count, severity = "warning", showIcon = true }: AnomalyBadgeProps) {
  if (count === 0) return null;

  const variants = {
    critical: {
      variant: "destructive" as const,
      icon: AlertTriangle,
      label: "Critical",
    },
    warning: {
      variant: "default" as const,
      icon: AlertCircle,
      label: "Warning",
    },
    info: {
      variant: "secondary" as const,
      icon: Info,
      label: "Info",
    },
  };

  const config = variants[severity];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      {showIcon && <Icon className="h-3 w-3" />}
      {count} {count === 1 ? "Anomaly" : "Anomalies"}
    </Badge>
  );
}
