import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Upload, Trash2, Loader2, Image as ImageIcon, GripVertical, Pencil } from "lucide-react";
import { toast } from "sonner";
import PhotoAnnotationEditor from "./PhotoAnnotationEditor";
import PhotoChecklistPanel from "./PhotoChecklistPanel";
import { PhotoRequirement } from "@shared/photoTemplates";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PhotosSectionProps {
  reportId: string;
}

export default function PhotosSection({ reportId }: PhotosSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchUploading, setBatchUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({});
  const [annotationEditorOpen, setAnnotationEditorOpen] = useState(false);
  const [currentPhotoForAnnotation, setCurrentPhotoForAnnotation] = useState<{ id: string, url: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [prefilledRequirement, setPrefilledRequirement] = useState<PhotoRequirement | null>(null);
  const utils = trpc.useUtils();

  const { data: photos, isLoading } = trpc.professionalReport.photos.list.useQuery({
    reportId,
  });

  const createPhoto = trpc.professionalReport.photos.create.useMutation({
    onSuccess: () => {
      utils.professionalReport.photos.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Failed to add photo: ${error.message}`);
    },
  });

  const updatePhoto = trpc.professionalReport.photos.update.useMutation({
    onSuccess: () => {
      utils.professionalReport.photos.list.invalidate();
    },
  });

  const deletePhoto = trpc.professionalReport.photos.delete.useMutation({
    onSuccess: () => {
      utils.professionalReport.photos.list.invalidate();
      toast.success("Photo deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete photo: ${error.message}`);
    },
  });

  const deleteAllPhotos = trpc.professionalReport.deleteAllPhotos.useMutation({
    onSuccess: () => {
      utils.professionalReport.photos.list.invalidate();
      toast.success("All photos deleted");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const uploadMutation = trpc.professionalReport.photos.upload.useMutation();

  const handleAnnotate = (photoId: string, photoUrl: string) => {
    setCurrentPhotoForAnnotation({ id: photoId, url: photoUrl });
    setAnnotationEditorOpen(true);
  };

  const handleSaveAnnotation = async (annotatedImageData: string) => {
    if (!currentPhotoForAnnotation) return;

    try {
      // Upload annotated image
      const result = await uploadMutation.mutateAsync({
        base64Data: annotatedImageData,
        filename: `annotated-${Date.now()}.jpg`,
        contentType: 'image/jpeg',
      });

      // Update photo with new URL
      await updatePhoto.mutateAsync({
        photoId: currentPhotoForAnnotation.id,
        photoUrl: result.url,
      });

      setAnnotationEditorOpen(false);
      setCurrentPhotoForAnnotation(null);
      toast.success('Annotated photo saved');
    } catch (error) {
      console.error('Failed to save annotated photo:', error);
      toast.error('Failed to save annotated photo');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && photos) {
      const oldIndex = photos.findIndex((p) => p.id === active.id);
      const newIndex = photos.findIndex((p) => p.id === over.id);

      const newPhotos = arrayMove(photos, oldIndex, newIndex);

      // Update sequence numbers
      for (let i = 0; i < newPhotos.length; i++) {
        if (newPhotos[i].sequenceNumber !== i + 1) {
          updatePhoto.mutate({
            photoId: newPhotos[i].id,
            sequenceNumber: i + 1,
          });
        }
      }

      toast.success("Photo order updated");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Sort photos by sequence number
  const sortedPhotos = photos ? [...photos].sort((a, b) => {
    const seqA = a.sequenceNumber || 999;
    const seqB = b.sequenceNumber || 999;
    return seqA - seqB;
  }) : [];

  const handleRequirementClick = (requirement: PhotoRequirement) => {
    setPrefilledRequirement(requirement);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Checklist Panel */}
      <PhotoChecklistPanel
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={setSelectedTemplateId}
        uploadedPhotos={(photos || []).map(p => ({ caption: p.caption || '', section: p.section || '' }))}
        onRequirementClick={handleRequirementClick}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inspection Photos</h2>
          <p className="text-sm text-muted-foreground">
            Upload and manage photos for the inspection report. Drag to reorder.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Photos
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Inspection Photos</DialogTitle>
              <DialogDescription>
                Select multiple photos to upload at once
              </DialogDescription>
            </DialogHeader>
            <BatchPhotoUploadForm
              reportId={reportId}
              prefilledRequirement={prefilledRequirement}
              onSubmit={async (photoDataArray) => {
                setPrefilledRequirement(null);
                setBatchUploading(true);
                let successCount = 0;

                for (const photoData of photoDataArray) {
                  try {
                    setUploadProgress(prev => ({ ...prev, [photoData.caption]: true }));
                    await createPhoto.mutateAsync(photoData);
                    successCount++;
                  } catch (error) {
                    console.error('Failed to upload photo:', photoData.caption, error);
                  }
                }

                setBatchUploading(false);
                setUploadProgress({});
                toast.success(`${successCount} of ${photoDataArray.length} photos uploaded successfully`);
                setDialogOpen(false);
              }}
              onCancel={() => setDialogOpen(false)}
              uploading={batchUploading}
              uploadProgress={uploadProgress}
            />
          </DialogContent>
        </Dialog>
        {sortedPhotos && sortedPhotos.length > 0 && (
          <Button
            variant="outline"
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm("Delete ALL photos? This cannot be undone.")) {
                deleteAllPhotos.mutate({ reportId });
              }
            }}
            disabled={deleteAllPhotos.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Delete All
          </Button>
        )}
      </div>

      {sortedPhotos && sortedPhotos.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedPhotos.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sortedPhotos.map((photo: any) => (
                <SortablePhotoCard
                  key={photo.id}
                  photo={photo}
                  onDelete={() => deletePhoto.mutate({ photoId: photo.id })}
                  onAnnotate={handleAnnotate}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No photos uploaded yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add photos to document inspection findings
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload First Photo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Annotation Editor */}
      {currentPhotoForAnnotation && (
        <PhotoAnnotationEditor
          open={annotationEditorOpen}
          photoUrl={currentPhotoForAnnotation.url}
          onSave={handleSaveAnnotation}
          onCancel={() => {
            setAnnotationEditorOpen(false);
            setCurrentPhotoForAnnotation(null);
          }}
        />
      )}
    </div>
  );
}

interface SortablePhotoCardProps {
  photo: any;
  onDelete: () => void;
  onAnnotate: (photoId: string, photoUrl: string) => void;
}

function SortablePhotoCard({ photo, onDelete, onAnnotate }: SortablePhotoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          <img
            src={photo.photoUrl}
            alt={photo.caption || 'Photo'}
            className="w-24 h-24 object-cover rounded"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect fill="%23f3f4f6" width="96" height="96"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">No Image</text></svg>';
            }}
          />

          <div className="flex-1">
            <h4 className="font-medium">{photo.caption || 'Untitled'}</h4>
            {photo.section && (
              <p className="text-sm text-muted-foreground">Section: {photo.section}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAnnotate(photo.id, photo.photoUrl)}
              title="Annotate photo"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title="Delete photo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface BatchPhotoUploadFormProps {
  reportId: string;
  prefilledRequirement?: PhotoRequirement | null;
  onSubmit: (photoDataArray: any[]) => void;
  onCancel: () => void;
  uploading: boolean;
  uploadProgress: { [key: string]: boolean };
}

function BatchPhotoUploadForm({ reportId, prefilledRequirement, onSubmit, onCancel, uploading, uploadProgress }: BatchPhotoUploadFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File, preview: string, caption: string, section: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.professionalReport.photos.upload.useMutation();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newPreviews: { file: File, preview: string, caption: string, section: string }[] = [];

    for (const file of fileArray) {
      // Check for HEIC format
      const isHeic = file.name.toLowerCase().endsWith('.heic') ||
        file.name.toLowerCase().endsWith('.heif') ||
        file.type.includes('heic') ||
        file.type.includes('heif');

      if (isHeic) {
        toast.info(`${file.name}: HEIC will be converted to JPEG`, { duration: 3000 });
      }

      // Compress image
      try {
        const compressedFile = await compressImage(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push({
            file: compressedFile,
            preview: reader.result as string,
            caption: prefilledRequirement?.caption || file.name.replace(/\.[^/.]+$/, ""),
            section: prefilledRequirement?.section.toLowerCase() || 'general',
          });

          if (newPreviews.length === fileArray.length) {
            setPreviews(prev => [...prev, ...newPreviews]);
            setSelectedFiles(prev => [...prev, ...newPreviews.map(p => p.file)]);
          }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Compression failed for', file.name, error);
      }
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          const maxWidth = 1920;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            'image/jpeg',
            0.9
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const updateCaption = (index: number, caption: string) => {
    setPreviews(prev => {
      const newPreviews = [...prev];
      newPreviews[index].caption = caption;
      return newPreviews;
    });
  };

  const updateSection = (index: number, section: string) => {
    setPreviews(prev => {
      const newPreviews = [...prev];
      newPreviews[index].section = section;
      return newPreviews;
    });
  };

  const removePreview = (index: number) => {
    setPreviews(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (previews.length === 0) {
      toast.error('Please select at least one photo');
      return;
    }

    const photoDataArray = [];

    for (const preview of previews) {
      try {
        const result = await uploadMutation.mutateAsync({
          base64Data: preview.preview,
          filename: preview.file.name,
          contentType: preview.file.type,
        });

        photoDataArray.push({
          reportId,
          photoUrl: result.url,
          caption: preview.caption,
          section: preview.section,
          sequenceNumber: photoDataArray.length + 1,
        });
      } catch (error) {
        console.error('Upload failed for', preview.caption, error);
      }
    }

    onSubmit(photoDataArray);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-lg font-medium mb-2">
          Drag and drop photos here
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          or click to browse (supports multiple selection)
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          Select Photos
        </Button>
      </div>

      {previews.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <Label>Selected Photos ({previews.length})</Label>
          {previews.map((preview, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center gap-3">
                <img
                  src={preview.preview}
                  alt={preview.caption}
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="flex-1 space-y-2">
                  <Input
                    value={preview.caption}
                    onChange={(e) => updateCaption(index, e.target.value)}
                    placeholder="Photo caption"
                    disabled={uploading}
                  />
                  <Select
                    value={preview.section}
                    onValueChange={(value) => updateSection(index, value)}
                    disabled={uploading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="shell">Shell</SelectItem>
                      <SelectItem value="heads">Heads</SelectItem>
                      <SelectItem value="nozzles">Nozzles</SelectItem>
                      <SelectItem value="foundation">Foundation</SelectItem>
                      <SelectItem value="appurtenances">Appurtenances</SelectItem>
                    </SelectContent>
                  </Select>
                  {uploadProgress[preview.caption] && (
                    <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePreview(index)}
                  disabled={uploading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>
        <Button type="submit" disabled={uploading || previews.length === 0}>
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading {Object.keys(uploadProgress).length} of {previews.length}...
            </>
          ) : (
            `Upload ${previews.length} Photo${previews.length > 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </form>
  );
}

