// Shared types between components and page orchestrator

export type DupCandidate = {
  source?: "outline" | "gdrive";
  id: string;
  title: string;
  collection?: string;
  url: string;
  updated?: string;
  matchScore: number;
};

export type RefactorResult = {
  markdown: string;
  type: string;
  duplicates?: DupCandidate[];
  recommendation?: string;
};

export type LanguageIssue = {
  type: string;
  found: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
};

export type AnalysisResult = {
  overview: {
    type: string;
    audience: string;
    coverage: number;
    qualityScore: number;
    summary: string;
  };
  relatedDocs: Array<{
    title: string;
    relationship: string;
    recommendation: string;
  }>;
  recommendations: {
    toAdd: string[];
    toImprove: string[];
    gaps: string[];
  };
  nextActions: Array<{
    label: string;
    type: string;
    rationale?: string;
  }>;
  languageQuality?: {
    score: number;
    verdict: string;
    issues: LanguageIssue[];
  };
};

export type Collection = { id: string; name: string };

export type SourceTab = "text" | "file" | "gdoc";
