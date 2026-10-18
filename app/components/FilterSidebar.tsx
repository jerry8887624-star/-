import React from 'react';
import { SortOption, ResearchMethod } from '../types';
import { SlidersHorizontal, ArrowDownWideNarrow, ArrowUpNarrowWide, Star, BookOpen, RotateCcw, Languages, History, Filter } from 'lucide-react';

interface FilterSidebarProps {
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  showEnglish: boolean;
  setShowEnglish: (show: boolean) => void;
  resultCount: number;
  onClearHistory: () => void;
  selectedMethodologies: Set<ResearchMethod>;
  toggleMethodology: (method: ResearchMethod) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ 
  sortOption, 
  setSortOption,
  showEnglish,
  setShowEnglish,
  resultCount,
  onClearHistory,
  selectedMethodologies,
  toggleMethodology
}) => {

  const methodTranslations: Record<ResearchMethod, string> = {
    [ResearchMethod.Quantitative]: "量化研究 (Quantitative)",
    [ResearchMethod.Qualitative]: "質性研究 (Qualitative)",
    [ResearchMethod.MixedMethods]: "混合方法 (Mixed Methods)",
    [ResearchMethod.Review]: "文獻回顧 (Review)",
    [ResearchMethod.Theoretical]: "理論研究 (Theoretical)",
    [ResearchMethod.Other]: "其他 (Other)"
  };
  
  return (
    <div className="w-full lg:w-72 space-y-6">
      
      {/* Control Panel */}
      <div className="bg-surface p-6 rounded-xl border border-slate-200 shadow-academic">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold font-display text-primary flex items-center gap-2">
            <SlidersHorizontal size={20} />
            篩選與顯示
          </h2>
          <span className="text-xs font-serif italic text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {resultCount} Results
          </span>
        </div>

        {/* Language Toggle */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
             <Languages size={12} /> Language / 語言
          </h3>
          <div className="bg-slate-100 p-1 rounded-lg flex">
             <button
                onClick={() => setShowEnglish(false)}
                className={`flex-1 text-sm py-1.5 rounded-md transition-all font-medium ${!showEnglish ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
             >
                繁體中文
             </button>
             <button
                onClick={() => setShowEnglish(true)}
                className={`flex-1 text-sm py-1.5 rounded-md transition-all font-medium ${showEnglish ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
             >
                English
             </button>
          </div>
        </div>

        {/* Methodology Filter */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
             <Filter size={12} /> Methodology / 方法論
          </h3>
          <div className="space-y-2">
            {Object.values(ResearchMethod).map((method) => (
              <label key={method} className="flex items-center gap-3 cursor-pointer group select-none">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedMethodologies.has(method) ? 'bg-primary border-primary' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                  {selectedMethodologies.has(method) && <div className="w-2 h-2 bg-white rounded-sm" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={selectedMethodologies.has(method)}
                  onChange={() => toggleMethodology(method)}
                />
                <span className={`text-sm ${selectedMethodologies.has(method) ? 'text-primary font-medium' : 'text-slate-600'}`}>
                  {methodTranslations[method]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">Sort By / 排序</h3>
          <div className="space-y-1">
            {[
              { id: 'relevance', label: 'Relevance (關聯度)', icon: Star },
              { id: 'yearDesc', label: 'Year (Newest)', icon: ArrowDownWideNarrow },
              { id: 'yearAsc', label: 'Year (Oldest)', icon: ArrowUpNarrowWide },
              { id: 'citations', label: 'Citations (Impact)', icon: BookOpen },
            ].map((option) => (
               <button
                key={option.id}
                onClick={() => setSortOption(option.id as SortOption)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all text-left ${
                  sortOption === option.id 
                    ? 'bg-blue-50/50 text-primary font-semibold border border-blue-100' 
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <option.icon size={16} className={sortOption === option.id ? "text-primary" : "text-slate-400"} />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-surface p-6 rounded-xl border border-slate-200 shadow-academic">
         <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
             <History size={12} /> Session
         </h3>
         <button
          onClick={onClearHistory}
          className="w-full py-2.5 px-4 border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={14} />
          Reset Research Session
        </button>
      </div>

    </div>
  );
};

export default FilterSidebar;