import React from 'react';
import { Paper } from '../types';
import { X, ArrowRight, GitCommit, BookOpen, Clock, ArrowLeft } from 'lucide-react';

interface CitationMapModalProps {
  paper: Paper;
  onClose: () => void;
  showEnglish: boolean;
}

// Helper to determine relation color styles (optional refinement)
const getRelationStyle = (isAncestor: boolean) => {
  return isAncestor 
    ? "border-l-4 border-slate-400 bg-slate-50/50" 
    : "border-l-4 border-emerald-500 bg-emerald-50/50";
};

const NodeCard = ({ title, author, year, tag, isAncestor, showEnglish, keywords }: { title: string, author: string, year: number, tag: string, isAncestor: boolean, showEnglish: boolean, keywords?: string[] }) => (
  <div className={`relative p-4 rounded-lg shadow-sm border border-slate-200 transition-all hover:shadow-md hover:scale-[1.02] bg-white group z-10 w-full max-w-sm ${isAncestor ? 'hover:border-slate-400' : 'hover:border-emerald-400'}`}>
    {/* Relation Tag Badge */}
    <div className={`absolute -top-2.5 ${isAncestor ? 'right-4' : 'left-4'} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm border ${isAncestor ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
      {tag}
    </div>

    <div className="mb-2">
      <h4 className="font-serif font-bold text-slate-800 leading-snug text-sm line-clamp-3 group-hover:text-primary transition-colors">
        {title}
      </h4>
    </div>
    
    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono border-t border-slate-100 pt-2 mt-2">
      <div className="flex items-center gap-1">
        <Clock size={10} />
        <span>{year}</span>
      </div>
      <div className="flex items-center gap-1 truncate max-w-[120px]" title={author}>
        <span className="truncate">{author}</span>
      </div>
    </div>

    {/* Keywords Section for Node */}
    {keywords && keywords.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-dashed border-slate-100">
        {keywords.slice(0, 2).map((k, i) => (
           <span key={i} className="text-[9px] px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100 truncate max-w-[120px]">
             {k}
           </span>
        ))}
      </div>
    )}
  </div>
);

const CitationMapModal: React.FC<CitationMapModalProps> = ({ paper, onClose, showEnglish }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#FDFBF7] rounded-xl shadow-2xl w-full max-w-[90vw] h-[90vh] flex flex-col overflow-hidden border border-slate-200 relative">
        
        {/* Background Texture (Dot Grid) */}
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        </div>

        {/* Header */}
        <div className="relative z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary text-white rounded-lg shadow-sm">
              <GitCommit size={20} />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-slate-900 tracking-tight">
                {showEnglish ? 'Citation Genealogy' : '學術脈絡地圖'}
              </h3>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-0.5">
                {showEnglish ? `Mapping the lineage of: ${paper.id}` : `文獻編號 ${paper.id} 之學術系譜`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Map Area */}
        <div className="flex-1 overflow-auto p-8 relative z-10 scroll-smooth">
          <div className="min-w-[1000px] flex items-center justify-center min-h-full">
            <div className="grid grid-cols-3 gap-12 w-full max-w-7xl mx-auto">
              
              {/* --- Left Column: Ancestors (Past) --- */}
              <div className="flex flex-col gap-6 items-end relative py-10">
                <div className="sticky top-0 z-20 bg-[#FDFBF7]/90 px-4 py-1 rounded-full border border-slate-200 shadow-sm mb-4 text-center self-center">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <ArrowLeft size={12} /> {showEnglish ? 'Foundations (Past)' : '理論基礎 (過去)'}
                   </h4>
                </div>
                
                {/* Vertical Connector Line for Left Column */}
                <div className="absolute right-[-24px] top-20 bottom-20 w-px bg-slate-300 hidden md:block opacity-50"></div>

                {paper.ancestors.length > 0 ? (
                  paper.ancestors.map((work, idx) => (
                    <div key={idx} className="relative flex items-center w-full justify-end group">
                       <NodeCard 
                          title={work.title} 
                          author={work.author} 
                          year={work.year} 
                          tag={showEnglish ? work.relationEn : work.relationZh}
                          isAncestor={true}
                          showEnglish={showEnglish}
                          keywords={work.keywords}
                       />
                       {/* Connector Arm */}
                       <div className="hidden md:block w-6 h-px bg-slate-300 absolute -right-6 top-1/2"></div>
                       {/* Dot */}
                       <div className="hidden md:block w-2 h-2 bg-slate-300 rounded-full absolute -right-[28px] top-1/2 -translate-y-1/2 border-2 border-[#FDFBF7]"></div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 italic text-sm py-10 pr-4">{showEnglish ? 'No ancestors found' : '無上游文獻資料'}</div>
                )}
              </div>

              {/* --- Center Column: The Paper (Present) --- */}
              <div className="flex flex-col items-center justify-center relative z-20">
                 {/* Central Highlight Glow */}
                 <div className="absolute inset-0 bg-blue-50/50 blur-3xl rounded-full -z-10"></div>
                 
                 <div className="bg-white border border-primary/20 rounded-xl p-1 shadow-2xl transform transition-transform hover:scale-105 w-full">
                   <div className="bg-primary text-white text-center py-2 rounded-t-lg">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                        {showEnglish ? 'Focal Paper' : '核心文獻'}
                      </span>
                   </div>
                   <div className="p-6 md:p-8 text-center bg-white rounded-b-lg">
                     <div className="flex justify-center mb-4 text-primary">
                       <BookOpen size={32} />
                     </div>
                     <h2 className="text-2xl font-display font-bold text-slate-900 mb-3 leading-snug">
                       {showEnglish ? paper.titleEn : paper.titleZh}
                     </h2>
                     <p className="text-sm text-slate-500 font-serif italic mb-6 px-4">
                       {showEnglish ? paper.titleZh : paper.titleEn}
                     </p>
                     
                     <div className="inline-flex items-center gap-4 text-sm text-slate-600 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                        <span className="font-bold">{paper.year}</span>
                        <span className="w-px h-3 bg-slate-300"></span>
                        <span className="font-medium">{paper.authors[0]} et al.</span>
                        <span className="w-px h-3 bg-slate-300"></span>
                        <span className="italic text-primary">{paper.journal}</span>
                     </div>

                     {/* Central Keywords */}
                     {paper.keywords && paper.keywords.length > 0 && (
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                           {paper.keywords.slice(0, 4).map(k => (
                              <span key={k} className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                {k}
                              </span>
                           ))}
                        </div>
                     )}
                   </div>
                 </div>
              </div>

              {/* --- Right Column: Descendants (Future) --- */}
              <div className="flex flex-col gap-6 items-start relative py-10">
                <div className="sticky top-0 z-20 bg-[#FDFBF7]/90 px-4 py-1 rounded-full border border-slate-200 shadow-sm mb-4 text-center self-center">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     {showEnglish ? 'Impact (Future)' : '延伸影響 (未來)'} <ArrowRight size={12} />
                   </h4>
                </div>

                {/* Vertical Connector Line for Right Column */}
                <div className="absolute left-[-24px] top-20 bottom-20 w-px bg-slate-300 hidden md:block opacity-50"></div>

                {paper.descendants.length > 0 ? (
                  paper.descendants.map((work, idx) => (
                    <div key={idx} className="relative flex items-center w-full justify-start group">
                       {/* Connector Arm */}
                       <div className="hidden md:block w-6 h-px bg-slate-300 absolute -left-6 top-1/2"></div>
                       {/* Dot */}
                       <div className="hidden md:block w-2 h-2 bg-emerald-300 rounded-full absolute -left-[28px] top-1/2 -translate-y-1/2 border-2 border-[#FDFBF7]"></div>

                       <NodeCard 
                          title={work.title} 
                          author={work.author} 
                          year={work.year} 
                          tag={showEnglish ? work.relationEn : work.relationZh}
                          isAncestor={false}
                          showEnglish={showEnglish}
                          keywords={work.keywords}
                       />
                    </div>
                  ))
                ) : (
                   <div className="text-slate-400 italic text-sm py-10 pl-4">{showEnglish ? 'No descendants found' : '無下游引用資料'}</div>
                )}
              </div>

            </div>
          </div>
        </div>
        
        {/* Footer Legend */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex justify-center items-center gap-6 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300"></span>
            <span>{showEnglish ? 'Ancestors (Cited By This Paper)' : '上游 (被此文獻引用)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
            <span>{showEnglish ? 'Descendants (Cites This Paper)' : '下游 (引用此文獻)'}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CitationMapModal;