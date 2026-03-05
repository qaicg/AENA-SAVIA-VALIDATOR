
import React, { useState } from 'react';
import { ValidationResult } from '../types';

interface ResultsTableProps {
  results: ValidationResult[];
  isExternalReport?: boolean;
}

// Helper to generate detailed explanations based on error context
const getErrorAnalysis = (message: string, details: any[]) => {
  const m = message.toLowerCase();

  if (m.includes('global mismatch')) {
    return {
      explanation: "The aggregated totals calculated from the individual Sales Files (11004) do not match the Global Totals declared in the Summary File (11008) header.",
      implication: "The Summary File is reporting financial data that cannot be substantiated by the detailed transaction logs. This is a critical certification failure.",
      causes: [
        "Missing 11004 files in the upload batch.",
        "The Summary File was generated before all transactions were completed/closed.",
        "Incorrect summation logic in the POS software generation of the 11008 header."
      ]
    };
  }

  if (m.includes('subfamily') && m.includes('mismatch')) {
    return {
      explanation: "For a specific SubFamily (category), the sum of values in the Sales Files (11004) differs from the row reported in the Summary File (11008).",
      implication: "The breakdown of sales by category is incorrect. This usually affects tax reporting or concession fee calculations.",
      causes: [
        "Rounding errors when summing items vs. lines.",
        "An item was assigned to SubFamily X in the ticket but SubFamily Y in the summary.",
        "Index mapping error: The 11008 parser might be reading the wrong column (e.g. Net instead of Gross).",
        "Discount Calculation: The 11008 expects specific proration logic (Line Discounts + Header Discounts)."
      ]
    };
  }

  if (m.includes('z number mismatch')) {
    return {
      explanation: "The 'Z Number' (Daily Closure ID) is not consistent across all uploaded files.",
      implication: "You are attempting to validate files that belong to different business days or different POS terminals.",
      causes: [
        "Uploading a mix of files from yesterday and today.",
        "The POS incremented the Z-counter mid-operation.",
        "Start Day (11001) or End Day (11002) files do not match the transactions."
      ]
    };
  }

  if (m.includes('date mismatch')) {
    return {
      explanation: "The 'FECHA_REAL' (Date) field in the file headers is inconsistent.",
      implication: "Files from different calendar days are mixed in this batch.",
      causes: [
        "Operational error: Selecting files from a folder containing history.",
        "The POS changed dates (post-midnight) without generating a new Z-closure correctly."
      ]
    };
  }

  if (m.includes('sequence gap')) {
    return {
      explanation: "Ticket numbers are not sequential (e.g., 1, 2, 4...).",
      implication: "Data loss is suspected. AENA requires continuous numbering for auditability.",
      causes: [
        "A file (11004) was created on the disk but not selected for upload.",
        "A transaction failed on the POS and the ticket number was burned but not logged.",
        "Files were deleted manually."
      ]
    };
  }

  if (m.includes('syntax') || m.includes('structure')) {
    return {
      explanation: "The file structure does not adhere to the AENA specification (pipe-separated values).",
      implication: "The file cannot be parsed reliably. The automated system will reject it.",
      causes: [
        "Missing mandatory fields (e.g., empty Item Code).",
        "Incorrect number of columns in a row.",
        "Negative numbers or decimals used where positive integers are required (AENA requires monetary values in 'mills', e.g., 10.00€ = 10000)."
      ]
    };
  }

  if (m.includes('internal inconsistency') || m.includes('math error')) {
    return {
      explanation: "The totals declared in the file Header do not match the sum of the file's Body lines.",
      implication: "The file is internally corrupt or mathematically invalid.",
      causes: [
        "The header totals were calculated before a line was added/removed.",
        "Rounding differences between line-item accumulation and total calculation."
      ]
    };
  }

  if (m.includes('ticket range')) {
    return {
      explanation: "The first or last ticket number found in the 11004 files does not match the CD_TICKET_I or CD_TICKET_F fields in the 11008 header.",
      implication: "The summary file claims to cover a range of tickets that differs from the actual files provided.",
      causes: [
        "Missing files at the start or end of the day.",
        "The 11008 header was generated using logic that excludes voided tickets, but they exist in the sequence."
      ]
    };
  }

  return {
    explanation: "A data discrepancy was found between the declared summaries and the calculated actuals.",
    implication: "Data integrity check failed.",
    causes: ["Check the 'Details' table below for exact values."]
  };
};

