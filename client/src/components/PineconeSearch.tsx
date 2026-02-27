/**
 * PINECONE AI SEARCH
 * OilPro 510 - AI-Powered Knowledge Base Search
 *
 * Search across 112+ records: vessel inspection data, ASME/API standards,
 * damage mechanisms, compliance requirements, and fleet analytics.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Database, Loader2, Zap, ChevronDown, ChevronUp } from "lucide-react";

const EXAMPLE_QUERIES = [
    "Which vessel has the highest corrosion risk?",
    "What is the minimum wall thickness for vessel 004?",
    "How do I defend my inspection interval in a PSM audit?",
    "What ASME formula for ellipsoidal heads?",
    "Show NIS external inspection data",
    "What are the SA CHEM facility inspection requirements?",
];

function getNamespaceLabel(ns: string): string {
    if (ns.startsWith("vessel-")) return `🔧 ${ns.replace("vessel-", "Vessel ")}`;
    const labels: Record<string, string> = {
        "api510-standards": "📋 API 510 Standards",
        "asme-code-knowledge": "📐 ASME Code",
        "damage-mechanisms": "⚠️ Damage Mechanisms",
        "compliance-regulatory": "🏛️ Compliance",
        "nde-inspection-methods": "🔍 NDE Methods",
        "best-practices": "✅ Best Practices",
        "business-strategy": "💼 Business",
        "oilpro-fleet": "🚢 Fleet Overview",
        "sachem-facility": "🏭 SA CHEM Facility",
    };
    return labels[ns] || ns;
}

function getScoreColor(score: number): string {
    if (score >= 0.8) return "text-green-600 bg-green-50";
    if (score >= 0.6) return "text-blue-600 bg-blue-50";
    if (score >= 0.4) return "text-amber-600 bg-amber-50";
    return "text-gray-600 bg-gray-50";
}

export function PineconeSearch() {
    const [query, setQuery] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [showExamples, setShowExamples] = useState(false);
    const [expandedResult, setExpandedResult] = useState<string | null>(null);

    const searchResult = trpc.pinecone.fleetSearch.useQuery(
        { query: searchQuery, topK: 8, includeKnowledge: true },
        { enabled: !!searchQuery, retry: false }
    );

    const handleSearch = (q?: string) => {
        const searchText = q || query;
        if (searchText.trim()) {
            setSearchQuery(searchText.trim());
            if (q) setQuery(q);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSearch();
    };

    return (
        <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-violet-100">
                            <Zap className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">AI Knowledge Search</CardTitle>
                            <CardDescription>
                                Search across all vessel data, standards, and compliance knowledge
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
                        <Database className="h-3 w-3" />
                        <span>112+ records</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Search Input */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything about your vessels, standards, or compliance..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-sm transition-all"
                        />
                    </div>
                    <Button
                        onClick={() => handleSearch()}
                        disabled={!query.trim() || searchResult.isLoading}
                        className="bg-violet-600 hover:bg-violet-700 text-white px-4"
                    >
                        {searchResult.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Search"
                        )}
                    </Button>
                </div>

                {/* Example Queries */}
                <div>
                    <button
                        onClick={() => setShowExamples(!showExamples)}
                        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 transition-colors"
                    >
                        {showExamples ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Example questions
                    </button>
                    {showExamples && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {EXAMPLE_QUERIES.map((eq) => (
                                <button
                                    key={eq}
                                    onClick={() => handleSearch(eq)}
                                    className="text-xs px-2.5 py-1 rounded-full bg-white border border-violet-200 text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-all"
                                >
                                    {eq}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Error State */}
                {searchResult.isError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                        Search failed: {searchResult.error?.message || "Check that PINECONE_API_KEY is set in .env"}
                    </div>
                )}

                {/* Results */}
                {searchResult.data && searchResult.data.results.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                                {searchResult.data.results.length} results from{" "}
                                {searchResult.data.namespacesSearched.length} namespaces
                            </span>
                            <span>{searchResult.data.totalResults} total matches</span>
                        </div>

                        {searchResult.data.results.map((result: any, idx: number) => {
                            const isExpanded = expandedResult === result.id;
                            const text = result.text || "";
                            const preview = text.length > 200 ? text.slice(0, 200) + "..." : text;

                            return (
                                <div
                                    key={`${result.id}-${idx}`}
                                    className="p-3 rounded-lg bg-white border border-gray-200 hover:border-violet-300 transition-all cursor-pointer"
                                    onClick={() => setExpandedResult(isExpanded ? null : result.id)}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                                                {getNamespaceLabel(result.namespace)}
                                            </span>
                                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${getScoreColor(result.score)}`}>
                                                {(result.score * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-400 font-mono shrink-0">
                                            #{idx + 1}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        {isExpanded ? text : preview}
                                    </p>
                                    {text.length > 200 && (
                                        <button className="text-xs text-violet-600 mt-1 hover:underline">
                                            {isExpanded ? "Show less" : "Show more"}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* No Results */}
                {searchResult.data && searchResult.data.results.length === 0 && (
                    <div className="text-center py-6 text-sm text-gray-500">
                        No results found for "{searchQuery}". Try a different query.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
