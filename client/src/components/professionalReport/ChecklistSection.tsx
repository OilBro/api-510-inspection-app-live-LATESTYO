import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckSquare, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ChecklistSectionProps {
  reportId: string;
}

export default function ChecklistSection({ reportId }: ChecklistSectionProps) {
  const utils = trpc.useUtils();

  const { data: checklistItems, isLoading } = trpc.professionalReport.checklist.list.useQuery({
    reportId,
  });

  const initializeChecklist = trpc.professionalReport.checklist.initialize.useMutation({
    onSuccess: () => {
      utils.professionalReport.checklist.list.invalidate();
      toast.success("Checklist initialized");
    },
    onError: (error: any) => {
      toast.error(`Failed to initialize checklist: ${error.message}`);
    },
  });

  const updateChecklistItem = trpc.professionalReport.checklist.update.useMutation({
    onSuccess: () => {
      utils.professionalReport.checklist.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Failed to update checklist: ${error.message}`);
    },
  });

  const deleteAllChecklist = trpc.professionalReport.deleteAllChecklistItems.useMutation({
    onSuccess: () => {
      utils.professionalReport.checklist.list.invalidate();
      toast.success("All checklist items deleted");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Initialize checklist if empty
  useEffect(() => {
    if (checklistItems && checklistItems.length === 0) {
      initializeChecklist.mutate({ reportId });
    }
  }, [checklistItems, reportId]);

  const handleCheckboxChange = (itemId: string, checked: boolean) => {
    updateChecklistItem.mutate({
      itemId,
      checked,
      checkedBy: checked ? "Inspector" : null,
      checkedDate: checked ? new Date() : null,
    });
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    updateChecklistItem.mutate({
      itemId,
      notes,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Group checklist items by category
  const groupedItems = checklistItems?.reduce((acc: any, item: any) => {
    const category = item.category || "General";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const completedCount = checklistItems?.filter((item: any) => item.checked).length || 0;
  const totalCount = checklistItems?.length || 0;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Inspection Checklist</h3>
          <p className="text-sm text-muted-foreground">
            API 510 compliance checklist - {completedCount} of {totalCount} items completed ({completionPercentage}%)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (confirm("Reset all checklist items? This will clear all checks and notes.")) {
                initializeChecklist.mutate({ reportId });
              }
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset Checklist
          </Button>
          {checklistItems && checklistItems.length > 0 && (
            <Button
              variant="outline"
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                if (confirm("Delete ALL checklist items? This cannot be undone.")) {
                  deleteAllChecklist.mutate({ reportId });
                }
              }}
              disabled={deleteAllChecklist.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete All
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-label={`Checklist ${completionPercentage}% complete`}>
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {checklistItems && checklistItems.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedItems || {}).map(([category, items]: [string, any]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base">{category}</CardTitle>
                <CardDescription>
                  {items.filter((i: any) => i.checked).length} of {items.length} completed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`check-${item.id}`}
                        checked={item.checked || false}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(item.id, checked as boolean)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`check-${item.id}`}
                          className={`text-sm font-medium cursor-pointer ${item.checked ? "line-through text-muted-foreground" : ""
                            }`}
                        >
                          {item.itemText}
                        </Label>
                        {item.checked && item.checkedBy && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Checked by {item.checkedBy} on{" "}
                            {item.checkedDate
                              ? new Date(item.checkedDate).toLocaleDateString()
                              : "N/A"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`notes-${item.id}`} className="text-xs">
                        Notes / Observations
                      </Label>
                      <Textarea
                        id={`notes-${item.id}`}
                        value={item.notes || ""}
                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                        placeholder="Add notes or observations..."
                        rows={2}
                        className="text-sm"
                      />
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
            <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No checklist items</p>
            <p className="text-sm text-muted-foreground mb-4">
              Initialize the default API 510 inspection checklist
            </p>
            <Button
              onClick={() => initializeChecklist.mutate({ reportId })}
              className="gap-2"
              disabled={initializeChecklist.isPending}
            >
              {initializeChecklist.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4" />
                  Initialize Checklist
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

