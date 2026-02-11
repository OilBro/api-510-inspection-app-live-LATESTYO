import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

interface PhotoComparisonViewProps {
  currentPhoto: {
    url: string;
    caption: string;
    date: Date;
  };
  previousPhoto?: {
    url: string;
    caption: string;
    date: Date;
  };
  open: boolean;
  onClose: () => void;
}

export default function PhotoComparisonView({
  currentPhoto,
  previousPhoto,
  open,
  onClose,
}: PhotoComparisonViewProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateTimeElapsed = () => {
    if (!previousPhoto) return null;
    
    const current = new Date(currentPhoto.date);
    const previous = new Date(previousPhoto.date);
    const diffTime = Math.abs(current.getTime() - previous.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffYears = Math.floor(diffDays / 365);
    const remainingDays = diffDays % 365;
    
    if (diffYears > 0) {
      return `${diffYears} year${diffYears > 1 ? 's' : ''}, ${remainingDays} days`;
    }
    return `${diffDays} days`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Photo Comparison</DialogTitle>
          <DialogDescription>
            Compare current inspection photo with previous inspection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {previousPhoto ? (
            <>
              {/* Time Elapsed Info */}
              <Card className="bg-blue-50 dark:bg-blue-950">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Time Elapsed</p>
                      <p className="text-2xl font-bold">{calculateTimeElapsed()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Previous: {formatDate(previousPhoto.date)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Current: {formatDate(currentPhoto.date)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-center">Previous Inspection</h3>
                  <Card>
                    <CardContent className="p-2">
                      <img
                        src={previousPhoto.url}
                        alt={previousPhoto.caption}
                        className="w-full h-auto rounded"
                      />
                      <p className="text-sm text-center mt-2 text-muted-foreground">
                        {previousPhoto.caption}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-center">Current Inspection</h3>
                  <Card>
                    <CardContent className="p-2">
                      <img
                        src={currentPhoto.url}
                        alt={currentPhoto.caption}
                        className="w-full h-auto rounded"
                      />
                      <p className="text-sm text-center mt-2 text-muted-foreground">
                        {currentPhoto.caption}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Overlay Comparison with Slider */}
              <div className="space-y-2">
                <h3 className="font-medium text-center">Overlay Comparison</h3>
                <Card>
                  <CardContent className="p-2">
                    <div className="relative overflow-hidden rounded">
                      {/* Previous photo (background) */}
                      <img
                        src={previousPhoto.url}
                        alt="Previous"
                        className="w-full h-auto"
                      />
                      
                      {/* Current photo (overlay with clip) */}
                      <div
                        className="absolute top-0 left-0 w-full h-full overflow-hidden"
                        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                      >
                        <img
                          src={currentPhoto.url}
                          alt="Current"
                          className="w-full h-auto"
                        />
                      </div>

                      {/* Slider control */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize"
                        style={{ left: `${sliderPosition}%` }}
                        onMouseDown={(e) => {
                          const startX = e.clientX;
                          const startPosition = sliderPosition;
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const container = e.currentTarget.parentElement;
                            if (!container) return;
                            
                            const rect = container.getBoundingClientRect();
                            const deltaX = moveEvent.clientX - startX;
                            const deltaPercent = (deltaX / rect.width) * 100;
                            const newPosition = Math.max(0, Math.min(100, startPosition + deltaPercent));
                            setSliderPosition(newPosition);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                          <div className="w-1 h-4 bg-gray-400"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderPosition}
                        onChange={(e) => setSliderPosition(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Previous</span>
                        <span>Current</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  No previous inspection photo available for comparison
                </p>
                <div className="mt-4">
                  <img
                    src={currentPhoto.url}
                    alt={currentPhoto.caption}
                    className="max-w-full h-auto mx-auto rounded"
                  />
                  <p className="text-sm mt-2">{currentPhoto.caption}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Close Button */}
          <div className="flex justify-end">
            <Button onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

