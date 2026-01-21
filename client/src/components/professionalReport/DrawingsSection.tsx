import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Upload, Trash2, Loader2, FileText, Pencil, Eye, Download, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface DrawingsSectionProps {
  reportId: string;
  inspectionId?: string;
}

const DRAWING_CATEGORIES = [
  { value: "pid", label: "P&ID (Piping & Instrumentation)" },
  { value: "fabrication", label: "Fabrication Drawing" },
  { value: "isometric", label: "Isometric Drawing" },
  { value: "general_arrangement", label: "General Arrangement" },
  { value: "detail", label: "Detail Drawing" },
  { value: "nameplate", label: "Nameplate / Data Plate" },
  { value: "nozzle_schedule", label: "Nozzle Schedule" },
  { value: "other", label: "Other" },
] as const;

type DrawingCategory = typeof DRAWING_CATEGORIES[number]["value"];

export default function DrawingsSection({ reportId, inspectionId }: DrawingsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingDrawing, setEditingDrawing] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [drawingNumber, setDrawingNumber] = useState("");
  const [revision, setRevision] = useState("");
  const [category, setCategory] = useState<DrawingCategory>("other");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: drawings, isLoading } = trpc.drawings.list.useQuery({ reportId });

  const uploadMutation = trpc.drawings.upload.useMutation({
    onSuccess: () => {
      utils.drawings.list.invalidate();
      toast.success("Drawing uploaded successfully");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to upload drawing: ${error.message}`);
    },
  });

  const updateMutation = trpc.drawings.update.useMutation({
    onSuccess: () => {
      utils.drawings.list.invalidate();
      toast.success("Drawing updated successfully");
      setEditDialogOpen(false);
      setEditingDrawing(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update drawing: ${error.message}`);
    },
  });

  const deleteMutation = trpc.drawings.delete.useMutation({
    onSuccess: () => {
      utils.drawings.list.invalidate();
      toast.success("Drawing deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete drawing: ${error.message}`);
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDrawingNumber("");
    setRevision("");
    setCategory("other");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill title from filename if empty
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title) {
      toast.error("Please select a file and enter a title");
      return;
    }

    setUploading(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        await uploadMutation.mutateAsync({
          reportId,
          inspectionId,
          title,
          description: description || undefined,
          drawingNumber: drawingNumber || undefined,
          revision: revision || undefined,
          category,
          fileData: base64,
          fileName: selectedFile.name,
          fileType: selectedFile.type || "application/octet-stream",
        });
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (drawing: any) => {
    setEditingDrawing(drawing);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDrawing) return;

    await updateMutation.mutateAsync({
      id: editingDrawing.id,
      title: editingDrawing.title,
      description: editingDrawing.description,
      drawingNumber: editingDrawing.drawingNumber,
      revision: editingDrawing.revision,
      category: editingDrawing.category,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this drawing?")) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const getCategoryLabel = (value: string) => {
    return DRAWING_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getFileIcon = (fileType: string | null) => {
    if (fileType?.includes("pdf")) return "📄";
    if (fileType?.includes("image")) return "🖼️";
    if (fileType?.includes("dwg") || fileType?.includes("autocad")) return "📐";
    return "📁";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Vessel Drawings</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Drawing
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload Drawing</DialogTitle>
              <DialogDescription>
                Upload a vessel drawing (PDF, image, or CAD file)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file">File *</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.dwg,.dxf"
                  onChange={handleFileSelect}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Vessel General Arrangement"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="drawingNumber">Drawing Number</Label>
                  <Input
                    id="drawingNumber"
                    value={drawingNumber}
                    onChange={(e) => setDrawingNumber(e.target.value)}
                    placeholder="e.g., DWG-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revision">Revision</Label>
                  <Input
                    id="revision"
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    placeholder="e.g., Rev A"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as DrawingCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAWING_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description or notes"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile || !title}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {drawings && drawings.length > 0 ? (
        <div className="grid gap-4">
          {drawings.map((drawing: any) => (
            <Card key={drawing.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-2xl">
                    {getFileIcon(drawing.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium truncate">{drawing.title}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          {drawing.drawingNumber && (
                            <span className="bg-muted px-2 py-0.5 rounded">{drawing.drawingNumber}</span>
                          )}
                          {drawing.revision && (
                            <span className="bg-muted px-2 py-0.5 rounded">{drawing.revision}</span>
                          )}
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {getCategoryLabel(drawing.category)}
                          </span>
                        </div>
                        {drawing.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {drawing.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(drawing.fileUrl, "_blank")}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = drawing.fileUrl;
                            link.download = drawing.fileName || drawing.title;
                            link.click();
                          }}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(drawing)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(drawing.id)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No drawings uploaded yet.<br />
              Click "Upload Drawing" to add vessel drawings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Drawing</DialogTitle>
            <DialogDescription>
              Update drawing details
            </DialogDescription>
          </DialogHeader>
          {editingDrawing && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={editingDrawing.title}
                  onChange={(e) => setEditingDrawing({ ...editingDrawing, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-drawingNumber">Drawing Number</Label>
                  <Input
                    id="edit-drawingNumber"
                    value={editingDrawing.drawingNumber || ""}
                    onChange={(e) => setEditingDrawing({ ...editingDrawing, drawingNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-revision">Revision</Label>
                  <Input
                    id="edit-revision"
                    value={editingDrawing.revision || ""}
                    onChange={(e) => setEditingDrawing({ ...editingDrawing, revision: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={editingDrawing.category}
                  onValueChange={(v) => setEditingDrawing({ ...editingDrawing, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAWING_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingDrawing.description || ""}
                  onChange={(e) => setEditingDrawing({ ...editingDrawing, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
