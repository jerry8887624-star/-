import React, { useState } from 'react';
import { Paper, ResearchMethod } from '../types';
import { ChevronDown, ChevronUp, BookOpen, Users, Calendar, AlertCircle, CheckCircle2, FlaskConical, GitFork, Copy, Check, ExternalLink, Square, CheckSquare, Tag } from 'lucide-react';
import CitationMapModal from './CitationMapModal';

interface PaperCardProps {
  paper: Paper;
  showEnglish: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

const MethodologyBadge: React.FC<{ type: ResearchMethod }> = ({ type }) => {
  const colors = {
    [ResearchMethod.Quantitative]: 'bg-blue-50 text-blue-700 border-blue-100',
    [ResearchMethod.Qualitative]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    [ResearchMethod.MixedMethods]: 'bg-purple-50 text-purple-700 border-purple-100',
    [ResearchMethod.Review]: 'bg-amber-50 text-amber-700 border-amber-100',
    [ResearchMethod.Theoretical]: 'bg-slate-50 text-slate-700 border-slate-100',
    [ResearchMethod.Other]: 'bg-gray-50 text-gray-700 border-gray-100',
  };

  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border ${colors[type] || colors[ResearchMethod.Other]}`}>
      {type}
    </span>
  );
};

const PaperCard: React.FC<PaperCardProps> = ({ paper, showEnglish, isSelected, onToggleSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayTitle = showEnglish ? paper.titleEn : paper.titleZh;
  const displayAbstract = showEnglish ? paper.abstractEn : paper.abstractZh;
  const displayMethodologyDetail = showEnglish ? paper.methodologyDetailEn : paper.methodologyDetailZh;
  const displayFindings = showEnglish ? paper.findingsEn : paper.findingsZh;
  const displayLimitations = showEnglish ? paper.limitationsEn : paper.limitationsZh;

  const handleCopyCitation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const citation = `${paper.authors.join(", ")} (${paper.year}). ${paper.titleEn}. ${paper.journal}.`;
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Prefer the AI provided link, fallback to Google Scholar search
    const url = (paper.link && paper.link.startsWith('http'))
      ? paper.link
      : `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.titleEn)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div 
        className={`relative bg-surface rounded-xl shadow-academic border overflow-hidden hover:shadow-hover transition-all duration-300 ${isSelected ? 'border-primary ring-1 ring-primary/20 bg-blue-50/20' : 'border-transparent'}`}
        onClick={() => onToggleSelect(paper.id)}
      >
        <div className="p-6">
          {/* Header Section */}
          <div className="flex justify-between items-start gap-4 mb-3">
            
            {/* Selection Checkbox Area */}
            <div className="pt-1.5 pr-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggleSelect(paper.id); }}>
               {isSelected ? (
                 <CheckSquare className="text-primary transition-all scale-110" size={20} />
               ) : (
                 <Square className="text-slate-200 hover:text-slate-400 transition-colors" size={20} />
               )}
            </div>

            <div className="flex-1">
              {/* Top Meta Row */}
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-xs font-mono text-slate-300">#{paper.id}</span>
                <MethodologyBadge type={paper.methodologyType} />
                <span className="text-xs font-medium text-green-700 bg-green-50/50 px-2 py-0.5 rounded border border-green-100">
                  Relevance: {paper.relevanceScore}%
                </span>
              </div>

              <h3 className="text-xl font-serif font-bold text-slate-900 leading-snug mb-2 hover:text-primary cursor-pointer decoration-primary/30 hover:underline underline-offset-4 transition-all" onClick={handleOpenLink}>
                {displayTitle}
              </h3>
              {/* Secondary Language Title (Smaller) */}
              <h4 className="text-sm text-slate-500 mb-4 font-medium leading-relaxed">
                {showEnglish ? paper.titleZh : paper.titleEn}
              </h4>

