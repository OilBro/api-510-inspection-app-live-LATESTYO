import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Brain,
  Search,
  BookOpen,
  History,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  FileText,
  Wrench,
} from "lucide-react";

// ============================================================================
// TAB 1: Code Clause Lookup (Rerank V3)
// ============================================================================

function CodeClauseLookup() {
  const [query, setQuery] = useState("");
  const [componentFilter, setComponentFilter] = useState<string>("");
  const selectFormulaMutation = trpc.cohere.selectFormula.useMutation();

  const handleSearch = () => {
    if (query.trim().length < 3) {
      toast.error("Query must be at least 3 characters");
      return;
    }
    selectFormulaMutation.mutate({
      query: query.trim(),
      componentType: componentFilter || undefined,
      topN: 5,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Code Clause Lookup
          </CardTitle>
          <CardDescription>
            Describe the calculation or code requirement you need, and the system will identify
            the most relevant ASME/API code clause using semantic search (Cohere Rerank V3).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="e.g., minimum thickness for cylindrical shell under internal pressure"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select value={componentFilter} onValueChange={setComponentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Components" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Components</SelectItem>
                <SelectItem value="shell">Shell</SelectItem>
                <SelectItem value="head">Head</SelectItem>
                <SelectItem value="nozzle">Nozzle</SelectItem>
                <SelectItem value="cone">Conical</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={selectFormulaMutation.isPending}>
              {selectFormulaMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          {/* Quick Reference Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2">Quick:</span>
            {[
              { label: "Shell t_min", query: "minimum required thickness for cylindrical shell", comp: "shell" },
              { label: "Shell MAWP", query: "maximum allowable working pressure MAWP for shell", comp: "shell" },
              { label: "Head t_min", query: "minimum required thickness for ellipsoidal head", comp: "head" },
              { label: "Remaining Life", query: "remaining life calculation corrosion rate API 510", comp: "" },
              { label: "Nozzle UG-37", query: "reinforcement required for openings nozzle area replacement", comp: "nozzle" },
              { label: "Inspection Interval", query: "next inspection interval determination API 510", comp: "" },
            ].map((item) => (
              <Button
                key={item.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery(item.query);
                  setComponentFilter(item.comp);
                  selectFormulaMutation.mutate({
                    query: item.query,
                    componentType: item.comp || undefined,
                    topN: 5,
                  });
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {selectFormulaMutation.data && (
        <div className="space-y-4">
          {/* Selected Clause */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  Selected Code Clause
                </CardTitle>
                <ConfidenceBadge score={selectFormulaMutation.data.confidence} />
              </div>
              <CardDescription>{selectFormulaMutation.data.explanation}</CardDescription>
            </CardHeader>
            <CardContent>
              <ClauseCard clause={selectFormulaMutation.data.selectedClause} highlight />
            </CardContent>
          </Card>

          {/* All Ranked Results */}
          {selectFormulaMutation.data.topClauses.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Ranked Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectFormulaMutation.data.topClauses.map((result, idx) => (
                  <div key={result.clause.id} className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-1 shrink-0">
                      #{idx + 1}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {result.clause.code} {result.clause.paragraph} — {result.clause.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Score: {result.relevanceScore.toFixed(4)}
                        </span>
                      </div>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{result.clause.formula}</code>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 2: Historical Memory (Embed V3)
// ============================================================================

function HistoricalMemory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>("");
  const batchEmbedMutation = trpc.cohere.batchEmbedInspections.useMutation();
  const findSimilarMutation = trpc.cohere.findSimilar.useMutation();

  const handleBatchEmbed = () => {
    batchEmbedMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(data.message);
      },
      onError: (err) => {
        toast.error(`Embedding failed: ${err.message}`);
      },
    });
  };

  const handleSearchByText = () => {
    if (searchQuery.trim().length < 5) {
      toast.error("Query must be at least 5 characters");
      return;
    }
    findSimilarMutation.mutate({
      query: searchQuery.trim(),
      topK: 10,
      minSimilarity: 0.2,
    });
  };

  const handleSearchByInspection = () => {
    if (!selectedInspectionId) {
      toast.error("Select an inspection first");
      return;
    }
    findSimilarMutation.mutate({
      inspectionId: selectedInspectionId,
      topK: 10,
      minSimilarity: 0.2,
    });
  };

  return (
    <div className="space-y-6">
      {/* Build Memory */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-emerald-600" />
            Historical Inspection Memory
          </CardTitle>
          <CardDescription>
            Build semantic memory from your inspection records using Cohere Embed V3.
            Once embedded, you can search for similar inspections by describing findings
            or selecting an existing inspection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleBatchEmbed}
              disabled={batchEmbedMutation.isPending}
              variant="outline"
            >
              {batchEmbedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Build/Update Memory Index
            </Button>
            {batchEmbedMutation.data && (
              <span className="text-sm text-muted-foreground">
                {batchEmbedMutation.data.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Similar Inspections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Search by Description</label>
            <div className="flex gap-3">
              <Input
                placeholder="e.g., pitting corrosion on lower shell near bottom head weld"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchByText()}
                className="flex-1"
              />
              <Button onClick={handleSearchByText} disabled={findSimilarMutation.isPending}>
                {findSimilarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <label className="text-sm font-medium mb-2 block">Or Search by Inspection ID</label>
            <div className="flex gap-3">
              <Input
                placeholder="Enter inspection ID"
                value={selectedInspectionId}
                onChange={(e) => setSelectedInspectionId(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSearchByInspection}
                disabled={findSimilarMutation.isPending || !selectedInspectionId}
                variant="outline"
              >
                Find Similar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {findSimilarMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Similar Inspections</span>
              <Badge variant="secondary">
                {findSimilarMutation.data.results.length} of {findSimilarMutation.data.totalCandidates} candidates
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {findSimilarMutation.data.results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No similar inspections found above the similarity threshold.</p>
                <p className="text-sm mt-1">Try building the memory index first, or broaden your search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {findSimilarMutation.data.results.map((result, idx) => (
                  <div
                    key={result.inspectionId}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{idx + 1}</Badge>
                        <span className="font-medium">{result.vesselTagNumber}</span>
                        {result.vesselName && (
                          <span className="text-muted-foreground">— {result.vesselName}</span>
                        )}
                      </div>
                      <SimilarityBadge score={result.similarity} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{result.findings}</p>
                    {result.inspectionDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Inspection Date: {new Date(result.inspectionDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// TAB 3: Engineering Guidance (Command R+ RAG)
// ============================================================================

function EngineeringGuidance() {
  const [question, setQuestion] = useState("");
  const [vesselTag, setVesselTag] = useState("");
  const [materialSpec, setMaterialSpec] = useState("");
  const [designPressure, setDesignPressure] = useState("");
  const [designTemp, setDesignTemp] = useState("");
  const [headType, setHeadType] = useState("");
  const [findings, setFindings] = useState("");
  const [showContext, setShowContext] = useState(false);

  const askQuestionMutation = trpc.cohere.askQuestion.useMutation();
  const repairMutation = trpc.cohere.getRepairRecommendation.useMutation();

  const [mode, setMode] = useState<"question" | "repair">("question");

  // Repair-specific fields
  const [repairFinding, setRepairFinding] = useState("");
  const [repairComponent, setRepairComponent] = useState("shell");
  const [repairSeverity, setRepairSeverity] = useState<"minor" | "moderate" | "severe">("moderate");

  const handleAskQuestion = () => {
    if (question.trim().length < 10) {
      toast.error("Question must be at least 10 characters");
      return;
    }

    const vesselContext = showContext
      ? {
          vesselTagNumber: vesselTag || undefined,
          materialSpec: materialSpec || undefined,
          designPressure: designPressure ? parseFloat(designPressure) : undefined,
          designTemperature: designTemp ? parseFloat(designTemp) : undefined,
          headType: headType || undefined,
          currentFindings: findings || undefined,
        }
      : undefined;

    askQuestionMutation.mutate({
      question: question.trim(),
      vesselContext,
    });
  };

  const handleRepairRequest = () => {
    if (repairFinding.trim().length < 10) {
      toast.error("Finding description must be at least 10 characters");
      return;
    }

    repairMutation.mutate({
      finding: repairFinding.trim(),
      componentType: repairComponent,
      severity: repairSeverity,
      vesselContext: showContext
        ? {
            vesselTagNumber: vesselTag || undefined,
            materialSpec: materialSpec || undefined,
            designPressure: designPressure ? parseFloat(designPressure) : undefined,
            designTemperature: designTemp ? parseFloat(designTemp) : undefined,
          }
        : undefined,
    });
  };

  const activeResult = mode === "question" ? askQuestionMutation.data : repairMutation.data;
  const isPending = mode === "question" ? askQuestionMutation.isPending : repairMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-600" />
            Engineering Guidance
          </CardTitle>
          <CardDescription>
            Ask engineering questions grounded in ASME/API codes. Responses include specific
            code citations for audit defensibility. Powered by Cohere Command R+ with RAG.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === "question" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("question")}
            >
              <FileText className="h-4 w-4 mr-1" />
              Code Question
            </Button>
            <Button
              variant={mode === "repair" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("repair")}
            >
              <Wrench className="h-4 w-4 mr-1" />
              Repair Recommendation
            </Button>
          </div>

          {mode === "question" ? (
            <div className="space-y-3">
              <Textarea
                placeholder="e.g., What is the procedure for a temporary fillet welded patch per API 510? What NDE is required after a weld repair on a shell seam?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground mr-1">Examples:</span>
                {[
                  "What is the minimum required thickness formula for a 2:1 ellipsoidal head per UG-32?",
                  "When is a hydrostatic test required after a repair per API 510?",
                  "How do I calculate the remaining life of a corroding vessel per API 510 Section 7?",
                  "What are the joint efficiency values for spot radiography per UW-12?",
                ].map((ex) => (
                  <Button
                    key={ex}
                    variant="ghost"
                    size="sm"
                    className="text-xs h-auto py-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setQuestion(ex)}
                  >
                    {ex.slice(0, 60)}...
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder="Describe the inspection finding, e.g., 'General corrosion with localized pitting on lower shell near the 6 o'clock position. Minimum reading 0.285 inches.'"
                value={repairFinding}
                onChange={(e) => setRepairFinding(e.target.value)}
                rows={3}
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Component</label>
                  <Select value={repairComponent} onValueChange={setRepairComponent}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shell">Shell</SelectItem>
                      <SelectItem value="head">Head</SelectItem>
                      <SelectItem value="nozzle">Nozzle</SelectItem>
                      <SelectItem value="weld">Weld</SelectItem>
                      <SelectItem value="support">Support/Saddle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Severity</label>
                  <Select value={repairSeverity} onValueChange={(v) => setRepairSeverity(v as "minor" | "moderate" | "severe")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Optional Vessel Context */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowContext(!showContext)}
              className="text-muted-foreground"
            >
              {showContext ? "Hide" : "Add"} Vessel Context (optional)
            </Button>
            {showContext && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 p-3 border rounded-lg bg-muted/30">
                <div>
                  <label className="text-xs font-medium">Vessel Tag</label>
                  <Input
                    placeholder="e.g., 54-11-001"
                    value={vesselTag}
                    onChange={(e) => setVesselTag(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Material Spec</label>
                  <Input
                    placeholder="e.g., SA-516 Gr 70"
                    value={materialSpec}
                    onChange={(e) => setMaterialSpec(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Design Pressure (psi)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 150"
                    value={designPressure}
                    onChange={(e) => setDesignPressure(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Design Temp (°F)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 650"
                    value={designTemp}
                    onChange={(e) => setDesignTemp(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Head Type</label>
                  <Select value={headType} onValueChange={setHeadType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ellipsoidal">2:1 Ellipsoidal</SelectItem>
                      <SelectItem value="torispherical">Torispherical (F&D)</SelectItem>
                      <SelectItem value="hemispherical">Hemispherical</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="conical">Conical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">Current Findings</label>
                  <Input
                    placeholder="Brief findings..."
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={mode === "question" ? handleAskQuestion : handleRepairRequest}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Consulting ASME/API Codes...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {mode === "question" ? "Ask Engineering Question" : "Get Repair Recommendation"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Response */}
      {activeResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Engineering Response</CardTitle>
                <ConfidenceBadge
                  score={activeResult.confidence === "high" ? 0.8 : activeResult.confidence === "medium" ? 0.5 : 0.2}
                  label={activeResult.confidence}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {activeResult.answer}
                </div>
              </div>

              {/* Citations */}
              {activeResult.citations.length > 0 && (
                <div>
                  <Separator className="my-3" />
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    Code Citations ({activeResult.citations.length})
                  </h4>
                  <div className="space-y-2">
                    {activeResult.citations.map((citation, idx) => (
                      <div key={idx} className="text-xs border rounded p-2 bg-muted/30">
                        <Badge variant="outline" className="mb-1">
                          {citation.code} {citation.paragraph}
                        </Badge>
                        <p className="text-muted-foreground mt-1">{citation.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-amber-800">{activeResult.disclaimer}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function ConfidenceBadge({ score, label }: { score: number; label?: string }) {
  const displayLabel = label || (score > 0.5 ? "High" : score > 0.2 ? "Moderate" : "Low");
  const variant = score > 0.5 ? "default" : score > 0.2 ? "secondary" : "destructive";
  return (
    <Badge variant={variant} className="text-xs">
      {displayLabel} Confidence
    </Badge>
  );
}

function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "text-green-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
  return (
    <span className={`text-sm font-mono font-medium ${color}`}>
      {pct}% match
    </span>
  );
}

function ClauseCard({ clause, highlight }: { clause: any; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "bg-white" : "bg-muted/30"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Badge>{clause.code}</Badge>
        <Badge variant="outline">{clause.paragraph}</Badge>
        <span className="font-semibold text-sm">{clause.title}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Formula</h5>
          <code className="text-sm bg-muted px-2 py-1 rounded block">{clause.formula}</code>
          {clause.mawpFormula && clause.mawpFormula !== "N/A" && clause.mawpFormula !== "N/A — Area replacement method" && clause.mawpFormula !== "N/A — Minimum thickness requirement" && clause.mawpFormula !== "N/A — Lookup table" && (
            <div className="mt-2">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1">MAWP Formula</h5>
              <code className="text-sm bg-muted px-2 py-1 rounded block">{clause.mawpFormula}</code>
            </div>
          )}
        </div>
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Applicability</h5>
          <p className="text-sm">{clause.applicability}</p>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1 mt-2">Limitations</h5>
          <p className="text-sm text-amber-700">{clause.limitations}</p>
        </div>
      </div>

      {clause.variables && (
        <div className="mt-3">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Variables</h5>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {Object.entries(clause.variables).map(([key, desc]) => (
              <div key={key} className="text-xs">
                <code className="font-mono font-bold">{key}</code>
                <span className="text-muted-foreground"> = {desc as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function EngineeringAdvisor() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Brain className="h-6 w-6 text-violet-600" />
                Engineering Advisor
              </h1>
              <p className="text-sm text-muted-foreground">
                AI-powered code guidance, formula selection, and historical inspection memory
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <Tabs defaultValue="code-lookup" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="code-lookup" className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              Code Clause Lookup
            </TabsTrigger>
            <TabsTrigger value="historical" className="flex items-center gap-1">
              <History className="h-4 w-4" />
              Historical Memory
            </TabsTrigger>
            <TabsTrigger value="guidance" className="flex items-center gap-1">
              <Brain className="h-4 w-4" />
              Engineering Guidance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code-lookup">
            <CodeClauseLookup />
          </TabsContent>

          <TabsContent value="historical">
            <HistoricalMemory />
          </TabsContent>

          <TabsContent value="guidance">
            <EngineeringGuidance />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
