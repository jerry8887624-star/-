export enum ResearchMethod {
  Quantitative = 'Quantitative',
  Qualitative = 'Qualitative',
  MixedMethods = 'Mixed Methods',
  Review = 'Review',
  Theoretical = 'Theoretical',
  Other = 'Other'
}

export interface RelatedWork {
  title: string;
  author: string;
  year: number;
  relationZh: string;
  relationEn: string;
  keywords?: string[];
}

export interface Paper {
  id: string;
  titleZh: string;
  titleEn: string;
  authors: string[];
  year: number;
  journal: string;
  abstractZh: string;
  abstractEn: string;
  methodologyType: ResearchMethod;
  methodologyDetailZh: string;
  methodologyDetailEn: string;
  findingsZh: string;
  findingsEn: string;
  limitationsZh: string;
  limitationsEn: string;
  relevanceScore: number;
  citationCount: number;
  link?: string; // New: URL to the paper
  keywords: string[];
  ancestors: RelatedWork[];
  descendants: RelatedWork[];
}

// New: Synthesis of the research landscape
export interface ResearchSynthesis {
  themes: string[];       // Key recurring themes
  gaps: string[];         // What is missing in literature
  controversies: string[];// Conflicting findings
  summary: string;        // Executive summary
}

// New: Deep analysis for the selected matrix
export interface MatrixAnalysis {
  theoreticalComparison: string;  // Comparison of theoretical frameworks
  methodologicalCritique: string; // Comparative critique of methods
  consensusPoints: string[];      // Where do the papers agree?
  divergencePoints: string[];     // Where do they disagree?
  synthesisParagraph: string;     // A cohesive paragraph suitable for Chapter 2
}

export interface FetchResult {
  papers: Paper[];
  synthesis: ResearchSynthesis;
}

export type SortOption = 'relevance' | 'yearDesc' | 'yearAsc' | 'citations';

export interface DisplayState {
  showEnglish: boolean;
}