
import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ResultsTable from './components/ResultsTable';
import DiscountBreakdown from './components/DiscountBreakdown';
import FileInspector from './components/FileInspector';
import SubfamilyCoherenceMatrix from './components/SubfamilyCoherenceMatrix';
import SequenceTimeAnalysis from './components/SequenceTimeAnalysis';
import ApiDocs from './components/ApiDocs';
import { identifyTransactionType, parse11004, parse11008, parseSystemEvent } from './utils/parser';
import { aggregateSales, generateDiscountBreakdown, inspectSingleFile, validateCoherence, fmtMoney } from './utils/validator';
import { validateSyntaxAndSemantics } from './utils/syntaxValidator';
import { analyzeErrorWithGemini } from './utils/aiAnalyzer';
import { FileDiscountBreakdown, ParsedSale11004, ParsedSummary11008, ParsedSystemEvent, SingleFileInspection, TransactionType, ValidationResult, AggregatedData } from './types';

// Icons
const IconDashboard = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const IconUpload = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
const IconCheck = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconTrash = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const IconSparkles = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IconCode = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;

type ViewMode = 'upload' | 'dashboard' | 'api';
type ResultTab = 'overview' | 'matrix' | 'ops' | 'finance';

/**
 * Descompresión y decodificación de reportes API (v1.3 con Gzip)
 */
async function decodeReportData(base64: string): Promise<any> {
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    try {
        // Usar DecompressionStream nativa del navegador
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();
        
        const response = new Response(ds.readable);
        const json = await response.json();
        return json;
    } catch (e) {
        // Fallback para versiones antiguas (v1.2 sin gzip)
        console.warn("Decompression failed, trying fallback to plain JSON...");
        const decoded = decodeURIComponent(Array.from(bytes).map(b => '%' + b.toString(16).padStart(2, '0')).join(''));
        return JSON.parse(decoded);
    }
}

