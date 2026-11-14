import React from 'react';
import { ResearchSynthesis } from '../types';
import { Lightbulb, Target, Scale, BrainCircuit } from 'lucide-react';

interface SynthesisCardProps {
  synthesis: ResearchSynthesis;
  showEnglish: boolean;
  }

  const SynthesisCard: React.FC<SynthesisCardProps> = ({ synthesis, showEnglish }) => {
  if (!synthesis) return null;

  return (
    <div className="bg-surface rounded-xl shadow-academic border border-slate-200 p-8 mb-8 animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-indigo-500 to-accent"></div>
      
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl shadow-sm border border-indigo-100">
          <BrainCircuit size={28} />
        </div>
        <div>
           <h3 className="text-2xl font-display font-bold text-primary">Research Landscape</h3>
           <p className="text-sm font-serif text-slate-500 italic">AI-Generated Academic Synthesis & Insights</p>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-slate-800 font-serif text-lg leading-relaxed border-l-4 border-accent pl-6 py-2 bg-slate-50/50 rounded-r-lg">
          "{synthesis.summary}"
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Themes */}
        <div className="bg-paper p-5 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 text-xs uppercase tracking-widest">
            <Lightbulb size={16} className="text-amber-600" />
            Key Themes
          </h4>
          <ul className="space-y-3">
            {synthesis.themes.map((item, idx) => (
              <li key={idx} className="flex gap-3 text-sm text-slate-700 font-serif">
                <span className="text-amber-500 font-bold mt-1.5 text-[10px]">•</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Gaps */}
        <div className="bg-paper p-5 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 text-xs uppercase tracking-widest">
            <Target size={16} className="text-red-600" />
            Research Gaps
          </h4>
          <ul className="space-y-3">
            {synthesis.gaps.map((item, idx) => (
              <li key={idx} className="flex gap-3 text-sm text-slate-700 font-serif">
                <span className="text-red-500 font-bold mt-1.5 text-[10px]">•</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Controversies */}
        <div className="bg-paper p-5 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 text-xs uppercase tracking-widest">
             <Scale size={16} className="text-blue-600" />
            Controversies
          </h4>
          <ul className="space-y-3">
            {synthesis.controversies.map((item, idx) => (
              <li key={idx} className="flex gap-3 text-sm text-slate-700 font-serif">
                <span className="text-blue-500 font-bold mt-1.5 text-[10px]">•</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
  };

  export default SynthesisCard;