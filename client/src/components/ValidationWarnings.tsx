import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Info, X, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ValidationWarningsProps {
  inspectionId: string;
}

export function ValidationWarnings({ inspectionId }: ValidationWarningsProps) {
  const utils = trpc.useUtils();
  
  const { data, isLoading } = trpc.validationWarnings.getWarnings.useQuery({
    inspectionId,
  });

  const dismissMutation = trpc.validationWarnings.dismissAll.useMutation({
    onSuccess: () => {
      toast.success("All warnings dismissed");
      utils.validationWarnings.getWarnings.invalidate({ inspectionId });
    },
    onError: (error) => {
      toast.error(`Failed to dismiss warnings: ${error.message}`);
    },
  });

  const restoreMutation = trpc.validationWarnings.restore.useMutation({
    onSuccess: () => {
      toast.success("Warnings restored");
      utils.validationWarnings.getWarnings.invalidate({ inspectionId });
    },
    onError: (error) => {
      toast.error(`Failed to restore warnings: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Validation</CardTitle>
          <CardDescription>Checking for missing or fallback values...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // If warnings are dismissed, show compact restore option
  if (data?.dismissed) {
    return (
      <Card className="border-dashed border-gray-300">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500">
              <Info className="h-4 w-4" />
              <span className="text-sm">Validation warnings hidden</span>
              {data.dismissedAt && (
                <span className="text-xs text-gray-400">
                  (dismissed {new Date(data.dismissedAt).toLocaleDateString()})
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => restoreMutation.mutate({ inspectionId })}
              disabled={restoreMutation.isPending}
            >
              <Eye className="h-4 w-4 mr-1" />
              Show Warnings
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (!data || data.totalWarnings === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Validation</CardTitle>
          <CardDescription>All data extracted successfully</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No warnings</AlertTitle>
            <AlertDescription>
              All required fields were successfully extracted from the PDF. No fallback values are being used.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityVariant = (severity: string): "default" | "destructive" => {
    return severity === "error" ? "destructive" : "default";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Data Validation Warnings</CardTitle>
            <CardDescription>
              {data.totalWarnings} issue{data.totalWarnings !== 1 ? "s" : ""} found
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {data.errorCount > 0 && (
              <Badge variant="destructive">{data.errorCount} Error{data.errorCount !== 1 ? "s" : ""}</Badge>
            )}
            {data.warningCount > 0 && (
              <Badge variant="secondary">{data.warningCount} Warning{data.warningCount !== 1 ? "s" : ""}</Badge>
            )}
            {data.infoCount > 0 && (
              <Badge variant="outline">{data.infoCount} Info</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => dismissMutation.mutate({ inspectionId })}
              disabled={dismissMutation.isPending}
              className="ml-2"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.warnings.map((warning, index) => (
          <Alert key={index} variant={getSeverityVariant(warning.severity)}>
            {getSeverityIcon(warning.severity)}
            <AlertTitle className="flex items-center gap-2">
              {warning.message}
              {warning.component && (
                <Badge variant="outline" className="ml-2">
                  {warning.component}
                </Badge>
              )}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              {warning.fallbackValue && (
                <div className="text-sm">
                  <strong>Using fallback:</strong> {warning.fallbackValue}
                </div>
              )}
              <div className="text-sm">
                <strong>Action:</strong> {warning.suggestedAction}
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