function App() {
  const [activeView, setActiveView] = useState<ViewMode>('upload');
  const [activeTab, setActiveTab] = useState<ResultTab>('overview');

  const [salesFiles, setSalesFiles] = useState<ParsedSale11004[]>([]);
  const [summaryFile, setSummaryFile] = useState<ParsedSummary11008 | null>(null);
  const [startFile, setStartFile] = useState<ParsedSystemEvent | null>(null);
  const [endFile, setEndFile] = useState<ParsedSystemEvent | null>(null);
  const [filesLoaded, setFilesLoaded] = useState<{name: string, type: string, raw?: ParsedSale11004}[]>([]);
  
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [discountBreakdown, setDiscountBreakdown] = useState<FileDiscountBreakdown[]>([]);
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [isApiReportView, setIsApiReportView] = useState(false);

  // --- DEEP LINK HYDRATION LOGIC (V1.3 con GZIP y Mapeo) ---
  useEffect(() => {
    const hydrate = async () => {
        const params = new URLSearchParams(window.location.search);
        const reportData = params.get('api_report');
        
        if (reportData) {
          try {
            const decoded = await decodeReportData(reportData);
            console.log("Hydrating from API report:", decoded);
            
            // Mapeo de claves minificadas (m=meta, r=results, a=aggregated, s=summary, d=discounts, o=ops)
            const isMinified = !!decoded.m;
            const results = isMinified ? (decoded.r || []) : (decoded.results || []);
            const meta = isMinified ? decoded.m : decoded.meta;
            const agg = isMinified ? decoded.a : decoded.aggregated;
            const sum = isMinified ? decoded.s : decoded.summary;
            const disc = isMinified ? decoded.d : decoded.discounts;
            const ops = isMinified ? decoded.o : decoded.ops;

            if (results.length === 0 && meta?.e === 0) {
                results.push({ 
                    status: 'valid', 
                    message: 'Auditoría superada: Todos los archivos cumplen la normativa SAVIA.' 
                });
            }

            setValidationResults(results);
            setAggregatedData(agg || null);
            setSummaryFile(sum || null);
            setDiscountBreakdown(disc || []);

            if (ops) {
                setSalesFiles(ops.map((s: any) => ({
                    fileName: s.n,
                    header: s.h,
                    items: [], taxes: [], payments: [], rawContent: ""
                })));
            }

            setFilesLoaded((ops?.map((s:any)=>({ name: s.n, type: 'Loaded via API' })) || []));
            
            setIsApiReportView(true);
            setIsValidated(true);
            setActiveView('dashboard');
          } catch (e) {
            console.error("Invalid report link", e);
            setError("No se pudo cargar el reporte. Es posible que el enlace esté corrupto o incompleto.");
          }
        }
    };
    hydrate();
  }, []);

  const handleFilesSelected = async (fileList: FileList) => {
    setError(null);
    setIsApiReportView(false); 
    const newSales: ParsedSale11004[] = [];
    let newSummary: ParsedSummary11008 | null = null;
    let newStart: ParsedSystemEvent | null = null;
    let newEnd: ParsedSystemEvent | null = null;
    const newLoaded: {name: string, type: string, raw?: ParsedSale11004}[] = [];

    const currentFileNames = new Set(salesFiles.map(f => f.fileName));
    if (summaryFile) currentFileNames.add(summaryFile.fileName);
    if (startFile) currentFileNames.add(startFile.fileName);
    if (endFile) currentFileNames.add(endFile.fileName);

    const readFile = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    };

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (currentFileNames.has(file.name)) continue;
        currentFileNames.add(file.name); 

        const content = await readFile(file);
        const type = identifyTransactionType(file.name, content);

        if (type === TransactionType.SALE) {
          const parsed = parse11004(file.name, content);
          newSales.push(parsed);
          newLoaded.push({ name: file.name, type: 'Sales', raw: parsed });
        } else if (type === TransactionType.SUMMARY) {
          const parsed = parse11008(file.name, content);
          newSummary = parsed;
          newLoaded.push({ name: file.name, type: 'Summary' });
        } else if (type === TransactionType.START_DAY) {
           const parsed = parseSystemEvent(file.name, content, TransactionType.START_DAY);
           newStart = parsed;
           newLoaded.push({ name: file.name, type: 'Start Day' });
        } else if (type === TransactionType.END_DAY) {
           const parsed = parseSystemEvent(file.name, content, TransactionType.END_DAY);
           newEnd = parsed;
           newLoaded.push({ name: file.name, type: 'End Day' });
        } else {
           newLoaded.push({ name: file.name, type: 'Unknown' });
        }
      }

      if (newSales.length > 0) setSalesFiles(prev => [...prev, ...newSales]);
      if (newSummary) setSummaryFile(newSummary);
      if (newStart) setStartFile(newStart);
      if (newEnd) setEndFile(newEnd);
      
      setFilesLoaded(prev => [...prev, ...newLoaded]);

    } catch (err) {
      setError("Error reading files. Please ensure they are valid text files.");
      console.error(err);
    }
  };

  const runValidation = () => {
    if (!summaryFile) {
      setError("Please upload a Summary File (11008) to validate against.");
      return;
    }
    if (salesFiles.length === 0) {
      setError("Please upload Sales Files (11004).");
      return;
    }

    const sortedSales = [...salesFiles].sort((a,b) => {
        const tA = parseInt(a.header.NUM_TICKET || "0");
        const tB = parseInt(b.header.NUM_TICKET || "0");
        return tA - tB;
    });

    const syntaxResults = validateSyntaxAndSemantics(sortedSales);
    const aggregated = aggregateSales(sortedSales);
    const coherenceResults = validateCoherence(aggregated, summaryFile, startFile || undefined, endFile || undefined, sortedSales);
    
    setValidationResults([...syntaxResults, ...coherenceResults]);
    setAggregatedData(aggregated);
    setDiscountBreakdown(generateDiscountBreakdown(sortedSales));
    setIsValidated(true);
    setActiveView('dashboard');
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  const handleAIAnalysis = async () => {
      setIsAnalyzing(true);
      try {
          const result = await analyzeErrorWithGemini(validationResults, salesFiles, summaryFile, aggregatedData);
          setAiAnalysisResult(result);
      } catch (e) {
          setAiAnalysisResult("No se pudo completar el análisis de IA.");
      } finally { setIsAnalyzing(false); }
  };

  const clearAll = () => {
    setSalesFiles([]); setSummaryFile(null); setStartFile(null); setEndFile(null);
    setFilesLoaded([]); setValidationResults([]); setDiscountBreakdown([]);
    setAggregatedData(null); setError(null); setIsValidated(false); setAiAnalysisResult(null);
    setIsApiReportView(false);
    setActiveView('upload');
    if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const Sidebar = () => (
    <div className="w-64 bg-slate-850 text-white flex flex-col h-full shadow-xl z-10">
      <div className="p-6 flex items-center border-b border-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-aena-green mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-bold text-lg tracking-tight">SAVIA Validator</span>
      </div>
      
      <nav className="flex-1 py-6 space-y-2 px-3">
        <button 
            onClick={() => setActiveView('upload')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${activeView === 'upload' ? 'bg-aena-green text-white' : 'text-gray-400 hover:bg-gray-800'}`}
        >
            <IconUpload /> <span className="font-medium">Data Upload</span>
        </button>

        <button 
            onClick={() => isValidated && setActiveView('dashboard')}
            disabled={!isValidated}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${activeView === 'dashboard' ? 'bg-aena-green text-white' : 'text-gray-400 hover:bg-gray-800'} ${!isValidated && 'opacity-50'}`}
        >
            <IconDashboard /> <span className="font-medium">Audit Dashboard</span>
        </button>

        <div className="pt-6 pb-2 px-4">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Developers</span>
        </div>

        <button 
            onClick={() => setActiveView('api')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${activeView === 'api' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-gray-400 hover:bg-gray-800'}`}
        >
            <IconCode /> <span className="font-medium">API Portal</span>
        </button>
      </nav>

      <div className="p-4 border-t border-gray-700">
          <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400">
              <p className="font-semibold text-gray-300 mb-1">Session Info</p>
              <div className="flex justify-between"><span>Files:</span> <span className="text-white">{filesLoaded.length}</span></div>
          </div>
          {filesLoaded.length > 0 && (
            <button onClick={clearAll} className="mt-3 w-full flex items-center justify-center space-x-2 text-red-400 hover:text-red-300 text-sm py-2 hover:bg-red-900/20 rounded transition">
                <IconTrash /> <span>Clear Session</span>
            </button>
          )}
      </div>
    </div>
  );

  const KPI = ({ label, value, subtext, color = 'blue' }: any) => (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col">
          <span className="text-gray-500 text-sm font-medium uppercase tracking-wider">{label}</span>
          <span className="text-2xl font-bold text-slate-800 mt-1">{value}</span>
          {subtext && <span className={`text-xs mt-1 font-medium ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-blue-600'}`}>{subtext}</span>}
      </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <div className="flex-1 overflow-hidden relative">
          <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shadow-sm z-20">
              <div className="flex items-center text-sm text-gray-500">
                  <span className="hover:text-gray-700 cursor-pointer">AENA Portal</span>
                  <svg className="h-4 w-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <span className="font-medium text-slate-800 capitalize">{activeView}</span>
              </div>
              {isApiReportView && (
                  <div className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full flex items-center space-x-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-tighter">API External Report View</span>
                  </div>
              )}
          </header>

          <main className="h-[calc(100vh-64px)] overflow-y-auto bg-gray-50 scroll-smooth">
              {error && (
                  <div className="max-w-5xl mx-auto mt-4 px-4">
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
                          <span>{error}</span>
                          <button onClick={() => setError(null)} className="font-bold">×</button>
                      </div>
                  </div>
              )}

              {activeView === 'upload' && (
                  <div className="max-w-5xl mx-auto py-16 px-4">
                      <div className="text-center mb-16"><h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">Certification <span className="text-aena-green">Audit</span></h1></div>
                      <FileUpload onFilesSelected={handleFilesSelected} />
                      {filesLoaded.length > 0 && (
                          <div className="mt-8 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                              <ul className="divide-y divide-gray-50">
                                  {filesLoaded.map((f, i) => (
                                      <li key={i} className="px-6 py-4 flex items-center justify-between"><div className="flex items-center space-x-4"><div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><IconUpload /></div><div><p className="text-sm font-semibold text-slate-800">{f.name}</p><p className="text-xs text-slate-500">{f.type}</p></div></div></li>
                                  ))}
                              </ul>
                              <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100"><button onClick={runValidation} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center"><IconCheck /> <span className="ml-2">Run Validation</span></button></div>
                          </div>
                      )}
                  </div>
              )}

              {activeView === 'dashboard' && (
                  <div className="py-8 px-8 max-w-7xl mx-auto">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                          <KPI label="Total Sales" value={aggregatedData ? fmtMoney(aggregatedData.global.totalGrossSale) : '-'} subtext={`${aggregatedData?.global.countSale} Tickets`} color="green" />
                          <KPI label="Total Returns" value={aggregatedData ? fmtMoney(aggregatedData.global.totalGrossReturn) : '-'} subtext={`${aggregatedData?.global.countReturn} Tickets`} color="red" />
                          <KPI label="Net Revenue" value={aggregatedData ? fmtMoney(aggregatedData.global.totalNetSale - aggregatedData.global.totalNetReturn) : '-'} color="blue" />
                          <KPI label="Discounts" value={aggregatedData ? fmtMoney(aggregatedData.global.totalDiscountSale + aggregatedData.global.totalDiscountReturn) : '-'} color="blue" />
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                           <div className="bg-white border-b border-gray-200 px-6 pt-4"><nav className="-mb-px flex space-x-8">
                              {['overview', 'matrix', 'ops', 'finance'].map((tab) => (
                                  <button key={tab} onClick={() => setActiveTab(tab as ResultTab)} className={`${activeTab === tab ? 'border-aena-green text-aena-green' : 'border-transparent text-gray-500 hover:text-gray-700'} py-4 px-1 border-b-2 font-medium text-sm transition-colors capitalize`}>{tab}</button>
                              ))}
                           </nav></div>
                           <div className="p-6">
                              {activeTab === 'overview' && <ResultsTable results={validationResults} isExternalReport={isApiReportView} />}
                              {activeTab === 'matrix' && <SubfamilyCoherenceMatrix calculated={aggregatedData} summary={summaryFile} files={salesFiles} />}
                              {activeTab === 'ops' && <SequenceTimeAnalysis files={salesFiles} />}
                              {activeTab === 'finance' && <DiscountBreakdown data={discountBreakdown} />}
                           </div>
                      </div>
                  </div>
              )}

              {activeView === 'api' && <div className="py-12 px-8"><ApiDocs /></div>}
          </main>
      </div>

      {aiAnalysisResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden border border-purple-100">
                   <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex justify-between items-center text-white"><div className="flex items-center space-x-2"><IconSparkles /> <h3 className="text-xl font-bold">AI Auditor Analysis</h3></div><button onClick={() => setAiAnalysisResult(null)} className="hover:opacity-70"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                   <div className="p-8 overflow-y-auto text-gray-700 text-sm whitespace-pre-wrap">{aiAnalysisResult}</div>
                   <div className="bg-gray-50 px-6 py-4 border-t flex justify-end"><button onClick={() => setAiAnalysisResult(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Close</button></div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
