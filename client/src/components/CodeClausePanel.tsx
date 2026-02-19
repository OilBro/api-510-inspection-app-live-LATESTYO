/**
 * CodeClausePanel — ASME/API Code Clause Display Component
 * 
 * Displays the governing ASME/API code clause alongside calculation results
 * using Cohere Rerank V3 for intelligent formula selection.
 * 
 * Features:
 * - Auto-detects calculation type and fetches the governing code clause
 * - Shows confidence score with color-coded indicator
 * - Expandable detail panel with formula, applicability, and limitations
 * - Compact inline mode for embedding next to calculation results
 * - Full panel mode for detailed code reference display
 */

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BookOpen, ChevronDown, ChevronRight, Shield, AlertTriangle, CheckCircle, Info } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type CalculationType =
  | "shell_tmin"
  | "shell_mawp"
  | "head_tmin"
  | "head_mawp"
  | "nozzle_reinforcement"
  | "remaining_life"
  | "corrosion_rate"
  | "inspection_interval";

interface CodeClauseData {
  id: string;
  code: string;
  paragraph: string;
  title: string;
  formula: string;
  mawpFormula: string;
  applicability: string;
  limitations: string;
  componentTypes: string[];
  variables: Record<string, string>;
}

interface CodeClausePanelProps {
  /** The type of calculation being performed */
  calculationType: CalculationType;
  /** Optional head type for head calculations */
  headType?: string;
  /** Display mode: 'inline' for compact badge, 'panel' for full detail */
  mode?: "inline" | "panel";
  /** Whether to show the expandable detail section */
  showDetails?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Confidence Helpers
// ============================================================================

function getConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score > 0.5) return "high";
  if (score > 0.2) return "medium";
  return "low";
}

function getConfidenceColor(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "text-green-700 bg-green-50 border-green-200";
    case "medium":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "low":
      return "text-red-700 bg-red-50 border-red-200";
  }
}

function getConfidenceBadgeVariant(level: "high" | "medium" | "low") {
  switch (level) {
    case "high":
      return "default" as const;
    case "medium":
      return "secondary" as const;
    case "low":
      return "destructive" as const;
  }
}

function ConfidenceIcon({ level }: { level: "high" | "medium" | "low" }) {
  switch (level) {
    case "high":
      return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
    case "medium":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
    case "low":
      return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
  }
}

// ============================================================================
// Fallback Knowledge Base (used when API is unavailable)
// ============================================================================

