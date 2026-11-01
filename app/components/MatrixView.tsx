import React, { useState } from 'react';
import { Paper, MatrixAnalysis } from '../types';
import { analyzeSelectedPapers } from '../services/geminiService';
import { ArrowLeft, FileSpreadsheet, Sparkles, BrainCircuit, Scale, PenTool, Loader2, Target, Tag } from 'lucide-react';

interface MatrixViewProps {
  papers: Paper[];
  onBack: () => void;
  showEnglish: boolean;
}

const MatrixView: React.FC<MatrixViewProps> = ({ papers, onBack, showEnglish }) => {
  const [analysis, setAnalysis] = useState<MatrixAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Custom CSV Export for Matrix
  const handleExportMatrixCSV = () => {
    const BOM = "\uFEFF";
    const headers = [
      "Author(s)", "Year", "Title", "Keywords", "Methodology Type", "Methodology Detail", "Key Findings", "Limitations", "Journal"
    ];

    const rows = papers.map(p => {
      const rowData = [
        p.authors.join('; '),
        p.year,
        showEnglish ? p.titleEn : p.titleZh,
        p.keywords.join('; '),
        p.methodologyType,
        showEnglish ? p.methodologyDetailEn : p.methodologyDetailZh,
        showEnglish ? p.findingsEn : p.findingsZh,
        showEnglish ? p.limitationsEn : p.limitationsZh,
        p.journal
      ];
      
      return rowData.map(val => {
        const stringVal = String(val || '');
        // Escape double quotes and wrap in quotes
        return `"${stringVal.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = BOM + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `synthesis_matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeSelectedPapers(papers);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
      alert(showEnglish ? "Analysis failed, please try again later." : "分析失敗，請稍後再試。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-40 overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-xl font-display font-bold text-primary">
              {showEnglish ? "Synthesis Matrix" : "文獻綜合矩陣"}
            </h2>
            <p className="text-sm text-slate-500 font-serif italic">
              {showEnglish 
                ? `Analyzing ${papers.length} selected papers` 
                : `正在分析 ${papers.length} 篇選定文獻`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!analysis && (
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 font-medium"
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {isAnalyzing 
                ? (showEnglish ? 'Analyzing...' : '分析中...') 
                : (showEnglish ? 'Generate AI Report' : '生成 AI 分析報告')}
            </button>
          )}
          <button 
            onClick={handleExportMatrixCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm font-medium"
          >
            <FileSpreadsheet size={18} />
            {showEnglish ? 'Export .CSV' : '匯出 .CSV'}
          </button>
        </div>
      </div>

      {/* Main Content: Split between Analysis (if present) and Table */}
      <div className="flex-1 overflow-auto p-6 space-y-8 bg-slate-50/50">
        
        {/* AI Analysis Section */}
        {analysis && (
          <div className="bg-surface rounded-xl shadow-academic border border-indigo-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-gradient-to-r from-indigo-50 to-white px-8 py-5 border-b border-indigo-100 flex items-center justify-between">
              <h3 className="flex items-center gap-3 text-xl font-display font-bold text-primary">
                <BrainCircuit className="text-indigo-600" size={24} />
                {showEnglish ? "Synthesis Analysis Report" : "文獻綜合分析報告"}
              </h3>
              <button 
                onClick={handleRunAnalysis} 
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline uppercase tracking-wide"
              >
                {showEnglish ? "Re-Analyze" : "重新分析"}
              </button>
            </div>
            
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Column: Comparisons */}
              <div className="space-y-8">
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest">
                    <Target size={14} className="text-slate-400" /> 
                    {showEnglish ? "Theoretical Comparison" : "理論框架比較"}
                  </h4>
                  <p className="text-base text-slate-800 bg-paper p-5 rounded-lg border border-slate-200 leading-relaxed font-serif">
                    {analysis.theoreticalComparison}
                  </p>
                </div>
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest">
                    <Target size={14} className="text-slate-400" /> 
                    {showEnglish ? "Methodological Critique" : "方法論評析"}
                  </h4>
                  <p className="text-base text-slate-800 bg-paper p-5 rounded-lg border border-slate-200 leading-relaxed font-serif">
                    {analysis.methodologicalCritique}
                  </p>
                </div>
              </div>

              {/* Right Column: Consensus/Divergence & Synthesis */}
              <div className="space-y-8">
                 <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex-1">
                      <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-700 mb-3 uppercase tracking-widest">
                        <Scale size={14} className="text-emerald-500" /> 
                        {showEnglish ? "Consensus" : "研究共識"}
                      </h4>
                      <ul className="list-disc list-inside text-sm text-slate-700 bg-emerald-50/30 p-5 rounded-lg border border-emerald-100 space-y-2 font-serif">
                        {analysis.consensusPoints.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                    <div className="flex-1">
                      <h4 className="flex items-center gap-2 text-xs font-bold text-amber-700 mb-3 uppercase tracking-widest">
                        <Scale size={14} className="text-amber-500" /> 
                        {showEnglish ? "Divergence" : "研究分歧與爭議"}
                      </h4>
                      <ul className="list-disc list-inside text-sm text-slate-700 bg-amber-50/30 p-5 rounded-lg border border-amber-100 space-y-2 font-serif">
                        {analysis.divergencePoints.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                 </div>

                 <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold text-indigo-700 mb-3 uppercase tracking-widest">
                      <PenTool size={14} className="text-indigo-500" /> 
                      {showEnglish ? "Synthesis Paragraph (Draft)" : "綜合寫作段落 (草稿)"}
                    </h4>
                    <div className="text-base text-slate-800 leading-8 bg-indigo-50/30 p-6 rounded-lg border border-indigo-100 italic relative font-serif">
                       <span className="absolute top-2 left-2 text-6xl text-indigo-200 font-serif opacity-30">"</span>
                       {analysis.synthesisParagraph}
                       <span className="absolute -bottom-4 right-4 text-6xl text-indigo-200 font-serif opacity-30">"</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* Matrix Table */}
        <div className="min-w-max bg-surface rounded-xl shadow-academic border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-5 font-bold text-primary font-display tracking-wide sticky top-0 bg-slate-50 shadow-sm z-10 w-72 min-w-[240px]">
                  {showEnglish ? "Paper Info" : "論文資訊"}
                </th>
                <th className="p-5 font-bold text-primary font-display tracking-wide sticky top-0 bg-slate-50 shadow-sm z-10 w-48 min-w-[200px]">
                  {showEnglish ? "Keywords" : "關鍵字"}
                </th>
                <th className="p-5 font-bold text-primary font-display tracking-wide sticky top-0 bg-slate-50 shadow-sm z-10 w-56 min-w-[200px]">
                  {showEnglish ? "Methodology" : "研究方法"}
                </th>
                <th className="p-5 font-bold text-primary font-display tracking-wide sticky top-0 bg-slate-50 shadow-sm z-10 min-w-[320px]">
                  {showEnglish ? "Key Findings" : "主要發現"}
                </th>
                <th className="p-5 font-bold text-primary font-display tracking-wide sticky top-0 bg-slate-50 shadow-sm z-10 min-w-[320px]">
                  {showEnglish ? "Limitations" : "研究限制"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {papers.map((paper, idx) => (
                <tr key={paper.id} className="hover:bg-slate-50/50 transition-colors align-top group">
                  
                  {/* Info Column */}
                  <td className="p-5 border-r border-slate-100 bg-slate-50/30">
                    <div className="font-serif font-bold text-slate-900 mb-2 leading-snug" title={showEnglish ? paper.titleEn : paper.titleZh}>
                      {showEnglish ? paper.titleEn : paper.titleZh}
                    </div>
                    <div className="text-xs text-slate-500 mb-3 font-mono">
                      {paper.authors[0]} et al. ({paper.year})
                    </div>
                    <div className="inline-block text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-medium">
                      {paper.journal}
                    </div>
                  </td>

                  {/* Keywords Column (NEW) */}
                  <td className="p-5 border-r border-slate-100">
                     <div className="flex flex-wrap gap-1">
                      {paper.keywords.slice(0, 4).map(k => (
                        <span key={k} className="inline-block text-[10px] text-slate-600 bg-blue-50/50 border border-blue-100 px-1.5 py-0.5 rounded">
                          {k}
                        </span>
                      ))}
                     </div>
                  </td>

                  {/* Methodology Column */}
                  <td className="p-5 border-r border-slate-100">
                    <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] uppercase font-bold rounded mb-3 border border-indigo-100">
                      {paper.methodologyType}
                    </span>
                    <p className="text-sm text-slate-600 leading-relaxed font-serif">
                      {showEnglish ? paper.methodologyDetailEn : paper.methodologyDetailZh}
                    </p>
                  </td>

                  {/* Findings Column */}
                  <td className="p-5 border-r border-slate-100">
                    <p className="text-sm text-slate-800 leading-relaxed font-serif">
                      {showEnglish ? paper.findingsEn : paper.findingsZh}
                    </p>
                  </td>

                  {/* Limitations Column */}
                  <td className="p-5">
                    <p className="text-sm text-slate-600 leading-relaxed italic font-serif">
                      {showEnglish ? (paper.limitationsEn || "Not specified") : (paper.limitationsZh || "未特別說明")}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer Hint */}
      <div className="bg-surface border-t border-slate-200 px-6 py-3 text-xs text-slate-400 text-center shrink-0 font-serif italic">
        {showEnglish 
          ? "Pro Tip: This synthesis matrix serves as the structural backbone for your Chapter 2 Literature Review." 
          : "提示：此綜合矩陣可作為您第二章文獻探討的結構骨幹，協助您整合不同觀點。"}
      </div>

    </div>
  );
};

export default MatrixView;