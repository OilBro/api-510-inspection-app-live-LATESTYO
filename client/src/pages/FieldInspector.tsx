import { useState, useEffect } from "react";
import { Camera, Upload, Wifi, WifiOff, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { sortByCmlNumber } from "@/lib/cmlSort";

interface PendingReading {
  id: string;
  inspectionId: string;
  vesselTag: string;
  legacyLocationId: string;
  location: string;
  thickness: string;
  photo?: string;
  latitude?: number;
  longitude?: number;
  timestamp: number;
  synced: boolean;
}

export default function FieldInspector() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingReadings, setPendingReadings] = useState<PendingReading[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<string>("");
  const [formData, setFormData] = useState({
    legacyLocationId: "",
    location: "",
    thickness: "",
  });

  const { data: inspections } = trpc.inspections.list.useQuery();
  const createTmlMutation = trpc.tmlReadings.create.useMutation();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load pending readings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("pendingReadings");
    if (stored) {
      setPendingReadings(JSON.parse(stored));
    }
  }, []);

  // Save pending readings to localStorage
  useEffect(() => {
    localStorage.setItem("pendingReadings", JSON.stringify(pendingReadings));
  }, [pendingReadings]);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && pendingReadings.some(r => !r.synced)) {
      syncPendingReadings();
    }
  }, [isOnline]);

  const captureReading = async () => {
    if (!selectedInspection || !formData.legacyLocationId || !formData.thickness) {
      toast.error("Please fill in all required fields");
      return;
    }

    const inspection = inspections?.find(i => i.id === selectedInspection);
    if (!inspection) return;

    // Get geolocation
    let latitude: number | undefined;
    let longitude: number | undefined;
    
    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (error) {
        console.warn("Geolocation not available:", error);
      }
    }

    const newReading: PendingReading = {
      id: `reading-${Date.now()}`,
      inspectionId: selectedInspection,
      vesselTag: inspection.vesselTagNumber || "Unknown",
      legacyLocationId: formData.legacyLocationId,
      location: formData.location,
      thickness: formData.thickness,
      latitude,
      longitude,
      timestamp: Date.now(),
      synced: false,
    };

    setPendingReadings(prev => [...prev, newReading]);
    
    // Reset form
    setFormData({ legacyLocationId: "", location: "", thickness: "" });
    
    toast.success("Reading captured", {
      description: isOnline ? "Syncing..." : "Saved offline, will sync when online",
    });

    // Try to sync immediately if online
    if (isOnline) {
      syncReading(newReading);
    }
  };

  const syncReading = async (reading: PendingReading) => {
    try {
      await createTmlMutation.mutateAsync({
        inspectionId: reading.inspectionId,
        legacyLocationId: reading.legacyLocationId,
        componentType: "Field Reading",
        location: reading.location,
        currentThickness: reading.thickness,
        previousThickness: "",
        nominalThickness: "",
      });

      // Mark as synced
      setPendingReadings(prev =>
        prev.map(r => r.id === reading.id ? { ...r, synced: true } : r)
      );

      toast.success(`Reading ${reading.legacyLocationId} synced`);
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
    }
  };

  const syncPendingReadings = async () => {
    const unsynced = pendingReadings.filter(r => !r.synced);
    
    if (unsynced.length === 0) {
      toast.info("No readings to sync");
      return;
    }

    toast.info(`Syncing ${unsynced.length} readings...`);

    for (const reading of unsynced) {
      await syncReading(reading);
    }
  };

  const capturePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      
      // Create video element
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      // Wait for video to be ready
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });

      // Create canvas and capture frame
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);

      // Stop stream
      stream.getTracks().forEach(track => track.stop());

      // Convert to blob
      canvas.toBlob(blob => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            toast.success("Photo captured");
            // Store photo data URL for later upload
          };
          reader.readAsDataURL(blob);
        }
      }, "image/jpeg", 0.8);

    } catch (error: any) {
      toast.error(`Camera error: ${error.message}`);
    }
  };

  const unsyncedCount = pendingReadings.filter(r => !r.synced).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-2xl py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Field Inspector</h1>
              <p className="text-sm text-muted-foreground">Capture thickness readings on-site</p>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm font-medium">Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm font-medium">Offline</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl py-6 space-y-6">
        {/* Sync Status */}
        {unsyncedCount > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-orange-600" />
                  <span className="font-medium">{unsyncedCount} readings pending sync</span>
                </div>
                <Button 
                  onClick={syncPendingReadings} 
                  disabled={!isOnline}
                  size="sm"
                >
                  Sync Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vessel Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Vessel</CardTitle>
            <CardDescription>Choose the vessel you're inspecting</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedInspection} onValueChange={setSelectedInspection}>
              <SelectTrigger>
                <SelectValue placeholder="Select vessel..." />
              </SelectTrigger>
              <SelectContent>
                {inspections?.map(inspection => (
                  <SelectItem key={inspection.id} value={inspection.id}>
                    {inspection.vesselTagNumber} - {inspection.vesselName || "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Reading Capture Form */}
        {selectedInspection && (
          <Card>
            <CardHeader>
              <CardTitle>Capture Reading</CardTitle>
              <CardDescription>Enter thickness measurement data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legacyLocationId">CML Number *</Label>
                <Input
                  id="legacyLocationId"
                  placeholder="e.g., CML-1, CML-2"
                  value={formData.legacyLocationId}
                  onChange={(e) => setFormData({ ...formData, legacyLocationId: e.target.value })}
                  className="text-lg h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., 12 o'clock, Top, Bottom"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="text-lg h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thickness">Thickness (inches) *</Label>
                <Input
                  id="thickness"
                  type="number"
                  step="0.001"
                  placeholder="0.625"
                  value={formData.thickness}
                  onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
                  className="text-lg h-12"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button onClick={capturePhoto} variant="outline" className="h-12">
                  <Camera className="h-5 w-5 mr-2" />
                  Photo
                </Button>
                <Button onClick={captureReading} className="h-12">
                  Save Reading
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Readings List */}
        {pendingReadings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Readings</CardTitle>
              <CardDescription>{pendingReadings.length} total readings captured</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortByCmlNumber(pendingReadings).map(reading => (
                <div
                  key={reading.id}
                  className={`p-4 rounded-lg border ${
                    reading.synced ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">{reading.vesselTag} - {reading.legacyLocationId}</div>
                      <div className="text-sm text-muted-foreground">
                        {reading.location && <span>{reading.location} • </span>}
                        <span className="font-mono">{reading.thickness}"</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(reading.timestamp).toLocaleString()}
                        </span>
                        {reading.latitude && reading.longitude && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            GPS
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded ${
                      reading.synced ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    }`}>
                      {reading.synced ? "Synced" : "Pending"}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
