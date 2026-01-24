import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { 
  Upload, 
  Trash2, 
  Loader2, 
  FileText, 
  Pencil, 
  Eye, 
  Download, 
  FileImage,
  FileCheck,
  Award,
  Wrench,
  ClipboardCheck,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface UploadsSectionProps {
  reportId: string;
  inspectionId?: string;
}

// Upload categories organized by section
const UPLOAD_SECTIONS = {
  drawings: {
    label: "Inspection Drawings",
    icon: FileImage,
    description: "Vessel drawings, fabrication drawings, isometric views",
    categories: [
      { value: "fabrication", label: "Fabrication Drawing" },
      { value: "isometric", label: "Isometric Drawing" },
      { value: "general_arrangement", label: "General Arrangement" },
      { value: "detail", label: "Detail Drawing" },
      { value: "nameplate", label: "Nameplate / Data Plate" },
      { value: "nozzle_schedule", label: "Nozzle Schedule" },
      { value: "drawing_other", label: "Other Drawing" },
    ],
  },
  pids: {
    label: "P&IDs",
    icon: FileText,
    description: "Piping & Instrumentation Diagrams",
    categories: [
      { value: "pid", label: "P&ID (Piping & Instrumentation)" },
      { value: "pfd", label: "Process Flow Diagram" },
      { value: "pid_markup", label: "P&ID Markup/Redline" },
    ],
  },
  u1: {
    label: "U-1",
    icon: FileCheck,
    description: "Manufacturer's Data Report (U-1/U-1A forms)",
    categories: [
      { value: "u1_form", label: "U-1 Form" },
      { value: "u1a_form", label: "U-1A Form" },
      { value: "u2_form", label: "U-2 Form" },
      { value: "mdr", label: "Manufacturer's Data Report" },
      { value: "partial_data_report", label: "Partial Data Report" },
    ],
  },
  certs: {
    label: "Certs & Calibrations",
    icon: Award,
    description: "Inspector certifications, NDE tech certs, equipment calibrations",
    categories: [
      { value: "api_inspector_cert", label: "API Inspector Certification" },
      { value: "nde_tech_cert", label: "NDE Technician Certification" },
      { value: "ut_calibration", label: "UT Equipment Calibration" },
      { value: "thickness_gauge_cal", label: "Thickness Gauge Calibration" },
      { value: "pressure_gauge_cal", label: "Pressure Gauge Calibration" },
      { value: "other_calibration", label: "Other Calibration Record" },
      { value: "other_cert", label: "Other Certification" },
    ],
  },
} as const;

type SectionKey = keyof typeof UPLOAD_SECTIONS;
type CategoryValue = typeof UPLOAD_SECTIONS[SectionKey]["categories"][number]["value"];

export default function UploadsSection({ reportId, inspectionId }: UploadsSectionProps) {
  const [activeSection, setActiveSection] = useState<SectionKey>("drawings");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingUpload, setEditingUpload] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [revision, setRevision] = useState("");
  const [category, setCategory] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState("");

  // Use the existing drawings API but with extended categories
  const { data: uploads, isLoading } = trpc.drawings.list.useQuery({ reportId });

  const uploadMutation = trpc.drawings.upload.useMutation({
    onSuccess: () => {
      utils.drawings.list.invalidate();
      toast.success("Document uploaded successfully");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });

  const updateMutation = trpc.drawings.update.useMutation({
    onSuccess: () => {
      utils.drawings.list.invalidate();
      toast.success("Document updated successfully");
      setEditDialogOpen(false);
      setEditingUpload(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update document: ${error.message}`);
    },
  });

  const deleteMutation = trpc.drawings.delete.useMutation({
    onSuccess: () => {
      utils.drawings.list.invalidate();
      toast.success("Document deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDocumentNumber("");
    setRevision("");
    setCategory("");
    setSelectedFile(null);
    setExpirationDate("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title || !category) {
      toast.error("Please select a file, enter a title, and select a category");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        await uploadMutation.mutateAsync({
          reportId,
          inspectionId,
          title,
          description: description || undefined,
          drawingNumber: documentNumber || undefined,
          revision: revision || undefined,
          category: category as any,
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

  const handleEdit = (upload: any) => {
    setEditingUpload(upload);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUpload) return;

    await updateMutation.mutateAsync({
      id: editingUpload.id,
      title: editingUpload.title,
      description: editingUpload.description,
      drawingNumber: editingUpload.drawingNumber,
      revision: editingUpload.revision,
      category: editingUpload.category,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const getCategoryLabel = (value: string) => {
    for (const section of Object.values(UPLOAD_SECTIONS)) {
      const cat = section.categories.find(c => c.value === value);
      if (cat) return cat.label;
    }
    return value;
  };

  const getSectionForCategory = (categoryValue: string): SectionKey | null => {
    for (const [key, section] of Object.entries(UPLOAD_SECTIONS)) {
      if (section.categories.some(c => c.value === categoryValue)) {
        return key as SectionKey;
      }
    }
    return null;
  };

  const getFileIcon = (fileType: string | null) => {
    if (fileType?.includes("pdf")) return "📄";
    if (fileType?.includes("image")) return "🖼️";
    if (fileType?.includes("dwg") || fileType?.includes("autocad")) return "📐";
    return "📁";
  };

  // Filter uploads by current section
  const filteredUploads = uploads?.filter((upload: any) => {
    const uploadSection = getSectionForCategory(upload.category);
    return uploadSection === activeSection;
  }) || [];

  // Count uploads per section
  const getCountForSection = (sectionKey: SectionKey) => {
    return uploads?.filter((upload: any) => {
      const uploadSection = getSectionForCategory(upload.category);
      return uploadSection === sectionKey;
    }).length || 0;
  };

  const currentSection = UPLOAD_SECTIONS[activeSection];
  const SectionIcon = currentSection.icon;

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
        <div>
          <h3 className="text-lg font-semibold">Supporting Documents</h3>
          <p className="text-sm text-muted-foreground">
            Upload all applicable inspection documentation
          </p>
        </div>
      </div>

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionKey)}>
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(UPLOAD_SECTIONS).map(([key, section]) => {
            const Icon = section.icon;
            const count = getCountForSection(key as SectionKey);
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{section.label}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.entries(UPLOAD_SECTIONS).map(([key, section]) => (
          <TabsContent key={key} value={key} className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <section.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{section.label}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                  <Dialog open={dialogOpen && activeSection === key} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setActiveSection(key as SectionKey);
                        setCategory(section.categories[0].value);
                      }}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Upload {section.label}</DialogTitle>
                        <DialogDescription>
                          {section.description}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="file">File *</Label>
                          <Input
                            id="file"
                            type="file"
                            ref={fileInputRef}
                            accept=".pdf,.png,.jpg,.jpeg,.gif,.dwg,.dxf,.doc,.docx"
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
                            placeholder="Enter document title"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="category">Category *</Label>
                          <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {section.categories.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="documentNumber">Document/Cert Number</Label>
                            <Input
                              id="documentNumber"
                              value={documentNumber}
                              onChange={(e) => setDocumentNumber(e.target.value)}
                              placeholder="e.g., DWG-001"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="revision">Revision/Version</Label>
                            <Input
                              id="revision"
                              value={revision}
                              onChange={(e) => setRevision(e.target.value)}
                              placeholder="e.g., Rev A"
                            />
                          </div>
                        </div>

                        {key === "certs" && (
                          <div className="space-y-2">
                            <Label htmlFor="expiration">Expiration Date</Label>
                            <Input
                              id="expiration"
                              type="date"
                              value={expirationDate}
                              onChange={(e) => setExpirationDate(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Track certification expiration dates
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="description">Notes</Label>
                          <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional notes or description"
                            rows={2}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => {
                          setDialogOpen(false);
                          resetForm();
                        }}>
                          Cancel
                        </Button>
                        <Button onClick={handleUpload} disabled={uploading || !selectedFile || !title || !category}>
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
              </CardHeader>
              <CardContent>
                {filteredUploads.length > 0 ? (
                  <div className="grid gap-3">
                    {filteredUploads.map((upload: any) => (
                      <div 
                        key={upload.id} 
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-lg">
                          {getFileIcon(upload.fileType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-medium text-sm truncate">{upload.title}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                {upload.drawingNumber && (
                                  <span className="bg-muted px-2 py-0.5 rounded">{upload.drawingNumber}</span>
                                )}
                                {upload.revision && (
                                  <span className="bg-muted px-2 py-0.5 rounded">{upload.revision}</span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {getCategoryLabel(upload.category)}
                                </Badge>
                              </div>
                              {upload.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {upload.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(upload.fileUrl, "_blank")}
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.href = upload.fileUrl;
                                  link.download = upload.fileName || upload.title;
                                  link.click();
                                }}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(upload)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(upload.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 bg-muted rounded-full mb-3">
                      <section.icon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No {section.label.toLowerCase()} uploaded yet.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "Upload" to add documents.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update document details
            </DialogDescription>
          </DialogHeader>
          {editingUpload && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editingUpload.title}
                  onChange={(e) => setEditingUpload({ ...editingUpload, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-documentNumber">Document Number</Label>
                  <Input
                    id="edit-documentNumber"
                    value={editingUpload.drawingNumber || ""}
                    onChange={(e) => setEditingUpload({ ...editingUpload, drawingNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-revision">Revision</Label>
                  <Input
                    id="edit-revision"
                    value={editingUpload.revision || ""}
                    onChange={(e) => setEditingUpload({ ...editingUpload, revision: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={editingUpload.category}
                  onValueChange={(v) => setEditingUpload({ ...editingUpload, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(UPLOAD_SECTIONS).flatMap(section => 
                      section.categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Notes</Label>
                <Textarea
                  id="edit-description"
                  value={editingUpload.description || ""}
                  onChange={(e) => setEditingUpload({ ...editingUpload, description: e.target.value })}
                  rows={2}
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

      {/* Summary Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Upload Checklist</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(UPLOAD_SECTIONS).map(([key, section]) => {
              const count = getCountForSection(key as SectionKey);
              const hasUploads = count > 0;
              return (
                <div 
                  key={key}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    hasUploads ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  {hasUploads ? (
                    <FileCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${hasUploads ? 'text-green-700' : 'text-amber-700'}`}>
                      {section.label}
                    </p>
                    <p className={`text-xs ${hasUploads ? 'text-green-600' : 'text-amber-600'}`}>
                      {count} uploaded
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
