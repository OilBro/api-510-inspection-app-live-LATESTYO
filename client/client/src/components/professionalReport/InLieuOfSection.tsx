import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface InLieuOfSectionProps {
  inspectionId: string;
}

export default function InLieuOfSection({ inspectionId }: InLieuOfSectionProps) {
  const utils = trpc.useUtils();
  const [formData, setFormData] = useState({
    cleanService: false,
    noCorrosionHistory: false,
    effectiveExternalInspection: false,
    processMonitoring: false,
    thicknessMonitoring: false,
    qualified: false,
    maxInterval: "",
    nextInternalDue: "",
    justification: "",
    monitoringPlan: "",
  });

  const { data: assessments, isLoading } = trpc.professionalReport.inLieuOfAssessment.list.useQuery({
    inspectionId,
  });

  const createAssessment = trpc.professionalReport.inLieuOfAssessment.create.useMutation({
    onSuccess: () => {
      utils.professionalReport.inLieuOfAssessment.list.invalidate();
      toast.success("In-Lieu-Of Assessment added successfully");
      // Reset form
      setFormData({
        cleanService: false,
        noCorrosionHistory: false,
        effectiveExternalInspection: false,
        processMonitoring: false,
        thicknessMonitoring: false,
        qualified: false,
        maxInterval: "",
        nextInternalDue: "",
        justification: "",
        monitoringPlan: "",
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to add assessment: ${error.message}`);
    },
  });

  const updateAssessment = trpc.professionalReport.inLieuOfAssessment.update.useMutation({
    onSuccess: () => {
      utils.professionalReport.inLieuOfAssessment.list.invalidate();
      toast.success("In-Lieu-Of Assessment updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update assessment: ${error.message}`);
    },
  });

  const deleteAssessment = trpc.professionalReport.inLieuOfAssessment.delete.useMutation({
    onSuccess: () => {
      utils.professionalReport.inLieuOfAssessment.list.invalidate();
      toast.success("In-Lieu-Of Assessment deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete assessment: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAssessment.mutate({
      inspectionId,
      ...formData,
      maxInterval: formData.maxInterval ? parseInt(formData.maxInterval) : undefined,
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
          <CardTitle>In-Lieu-Of Internal Inspection Qualification</CardTitle>
          <CardDescription>
            Assessment per API 510 Section 6.4 for external inspection in lieu of internal inspection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Qualification Criteria</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cleanService">Clean Service (Non-corrosive)</Label>
                  <Switch
                    id="cleanService"
                    checked={formData.cleanService}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, cleanService: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="noCorrosionHistory">No History of Corrosion</Label>
                  <Switch
                    id="noCorrosionHistory"
                    checked={formData.noCorrosionHistory}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, noCorrosionHistory: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="effectiveExternalInspection">Effective External Inspection Program</Label>
                  <Switch
                    id="effectiveExternalInspection"
                    checked={formData.effectiveExternalInspection}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, effectiveExternalInspection: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="processMonitoring">Process Monitoring in Place</Label>
                  <Switch
                    id="processMonitoring"
                    checked={formData.processMonitoring}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, processMonitoring: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="thicknessMonitoring">Thickness Monitoring Program</Label>
                  <Switch
                    id="thicknessMonitoring"
                    checked={formData.thicknessMonitoring}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, thicknessMonitoring: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="qualified"
                  checked={formData.qualified}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, qualified: checked })
                  }
                />
                <Label htmlFor="qualified">Qualified for In-Lieu-Of</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxInterval">Maximum Interval (years)</Label>
                <Input
                  id="maxInterval"
                  type="number"
                  value={formData.maxInterval}
                  onChange={(e) =>
                    setFormData({ ...formData, maxInterval: e.target.value })
                  }
                  placeholder="10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextInternalDue">Next Internal Due</Label>
                <Input
                  id="nextInternalDue"
                  type="date"
                  value={formData.nextInternalDue}
                  onChange={(e) =>
                    setFormData({ ...formData, nextInternalDue: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">Justification</Label>
              <Textarea
                id="justification"
                value={formData.justification}
                onChange={(e) =>
                  setFormData({ ...formData, justification: e.target.value })
                }
                placeholder="Vessel qualifies for In-Lieu-Of internal inspection per API 510 Section 6.4.3. Criteria met: (1) Corrosion rate < 0.010 mpy..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monitoringPlan">Monitoring Plan</Label>
              <Textarea
                id="monitoringPlan"
                value={formData.monitoringPlan}
                onChange={(e) =>
                  setFormData({ ...formData, monitoringPlan: e.target.value })
                }
                placeholder="Continue external inspection every 2.5 years. Maintain thickness monitoring program with annual TML readings..."
                rows={4}
              />
            </div>

            <Button type="submit" disabled={createAssessment.isPending}>
              {createAssessment.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Plus className="mr-2 h-4 w-4" />
              Add In-Lieu-Of Assessment
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Assessments */}
      {assessments && assessments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Existing In-Lieu-Of Assessments</h3>
          {assessments.map((assessment: any) => (
            <Card key={assessment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">
                      In-Lieu-Of Qualification
                    </CardTitle>
                    {assessment.qualified ? (
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
                  Status: {assessment.qualified ? "Qualified" : "Not Qualified"} | 
                  Max Interval: {assessment.maxInterval ? `${assessment.maxInterval} years` : "N/A"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-2">Criteria Met:</p>
                    <ul className="space-y-1">
                      <li className="flex items-center gap-2">
                        {assessment.cleanService ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        Clean Service
                      </li>
                      <li className="flex items-center gap-2">
                        {assessment.noCorrosionHistory ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        No Corrosion History
                      </li>
                      <li className="flex items-center gap-2">
                        {assessment.effectiveExternalInspection ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        Effective External Inspection
                      </li>
                      <li className="flex items-center gap-2">
                        {assessment.processMonitoring ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        Process Monitoring
                      </li>
                      <li className="flex items-center gap-2">
                        {assessment.thicknessMonitoring ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        Thickness Monitoring
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next Internal Due</p>
                    <p className="font-medium">
                      {assessment.nextInternalDue
                        ? new Date(assessment.nextInternalDue).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {assessment.justification && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Justification</p>
                    <p className="text-sm">{assessment.justification}</p>
                  </div>
                )}

                {assessment.monitoringPlan && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Monitoring Plan</p>
                    <p className="text-sm">{assessment.monitoringPlan}</p>
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
            No In-Lieu-Of assessments added yet. Use the form above to add one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

