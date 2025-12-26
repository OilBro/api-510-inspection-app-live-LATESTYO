import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Download, FileImage, Loader2, Upload, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ConversionJob {
  id: string;
  filename: string;
  size: number;
  status: "uploading" | "converting" | "completed" | "failed";
  progress: number;
  downloadUrl?: string;
  error?: string;
  thumbnailUrl?: string;
}

export default function ConvertImages() {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convertMutation = trpc.images.convertToJpeg.useMutation();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    processFiles(Array.from(files));
    e.target.value = ""; // Clear input
  };

  const processFiles = async (files: File[]) => {
    // Create jobs for each file with thumbnail preview
    const newJobs: ConversionJob[] = await Promise.all(
      files.map(async (file) => {
        // Generate thumbnail preview
        const thumbnailUrl = await generateThumbnail(file);
        return {
          id: Math.random().toString(36).substr(2, 9),
          filename: file.name,
          size: file.size,
          status: "uploading" as const,
          progress: 0,
          thumbnailUrl,
        };
      })
    );

    setJobs((prev) => [...prev, ...newJobs]);

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const jobId = newJobs[i].id;

      try {
        // Update status to uploading
        updateJob(jobId, { status: "uploading", progress: 30 });

        // Upload file to S3 first
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        const { url: sourceUrl } = await uploadResponse.json();

        // Update status to converting
        updateJob(jobId, { status: "converting", progress: 60 });

        // Convert to JPEG using FreeConvert
        const result = await convertMutation.mutateAsync({
          sourceUrl,
          outputFilename: file.name.replace(/\.[^.]+$/, ".jpg"),
        });

        if (result.url) {
          updateJob(jobId, {
            status: "completed",
            progress: 100,
            downloadUrl: result.url,
          });
        } else {
          throw new Error("Conversion failed");
        }
      } catch (error: any) {
        updateJob(jobId, {
          status: "failed",
          progress: 0,
          error: error.message,
        });
      }
    }
  };

  const updateJob = (id: string, updates: Partial<ConversionJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...updates } : job))
    );
  };

  const removeJob = (id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  };

  const clearCompleted = () => {
    setJobs((prev) => prev.filter((job) => job.status !== "completed"));
  };

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }

          // Calculate thumbnail size (max 80px)
          const maxSize = 80;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const totalSize = jobs.reduce((sum, job) => sum + job.size, 0);
  const completedCount = jobs.filter((j) => j.status === "completed").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              ← Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Convert Images to JPEG</h1>
          <p className="text-muted-foreground">
            Convert inspection photos from any format (PNG, BMP, TIFF, etc.) to JPEG for consistent processing
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload Images</CardTitle>
            <CardDescription>
              Drag and drop images here, or click to browse. Supported formats: PNG, BMP, TIFF, WebP, GIF, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className={cn(
                "h-12 w-12 mx-auto mb-4 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
              <p className="text-lg font-medium mb-2">
                {isDragging ? "Drop files here" : "Drag and drop images here"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse your files
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="secondary" size="sm" onClick={(e) => e.stopPropagation()}>
                Browse Files
              </Button>
            </div>

            {jobs.length > 0 && (
              <div className="mt-6 flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium">{jobs.length} files</span>
                  <span className="text-muted-foreground"> • {formatFileSize(totalSize)}</span>
                  {completedCount > 0 && (
                    <span className="text-green-600 ml-2">• {completedCount} completed</span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={clearCompleted}>
                  Clear Completed
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileImage className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No images selected. Drag and drop files above or click to browse.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4 mb-4">
                    {job.thumbnailUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={job.thumbnailUrl}
                          alt={job.filename}
                          className="w-20 h-20 object-cover rounded-lg border-2 border-border"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium mb-1 truncate">{job.filename}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(job.size)} •{" "}
                        {job.status === "uploading" && "Uploading..."}
                        {job.status === "converting" && "Converting to JPEG..."}
                        {job.status === "completed" && "Conversion complete!"}
                        {job.status === "failed" && `Failed: ${job.error}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === "completed" && job.downloadUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href={job.downloadUrl} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      )}
                      {(job.status === "completed" || job.status === "failed") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeJob(job.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {(job.status === "uploading" || job.status === "converting") && (
                    <div className="flex items-center gap-3">
                      <Progress value={job.progress} className="flex-1" />
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {job.status === "completed" && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Successfully converted to JPEG format
                      </AlertDescription>
                    </Alert>
                  )}

                  {job.status === "failed" && (
                    <Alert variant="destructive">
                      <AlertDescription>{job.error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