const ResultRow: React.FC<{ res: ValidationResult }> = ({ res }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetails = res.details && res.details.length > 0;
  
  // Auto-expand errors on load
  React.useEffect(() => {
    if (res.status === 'invalid' && hasDetails) {
        setIsOpen(true);
    }
  }, []);

  const handleToggle = () => {
      if (hasDetails) setIsOpen(!isOpen);
  };

  const getStatusColor = () => {
      switch(res.status) {
          case 'valid': return 'text-green-600 bg-green-50 border-green-100';
          case 'invalid': return 'text-red-600 bg-red-50 border-red-100';
          case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-100';
          default: return 'text-gray-600 bg-gray-50';
      }
  };

  const getIcon = () => {
      if (res.status === 'valid') return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
      if (res.status === 'invalid') return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
      return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
  };

  const analysis = (res.status === 'invalid' || res.status === 'warning') 
    ? getErrorAnalysis(res.message, res.details || []) 
    : null;

  return (
      <li className="group">
        <div 
            className={`px-4 py-3 flex items-center justify-between transition-colors border-b border-gray-100 ${hasDetails ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            onClick={handleToggle}
        >
          <div className="flex items-center flex-1 gap-3">
            <div className={`p-1.5 rounded-full flex-shrink-0 ${getStatusColor()}`}>
                {getIcon()}
            </div>
            <p className={`text-sm font-medium ${res.status === 'invalid' ? 'text-red-700' : res.status === 'warning' ? 'text-yellow-700' : 'text-slate-700'}`}>
              {res.message}
            </p>
          </div>
          
          {hasDetails && (
              <div className="ml-2 flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors">
                   <svg 
                        className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
              </div>
          )}
        </div>

        {/* Details Area */}
        {hasDetails && isOpen && (
          <div className="bg-slate-50 px-4 py-4 border-b border-gray-100">
             
             {/* Analysis Box */}
             {analysis && (
                 <div className="mb-4 bg-white border border-blue-200 rounded-md p-4 shadow-sm">
                     <div className="flex items-start space-x-3">
                         <div className="flex-shrink-0 mt-0.5 text-blue-500">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                             </svg>
                         </div>
                         <div className="flex-1">
                             <h4 className="text-sm font-bold text-gray-900 mb-1">Issue Analysis</h4>
                             <p className="text-xs text-gray-700 mb-2">{analysis.explanation}</p>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                 <div>
                                     <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Implication</span>
                                     <p className="text-xs text-gray-600 mt-0.5">{analysis.implication}</p>
                                 </div>
                                 <div>
                                     <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Potential Causes</span>
                                     <ul className="text-xs text-gray-600 list-disc list-inside mt-0.5 space-y-0.5">
                                         {analysis.causes.map((c, i) => <li key={i}>{c}</li>)}
                                     </ul>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
             )}

             {res.status === 'valid' && (
                 <p className="text-xs text-green-700 mb-3 font-semibold tracking-wide uppercase flex items-center">
                     <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     Verification Details:
                 </p>
             )}

            <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Context</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Field</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Expected</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Actual</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {res.details!.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap">{d.context}</td>
                        <td className="px-3 py-2 text-gray-600">{d.field}</td>
                        <td className="px-3 py-2 text-gray-500 font-mono">{d.expected}</td>
                        <td className={`px-3 py-2 font-mono font-bold ${res.status === 'invalid' ? 'text-red-600 bg-red-50' : res.status === 'warning' ? 'text-yellow-600 bg-yellow-50' : 'text-green-600'}`}>
                            {d.actual}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          </div>
        )}
      </li>
  );
};

const ResultsTable: React.FC<ResultsTableProps> = ({ results, isExternalReport }) => {
  if (results.length === 0) return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          No validation results available. Run a validation to see the report.
      </div>
  );

  return (
    <div className="space-y-4">
        {isExternalReport && results.some(r => r.status === 'valid') === false && (
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-blue-700">
                    <p className="font-bold mb-1">Nota de Auditoría</p>
                    <p>Este reporte externo muestra únicamente las discrepancias detectadas. Todas las demás comprobaciones de sintaxis y coherencia cruzada han sido superadas con éxito.</p>
                </div>
            </div>
        )}
        
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit Log</span>
                <span className="text-xs text-gray-400">{results.length} Events</span>
            </div>
            <ul className="divide-y divide-gray-100">
                {results.map((res, idx) => (
                    <ResultRow key={idx} res={res} />
                ))}
            </ul>
        </div>
    </div>
  );
};

export default ResultsTable;
