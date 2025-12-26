import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Circle, AlertCircle, Info } from "lucide-react";
import { PHOTO_TEMPLATES, PhotoRequirement } from "@shared/photoTemplates";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PhotoChecklistPanelProps {
  selectedTemplateId?: string;
  onTemplateChange: (templateId: string) => void;
  uploadedPhotos: Array<{ caption: string; section: string }>;
  onRequirementClick: (requirement: PhotoRequirement) => void;
}

export default function PhotoChecklistPanel({
  selectedTemplateId,
  onTemplateChange,
  uploadedPhotos,
  onRequirementClick,
}: PhotoChecklistPanelProps) {
  const selectedTemplate = selectedTemplateId
    ? PHOTO_TEMPLATES.find(t => t.id === selectedTemplateId)
    : null;

  const getRequirementStatus = (requirement: PhotoRequirement): 'complete' | 'incomplete' => {
    // Check if any uploaded photo matches this requirement
    const hasMatch = uploadedPhotos.some(
      photo =>
        photo.caption.toLowerCase().includes(requirement.caption.toLowerCase()) ||
        (photo.section === requirement.section && 
         photo.caption.toLowerCase().includes(requirement.id.replace(/-/g, ' ')))
    );
    return hasMatch ? 'complete' : 'incomplete';
  };

  const calculateProgress = (): { completed: number; total: number; required: number } => {
    if (!selectedTemplate) return { completed: 0, total: 0, required: 0 };

    const total = selectedTemplate.requirements.length;
    const required = selectedTemplate.requirements.filter(r => r.required).length;
    const completed = selectedTemplate.requirements.filter(
      r => getRequirementStatus(r) === 'complete'
    ).length;

    return { completed, total, required };
  };

  const progress = calculateProgress();
  const progressPercent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
  const requiredComplete = selectedTemplate
    ? selectedTemplate.requirements.filter(r => r.required && getRequirementStatus(r) === 'complete').length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Circle className="h-5 w-5" />
          Photo Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Template</label>
          <Select value={selectedTemplateId || ''} onValueChange={onTemplateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a photo template..." />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_TEMPLATES.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate && (
            <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
          )}
        </div>

        {selectedTemplate && (
          <>
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">
                  {progress.completed} of {progress.total} photos
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Required: {requiredComplete} of {progress.required}
                </span>
                <span>{Math.round(progressPercent)}% complete</span>
              </div>
            </div>

            {/* Requirements List */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Required Photos</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        Click on any item to auto-fill its caption when uploading
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="space-y-1 max-h-96 overflow-y-auto">
                {selectedTemplate.requirements.map(requirement => {
                  const status = getRequirementStatus(requirement);
                  const isComplete = status === 'complete';

                  return (
                    <TooltipProvider key={requirement.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onRequirementClick(requirement)}
                            className={`w-full flex items-start gap-2 p-2 rounded text-left transition-colors hover:bg-accent ${
                              isComplete ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="mt-0.5">
                              {isComplete ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : requirement.required ? (
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${isComplete ? 'line-through' : ''}`}>
                                {requirement.caption}
                                {requirement.required && (
                                  <span className="text-orange-600 ml-1">*</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {requirement.section}
                              </p>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="text-xs">{requirement.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Legend:</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-600" />
                  <span>Complete</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-orange-600" />
                  <span>Required</span>
                </div>
                <div className="flex items-center gap-1">
                  <Circle className="h-3 w-3" />
                  <span>Optional</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

