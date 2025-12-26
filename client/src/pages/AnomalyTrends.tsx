import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

export default function AnomalyTrends() {
  const [daysBack, setDaysBack] = useState(90);

  const { data: trends, isLoading: trendsLoading, refetch: refetchTrends } = trpc.anomalies.getTrends.useQuery({ daysBack });
  const { data: categoryBreakdown, isLoading: categoryLoading } = trpc.anomalies.getCategoryBreakdown.useQuery();
  const { data: vesselTypeBreakdown, isLoading: vesselLoading } = trpc.anomalies.getVesselTypeBreakdown.useQuery();
  const { data: recurringProblems, isLoading: recurringLoading } = trpc.anomalies.getRecurringProblems.useQuery();

  const isLoading = trendsLoading || categoryLoading || vesselLoading || recurringLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Anomaly Trends & Analytics</h1>
                <p className="text-sm text-gray-600">Data quality insights and patterns</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchTrends()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Time Range Selector */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium">Time Range:</label>
          <Select value={daysBack.toString()} onValueChange={(value) => setDaysBack(parseInt(value))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="60">Last 60 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="180">Last 6 Months</SelectItem>
              <SelectItem value="365">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Detection Rate Trend */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Detection Rate Over Time</CardTitle>
            <CardDescription>Anomalies detected per day</CardDescription>
          </CardHeader>
          <CardContent>
            {trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="criticalCount" stroke="#ef4444" name="Critical" strokeWidth={2} />
                  <Line type="monotone" dataKey="warningCount" stroke="#f59e0b" name="Warning" strokeWidth={2} />
                  <Line type="monotone" dataKey="infoCount" stroke="#3b82f6" name="Info" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No trend data available for the selected time range
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Most Common Issues</CardTitle>
              <CardDescription>Breakdown by anomaly category</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryBreakdown && categoryBreakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {categoryBreakdown.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span>{item.category}</span>
                        </div>
                        <span className="font-medium">{item.count} ({item.percentage.toFixed(1)}%)</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No category data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vessel Type Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Issues by Vessel Type</CardTitle>
              <CardDescription>Average anomalies per inspection</CardDescription>
            </CardHeader>
            <CardContent>
              {vesselTypeBreakdown && vesselTypeBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={vesselTypeBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="vesselType" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgAnomaliesPerInspection" fill="#3b82f6" name="Avg Anomalies/Inspection" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No vessel type data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recurring Problems */}
        <Card>
          <CardHeader>
            <CardTitle>Recurring Problems</CardTitle>
            <CardDescription>Vessels with repeated anomalies across multiple inspections</CardDescription>
          </CardHeader>
          <CardContent>
            {recurringProblems && recurringProblems.length > 0 ? (
              <div className="space-y-3">
                {recurringProblems.map((problem, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium">{problem.vesselTag}</h4>
                          <p className="text-sm text-gray-600">{problem.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{problem.occurrences} occurrences</p>
                        <p className="text-xs text-gray-500">in {problem.inspectionCount} inspections</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>No recurring problems detected</p>
                <p className="text-sm">This is a good sign - your vessels show consistent data quality</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
