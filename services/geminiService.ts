import { GoogleGenAI, Type } from "@google/genai";
import { FetchResult, ResearchMethod, MatrixAnalysis, Paper } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are a distinguished Professor and Thesis Advisor at a top-tier university (like MIT, Stanford, or NTU). 
Your standards for literature review are extremely high. You prioritize seminal works, high-impact journals, and rigorous methodology.

Your task is to assist a graduate student in building a comprehensive bibliography.

RULES:
1. **Quantity & Quality**: Provide 10-12 high-quality papers per request. Prefer real, verifiable papers from top journals (Nature, Science, IEEE, ACM, APA, etc.).
2. **Bilingual**: Provide all textual content in BOTH Traditional Chinese (zh-TW) and English in the respective fields.
3. **Deep Analysis**: For each paper, identify its lineage (Ancestors/Descendants) to create a citation map.
4. **Synthesis**: Apart from the list, you must provide a "Research Landscape Synthesis" that identifies:
   - Key Themes (Patterns across papers)
   - Research Gaps (What is missing? Where should the student focus?)
   - Controversies (Debates in the field)
5. **Links**: Provide a valid URL (DOI link or publisher page) for the paper if possible.
6. **Context Awareness**: If the user provides a list of "Excluded Titles", DO NOT repeat them. Find NEW papers.
`;

export const fetchPapers = async (topic: string, existingTitles: string[] = []): Promise<FetchResult> => {
  try {
    const isLoadMore = existingTitles.length > 0;
    
    let prompt = `Please conduct a rigorous literature review on the topic: "${topic}".`;
    
    if (isLoadMore) {
      prompt += `\n\nI have already reviewed the following papers, DO NOT include them again: ${JSON.stringify(existingTitles.slice(-20))}. \nProvide 10 NEW and DISTINCT papers that expand the scope or dig deeper into specific sub-topics.`;
    } else {
      prompt += `\nProvide 10-12 key foundational and recent papers.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            synthesis: {
              type: Type.OBJECT,
              description: "A high-level academic synthesis of the returned papers and the field in general.",
              properties: {
                summary: { type: Type.STRING, description: "Executive summary of the current search results (2-3 sentences)." },
                themes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 Major themes or schools of thought." },
                gaps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 Research gaps or underexplored areas." },
                controversies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 Active debates or conflicting findings." }
              },
              required: ["summary", "themes", "gaps", "controversies"]
            },
            papers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Unique ID (e.g., A01, B02)" },
                  titleZh: { type: Type.STRING },
                  titleEn: { type: Type.STRING },
                  authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                  year: { type: Type.INTEGER },
                  journal: { type: Type.STRING },
                  abstractZh: { type: Type.STRING },
                  abstractEn: { type: Type.STRING },
                  methodologyType: { 
                    type: Type.STRING, 
                    enum: ["Quantitative", "Qualitative", "Mixed Methods", "Review", "Theoretical", "Other"]
                  },
                  methodologyDetailZh: { type: Type.STRING, description: "Specific methodology details in Traditional Chinese" },
                  methodologyDetailEn: { type: Type.STRING, description: "Specific methodology details in English" },
                  findingsZh: { type: Type.STRING, description: "Key findings in Traditional Chinese" },
                  findingsEn: { type: Type.STRING, description: "Key findings in English" },
                  limitationsZh: { type: Type.STRING, description: "Limitations in Traditional Chinese" },
                  limitationsEn: { type: Type.STRING, description: "Limitations in English" },
                  relevanceScore: { type: Type.INTEGER },
                  citationCount: { type: Type.INTEGER },
                  link: { type: Type.STRING, description: "A valid URL or DOI link to the paper (e.g., https://doi.org/...)" },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 specific academic keywords related to the paper's topic" },
                  ancestors: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        author: { type: Type.STRING },
                        year: { type: Type.INTEGER },
                        relationZh: { type: Type.STRING, description: "Relationship type in Traditional Chinese (e.g., 基礎理論)" },
                        relationEn: { type: Type.STRING, description: "Relationship type in English (e.g., Foundational Theory)" },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-2 key topics/keywords" }
                      },
                      required: ["title", "author", "year", "relationZh", "relationEn", "keywords"]
                    }
                  },
                  descendants: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        author: { type: Type.STRING },
                        year: { type: Type.INTEGER },
                        relationZh: { type: Type.STRING, description: "Relationship type in Traditional Chinese" },
                        relationEn: { type: Type.STRING, description: "Relationship type in English" },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-2 key topics/keywords" }
                      },
                      required: ["title", "author", "year", "relationZh", "relationEn", "keywords"]
                    }
                  }
                },
                required: ["id", "titleZh", "titleEn", "authors", "year", "journal", "abstractZh", "abstractEn", "methodologyType", "methodologyDetailZh", "methodologyDetailEn", "findingsZh", "findingsEn", "limitationsZh", "limitationsEn", "relevanceScore", "citationCount", "link", "keywords", "ancestors", "descendants"]
              }
            }
          },
          required: ["synthesis", "papers"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const data = JSON.parse(text);
    
    const processedPapers = data.papers.map((item: any) => ({
      ...item,
      // Ensure methodologyType matches our Enum
      methodologyType: Object.values(ResearchMethod).includes(item.methodologyType) 
        ? item.methodologyType 
        : ResearchMethod.Other
    }));

    return {
      papers: processedPapers,
      synthesis: data.synthesis
    };

  } catch (error) {
    console.error("Error fetching papers:", error);
    throw new Error("Failed to generate literature review. Please try again.");
  }
};

