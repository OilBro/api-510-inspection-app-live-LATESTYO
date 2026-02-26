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
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface FfsAssessmentSectionProps {
  inspectionId: string;
}

export default function FfsAssessmentSection({ inspectionId }: FfsAssessmentSectionProps) {
  const utils = trpc.useUtils();
  const [formData, setFormData] = useState({
    assessmentLevel: "level1" as "level1" | "level2" | "level3",
    damageType: "",
    remainingThickness: "",
    minimumRequired: "",
    futureCorrosionAllowance: "",
    acceptable: false,
    remainingLife: "",
    nextInspectionDate: "",
    assessmentNotes: "",
    recommendations: "",
  });

  const { data: assessments, isLoading } = trpc.professionalReport.ffsAssessment.list.useQuery({
    inspectionId,
  });

  const createAssessment = trpc.professionalReport.ffsAssessment.create.useMutation({
    onSuccess: () => {
      utils.professionalReport.ffsAssessment.list.invalidate();
      toast.success("FFS Assessment added successfully");
      // Reset form
      setFormData({
        assessmentLevel: "level1",
        damageType: "",
        remainingThickness: "",
        minimumRequired: "",
        futureCorrosionAllowance: "",
        acceptable: false,
        remainingLife: "",
        nextInspectionDate: "",
        assessmentNotes: "",
        recommendations: "",
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to add assessment: ${error.message}`);
    },
  });

  const updateAssessment = trpc.professionalReport.ffsAssessment.update.useMutation({
    onSuccess: () => {
      utils.professionalReport.ffsAssessment.list.invalidate();
      toast.success("FFS Assessment updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update assessment: ${error.message}`);
    },
  });

  const deleteAssessment = trpc.professionalReport.ffsAssessment.delete.useMutation({
    onSuccess: () => {
      utils.professionalReport.ffsAssessment.list.invalidate();
      toast.success("FFS Assessment deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete assessment: ${error.message}`);
    },
  });

  const deleteAllFfs = trpc.professionalReport.deleteAllFfsAssessments.useMutation({
    onSuccess: () => {
      utils.professionalReport.ffsAssessment.list.invalidate();
      toast.success("All FFS assessments deleted");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAssessment.mutate({
      inspectionId,
      ...formData,
    });
  };

  const handleFieldUpdate = (id: string, field: string, value: any) => {
    updateAssessment.mutate({
      id,
      [field]: value,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add New Assessment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add FFS Assessment (API 579)</CardTitle>
          <CardDescription>
            Fitness-For-Service assessment per API 579-1/ASME FFS-1
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assessmentLevel">Assessment Level</Label>
                <Select
                  value={formData.assessmentLevel}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, assessmentLevel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level1">Level 1 - Screening</SelectItem>
                    <SelectItem value="level2">Level 2 - Engineering</SelectItem>
                    <SelectItem value="level3">Level 3 - Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="damageType">Damage Type</Label>
                <Input
                  id="damageType"
                  value={formData.damageType}
                  onChange={(e) => setFormData({ ...formData, damageType: e.target.value })}
                  placeholder="e.g., General Metal Loss, LTA, Pitting"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="remainingThickness">Remaining Thickness (in)</Label>
                <Input
                  id="remainingThickness"
                  type="number"
                  step="0.0001"
                  value={formData.remainingThickness}
                  onChange={(e) =>
                    setFormData({ ...formData, remainingThickness: e.target.value })
                  }
                  placeholder="0.4200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumRequired">Minimum Required (in)</Label>
                <Input
                  id="minimumRequired"
                  type="number"
                  step="0.0001"
                  value={formData.minimumRequired}
                  onChange={(e) =>
                    setFormData({ ...formData, minimumRequired: e.target.value })
                  }
                  placeholder="0.2950"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="futureCorrosionAllowance">Future CA (in)</Label>
                <Input
                  id="futureCorrosionAllowance"
                  type="number"
                  step="0.0001"
                  value={formData.futureCorrosionAllowance}
                  onChange={(e) =>
                    setFormData({ ...formData, futureCorrosionAllowance: e.target.value })
                  }
                  placeholder="0.1250"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="acceptable"
                  checked={formData.acceptable}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, acceptable: checked })
                  }
                />
                <Label htmlFor="acceptable">Acceptable</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remainingLife">Remaining Life (years)</Label>
                <Input
                  id="remainingLife"
                  type="number"
                  step="0.01"
                  value={formData.remainingLife}
                  onChange={(e) =>
                    setFormData({ ...formData, remainingLife: e.target.value })
                  }
                  placeholder="15.63"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextInspectionDate">Next Inspection Date</Label>
                <Input
                  id="nextInspectionDate"
                  type="date"
                  value={formData.nextInspectionDate}
                  onChange={(e) =>
                    setFormData({ ...formData, nextInspectionDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessmentNotes">Assessment Notes</Label>
              <Textarea
                id="assessmentNotes"
                value={formData.assessmentNotes}
                onChange={(e) =>
                  setFormData({ ...formData, assessmentNotes: e.target.value })
                }
                placeholder="Detailed assessment methodology and calculations..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendations">Recommendations</Label>
              <Textarea
                id="recommendations"
                value={formData.recommendations}
                onChange={(e) =>
                  setFormData({ ...formData, recommendations: e.target.value })
                }
                placeholder="Continue monitoring at next scheduled inspection..."
                rows={3}
              />
            </div>

            <Button type="submit" disabled={createAssessment.isPending}>
              {createAssessment.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Plus className="mr-2 h-4 w-4" />
              Add FFS Assessment
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Assessments */}
      {assessments && assessments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Existing FFS Assessments</h3>
            <Button
              variant="outline"
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                if (confirm("Delete ALL FFS assessments? This cannot be undone.")) {
                  deleteAllFfs.mutate({ inspectionId });
                }
              }}
              disabled={deleteAllFfs.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete All
            </Button>
          </div>
          {assessments.map((assessment: any) => (
            <Card key={assessment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">
                      {assessment.damageType || "FFS Assessment"}
                    </CardTitle>
                    {assessment.acceptable ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAssessment.mutate({ id: assessment.id })}
                    disabled={deleteAssessment.isPending}
                  >
                    {deleteAssessment.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <CardDescription>
                  Level: {assessment.assessmentLevel?.replace("level", "Level ")} |
                  Remaining Life: {assessment.remainingLife ? `${assessment.remainingLife} years` : "N/A"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Remaining Thickness</p>
                    <p className="font-medium">{assessment.remainingThickness || "N/A"} in</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Minimum Required</p>
                    <p className="font-medium">{assessment.minimumRequired || "N/A"} in</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Future CA</p>
                    <p className="font-medium">{assessment.futureCorrosionAllowance || "N/A"} in</p>
                  </div>
                </div>

                {assessment.assessmentNotes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Assessment Notes</p>
                    <p className="text-sm">{assessment.assessmentNotes}</p>
                  </div>
                )}

                {assessment.recommendations && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Recommendations</p>
                    <p className="text-sm">{assessment.recommendations}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {assessments && assessments.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No FFS assessments added yet. Use the form above to add one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

