import React, { useState, useMemo, useEffect } from 'react';
import { fetchPapers, setApiKey, hasApiKey } from './services/geminiService';
import { Paper, SortOption, ResearchSynthesis, ResearchMethod } from './types';
import PaperCard from './components/PaperCard';
import FilterSidebar from './components/FilterSidebar';
import SynthesisCard from './components/SynthesisCard';
import MatrixView from './components/MatrixView';
import { Search, Sparkles, Zap, Download, Loader2, PlusCircle, FileSpreadsheet, FileJson, Table2, X, Rocket, KeyRound } from 'lucide-react';

const STORAGE_KEY = 'research_accelerator_v1';

const App: React.FC = () => {
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [isApiKeySet, setIsApiKeySet] = useState(false);

    const [query, setQuery] = useState('');
    const [papers, setPapers] = useState<Paper[]>([]);
    const [synthesis, setSynthesis] = useState<ResearchSynthesis | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [showEnglish, setShowEnglish] = useState(false);

    // Filter & Sort State
    const [sortOption, setSortOption] = useState<SortOption>('relevance');
    const [selectedMethodologies, setSelectedMethodologies] = useState<Set<ResearchMethod>>(new Set());

    // Matrix Analysis State
    const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
    const [showMatrixView, setShowMatrixView] = useState(false);

    // Auto-load saved API Key
    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            setApiKey(savedKey);
            setApiKeyInput(savedKey);
            setIsApiKeySet(true);
        }
    }, []);

    // Load from LocalStorage on Mount
    useEffect(() => {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.papers && parsed.papers.length > 0) {
                    setPapers(parsed.papers);
                    setSynthesis(parsed.synthesis || null);
                    setQuery(parsed.query || '');
                    setHasSearched(true);
                }
            } catch (e) {
                console.error("Failed to load saved data", e);
            }
        }
    }, []);

    // Save to LocalStorage whenever papers or query changes
    useEffect(() => {
        if (hasSearched) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                query,
                papers,
                synthesis,
                timestamp: new Date().getTime()
            }));
        }
    }, [papers, synthesis, query, hasSearched]);

    const handleApiKeySubmit = () => {
        if (apiKeyInput.trim()) {
            setApiKey(apiKeyInput.trim());
            setIsApiKeySet(true);
            localStorage.setItem('gemini_api_key', apiKeyInput.trim());
        }
    };

    const handleClearHistory = () => {
        if (window.confirm(showEnglish ? 'Clear all search history? This will remove current results.' : '確定要清除所有搜尋紀錄嗎？這將會移除目前的文獻列表。')) {
            localStorage.removeItem(STORAGE_KEY);
            setPapers([]);
            setSynthesis(null);
            setQuery('');
            setHasSearched(false);
            setSelectedPaperIds(new Set());
            setSelectedMethodologies(new Set());
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError(null);
        setHasSearched(true);
        setPapers([]);
        setSynthesis(null);
        setSelectedPaperIds(new Set());

        try {
            const result = await fetchPapers(query, []);
            setPapers(result.papers);
            setSynthesis(result.synthesis);
        } catch (err) {
            setError(err instanceof Error ? err.message : (showEnglish ? 'Unknown error occurred' : '發生未知錯誤'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (!query.trim()) return;
        setIsLoadingMore(true);
        setError(null);

        try {
            const existingTitles = papers.map(p => p.titleEn);
            const result = await fetchPapers(query, existingTitles);

            setPapers(prev => [...prev, ...result.papers]);
            if (result.synthesis) {
                setSynthesis(result.synthesis);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : (showEnglish ? 'Failed to load more papers.' : '無法載入更多文獻，請稍後再試。'));
        } finally {
            setIsLoadingMore(false);
        }
    };

    const toggleMethodology = (method: ResearchMethod) => {
        setSelectedMethodologies(prev => {
            const next = new Set(prev);
            if (next.has(method)) {
                next.delete(method);
            } else {
                next.add(method);
            }
            return next;
        });
    };

    const processedPapers = useMemo(() => {
        let result = [...papers];

        if (selectedMethodologies.size > 0) {
            result = result.filter(p => selectedMethodologies.has(p.methodologyType));
        }

        result.sort((a, b) => {
            switch (sortOption) {
                case 'yearDesc':
                    return b.year - a.year;
                case 'yearAsc':
                    return a.year - b.year;
                case 'relevance':
                    return b.relevanceScore - a.relevanceScore;
                case 'citations':
                    return b.citationCount - a.citationCount;
                default:
                    return 0;
            }
        });

        return result;
    }, [papers, sortOption, selectedMethodologies]);

    const handleToggleSelect = (id: string) => {
        setSelectedPaperIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleClearSelection = () => {
        setSelectedPaperIds(new Set());
    };

    const selectedPapers = useMemo(() => {
        return papers.filter(p => selectedPaperIds.has(p.id));
    }, [papers, selectedPaperIds]);


    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type: `${type};charset=utf-8;` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportBibTeX = () => {
        if (processedPapers.length === 0) return;

        const bibtexContent = processedPapers.map(p => {
            const authorStr = p.authors.join(' and ');
            const key = `${p.authors[0].split(' ')[0]}${p.year}${p.titleEn.split(' ')[0]}`.replace(/[^a-zA-Z0-9]/g, '');
            const keywordsStr = p.keywords ? p.keywords.join(', ') : '';
            return `@article{${key},
  title={${p.titleEn}},
  author={${authorStr}},
  journal={${p.journal}},
  year={${p.year}},
  url={${p.link || ''}},
  keywords={${keywordsStr}},
  abstract={${p.abstractEn}}
}`;
        }).join('\n\n');

        downloadFile(bibtexContent, `references_${new Date().toISOString().slice(0, 10)}.bib`, 'text/plain');
    };

    const handleExportCSV = () => {
        if (processedPapers.length === 0) return;

        const BOM = "\uFEFF";
        const headers = [
            "ID", "Title (En)", "Title (Zh)", "Authors", "Year", "Journal",
            "Methodology", "Relevance", "Citations", "Link", "Keywords",
            "Findings (Current Lang)", "Abstract (Current Lang)", "Methodology Detail (Current Lang)", "Limitations (Current Lang)"
        ];

        const rows = processedPapers.map(p => {
            const rowData = [
                p.id, p.titleEn, p.titleZh, p.authors.join('; '), p.year, p.journal,
                p.methodologyType, p.relevanceScore, p.citationCount, p.link || '', p.keywords.join('; '),
                showEnglish ? p.findingsEn : p.findingsZh,
                showEnglish ? p.abstractEn : p.abstractZh,
                showEnglish ? p.methodologyDetailEn : p.methodologyDetailZh,
                showEnglish ? p.limitationsEn : p.limitationsZh
            ];

            return rowData.map(val => {
                const stringVal = String(val || '');
                return `"${stringVal.replace(/"/g, '""')}"`;
            }).join(',');
        });

        const csvContent = BOM + headers.join(',') + '\n' + rows.join('\n');
        downloadFile(csvContent, `literature_review_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    };

    return (
        <div className="min-h-screen bg-background text-ink pb-20 relative font-sans">

            {/* Matrix View Sub-Page */}
            {showMatrixView && (
                <MatrixView
                    papers={selectedPapers}
                    onBack={() => setShowMatrixView(false)}
                    showEnglish={showEnglish}
                />
            )}

            {/* Header */}
            <header className="bg-surface border-b border-slate-200 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/90">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary p-2 rounded-lg text-white shadow-md">
                            <Zap size={22} fill="white" />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight hidden sm:block">
                            文獻回顧加速器
                        </h1>
                    </div>

                    {hasSearched && !isLoading && processedPapers.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2 hidden md:block">Export Data</span>
                            <button
                                onClick={handleExportBibTeX}
                                className="text-xs font-medium text-slate-600 hover:text-primary hover:bg-slate-50 flex items-center gap-2 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg bg-white"
                                title="匯出 BibTeX (EndNote/Zotero)"
                            >
                                <FileJson size={14} />
                                <span className="hidden sm:inline">BibTeX</span>
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 transition-colors border border-emerald-200 px-3 py-1.5 rounded-lg bg-white"
                                title="匯出 CSV (Excel)"
                            >
                                <FileSpreadsheet size={14} />
                                <span className="hidden sm:inline">Excel/CSV</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* API Key Setup */}
                {!isApiKeySet && (
                    <div className="max-w-2xl mx-auto mb-8 bg-white border border-blue-200 rounded-2xl shadow-academic p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="text-center mb-6">
                            <div className="bg-primary p-3 rounded-xl text-white inline-block mb-4 shadow-md">
                                <KeyRound size={28} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">歡迎使用文獻回顧加速器</h2>
                            <p className="text-slate-500">請先輸入你的 Gemini API Key 以啟用 AI 功能（免費取得）</p>
                        </div>
                        <div className="flex gap-3">
                            <input
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleApiKeySubmit(); }}
                                placeholder="貼上你的 API Key（AIza...）"
                                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                                onClick={handleApiKeySubmit}
                                disabled={!apiKeyInput.trim()}
                                className="bg-primary hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 shadow-sm"
                            >
                                啟用
                            </button>
                        </div>
                        <div className="mt-4 text-center">
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline font-medium">
                                → 點此免費取得 Gemini API Key
                            </a>
                            <p className="text-xs text-slate-400 mt-2">API Key 僅存在你的瀏覽器中，不會上傳到任何伺服器</p>
                            <p className="text-xs text-slate-400 mt-1">作者：國立政治大學MEPA第七屆領導決策專班 許宏瑋</p>
                        </div>
                    </div>
                )}

                {/* Search Hero Section */}
                <div className={`transition-all duration-500 ease-in-out ${hasSearched ? 'mb-8' : 'min-h-[60vh] flex flex-col justify-center items-center'}`}>
                    {!hasSearched && (
                        <div className="text-center mb-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="mb-4 inline-block">
                                <span className="bg-blue-50 text-primary text-xs font-bold px-3 py-1 rounded-full border border-blue-100 tracking-widest uppercase flex items-center gap-2 w-fit mx-auto">
                                    <Rocket size={12} /> AI Research Accelerator
                                </span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight leading-tight">
                                極速解構學術文獻，<br />
                                <span className="text-primary">您的 AI 研究加速器</span>
                            </h2>
                            <p className="text-lg text-slate-500 leading-relaxed px-4">
                                別再被海量論文淹沒。輸入研究方向，一鍵生成文獻矩陣、<br className="hidden md:block" />視覺化引用系譜，讓文獻回顧效率提升 10 倍。
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSearch} className={`relative w-full ${hasSearched ? 'max-w-4xl' : 'max-w-2xl'}`}>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <Search className={`text-slate-400 group-focus-within:text-primary transition-colors ${isLoading ? 'opacity-0' : 'opacity-100'}`} size={20} />
                                {isLoading && (
                                    <Loader2 className="absolute left-5 text-primary animate-spin" size={20} />
                                )}
                            </div>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="例如：生成式 AI 對學術誠信的影響 (Generative AI on Academic Integrity)..."
                                className="w-full pl-14 pr-32 py-4 bg-white border border-slate-200 rounded-2xl shadow-academic text-lg placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
                                disabled={isLoading || !isApiKeySet}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !query.trim() || !isApiKeySet}
                                className="absolute right-2 top-2 bottom-2 bg-primary hover:bg-blue-700 text-white px-6 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                            >
                                <Sparkles size={18} />
                                {isLoading ? (showEnglish ? 'Analyzing...' : '分析中...') : (showEnglish ? 'Start' : '開始加速')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Results Section */}
                {error && (
                    <div className="max-w-4xl mx-auto bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 mb-8 flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full"><Loader2 className="animate-spin" size={0} /><span className="text-xl font-bold">!</span></div>
                        {error}
                    </div>
                )}

                {hasSearched && !isLoading && !error && (
                    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        {/* Sidebar */}
                        <aside className="lg:w-72 shrink-0">
                            <FilterSidebar
                                sortOption={sortOption}
                                setSortOption={setSortOption}
                                showEnglish={showEnglish}
                                setShowEnglish={setShowEnglish}
                                resultCount={processedPapers.length}
                                onClearHistory={handleClearHistory}
                                selectedMethodologies={selectedMethodologies}
                                toggleMethodology={toggleMethodology}
                            />
                        </aside>

                        {/* List */}
                        <div className="flex-1 space-y-6">

                            {/* Professor's Insight Synthesis */}
                            {synthesis && (
                                <SynthesisCard synthesis={synthesis} showEnglish={showEnglish} />
                            )}

                            {processedPapers.length > 0 ? (
                                <>
                                    {processedPapers.map((paper) => (
                                        <PaperCard
                                            key={paper.id}
                                            paper={paper}
                                            showEnglish={showEnglish}
                                            isSelected={selectedPaperIds.has(paper.id)}
                                            onToggleSelect={handleToggleSelect}
                                        />
                                    ))}

                                    {/* Load More Button */}
                                    <div className="pt-4 flex justify-center pb-20">
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={isLoadingMore}
                                            className="group flex items-center gap-2 px-8 py-3 bg-white border border-slate-300 hover:border-primary hover:text-primary text-slate-600 rounded-full font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <Loader2 size={20} className="animate-spin" />
                                                    Deep Diving...
                                                </>
                                            ) : (
                                                <>
                                                    <PlusCircle size={20} className="group-hover:scale-110 transition-transform" />
                                                    {showEnglish ? 'Load More Papers' : '載入更多文獻'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center">
                                    <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <Search className="text-slate-400" size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">
                                        {showEnglish ? 'No matches found' : '未找到相關結果'}
                                    </h3>
                                    <p className="text-slate-500">
                                        {showEnglish ? 'Try adjusting your filters or search terms.' : '請嘗試調整篩選條件或搜尋關鍵字。'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading Skeleton */}
                {isLoading && (
                    <div className="max-w-4xl mx-auto mt-12 space-y-6">
                        {/* Synthesis Skeleton */}
                        <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 animate-pulse mb-8">
                            <div className="h-6 bg-indigo-100 rounded w-1/3 mb-4"></div>
                            <div className="h-20 bg-indigo-100 rounded w-full mb-6"></div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="h-32 bg-indigo-100 rounded"></div>
                                <div className="h-32 bg-indigo-100 rounded"></div>
                                <div className="h-32 bg-indigo-100 rounded"></div>
                            </div>
                        </div>

                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-pulse">
                                <div className="h-4 bg-slate-200 rounded w-1/4 mb-4"></div>
                                <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
                                <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                                <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                                <div className="flex gap-4 mt-4">
                                    <div className="h-8 bg-slate-200 rounded w-1/4"></div>
                                    <div className="h-8 bg-slate-200 rounded w-1/4"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Floating Action Bar for Selection */}
                {selectedPaperIds.size > 0 && !showMatrixView && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white pl-4 pr-1 py-1.5 rounded-full shadow-2xl z-40 flex items-center gap-4 animate-in slide-in-from-bottom-6 duration-300 border border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <span className="bg-primary text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
                                {selectedPaperIds.size}
                            </span>
                            <span className="text-sm font-medium">{showEnglish ? 'Selected' : '已選擇'}</span>
                        </div>
                        <div className="h-4 w-px bg-white/20"></div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleClearSelection}
                                className="text-slate-300 hover:text-white text-sm transition-colors p-2 hover:bg-white/10 rounded-full"
                                title={showEnglish ? "Clear Selection" : "清除選擇"}
                            >
                                <X size={16} />
                            </button>
                            <button
                                onClick={() => setShowMatrixView(true)}
                                className="bg-primary hover:bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg"
                            >
                                <Table2 size={16} />
                                {showEnglish ? 'Matrix View' : '綜合矩陣'}
                            </button>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default App;
