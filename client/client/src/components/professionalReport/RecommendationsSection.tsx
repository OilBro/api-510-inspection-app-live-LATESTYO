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
import { Plus, Trash2, Edit, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface RecommendationsSectionProps {
  reportId: string;
}

export default function RecommendationsSection({ reportId }: RecommendationsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecommendation, setEditingRecommendation] = useState<any>(null);
  const utils = trpc.useUtils();

  const { data: recommendations, isLoading } = trpc.professionalReport.recommendations.list.useQuery({
    reportId,
  });

  const createRecommendation = trpc.professionalReport.recommendations.create.useMutation({
    onSuccess: () => {
      utils.professionalReport.recommendations.list.invalidate();
      toast.success("Recommendation added successfully");
      setDialogOpen(false);
      setEditingRecommendation(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to add recommendation: ${error.message}`);
    },
  });

  const updateRecommendation = trpc.professionalReport.recommendations.update.useMutation({
    onSuccess: () => {
      utils.professionalReport.recommendations.list.invalidate();
      toast.success("Recommendation updated successfully");
      setDialogOpen(false);
      setEditingRecommendation(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update recommendation: ${error.message}`);
    },
  });

  const deleteRecommendation = trpc.professionalReport.recommendations.delete.useMutation({
    onSuccess: () => {
      utils.professionalReport.recommendations.list.invalidate();
      toast.success("Recommendation deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete recommendation: ${error.message}`);
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Group recommendations by section
  const groupedRecommendations = recommendations?.reduce((acc: any, rec: any) => {
    const section = rec.section || "General";
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(rec);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Recommendations</h3>
          <p className="text-sm text-muted-foreground">
            Document recommended actions and repairs
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="gap-2"
              onClick={() => {
                setEditingRecommendation(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Recommendation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRecommendation ? "Edit Recommendation" : "Add Recommendation"}
              </DialogTitle>
              <DialogDescription>
                Document recommended actions, repairs, or improvements
              </DialogDescription>
            </DialogHeader>
            <RecommendationForm
              reportId={reportId}
              recommendation={editingRecommendation}
              onSubmit={(data) => {
                if (editingRecommendation) {
                  updateRecommendation.mutate({ recommendationId: editingRecommendation.id, ...data });
                } else {
                  createRecommendation.mutate({ reportId, ...data });
                }
              }}
              onCancel={() => {
                setDialogOpen(false);
                setEditingRecommendation(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {recommendations && recommendations.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedRecommendations || {}).map(([section, sectionRecs]: [string, any]) => (
            <Card key={section}>
              <CardHeader>
                <CardTitle className="text-base">{section}</CardTitle>
                <CardDescription>
                  {sectionRecs.length} recommendation{sectionRecs.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sectionRecs.map((rec: any) => (
                  <div
                    key={rec.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(rec.priority || 'low')}>
                          {rec.priority || 'low'}
                        </Badge>
                        {rec.subsection && (
                          <span className="text-sm text-muted-foreground">
                            {rec.subsection}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingRecommendation(rec);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this recommendation?")) {
                              deleteRecommendation.mutate({ recommendationId: rec.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-900">{rec.recommendation}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No recommendations yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add recommendations for repairs, improvements, or follow-up actions
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Recommendation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface RecommendationFormProps {
  reportId: string;
  recommendation?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function RecommendationForm({ recommendation, onSubmit, onCancel }: RecommendationFormProps) {
  const [formData, setFormData] = useState({
    section: recommendation?.section || "General",
    subsection: recommendation?.subsection || "",
    recommendation: recommendation?.recommendation || "",
    priority: recommendation?.priority || "medium",
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
              <SelectItem value="General">General</SelectItem>
              <SelectItem value="Foundation">Foundation</SelectItem>
              <SelectItem value="Shell">Shell</SelectItem>
              <SelectItem value="Heads">Heads</SelectItem>
              <SelectItem value="Appurtenances">Appurtenances</SelectItem>
              <SelectItem value="Nozzles">Nozzles</SelectItem>
              <SelectItem value="Supports">Supports</SelectItem>
              <SelectItem value="Insulation">Insulation</SelectItem>
              <SelectItem value="Coating">Coating</SelectItem>
              <SelectItem value="Safety Systems">Safety Systems</SelectItem>
              <SelectItem value="Documentation">Documentation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority *</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => handleChange("priority", value)}
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="subsection">Subsection / Reference</Label>
        <Input
          id="subsection"
          value={formData.subsection}
          onChange={(e) => handleChange("subsection", e.target.value)}
          placeholder="e.g., Section 4.2.1, Drawing A-101"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recommendation">Recommendation *</Label>
        <Textarea
          id="recommendation"
          value={formData.recommendation}
          onChange={(e) => handleChange("recommendation", e.target.value)}
          placeholder="Detailed recommendation..."
          rows={6}
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{recommendation ? "Update Recommendation" : "Add Recommendation"}</Button>
      </div>
    </form>
  );
}