              {/* Author / Year / Journal Row */}
              <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  <span className="font-medium text-slate-800">{paper.authors.join(", ")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" />
                  <span>{paper.year}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen size={14} className="text-slate-400" />
                  <span className="italic text-primary font-serif">{paper.journal}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 ml-auto">
                  <span className="text-xs uppercase tracking-wider font-bold">Cited by</span>
                  <span className="font-mono font-bold bg-slate-100 px-1.5 rounded">{paper.citationCount}</span>
                </div>
              </div>

              {/* Keyword Row (Prominent) */}
              {paper.keywords && paper.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-dashed border-slate-100">
                  {paper.keywords.slice(0, 5).map(k => (
                    <span key={k} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 hover:border-blue-300 hover:bg-blue-100 transition-colors cursor-default">
                      <Tag size={11} className="text-blue-400" />
                      {k}
                    </span>
                  ))}
                  {paper.keywords.length > 5 && (
                    <span className="inline-flex items-center text-[10px] text-slate-400 px-2 py-1">
                      +{paper.keywords.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Quick Actions */}
            <div className="flex flex-col gap-1">
              <button 
                onClick={handleCopyCitation}
                className="p-2 text-slate-300 hover:text-primary hover:bg-slate-50 rounded-lg transition-all"
                title="複製引用格式 (APA)"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
              <button 
                onClick={handleOpenLink}
                className="p-2 text-slate-300 hover:text-primary hover:bg-slate-50 rounded-lg transition-all"
                title="前往文獻來源"
              >
                <ExternalLink size={18} />
              </button>
            </div>
          </div>

          {/* Abstract Preview */}
          <div className="relative group/abstract mt-4">
             <p className="text-slate-600 font-serif text-sm leading-7 mb-4 pl-4 border-l-2 border-slate-100 group-hover/abstract:border-primary/30 transition-colors">
               {displayAbstract}
             </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setExpanded(!expanded)}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-primary hover:border-primary/30 transition-all"
            >
              {expanded ? (
                <>
                  <ChevronUp size={16} /> {showEnglish ? 'Hide Details' : '隱藏詳情'}
                </>
              ) : (
                <>
                  <ChevronDown size={16} /> {showEnglish ? 'View Details' : '查看詳情'}
                </>
              )}
            </button>
            
            <button 
              onClick={() => setShowMap(true)}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2 text-indigo-700 bg-indigo-50/50 border border-indigo-100 rounded-lg text-sm font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all"
            >
              <GitFork size={16} /> {showEnglish ? 'Citation Map' : '文獻地圖'}
            </button>

            <button 
              onClick={handleOpenLink}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2 text-white bg-primary border border-primary rounded-lg text-sm font-medium hover:bg-slate-700 shadow-sm hover:shadow transition-all"
            >
              <ExternalLink size={16} /> {showEnglish ? 'Read Source' : '閱讀來源'}
            </button>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="bg-slate-50 p-6 border-t border-slate-200 grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-4">
                <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                      <FlaskConical size={14} className="text-indigo-500"/>
                      {showEnglish ? 'Methodology' : '研究方法'}
                    </h4>
                    <p className="text-sm text-slate-700 bg-white p-4 rounded-lg border border-slate-200 shadow-sm font-serif leading-relaxed">
                      {displayMethodologyDetail}
                    </p>
                </div>
                <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                      <CheckCircle2 size={14} className="text-emerald-500"/>
                      {showEnglish ? 'Key Findings' : '主要發現'}
                    </h4>
                    <p className="text-sm text-slate-700 bg-white p-4 rounded-lg border border-slate-200 shadow-sm font-serif leading-relaxed">
                      {displayFindings}
                    </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                      <AlertCircle size={14} className="text-amber-500"/>
                      {showEnglish ? 'Limitations' : '研究限制'}
                    </h4>
                    <p className="text-sm text-slate-700 bg-white p-4 rounded-lg border border-slate-200 shadow-sm font-serif leading-relaxed">
                      {displayLimitations}
                    </p>
                </div>
                {/* Full Keywords List in Expanded View */}
                {paper.keywords && paper.keywords.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                      <Tag size={14} className="text-slate-500"/>
                      {showEnglish ? 'All Keywords' : '完整關鍵字'}
                    </h4>
                    <div className="flex flex-wrap gap-2 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      {paper.keywords.map(k => (
                        <span key={k} className="text-xs text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
          </div>
        )}
      </div>

      {showMap && <CitationMapModal paper={paper} onClose={() => setShowMap(false)} showEnglish={showEnglish} />}
    </>
  );
};

export default PaperCard;