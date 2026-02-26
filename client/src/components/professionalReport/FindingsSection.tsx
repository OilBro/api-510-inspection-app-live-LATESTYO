import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Edit, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface FindingsSectionProps {
  reportId: string;
}

export default function FindingsSection({ reportId }: FindingsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<any>(null);
  const utils = trpc.useUtils();

  const { data: findings, isLoading } = trpc.professionalReport.findings.list.useQuery({
    reportId,
  });

  const createFinding = trpc.professionalReport.findings.create.useMutation({
    onSuccess: () => {
      utils.professionalReport.findings.list.invalidate();
      toast.success("Finding added successfully");
      setDialogOpen(false);
      setEditingFinding(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to add finding: ${error.message}`);
    },
  });

  const updateFinding = trpc.professionalReport.findings.update.useMutation({
    onSuccess: () => {
      utils.professionalReport.findings.list.invalidate();
      toast.success("Finding updated successfully");
      setDialogOpen(false);
      setEditingFinding(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update finding: ${error.message}`);
    },
  });

  const deleteFinding = trpc.professionalReport.findings.delete.useMutation({
    onSuccess: () => {
      utils.professionalReport.findings.list.invalidate();
      toast.success("Finding deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete finding: ${error.message}`);
    },
  });

  const deleteAllFindings = trpc.professionalReport.deleteAllFindings.useMutation({
    onSuccess: () => {
      utils.professionalReport.findings.list.invalidate();
      toast.success("All findings deleted");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getFindingTypeColor = (type: string) => {
    switch (type) {
      case "defect":
        return "bg-red-50 text-red-700";
      case "recommendation":
        return "bg-blue-50 text-blue-700";
      case "observation":
        return "bg-gray-50 text-gray-700";
      default:
        return "bg-gray-50 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Group findings by section
  const groupedFindings = findings?.reduce((acc: any, finding: any) => {
    const section = finding.section || "Other";
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(finding);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Inspection Findings</h3>
          <p className="text-sm text-muted-foreground">
            Document observations, defects, and recommendations by component section
          </p>
        </div>
        <div className="flex items-center gap-2">
          {findings && findings.length > 0 && (
            <Button
              variant="outline"
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                if (confirm("Delete ALL findings? This cannot be undone.")) {
                  deleteAllFindings.mutate({ reportId });
                }
              }}
              disabled={deleteAllFindings.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete All
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="gap-2"
                onClick={() => {
                  setEditingFinding(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Finding
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingFinding ? "Edit Finding" : "Add Inspection Finding"}
                </DialogTitle>
                <DialogDescription>
                  Record inspection observations, defects, or recommendations
                </DialogDescription>
              </DialogHeader>
              <FindingForm
                reportId={reportId}
                finding={editingFinding}
                onSubmit={(data) => {
                  if (editingFinding) {
                    updateFinding.mutate({ findingId: editingFinding.id, ...data });
                  } else {
                    createFinding.mutate({ reportId, ...data });
                  }
                }}
                onCancel={() => {
                  setDialogOpen(false);
                  setEditingFinding(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {findings && findings.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedFindings || {}).map(([section, sectionFindings]: [string, any]) => (
            <Card key={section}>
              <CardHeader>
                <CardTitle className="text-base">{section}</CardTitle>
                <CardDescription>
                  {sectionFindings.length} finding{sectionFindings.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sectionFindings.map((finding: any) => (
                  <div
                    key={finding.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getFindingTypeColor(finding.findingType)}>
                          {finding.findingType}
                        </Badge>
                        <Badge className={getSeverityColor(finding.severity)}>
                          {finding.severity}
                        </Badge>
                        {finding.location && (
                          <span className="text-sm text-muted-foreground">
                            @ {finding.location}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingFinding(finding);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this finding?")) {
                              deleteFinding.mutate({ findingId: finding.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-900">{finding.description}</p>
                    </div>

                    {finding.measurements && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Measurements:</span> {finding.measurements}
                      </div>
                    )}

                    {finding.photos && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Photos:</span> {finding.photos}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No findings recorded yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add inspection findings, observations, and defects
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Finding
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface FindingFormProps {
  reportId: string;
  finding?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function FindingForm({ finding, onSubmit, onCancel }: FindingFormProps) {
  const [formData, setFormData] = useState({
    section: finding?.section || "Shell",
    findingType: finding?.findingType || "observation",
    severity: finding?.severity || "low",
    description: finding?.description || "",
    location: finding?.location || "",
    measurements: finding?.measurements || "",
    photos: finding?.photos || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="section">Section *</Label>
          <Select value={formData.section} onValueChange={(value) => handleChange("section", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Foundation">Foundation</SelectItem>
              <SelectItem value="Shell">Shell</SelectItem>
              <SelectItem value="Heads">Heads</SelectItem>
              <SelectItem value="Appurtenances">Appurtenances</SelectItem>
              <SelectItem value="Nozzles">Nozzles</SelectItem>
              <SelectItem value="Supports">Supports</SelectItem>
              <SelectItem value="Insulation">Insulation</SelectItem>
              <SelectItem value="Coating">Coating</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="findingType">Finding Type *</Label>
          <Select
            value={formData.findingType}
            onValueChange={(value) => handleChange("findingType", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="observation">Observation</SelectItem>
              <SelectItem value="defect">Defect</SelectItem>
              <SelectItem value="recommendation">Recommendation</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="severity">Severity *</Label>
          <Select
            value={formData.severity}
            onValueChange={(value) => handleChange("severity", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => handleChange("location", e.target.value)}
            placeholder="e.g., North side, 6 o'clock position"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Detailed description of the finding..."
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="measurements">Measurements</Label>
        <Input
          id="measurements"
          value={formData.measurements}
          onChange={(e) => handleChange("measurements", e.target.value)}
          placeholder="e.g., Pit depth: 0.125 in, Length: 3 in"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="photos">Photo References</Label>
        <Input
          id="photos"
          value={formData.photos}
          onChange={(e) => handleChange("photos", e.target.value)}
          placeholder="e.g., Photo 1, Photo 2, Photo 3"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{finding ? "Update Finding" : "Add Finding"}</Button>
      </div>
    </form>
  );
}

