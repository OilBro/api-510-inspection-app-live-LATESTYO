import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";

export default function RCRAComplianceDashboard() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const [activeCategory, setActiveCategory] = useState("integrity_assessment");

  const { data: categories } = trpc.rcraCompliance.getChecklistCategories.useQuery();
  const { data: summary } = trpc.rcraCompliance.getComplianceSummary.useQuery(
    { inspectionId: inspectionId! },
    { enabled: !!inspectionId }
  );
  const { data: facilityStatus } = trpc.rcraCompliance.getFacilityStatus.useQuery(
    { inspectionId: inspectionId! },
    { enabled: !!inspectionId }
  );
  const { data: checklistItems, refetch: refetchItems } = trpc.rcraCompliance.getChecklistItems.useQuery(
    { inspectionId: inspectionId!, category: activeCategory as any },
    { enabled: !!inspectionId }
  );

  const updateItem = trpc.rcraCompliance.updateChecklistItem.useMutation({
    onSuccess: () => refetchItems(),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "satisfactory": return "bg-green-500";
      case "unsatisfactory": return "bg-red-500";
      case "na": return "bg-gray-400";
      default: return "bg-yellow-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "satisfactory": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "unsatisfactory": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "na": return <Clock className="h-4 w-4 text-gray-400" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const calculateOverallCompliance = () => {
    if (!summary) return 0;
    let totalItems = 0;
    let satisfactoryItems = 0;
    Object.values(summary).forEach((cat: any) => {
      totalItems += cat.total - cat.na;
      satisfactoryItems += cat.satisfactory;
    });
    return totalItems > 0 ? Math.round((satisfactoryItems / totalItems) * 100) : 0;
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/inspections/${inspectionId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inspection
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            RCRA Compliance Dashboard
          </h1>
          <p className="text-muted-foreground">40 CFR Part 265 Subpart J - Tank Systems</p>
        </div>
      </div>

      {/* Overall Compliance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{calculateOverallCompliance()}%</div>
            <Progress value={calculateOverallCompliance()} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Facility Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={facilityStatus?.interimStatus === "active" ? "default" : "secondary"}>
              {facilityStatus?.interimStatus || "Not Set"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {facilityStatus?.tankMaterial || "Unknown"} Tank
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Items Requiring Action</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {summary ? Object.values(summary).reduce((acc: number, cat: any) => acc + cat.unsatisfactory, 0) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Unsatisfactory findings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Inspections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {summary ? Object.values(summary).reduce((acc: number, cat: any) => acc + cat.notInspected, 0) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Items not yet inspected</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {categories?.map((cat) => (
            <TabsTrigger key={cat.key} value={cat.key} className="text-xs">
              {cat.title}
              {summary?.[cat.key] && (
                <Badge variant="outline" className="ml-1 text-xs">
                  {summary[cat.key].satisfactory}/{summary[cat.key].total}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories?.map((cat) => (
          <TabsContent key={cat.key} value={cat.key} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{cat.title}</CardTitle>
                <CardDescription>
                  {cat.itemCount} inspection items per 40 CFR Part 265
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {checklistItems?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(item.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.itemCode}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {item.regulatoryReference}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">{item.itemDescription}</p>
                        {item.findings && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Findings: {item.findings}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={item.status === "satisfactory" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => updateItem.mutate({ id: item.id, status: "satisfactory" })}
                        >
                          Pass
                        </Button>
                        <Button
                          size="sm"
                          variant={item.status === "unsatisfactory" ? "destructive" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => updateItem.mutate({ id: item.id, status: "unsatisfactory" })}
                        >
                          Fail
                        </Button>
                        <Button
                          size="sm"
                          variant={item.status === "na" ? "secondary" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => updateItem.mutate({ id: item.id, status: "na" })}
                        >
                          N/A
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Regulatory Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Regulatory References
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>40 CFR 265.191</strong> - Assessment of existing tank system's integrity</p>
          <p><strong>40 CFR 265.193</strong> - Containment and detection of releases</p>
          <p><strong>40 CFR 265.194</strong> - General operating requirements</p>
          <p><strong>40 CFR 265.195</strong> - Inspections</p>
          <p><strong>40 CFR 265.196</strong> - Response to leaks or spills</p>
          <p><strong>NACE SP0169</strong> - Control of External Corrosion on Underground or Submerged Metallic Piping Systems</p>
        </CardContent>
      </Card>
    </div>
  );
}
