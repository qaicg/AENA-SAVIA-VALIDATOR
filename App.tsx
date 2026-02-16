
import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ResultsTable from './components/ResultsTable';
import DiscountBreakdown from './components/DiscountBreakdown';
import FileInspector from './components/FileInspector';
import SubfamilyCoherenceMatrix from './components/SubfamilyCoherenceMatrix';
import SequenceTimeAnalysis from './components/SequenceTimeAnalysis';
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

type ViewMode = 'upload' | 'dashboard';
type ResultTab = 'overview' | 'matrix' | 'ops' | 'finance';

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

  // Inspection State
  const [inspectData, setInspectData] = useState<SingleFileInspection | null>(null);

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  const handleFilesSelected = async (fileList: FileList) => {
    setError(null);
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

    // 1. Syntax
    const syntaxResults = validateSyntaxAndSemantics(sortedSales);

    // 2. Coherence
    const aggregated = aggregateSales(sortedSales);
    const coherenceResults = validateCoherence(
      aggregated, 
      summaryFile, 
      startFile || undefined, 
      endFile || undefined,
      sortedSales 
    );
    
    // 3. Sequence
    let prevTicket = -1;
    let sequenceBroken = false;
    sortedSales.forEach(f => {
        const curr = parseInt(f.header.NUM_TICKET);
        if (prevTicket !== -1 && curr !== prevTicket + 1) {
            sequenceBroken = true;
            coherenceResults.push({
                status: 'warning',
                message: `Sequence Gap detected: Ticket ${prevTicket} -> ${curr}`,
                details: []
            });
        }
        prevTicket = curr;
    });

    setValidationResults([...syntaxResults, ...coherenceResults]);
    setAggregatedData(aggregated);

    // 4. Discounts
    const breakdown = generateDiscountBreakdown(sortedSales);
    setDiscountBreakdown(breakdown);

    setIsValidated(true);
    setActiveView('dashboard');
  };

  const handleAIAnalysis = async () => {
      setIsAnalyzing(true);
      try {
          const result = await analyzeErrorWithGemini(
              validationResults, 
              salesFiles, 
              summaryFile, 
              aggregatedData
          );
          setAiAnalysisResult(result);
      } catch (e) {
          setAiAnalysisResult("No se pudo completar el análisis de IA.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const clearAll = () => {
    setSalesFiles([]);
    setSummaryFile(null);
    setStartFile(null);
    setEndFile(null);
    setFilesLoaded([]);
    setValidationResults([]);
    setDiscountBreakdown([]);
    setAggregatedData(null);
    setError(null);
    setInspectData(null);
    setIsValidated(false);
    setAiAnalysisResult(null);
    setActiveView('upload');
  };

  const handleInspect = (file: ParsedSale11004) => {
      const data = inspectSingleFile(file);
      setInspectData(data);
  };

  // --- UI Components ---

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
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${activeView === 'upload' ? 'bg-aena-green text-white shadow-lg shadow-green-900/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
        >
            <IconUpload />
            <span className="font-medium">Data Upload</span>
        </button>

        <button 
            onClick={() => isValidated && setActiveView('dashboard')}
            disabled={!isValidated}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${activeView === 'dashboard' ? 'bg-aena-green text-white shadow-lg shadow-green-900/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'} ${!isValidated && 'opacity-50 cursor-not-allowed'}`}
        >
            <IconDashboard />
            <span className="font-medium">Audit Dashboard</span>
        </button>
      </nav>

      <div className="p-4 border-t border-gray-700">
          <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400">
              <p className="font-semibold text-gray-300 mb-1">Session Info</p>
              <div className="flex justify-between">
                  <span>Files:</span>
                  <span className="text-white">{filesLoaded.length}</span>
              </div>
              <div className="flex justify-between mt-1">
                  <span>Status:</span>
                  <span className={isValidated ? "text-green-400" : "text-yellow-400"}>{isValidated ? 'Audited' : 'Pending'}</span>
              </div>
          </div>
          {filesLoaded.length > 0 && (
            <button 
                onClick={clearAll} 
                className="mt-3 w-full flex items-center justify-center space-x-2 text-red-400 hover:text-red-300 text-sm py-2 hover:bg-red-900/20 rounded transition"
            >
                <IconTrash />
                <span>Clear Session</span>
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

  const StatusBanner = () => {
      const errorCount = validationResults.filter(r => r.status === 'invalid').length;
      const warningCount = validationResults.filter(r => r.status === 'warning').length;
      const isSuccess = errorCount === 0;

      return (
          <div className={`rounded-xl p-6 mb-6 shadow-sm border flex items-center justify-between ${isSuccess ? 'bg-gradient-to-r from-green-50 to-white border-green-100' : 'bg-gradient-to-r from-red-50 to-white border-red-100'}`}>
              <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-full ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {isSuccess ? <IconCheck /> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                  </div>
                  <div>
                      <h2 className={`text-xl font-bold ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
                          {isSuccess ? 'Certification Passed' : 'Certification Failed'}
                      </h2>
                      <p className="text-gray-600 text-sm mt-0.5">
                          {isSuccess 
                            ? 'All coherence, syntax, and operational checks completed successfully.' 
                            : `${errorCount} critical errors and ${warningCount} warnings detected.`}
                      </p>
                  </div>
              </div>
              
              {!isSuccess && (
                  <div className="flex gap-2">
                       <button
                            onClick={handleAIAnalysis}
                            disabled={isAnalyzing}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-purple-200 transition-all flex items-center space-x-2 disabled:opacity-50"
                       >
                           {isAnalyzing ? (
                               <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                               </svg>
                           ) : (
                               <IconSparkles />
                           )}
                           <span>{isAnalyzing ? 'Analizando...' : 'Análisis IA'}</span>
                       </button>
                  </div>
              )}
          </div>
      );
  };

  const AIResultModal = () => {
      if (!aiAnalysisResult) return null;

      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col border border-purple-100 overflow-hidden">
                   <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
                       <div className="flex items-center space-x-2 text-white">
                           <IconSparkles />
                           <h3 className="text-xl font-bold">Análisis de Auditoría IA</h3>
                       </div>
                       <button onClick={() => setAiAnalysisResult(null)} className="text-white/80 hover:text-white">
                           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                       </button>
                   </div>
                   <div className="p-8 overflow-y-auto text-gray-700 leading-relaxed whitespace-pre-wrap font-sans text-sm">
                       {aiAnalysisResult}
                   </div>
                   <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                       <button 
                         onClick={() => setAiAnalysisResult(null)}
                         className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                       >
                           Cerrar Informe
                       </button>
                   </div>
              </div>
          </div>
      )
  };

  const UploadView = () => (
      <div className="max-w-5xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 relative">
              {/* Decorative background element behind text */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-green-50 to-blue-50 rounded-full blur-3xl opacity-50 -z-10"></div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider mb-6">
                <span className="w-2 h-2 rounded-full bg-aena-green animate-pulse"></span>
                System Ready
              </div>

              <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
                Validation & <span className="text-transparent bg-clip-text bg-gradient-to-br from-aena-green to-emerald-600">Certification</span>
              </h1>
              
              <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Upload AENA POS files <span className="inline-flex items-center px-2 py-0.5 rounded text-base font-mono font-medium bg-white border border-slate-200 text-slate-700 shadow-sm mx-1">11004</span>, <span className="inline-flex items-center px-2 py-0.5 rounded text-base font-mono font-medium bg-white border border-slate-200 text-slate-700 shadow-sm mx-1">11008</span> to begin the audit process.
              </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-200/50 p-3 border border-slate-100 mb-12 relative z-10">
             <FileUpload onFilesSelected={handleFilesSelected} />
          </div>

          {filesLoaded.length > 0 && (
              <div className="mt-12 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-center mb-4 px-2">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Staged Files</h3>
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold px-3 py-1 rounded-full">{filesLoaded.length} Ready</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                      <ul className="divide-y divide-gray-50">
                          {filesLoaded.map((f, i) => (
                              <li key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition group">
                                  <div className="flex items-center space-x-4">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${f.type === 'Sales' ? 'bg-blue-50 text-blue-600' : f.type === 'Summary' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </div>
                                      <div>
                                          <p className="text-sm font-semibold text-slate-800">{f.name}</p>
                                          <p className="text-xs text-slate-500 font-medium">{f.type}</p>
                                      </div>
                                  </div>
                                  {f.raw && (
                                      <button onClick={() => handleInspect(f.raw!)} className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-aena-green hover:border-aena-green px-3 py-1.5 rounded-md font-medium">Inspect Content</button>
                                  )}
                              </li>
                          ))}
                      </ul>
                      <div className="bg-gray-50/50 px-6 py-4 flex justify-end border-t border-gray-100 backdrop-blur-sm">
                           <button 
                                onClick={runValidation}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-slate-900/10 transition-all transform active:scale-[0.98] flex items-center"
                           >
                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                               Run Certification Audit
                           </button>
                      </div>
                  </div>
              </div>
          )}

          {error && (
              <div className="mt-6 max-w-3xl mx-auto bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm">
                  <div className="flex">
                      <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                      </div>
                      <div className="ml-3">
                          <p className="text-sm text-red-700 font-medium">{error}</p>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );

  const DashboardView = () => (
      <div className="py-8 px-8 max-w-7xl mx-auto h-full overflow-y-auto">
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <KPI label="Total Sales" value={aggregatedData ? fmtMoney(aggregatedData.global.totalGrossSale) : '-'} subtext={`${aggregatedData?.global.countSale} Tickets`} color="green" />
              <KPI label="Total Returns" value={aggregatedData ? fmtMoney(aggregatedData.global.totalGrossReturn) : '-'} subtext={`${aggregatedData?.global.countReturn} Tickets`} color="red" />
              <KPI label="Net Amount" value={aggregatedData ? fmtMoney(aggregatedData.global.totalNetSale - aggregatedData.global.totalNetReturn) : '-'} subtext="Revenue" color="blue" />
              <KPI label="Discounts" value={aggregatedData ? fmtMoney(aggregatedData.global.totalDiscountSale + aggregatedData.global.totalDiscountReturn) : '-'} subtext="Total Value" color="blue" />
          </div>

          <StatusBanner />

          {/* Tab Navigation */}
          <div className="bg-white rounded-t-xl border-b border-gray-200 px-6 pt-4">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                  {[
                      { id: 'overview', name: 'Validation Report' },
                      { id: 'matrix', name: 'Coherence Matrix' },
                      { id: 'ops', name: 'Operations & Sequence' },
                      { id: 'finance', name: 'Financial Breakdown' }
                  ].map((tab) => (
                      <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as ResultTab)}
                          className={`${
                              activeTab === tab.id
                                  ? 'border-aena-green text-aena-green'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                      >
                          {tab.name}
                      </button>
                  ))}
              </nav>
          </div>

          {/* Tab Content Area */}
          <div className="bg-white rounded-b-xl shadow-sm border border-gray-100 min-h-[500px] p-6">
              {activeTab === 'overview' && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Detailed Validation Log</h3>
                    <ResultsTable results={validationResults} />
                  </div>
              )}
              {activeTab === 'matrix' && (
                  <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Subfamily Cross-Reference (11004 vs 11008)</h3>
                      <SubfamilyCoherenceMatrix calculated={aggregatedData} summary={summaryFile} files={salesFiles} />
                  </div>
              )}
              {activeTab === 'ops' && (
                  <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Operational Integrity</h3>
                      <SequenceTimeAnalysis files={salesFiles} />
                  </div>
              )}
              {activeTab === 'finance' && (
                  <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Discount Analysis & Breakdown</h3>
                      <DiscountBreakdown data={discountBreakdown} />
                  </div>
              )}
          </div>
      </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <div className="flex-1 overflow-hidden relative">
          <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shadow-sm z-20">
              <div className="flex items-center text-sm text-gray-500">
                  <span className="hover:text-gray-700 cursor-pointer">Home</span>
                  <svg className="h-4 w-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <span className={`font-medium ${activeView === 'upload' ? 'text-slate-800' : 'text-gray-500'}`}>Upload</span>
                  {activeView === 'dashboard' && (
                      <>
                        <svg className="h-4 w-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <span className="font-medium text-slate-800">Results</span>
                      </>
                  )}
              </div>
              <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                      USR
                  </div>
              </div>
          </header>

          <main className="h-[calc(100vh-64px)] overflow-y-auto bg-gray-50 scroll-smooth">
              {activeView === 'upload' ? <UploadView /> : <DashboardView />}
          </main>
      </div>

      {inspectData && (
          <FileInspector data={inspectData} onClose={() => setInspectData(null)} />
      )}

      {/* AI Modal */}
      <AIResultModal />
    </div>
  );
}

export default App;