const FALLBACK_CLAUSES: Record<string, CodeClauseData> = {
  shell_tmin: {
    id: "UG-27-circ",
    code: "ASME VIII-1",
    paragraph: "UG-27(c)(1)",
    title: "Cylindrical Shell — Circumferential Stress (Longitudinal Joints)",
    formula: "t = PR / (SE - 0.6P)",
    mawpFormula: "MAWP = SEt / (R + 0.6t)",
    applicability: "Cylindrical shells under internal pressure. Circumferential stress governs when P ≤ 0.385SE.",
    limitations: "Thin-wall formula only: t ≤ R/2. For thick-wall, use mandatory Appendix 1.",
    componentTypes: ["shell", "cylinder"],
    variables: {
      P: "Design pressure (psi)",
      R: "Inside radius (inches)",
      S: "Allowable stress at design temperature (psi) per ASME Section II Part D",
      E: "Joint efficiency per UW-12",
      t: "Minimum required wall thickness (inches)",
    },
  },
  shell_mawp: {
    id: "UG-27-circ",
    code: "ASME VIII-1",
    paragraph: "UG-27(c)(1)",
    title: "Cylindrical Shell — MAWP at Actual Thickness",
    formula: "MAWP = SEt / (R + 0.6t)",
    mawpFormula: "MAWP = SEt / (R + 0.6t)",
    applicability: "Maximum allowable working pressure for cylindrical shells at measured thickness.",
    limitations: "Thin-wall formula only: t ≤ R/2.",
    componentTypes: ["shell"],
    variables: {
      S: "Allowable stress (psi)",
      E: "Joint efficiency",
      t: "Actual measured thickness (inches)",
      R: "Inside radius (inches)",
    },
  },
  head_tmin: {
    id: "UG-32-d-ellipsoidal",
    code: "ASME VIII-1",
    paragraph: "UG-32(d)",
    title: "2:1 Ellipsoidal Head — Internal Pressure",
    formula: "t = PD / (2SE - 0.2P)",
    mawpFormula: "MAWP = 2SEt / (D + 0.2t)",
    applicability: "2:1 semi-ellipsoidal heads under internal pressure.",
    limitations: "Thin-wall formula: t ≤ 0.25D.",
    componentTypes: ["head", "ellipsoidal"],
    variables: {
      P: "Design pressure (psi)",
      D: "Inside diameter of head skirt (inches)",
      S: "Allowable stress (psi)",
      E: "Joint efficiency",
      t: "Minimum required head thickness (inches)",
    },
  },
  head_mawp: {
    id: "UG-32-d-ellipsoidal",
    code: "ASME VIII-1",
    paragraph: "UG-32(d)",
    title: "2:1 Ellipsoidal Head — MAWP",
    formula: "MAWP = 2SEt / (D + 0.2t)",
    mawpFormula: "MAWP = 2SEt / (D + 0.2t)",
    applicability: "Maximum allowable working pressure for 2:1 ellipsoidal heads.",
    limitations: "Thin-wall formula: t ≤ 0.25D.",
    componentTypes: ["head"],
    variables: {
      S: "Allowable stress (psi)",
      E: "Joint efficiency",
      t: "Actual measured thickness (inches)",
      D: "Inside diameter (inches)",
    },
  },
  remaining_life: {
    id: "API510-7.1.1-RL",
    code: "API 510",
    paragraph: "§7.1.1",
    title: "Remaining Life Calculation",
    formula: "RL = (t_actual - t_required) / Corrosion_Rate",
    mawpFormula: "N/A",
    applicability: "All in-service pressure vessels subject to corrosion or erosion.",
    limitations: "Corrosion rate must be explicitly defined as LT, ST, or user-provided.",
    componentTypes: ["any"],
    variables: {
      t_actual: "Current measured thickness (inches)",
      t_required: "Minimum required thickness (inches)",
      Corrosion_Rate: "Rate in inches/year",
      RL: "Remaining life (years)",
    },
  },
  corrosion_rate: {
    id: "API510-CR-ST",
    code: "API 510",
    paragraph: "§7.1",
    title: "Short-Term Corrosion Rate",
    formula: "CR = (t_previous - t_current) / Years_between_inspections",
    mawpFormula: "N/A",
    applicability: "Corrosion rate between two consecutive thickness measurements.",
    limitations: "Requires at least two thickness readings at the same CML location.",
    componentTypes: ["any"],
    variables: {
      t_previous: "Previous thickness measurement (inches)",
      t_current: "Current thickness measurement (inches)",
      Years_between_inspections: "Time between measurements (years)",
    },
  },
  inspection_interval: {
    id: "API510-interval",
    code: "API 510",
    paragraph: "§6.4",
    title: "Inspection Interval Determination",
    formula: "Interval = MIN(RL / 2, 10 years)",
    mawpFormula: "N/A",
    applicability: "Determining next internal or on-stream inspection date.",
    limitations: "If RL ≤ 4 years, internal inspection is required.",
    componentTypes: ["any"],
    variables: {
      RL: "Remaining life (years)",
      Interval: "Maximum inspection interval (years)",
    },
  },
  nozzle_reinforcement: {
    id: "UG-37-reinforcement",
    code: "ASME VIII-1",
    paragraph: "UG-37",
    title: "Reinforcement Required for Openings",
    formula: "A_required = d × t_r × F + 2 × t_n × t_r × F × (1 - f_r1)",
    mawpFormula: "N/A — Area replacement method",
    applicability: "All openings in pressure vessels that require reinforcement per UG-36.",
    limitations: "Opening diameter ≤ one-half the vessel diameter or 20 inches.",
    componentTypes: ["nozzle"],
    variables: {
      d: "Finished diameter of opening (inches)",
      t_r: "Required thickness of shell or head (inches)",
      F: "Correction factor",
      t_n: "Nominal thickness of nozzle wall (inches)",
    },
  },
};

