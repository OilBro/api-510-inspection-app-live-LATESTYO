import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, AlertCircle, XCircle, Trash2 } from "lucide-react";
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

interface ActionPlanListProps {
  anomalyId: string;
}

export function ActionPlanList({ anomalyId }: ActionPlanListProps) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  const { data: plans, isLoading, refetch } = trpc.actionPlans.getForAnomaly.useQuery({
    anomalyId,
  });

  const updateStatusMutation = trpc.actionPlans.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Action plan updated");
      setSelectedPlan(null);
      setCompletionNotes("");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = trpc.actionPlans.delete.useMutation({
    onSuccess: () => {
      toast.success("Action plan deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading action plans...</div>;
  }

  if (!plans || plans.length === 0) {
    return <div className="text-sm text-gray-500">No action plans yet</div>;
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge variant="default" className="bg-orange-600">High</Badge>;
      case "medium":
        return <Badge variant="default">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-blue-600" />;
      case "pending":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return null;
    }
  };

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === "completed" || status === "cancelled") return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <>
      <div className="space-y-3">
        {plans.map((plan: any) => (
          <Card key={plan.id} className={isOverdue(plan.dueDate, plan.status) ? "border-red-300" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {getStatusIcon(plan.status)}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{plan.title}</h4>
                    {getPriorityBadge(plan.priority)}
                    {getStatusBadge(plan.status)}
                    {isOverdue(plan.dueDate, plan.status) && (
                      <Badge variant="destructive">Overdue</Badge>
                    )}
                  </div>
                  
                  {plan.description && (
                    <p className="text-sm text-gray-600">{plan.description}</p>
                  )}
                  
                  <div className="flex gap-4 text-xs text-gray-500">
                    {plan.dueDate && (
                      <span>Due: {new Date(plan.dueDate).toLocaleDateString()}</span>
                    )}
                    <span>Created: {new Date(plan.createdAt).toLocaleDateString()}</span>
                  </div>

                  {plan.status !== "completed" && plan.status !== "cancelled" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          updateStatusMutation.mutate({
                            actionPlanId: plan.id,
                            status: "in_progress",
                          });
                        }}
                        disabled={plan.status === "in_progress"}
                      >
                        {plan.status === "in_progress" ? "In Progress" : "Start"}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => setSelectedPlan(plan)}
                      >
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this action plan?")) {
                            deleteMutation.mutate({ actionPlanId: plan.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {plan.completionNotes && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                      <span className="font-medium">Completion Notes:</span> {plan.completionNotes}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completion Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Action Plan</DialogTitle>
            <DialogDescription>{selectedPlan?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Completion Notes (Optional)</label>
              <Textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Describe what was done to resolve this issue..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPlan(null);
                setCompletionNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                updateStatusMutation.mutate({
                  actionPlanId: selectedPlan.id,
                  status: "completed",
                  completionNotes: completionNotes || undefined,
                });
              }}
              disabled={updateStatusMutation.isPending}
            >
              Mark as Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
