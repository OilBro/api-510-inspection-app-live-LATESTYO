import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, AlertCircle, Info, CheckCircle, X, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AnomalyPanelProps {
  inspectionId: string;
}

export function AnomalyPanel({ inspectionId }: AnomalyPanelProps) {
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: anomalies, isLoading, refetch } = trpc.anomalies.getForInspection.useQuery({
    inspectionId,
  });

  const exportMutation = trpc.anomalies.exportToCSV.useQuery(
    { inspectionId },
    { enabled: false }
  );

  const handleExport = async () => {
    try {
      const result = await exportMutation.refetch();
      if (result.data?.csv) {
        const blob = new Blob([result.data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anomalies-${inspectionId}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Anomalies exported to CSV');
      }
    } catch (error) {
      toast.error('Failed to export anomalies');
    }
  };

  const reviewMutation = trpc.anomalies.reviewAnomaly.useMutation({
    onSuccess: () => {
      toast.success("Anomaly reviewed successfully");
      setSelectedAnomaly(null);
      setReviewNotes("");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to review anomaly: ${error.message}`);
    },
  });

  const approveMutation = trpc.anomalies.approveInspection.useMutation({
    onSuccess: () => {
      toast.success("Inspection approved");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to approve inspection: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anomaly Detection</CardTitle>
          <CardDescription>Loading anomalies...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!anomalies || anomalies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anomaly Detection</CardTitle>
          <CardDescription>No anomalies detected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">All checks passed</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge variant="default">Warning</Badge>;
      case "info":
        return <Badge variant="secondary">Info</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending Review</Badge>;
      case "acknowledged":
        return <Badge variant="secondary">Acknowledged</Badge>;
      case "resolved":
        return <Badge variant="default" className="bg-green-600">Resolved</Badge>;
      case "false_positive":
        return <Badge variant="secondary">False Positive</Badge>;
      default:
        return null;
    }
  };

  const criticalCount = anomalies.filter((a: any) => a.severity === "critical").length;
  const pendingCount = anomalies.filter((a: any) => a.reviewStatus === "pending").length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Anomaly Detection</CardTitle>
              <CardDescription>
                {anomalies.length} {anomalies.length === 1 ? "anomaly" : "anomalies"} detected
                {criticalCount > 0 && ` (${criticalCount} critical)`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {anomalies.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exportMutation.isFetching}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}
              {pendingCount > 0 && (
                <Button
                  onClick={() => approveMutation.mutate({ inspectionId })}
                  disabled={approveMutation.isPending}
                >
                  Approve All
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {anomalies.map((anomaly: any) => (
              <div
                key={anomaly.id}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedAnomaly(anomaly)}
              >
                <div className="flex items-start gap-3">
                  {getSeverityIcon(anomaly.severity)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{anomaly.title}</h4>
                      {getSeverityBadge(anomaly.severity)}
                      {getStatusBadge(anomaly.reviewStatus)}
                    </div>
                    <p className="text-sm text-gray-600">{anomaly.description}</p>
                    {anomaly.affectedComponent && (
                      <p className="text-xs text-gray-500">
                        Component: <span className="font-medium">{anomaly.affectedComponent}</span>
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500">
                      {anomaly.detectedValue && (
                        <span>Detected: <span className="font-medium">{anomaly.detectedValue}</span></span>
                      )}
                      {anomaly.expectedRange && (
                        <span>Expected: <span className="font-medium">{anomaly.expectedRange}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedAnomaly} onOpenChange={() => setSelectedAnomaly(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Anomaly</DialogTitle>
            <DialogDescription>{selectedAnomaly?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">{selectedAnomaly?.description}</p>
              {selectedAnomaly?.affectedComponent && (
                <p className="text-xs text-gray-500">
                  Component: <span className="font-medium">{selectedAnomaly.affectedComponent}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Notes (Optional)</label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about this anomaly..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reviewMutation.mutate({
                  anomalyId: selectedAnomaly.id,
                  status: "false_positive",
                  notes: reviewNotes,
                });
              }}
              disabled={reviewMutation.isPending}
            >
              Mark as False Positive
            </Button>
            <Button
              variant="default"
              onClick={() => {
                reviewMutation.mutate({
                  anomalyId: selectedAnomaly.id,
                  status: "acknowledged",
                  notes: reviewNotes,
                });
              }}
              disabled={reviewMutation.isPending}
            >
              Acknowledge
            </Button>
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                reviewMutation.mutate({
                  anomalyId: selectedAnomaly.id,
                  status: "resolved",
                  notes: reviewNotes,
                });
              }}
              disabled={reviewMutation.isPending}
            >
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