// ============================================================================
// Component
// ============================================================================

export default function CodeClausePanel({
  calculationType,
  headType,
  mode = "panel",
  showDetails = true,
  className = "",
}: CodeClausePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [clause, setClause] = useState<CodeClauseData | null>(null);
  const [confidence, setConfidence] = useState<number>(1.0);
  const [explanation, setExplanation] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  // Stabilize the query input to prevent infinite re-renders
  const queryInput = useMemo(() => ({
    calculationType,
    headType,
  }), [calculationType, headType]);

  // Use the getCodeReference query endpoint
  const { data, isLoading: queryLoading, error } = trpc.cohere.getCodeReference.useQuery(
    {
      calculationType: queryInput.calculationType,
      headType: queryInput.headType,
    },
    {
      retry: 1,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // Update state when data arrives
  useEffect(() => {
    if (data) {
      setClause(data.selectedClause as CodeClauseData);
      setConfidence(data.confidence);
      setExplanation(data.explanation);
      setUsedFallback(false);
      setIsLoading(false);
    }
  }, [data]);

  // Fall back to local knowledge base if API fails
  useEffect(() => {
    if (error) {
      const fallback = FALLBACK_CLAUSES[calculationType];
      if (fallback) {
        // For head calculations, adjust the fallback based on head type
        if (calculationType === "head_tmin" || calculationType === "head_mawp") {
          const adjustedFallback = getHeadFallback(calculationType, headType);
          setClause(adjustedFallback);
        } else {
          setClause(fallback);
        }
        setConfidence(1.0);
        setExplanation("Using local code reference (Cohere API unavailable).");
        setUsedFallback(true);
      }
      setIsLoading(false);
    }
  }, [error, calculationType, headType]);

  const confidenceLevel = getConfidenceLevel(confidence);

  if (!clause && !queryLoading) return null;

  // ---- INLINE MODE ----
  if (mode === "inline") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors hover:opacity-80 ${getConfidenceColor(confidenceLevel)} ${className}`}
          >
            <BookOpen className="h-3 w-3" />
            <span>{clause ? `${clause.code} ${clause.paragraph}` : "Loading..."}</span>
            <ConfidenceIcon level={confidenceLevel} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-3">
          {clause ? (
            <div className="space-y-1.5">
              <p className="font-semibold text-sm">{clause.title}</p>
              <p className="text-xs font-mono bg-black/10 px-1.5 py-0.5 rounded">{clause.formula}</p>
              <p className="text-xs opacity-80">{clause.applicability}</p>
              <div className="flex items-center gap-1 text-xs">
                <Shield className="h-3 w-3" />
                <span>Confidence: {(confidence * 100).toFixed(0)}%</span>
                {usedFallback && <span className="text-amber-300"> (offline)</span>}
              </div>
            </div>
          ) : (
            <p className="text-xs">Loading code reference...</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ---- PANEL MODE ----
  return (
    <div className={`rounded-lg border ${getConfidenceColor(confidenceLevel)} ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:opacity-90 transition-opacity">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 shrink-0" />
              {queryLoading ? (
                <span className="text-sm animate-pulse">Identifying governing code clause...</span>
              ) : clause ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">
                    {clause.code} {clause.paragraph}
                  </span>
                  <span className="text-xs opacity-75">—</span>
                  <span className="text-xs opacity-90">{clause.title}</span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <Badge variant={getConfidenceBadgeVariant(confidenceLevel)} className="text-[10px] px-1.5 py-0">
                <ConfidenceIcon level={confidenceLevel} />
                <span className="ml-1">{(confidence * 100).toFixed(0)}%</span>
              </Badge>
              {usedFallback && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Offline
                </Badge>
              )}
              {showDetails && (
                isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {showDetails && clause && (
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-3 border-t border-current/10 pt-2">
              {/* Formula */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold opacity-60 mb-1">Governing Formula</p>
                <div className="bg-white/60 rounded px-2.5 py-1.5 font-mono text-sm border border-current/10">
                  {clause.formula}
                </div>
                {clause.mawpFormula && clause.mawpFormula !== "N/A" && clause.mawpFormula !== "N/A — Area replacement method" && clause.mawpFormula !== "N/A — Minimum thickness requirement" && clause.mawpFormula !== "N/A — Lookup table" && (
                  <div className="bg-white/60 rounded px-2.5 py-1.5 font-mono text-sm border border-current/10 mt-1">
                    {clause.mawpFormula}
                  </div>
                )}
              </div>

              {/* Variables */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold opacity-60 mb-1">Variables</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {Object.entries(clause.variables).map(([key, desc]) => (
                    <div key={key} className="flex items-start gap-1.5 text-xs">
                      <span className="font-mono font-bold shrink-0 bg-white/60 px-1 rounded">{key}</span>
                      <span className="opacity-80">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Applicability */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold opacity-60 mb-1">Applicability</p>
                <p className="text-xs opacity-90">{clause.applicability}</p>
              </div>

              {/* Limitations */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold opacity-60 mb-1">Limitations</p>
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 opacity-70" />
                  <p className="text-xs opacity-90">{clause.limitations}</p>
                </div>
              </div>

              {/* Explanation */}
              {explanation && (
                <div className="flex items-start gap-1.5 text-xs opacity-75 pt-1 border-t border-current/10">
                  <Info className="h-3 w-3 shrink-0 mt-0.5" />
                  <p>{explanation}</p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

// ============================================================================
// Head Type Fallback Helper
// ============================================================================

function getHeadFallback(calcType: "head_tmin" | "head_mawp", headType?: string): CodeClauseData {
  const ht = (headType || "ellipsoidal").toLowerCase();

  if (ht.includes("hemi")) {
    return {
      id: "UG-32-f-hemispherical",
      code: "ASME VIII-1",
      paragraph: "UG-32(f)",
      title: "Hemispherical Head — Internal Pressure",
      formula: "t = PR / (2SE - 0.2P)",
      mawpFormula: "MAWP = 2SEt / (R + 0.2t)",
      applicability: "Hemispherical heads under internal pressure.",
      limitations: "Thin-wall formula: t ≤ 0.356R.",
      componentTypes: ["head", "hemispherical"],
      variables: {
        P: "Design pressure (psi)",
        R: "Inside radius (inches)",
        S: "Allowable stress (psi)",
        E: "Joint efficiency",
        t: "Minimum required thickness (inches)",
      },
    };
  }

  if (ht.includes("tori") || ht.includes("f&d") || ht.includes("flanged")) {
    return {
      id: "UG-32-e-torispherical",
      code: "ASME VIII-1",
      paragraph: "UG-32(e)",
      title: "Torispherical (F&D) Head — Internal Pressure",
      formula: "t = 0.885PL / (SE - 0.1P)",
      mawpFormula: "MAWP = SEt / (0.885L + 0.1t)",
      applicability: "ASME flanged and dished (torispherical) heads.",
      limitations: "r ≥ 0.06L, r ≥ 3t, L ≤ OD. M = 0.885 for standard F&D.",
      componentTypes: ["head", "torispherical"],
      variables: {
        P: "Design pressure (psi)",
        L: "Inside crown radius (inches)",
        S: "Allowable stress (psi)",
        E: "Joint efficiency",
        t: "Minimum required thickness (inches)",
      },
    };
  }

  // Default: ellipsoidal
  return FALLBACK_CLAUSES[calcType];
}

// ============================================================================
// Compact Code Badge (for embedding inline in result rows)
// ============================================================================

export function CodeClauseBadge({
  calculationType,
  headType,
  className = "",
}: {
  calculationType: CalculationType;
  headType?: string;
  className?: string;
}) {
  return (
    <CodeClausePanel
      calculationType={calculationType}
      headType={headType}
      mode="inline"
      className={className}
    />
  );
}
