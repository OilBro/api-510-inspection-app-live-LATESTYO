import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";

export function AnomalyStats() {
  const { data: stats, isLoading } = trpc.anomalies.getStatistics.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anomaly Detection</CardTitle>
          <CardDescription>Loading statistics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Detection</CardTitle>
        <CardDescription>Data quality monitoring</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.pendingReview > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
              <AlertTriangle className="h-4 w-4" />
              {stats.pendingReview} {stats.pendingReview === 1 ? "Report" : "Reports"} Pending Review
            </div>
            <p className="text-xs text-red-600">Critical anomalies detected</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Anomalies</span>
            <Badge variant="outline">{stats.totalAnomalies}</Badge>
          </div>
          
          {stats.criticalCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-gray-600">Critical</span>
              </div>
              <Badge variant="destructive">{stats.criticalCount}</Badge>
            </div>
          )}

          {stats.warningCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-gray-600">Warnings</span>
              </div>
              <Badge variant="default">{stats.warningCount}</Badge>
            </div>
          )}

          {stats.infoCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-600">Info</span>
              </div>
              <Badge variant="secondary">{stats.infoCount}</Badge>
            </div>
          )}
        </div>

        {stats.totalAnomalies === 0 && (
          <div className="text-center py-4 text-sm text-gray-500">
            No anomalies detected
          </div>
        )}
      </CardContent>
    </Card>
  );
}
