import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Circle,
  Square,
  Pencil,
  Type,
  Undo,
  Trash2,
  Save,
  Ruler,
} from "lucide-react";
import { toast } from "sonner";

interface PhotoAnnotationEditorProps {
  photoUrl: string;
  onSave: (annotatedImageData: string) => void;
  onCancel: () => void;
  open: boolean;
}

type Tool = 'arrow' | 'circle' | 'rectangle' | 'pen' | 'text' | 'measure' | 'none';

interface Annotation {
  type: Tool;
  color: string;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  measurement?: number; // Calculated measurement in reference units
}

export default function PhotoAnnotationEditor({
  photoUrl,
  onSave,
  onCancel,
  open,
}: PhotoAnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [referenceScale, setReferenceScale] = useState<{pixelLength: number, actualLength: number, unit: string} | null>(null);
  const [showReferenceDialog, setShowReferenceDialog] = useState(false);
  const [referenceInput, setReferenceInput] = useState({ length: '', unit: 'inches' });
  const [tempReferenceLine, setTempReferenceLine] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    if (!open || !photoUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      redrawCanvas();
    };
    img.onerror = () => {
      toast.error('Failed to load image');
    };
    img.src = photoUrl;
  }, [open, photoUrl]);

  // Redraw canvas
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    // Set canvas size to match image
    canvas.width = imageRef.current.width;
    canvas.height = imageRef.current.height;

    // Draw image
    ctx.drawImage(imageRef.current, 0, 0);

    // Draw all annotations
    annotations.forEach(ann => drawAnnotation(ctx, ann));

    // Draw temp annotation
    if (tempAnnotation) {
      drawAnnotation(ctx, tempAnnotation);
    }
    
    // Draw temp reference line
    if (tempReferenceLine) {
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(tempReferenceLine.x1, tempReferenceLine.y1);
      ctx.lineTo(tempReferenceLine.x2, tempReferenceLine.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    if (imageLoaded) {
      redrawCanvas();
    }
  }, [annotations, tempAnnotation, tempReferenceLine, imageLoaded, referenceScale]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation) => {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = 3;

    switch (ann.type) {
      case 'arrow':
        if (ann.points && ann.points.length === 4) {
          drawArrow(ctx, ann.points[0], ann.points[1], ann.points[2], ann.points[3], ann.color);
        }
        break;

      case 'circle':
        if (ann.x !== undefined && ann.y !== undefined && ann.width) {
          ctx.beginPath();
          ctx.arc(ann.x, ann.y, ann.width / 2, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;

      case 'rectangle':
        if (ann.x !== undefined && ann.y !== undefined && ann.width && ann.height) {
          ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
        }
        break;

      case 'pen':
        if (ann.points && ann.points.length > 2) {
          ctx.beginPath();
          ctx.moveTo(ann.points[0], ann.points[1]);
          for (let i = 2; i < ann.points.length; i += 2) {
            ctx.lineTo(ann.points[i], ann.points[i + 1]);
          }
          ctx.stroke();
        }
        break;

      case 'text':
        if (ann.x !== undefined && ann.y !== undefined && ann.text) {
          ctx.font = 'bold 20px Arial';
          ctx.fillText(ann.text, ann.x, ann.y);
        }
        break;
      
      case 'measure':
        if (ann.points && ann.points.length === 4) {
          // Draw measurement line
          ctx.beginPath();
          ctx.moveTo(ann.points[0], ann.points[1]);
          ctx.lineTo(ann.points[2], ann.points[3]);
          ctx.stroke();
          
          // Draw end markers
          const markerSize = 10;
          ctx.beginPath();
          ctx.moveTo(ann.points[0], ann.points[1] - markerSize);
          ctx.lineTo(ann.points[0], ann.points[1] + markerSize);
          ctx.moveTo(ann.points[2], ann.points[3] - markerSize);
          ctx.lineTo(ann.points[2], ann.points[3] + markerSize);
          ctx.stroke();
          
          // Draw measurement label
          if (ann.measurement !== undefined) {
            const midX = (ann.points[0] + ann.points[2]) / 2;
            const midY = (ann.points[1] + ann.points[3]) / 2;
            const label = `${ann.measurement.toFixed(2)} ${referenceScale?.unit || 'px'}`;
            
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#FFFFFF';
            const metrics = ctx.measureText(label);
            ctx.fillRect(midX - metrics.width / 2 - 4, midY - 12, metrics.width + 8, 20);
            ctx.fillStyle = ann.color;
            ctx.fillText(label, midX - metrics.width / 2, midY + 4);
          }
        }
        break;
    }
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string
  ) => {
    const headLength = 20;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'none') return;

    const pos = getMousePos(e);

    if (currentTool === 'text') {
      setTextPosition(pos);
      setShowTextInput(true);
      return;
    }
    
    if (currentTool === 'measure' && !referenceScale) {
      // First measurement sets the reference
      setIsDrawing(true);
      setTempReferenceLine({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
      return;
    }

    setIsDrawing(true);

    const newAnnotation: Annotation = {
      type: currentTool,
      color: currentColor,
    };

    if (currentTool === 'arrow' || currentTool === 'pen' || currentTool === 'measure') {
      newAnnotation.points = [pos.x, pos.y];
    } else {
      newAnnotation.x = pos.x;
      newAnnotation.y = pos.y;
      newAnnotation.width = 0;
      newAnnotation.height = 0;
    }

    setTempAnnotation(newAnnotation);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !tempAnnotation) return;

    const pos = getMousePos(e);

    if (currentTool === 'measure' && !referenceScale && tempReferenceLine) {
      setTempReferenceLine({
        ...tempReferenceLine,
        x2: pos.x,
        y2: pos.y,
      });
      return;
    }
    
    if (currentTool === 'arrow' || currentTool === 'measure') {
      setTempAnnotation({
        ...tempAnnotation,
        points: [tempAnnotation.points![0], tempAnnotation.points![1], pos.x, pos.y],
      });
    } else if (currentTool === 'pen') {
      setTempAnnotation({
        ...tempAnnotation,
        points: [...(tempAnnotation.points || []), pos.x, pos.y],
      });
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(pos.x - tempAnnotation.x!, 2) + Math.pow(pos.y - tempAnnotation.y!, 2)
      );
      setTempAnnotation({
        ...tempAnnotation,
        width: radius * 2,
      });
    } else if (currentTool === 'rectangle') {
      setTempAnnotation({
        ...tempAnnotation,
        width: pos.x - tempAnnotation.x!,
        height: pos.y - tempAnnotation.y!,
      });
    }
  };

  const handleMouseUp = () => {
    // Handle reference line completion
    if (currentTool === 'measure' && !referenceScale && tempReferenceLine && isDrawing) {
      setShowReferenceDialog(true);
      setIsDrawing(false);
      return;
    }
    
    if (!isDrawing || !tempAnnotation) return;
    
    // Calculate measurement if using measure tool with reference scale
    if (currentTool === 'measure' && referenceScale && tempAnnotation.points && tempAnnotation.points.length === 4) {
      const pixelLength = Math.sqrt(
        Math.pow(tempAnnotation.points[2] - tempAnnotation.points[0], 2) +
        Math.pow(tempAnnotation.points[3] - tempAnnotation.points[1], 2)
      );
      const actualLength = (pixelLength / referenceScale.pixelLength) * referenceScale.actualLength;
      tempAnnotation.measurement = actualLength;
    }

    setAnnotations([...annotations, tempAnnotation]);
    setTempAnnotation(null);
    setIsDrawing(false);
  };
  
  const handleReferenceSubmit = () => {
    if (!tempReferenceLine || !referenceInput.length) {
      toast.error('Please enter a valid measurement');
      return;
    }
    
    const pixelLength = Math.sqrt(
      Math.pow(tempReferenceLine.x2 - tempReferenceLine.x1, 2) +
      Math.pow(tempReferenceLine.y2 - tempReferenceLine.y1, 2)
    );
    
    const actualLength = parseFloat(referenceInput.length);
    if (isNaN(actualLength) || actualLength <= 0) {
      toast.error('Please enter a valid number');
      return;
    }
    
    setReferenceScale({
      pixelLength,
      actualLength,
      unit: referenceInput.unit,
    });
    
    setShowReferenceDialog(false);
    setTempReferenceLine(null);
    setReferenceInput({ length: '', unit: 'inches' });
    toast.success(`Reference scale set: ${actualLength} ${referenceInput.unit}`);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) {
      setShowTextInput(false);
      setTextInput('');
      return;
    }

    const newAnnotation: Annotation = {
      type: 'text',
      color: currentColor,
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
    };

    setAnnotations([...annotations, newAnnotation]);
    setShowTextInput(false);
    setTextInput('');
  };

  const handleUndo = () => {
    if (annotations.length > 0) {
      setAnnotations(annotations.slice(0, -1));
    }
  };

  const handleClear = () => {
    setAnnotations([]);
    setTempAnnotation(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const annotatedImageData = canvas.toDataURL('image/jpeg', 0.95);
      onSave(annotatedImageData);
      toast.success('Annotations saved');
    } catch (error) {
      console.error('Failed to save annotations:', error);
      toast.error('Failed to save annotations');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Annotate Photo</DialogTitle>
          <DialogDescription>
            Draw arrows, circles, rectangles, or add text to highlight details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap border-b pb-4">
            <Label className="text-sm font-medium mr-2">Tools:</Label>
            
            <Button
              variant={currentTool === 'arrow' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('arrow')}
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Arrow
            </Button>

            <Button
              variant={currentTool === 'circle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('circle')}
            >
              <Circle className="h-4 w-4 mr-1" />
              Circle
            </Button>

            <Button
              variant={currentTool === 'rectangle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('rectangle')}
            >
              <Square className="h-4 w-4 mr-1" />
              Rectangle
            </Button>

            <Button
              variant={currentTool === 'pen' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('pen')}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Pen
            </Button>

            <Button
              variant={currentTool === 'text' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('text')}
            >
              <Type className="h-4 w-4 mr-1" />
              Text
            </Button>
            
            <Button
              variant={currentTool === 'measure' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('measure')}
              title={referenceScale ? `Scale: ${referenceScale.actualLength} ${referenceScale.unit}` : 'Set reference first'}
            >
              <Ruler className="h-4 w-4 mr-1" />
              Measure
            </Button>

            <div className="flex items-center gap-2 ml-4">
              <Label htmlFor="color-picker" className="text-sm">Color:</Label>
              <input
                id="color-picker"
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer"
              />
            </div>

            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={annotations.length === 0}
              >
                <Undo className="h-4 w-4 mr-1" />
                Undo
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={annotations.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative border rounded-lg overflow-auto max-h-[60vh]">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="cursor-crosshair max-w-full h-auto"
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />
            {!imageLoaded && (
              <div className="flex items-center justify-center p-12">
                <p className="text-muted-foreground">Loading image...</p>
              </div>
            )}
          </div>

          {/* Reference Scale Dialog */}
          {showReferenceDialog && tempReferenceLine && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-background p-6 rounded-lg shadow-lg space-y-4 max-w-md">
                <h3 className="font-medium">Set Reference Measurement</h3>
                <p className="text-sm text-muted-foreground">
                  You drew a line. What is the actual length of this line in real life?
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={referenceInput.length}
                    onChange={(e) => setReferenceInput({ ...referenceInput, length: e.target.value })}
                    placeholder="Enter length..."
                    autoFocus
                  />
                  <select
                    value={referenceInput.unit}
                    onChange={(e) => setReferenceInput({ ...referenceInput, unit: e.target.value })}
                    className="px-3 py-2 border rounded"
                  >
                    <option value="inches">inches</option>
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="ft">ft</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowReferenceDialog(false);
                      setTempReferenceLine(null);
                      setReferenceInput({ length: '', unit: 'inches' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleReferenceSubmit}>
                    Set Reference
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Text Input Dialog */}
          {showTextInput && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-background p-6 rounded-lg shadow-lg space-y-4">
                <h3 className="font-medium">Add Text Annotation</h3>
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Enter text..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTextSubmit();
                    if (e.key === 'Escape') {
                      setShowTextInput(false);
                      setTextInput('');
                    }
                  }}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowTextInput(false);
                      setTextInput('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleTextSubmit}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!imageLoaded}>
              <Save className="h-4 w-4 mr-2" />
              Save Annotated Photo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

