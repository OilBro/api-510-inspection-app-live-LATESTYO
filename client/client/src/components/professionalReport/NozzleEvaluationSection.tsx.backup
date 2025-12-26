import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface NozzleEvaluationSectionProps {
  inspectionId: string;
}

export default function NozzleEvaluationSection({
  inspectionId,
}: NozzleEvaluationSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNozzle, setEditingNozzle] = useState<any>(null);

  // Queries
  const { data: nozzles, refetch } = trpc.nozzles.list.useQuery({ inspectionId });
  const { data: nominalSizes } = trpc.nozzles.getNominalSizes.useQuery();
  const { data: schedules } = trpc.nozzles.getSchedules.useQuery();

  // Mutations
  const createMutation = trpc.nozzles.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsAddDialogOpen(false);
      toast.success("Nozzle added successfully");
    },
    onError: (error) => {
      toast.error(`Failed to add nozzle: ${error.message}`);
    },
  });

  const updateMutation = trpc.nozzles.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditDialogOpen(false);
      setEditingNozzle(null);
      toast.success("Nozzle updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update nozzle: ${error.message}`);
    },
  });

  const deleteMutation = trpc.nozzles.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Nozzle deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete nozzle: ${error.message}`);
    },
  });

  const handleAdd = (formData: FormData) => {
    const nozzleNumber = formData.get("nozzleNumber") as string;
    const nozzleDescription = formData.get("nozzleDescription") as string;
    const location = formData.get("location") as string;
    const nominalSize = formData.get("nominalSize") as string;
    const schedule = formData.get("schedule") as string;
    const actualThickness = formData.get("actualThickness") as string;
    const shellHeadRequired = formData.get("shellHeadRequired") as string;

    createMutation.mutate({
      inspectionId,
      nozzleNumber,
      nozzleDescription,
      location,
      nominalSize,
      schedule,
      actualThickness: actualThickness ? parseFloat(actualThickness) : undefined,
      shellHeadRequiredThickness: parseFloat(shellHeadRequired),
    });
  };

  const handleEdit = (formData: FormData) => {
    if (!editingNozzle) return;

    const nozzleNumber = formData.get("nozzleNumber") as string;
    const nozzleDescription = formData.get("nozzleDescription") as string;
    const location = formData.get("location") as string;
    const nominalSize = formData.get("nominalSize") as string;
    const schedule = formData.get("schedule") as string;
    const actualThickness = formData.get("actualThickness") as string;
    const shellHeadRequired = formData.get("shellHeadRequired") as string;
    const notes = formData.get("notes") as string;

    updateMutation.mutate({
      nozzleId: editingNozzle.id,
      nozzleNumber,
      nozzleDescription,
      location,
      nominalSize,
      schedule,
      actualThickness: actualThickness ? parseFloat(actualThickness) : undefined,
      shellHeadRequiredThickness: parseFloat(shellHeadRequired),
      notes,
    });
  };

  const handleDelete = (nozzleId: string) => {
    if (confirm("Are you sure you want to delete this nozzle?")) {
      deleteMutation.mutate({ nozzleId });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Nozzle Evaluation</h3>
          <p className="text-sm text-muted-foreground">
            Minimum thickness per ASME UG-45
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Nozzle
        </Button>
      </div>

      {nozzles && nozzles.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nozzle #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Actual (in)</TableHead>
                <TableHead>Min Req (in)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nozzles.map((nozzle) => {
                const actual = nozzle.actualThickness
                  ? parseFloat(nozzle.actualThickness)
                  : null;
                const minReq = nozzle.minimumRequired
                  ? parseFloat(nozzle.minimumRequired)
                  : null;

                return (
                  <TableRow key={nozzle.id}>
                    <TableCell className="font-medium">
                      {nozzle.nozzleNumber}
                    </TableCell>
                    <TableCell>{nozzle.nozzleDescription || "-"}</TableCell>
                    <TableCell>{nozzle.nominalSize}"</TableCell>
                    <TableCell>{nozzle.schedule}</TableCell>
                    <TableCell>{nozzle.location || "-"}</TableCell>
                    <TableCell>
                      {actual !== null ? actual.toFixed(4) : "-"}
                    </TableCell>
                    <TableCell>
                      {minReq !== null ? minReq.toFixed(4) : "-"}
                    </TableCell>
                    <TableCell>
                      {nozzle.acceptable ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span>Acceptable</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600">
                          <XCircle className="w-4 h-4 mr-1" />
                          <span>Not Acceptable</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingNozzle(nozzle);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(nozzle.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">
            No nozzles added yet. Click "Add Nozzle" to begin.
          </p>
        </div>
      )}

      {/* Add Nozzle Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd(new FormData(e.currentTarget));
            }}
          >
            <DialogHeader>
              <DialogTitle>Add Nozzle</DialogTitle>
              <DialogDescription>
                Enter nozzle details. Minimum required thickness will be calculated automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nozzleNumber">Nozzle Number *</Label>
                  <Input
                    id="nozzleNumber"
                    name="nozzleNumber"
                    placeholder="N1, MW-1, etc."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    placeholder="Shell, Top Head, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nozzleDescription">Description</Label>
                <Input
                  id="nozzleDescription"
                  name="nozzleDescription"
                  placeholder="Inlet, Outlet, Manway, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nominalSize">Nominal Size *</Label>
                  <Select name="nominalSize" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {nominalSizes?.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}"
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule">Schedule *</Label>
                  <Select name="schedule" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      {schedules?.map((sched) => (
                        <SelectItem key={sched} value={sched}>
                          {sched}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shellHeadRequired">
                    Shell/Head Required Thickness (in) *
                  </Label>
                  <Input
                    id="shellHeadRequired"
                    name="shellHeadRequired"
                    type="number"
                    step="0.0001"
                    placeholder="0.2500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actualThickness">
                    Actual Thickness (in)
                  </Label>
                  <Input
                    id="actualThickness"
                    name="actualThickness"
                    type="number"
                    step="0.0001"
                    placeholder="0.3000"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Nozzle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Nozzle Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEdit(new FormData(e.currentTarget));
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit Nozzle</DialogTitle>
              <DialogDescription>
                Update nozzle details. Minimum required thickness will be recalculated.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nozzleNumber">Nozzle Number *</Label>
                  <Input
                    id="edit-nozzleNumber"
                    name="nozzleNumber"
                    defaultValue={editingNozzle?.nozzleNumber}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    name="location"
                    defaultValue={editingNozzle?.location || ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-nozzleDescription">Description</Label>
                <Input
                  id="edit-nozzleDescription"
                  name="nozzleDescription"
                  defaultValue={editingNozzle?.nozzleDescription || ""}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nominalSize">Nominal Size *</Label>
                  <Select
                    name="nominalSize"
                    defaultValue={editingNozzle?.nominalSize}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {nominalSizes?.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}"
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-schedule">Schedule *</Label>
                  <Select
                    name="schedule"
                    defaultValue={editingNozzle?.schedule}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {schedules?.map((sched) => (
                        <SelectItem key={sched} value={sched}>
                          {sched}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-shellHeadRequired">
                    Shell/Head Required Thickness (in) *
                  </Label>
                  <Input
                    id="edit-shellHeadRequired"
                    name="shellHeadRequired"
                    type="number"
                    step="0.0001"
                    defaultValue={editingNozzle?.shellHeadRequiredThickness}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-actualThickness">
                    Actual Thickness (in)
                  </Label>
                  <Input
                    id="edit-actualThickness"
                    name="actualThickness"
                    type="number"
                    step="0.0001"
                    defaultValue={editingNozzle?.actualThickness || ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  name="notes"
                  defaultValue={editingNozzle?.notes || ""}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingNozzle(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