export const analyzeSelectedPapers = async (papers: Paper[]): Promise<MatrixAnalysis> => {
  try {
    // Prepare a concise version of papers to save tokens and focus the model
    // We pass the English version to the model for consistent processing, but the model will output Chinese as requested.
    const concisePapers = papers.map(p => ({
      title: p.titleEn,
      author: p.authors[0],
      year: p.year,
      method: p.methodologyType,
      findings: p.findingsEn,
      limitations: p.limitationsEn
    }));

    const prompt = `
      You are an expert Academic Editor performing a meta-synthesis on a selected set of papers.
      
      The user has selected ${papers.length} specific papers for a "Synthesis Matrix".
      Your goal is to compare, contrast, and synthesize these specific papers to help the user write their Thesis Chapter 2.

      Selected Papers Data: ${JSON.stringify(concisePapers)}

      Please provide a structured analysis in Traditional Chinese (zh-TW) that includes:
      1. **Theoretical Comparison**: How do their theoretical perspectives or frameworks compare?
      2. **Methodological Critique**: Compare the strengths/weaknesses of the methods used across these papers.
      3. **Consensus**: What findings do most of these papers agree on?
      4. **Divergence**: Where do they disagree or provide conflicting evidence?
      5. **Synthesis Paragraph**: Write a cohesive, academic paragraph synthesizing these works (citation format: Author, Year).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            theoreticalComparison: { type: Type.STRING, description: "Comparison of theoretical frameworks (zh-TW)" },
            methodologicalCritique: { type: Type.STRING, description: "Critique of methods (zh-TW)" },
            consensusPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of agreement points (zh-TW)" },
            divergencePoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of disagreement points (zh-TW)" },
            synthesisParagraph: { type: Type.STRING, description: "A cohesive synthesis paragraph for academic writing (zh-TW)" }
          },
          required: ["theoreticalComparison", "methodologicalCritique", "consensusPoints", "divergencePoints", "synthesisParagraph"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI analysis");
    
    return JSON.parse(text) as MatrixAnalysis;

  } catch (error) {
    console.error("Error analyzing matrix:", error);
    throw new Error("Failed to analyze the selected papers.");
  }
};