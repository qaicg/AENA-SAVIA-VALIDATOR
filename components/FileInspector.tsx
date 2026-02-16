
import React from 'react';
import { SingleFileInspection, SaleItemLine } from '../types';
import { fmtMoney } from '../utils/validator';

interface Props {
  data: SingleFileInspection;
  onClose: () => void;
}

const FileInspector: React.FC<Props> = ({ data, onClose }) => {
  
  // Helper to determine styling for columns based on check results
  const getColumnClass = (keyword: string, defaultClass: string) => {
    const check = data.checks.find(c => c.label.includes(keyword));
    if (!check) return defaultClass;
    
    // If check failed (Error) - Stronger Red
    if (!check.isOk) {
        return `${defaultClass.split('text-')[0]} bg-red-100 text-red-900 font-bold border-x border-red-200`;
    }
    // If check warned (Warning) - Stronger Yellow
    if (check.isWarning) {
        return `${defaultClass.split('text-')[0]} bg-yellow-50 text-yellow-800 font-bold border-x border-yellow-200`;
    }
    
    return defaultClass;
  };

  // Helper to detect internal inconsistencies within a single line
  const getLineIssues = (line: SaleItemLine): string[] => {
      const issues: string[] = [];
      
      // Check 1: Gross vs Net + Tax consistency
      // Rate example: 2100 = 21.00%. Factor = 1.21.
      const rate = line.TAX_RATE || 0;
      const calculatedGross = line.IMPNETO_A * (1 + rate / 10000);
      
      // Tolerance: 5 cents (50 units) due to potential rounding differences/truncation in source system
      if (Math.abs(line.IMPBRUTO_A - calculatedGross) > 50) {
          issues.push(`Math Mismatch: Net (${fmtMoney(line.IMPNETO_A)}) + ${rate/100}% Tax != Gross (${fmtMoney(line.IMPBRUTO_A)})`);
      }

      // Check 2: Net should not exceed Base (Venta)
      if (line.IMPNETO_A > line.IMPVENTA_A) {
          issues.push(`Logic Error: Net Amount > Base Amount`);
      }

      return issues;
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <div>
             <h3 className="text-xl font-bold text-gray-900">Ticket Inspection: {data.ticketNum}</h3>
             <p className="text-sm text-gray-500 font-mono">{data.fileName}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* 1. Validation Checks Grid */}
            <div>
                <h4 className="text-lg font-medium text-gray-800 mb-4 pb-1 border-b">Internal Consistency (Header vs Lines)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.checks.map((check, idx) => (
                        <div key={idx} className={`p-4 rounded-lg border ${check.isOk && !check.isWarning ? 'border-green-200 bg-green-50' : check.isWarning ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-semibold text-gray-700">{check.label}</span>
                                {check.isOk && !check.isWarning ? (
                                    <span className="text-green-600">✔ OK</span>
                                ) : check.isWarning ? (
                                    <span className="text-yellow-600 text-xs font-bold">⚠ DIFF</span>
                                ) : (
                                    <span className="text-red-600 font-bold">✘ FAIL</span>
                                )}
                            </div>
                            <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Header:</span>
                                    <span className="font-mono text-gray-900">{check.headerValue}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-300 pb-1">
                                    <span className="text-gray-500">Sum Lines:</span>
                                    <span className="font-mono text-gray-900">{check.calcValue}</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span className="text-gray-500">Diff:</span>
                                    <span className={`font-mono font-bold ${check.diff == 0 ? 'text-gray-400' : 'text-red-600'}`}>{check.diff}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Line Items Table */}
            <div>
                <h4 className="text-lg font-medium text-gray-800 mb-4 pb-1 border-b">Detailed Line Items (5xx)</h4>
                <div className="overflow-auto border rounded-lg max-h-96 relative shadow-inner">
                    <table className="min-w-full text-xs divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-500 bg-gray-100 w-8">#</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500 bg-gray-100">SubFam</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500 bg-gray-100">Item Code</th>
                                <th className={`px-3 py-2 text-right font-medium ${getColumnClass('Units', 'text-gray-500')} bg-gray-100`}>Units</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500 bg-gray-100">Base (Venta)</th>
                                <th className={`px-3 py-2 text-right font-medium ${getColumnClass('Discount', 'text-blue-600')} bg-gray-100`}>Disc 1</th>
                                <th className={`px-3 py-2 text-right font-medium ${getColumnClass('Net', 'text-gray-500')} bg-gray-100`}>Net (Base Imp)</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500 bg-gray-100">Tax Rate</th>
                                <th className={`px-3 py-2 text-right font-medium ${getColumnClass('Gross', 'text-gray-500')} bg-gray-100`}>Gross (Total)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {data.lines.map((line, idx) => {
                                const issues = getLineIssues(line);
                                const hasIssues = issues.length > 0;
                                const rowClass = hasIssues ? 'bg-red-50 border-l-4 border-l-red-500' : 'hover:bg-gray-50';
                                
                                const totalLineDiscount = line.IMPDESCUENTO_1 + (line.IMPDESCUENTO_2 || 0) + (line.IMPDESCUENTO_3 || 0);
                                const netCalc = line.IMPVENTA_A - totalLineDiscount;
                                const netTooltip = `Base: ${fmtMoney(line.IMPVENTA_A)}\n- Disc: ${fmtMoney(totalLineDiscount)}\n= Calc Net: ${fmtMoney(netCalc)}`;

                                const taxAmt = line.IMPNETO_A * (line.TAX_RATE / 10000);
                                const grossCalc = line.IMPNETO_A + taxAmt;
                                const grossTooltip = `Net: ${fmtMoney(line.IMPNETO_A)}\n+ Tax (${(line.TAX_RATE/100).toFixed(2)}%): ${fmtMoney(taxAmt)}\n= Calc Gross: ${fmtMoney(grossCalc)}`;

                                return (
                                <tr key={idx} className={`${rowClass} transition-colors border-b border-gray-100`}>
                                    <td className="px-3 py-2 text-gray-400 font-mono text-[10px] relative">
                                        {idx + 1}
                                        {hasIssues && (
                                            <div 
                                                className="absolute top-0 right-0 bottom-0 flex items-center pr-1 group"
                                                title={issues.join('\n')}
                                            >
                                                 <svg 
                                                    className="w-4 h-4 text-red-600 cursor-help" 
                                                    fill="none" 
                                                    viewBox="0 0 24 24" 
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{line.TIPO_SUBFAMILIA}</td>
                                    <td className="px-3 py-2 text-gray-900 font-medium">{line.CD_ARTICULO}</td>
                                    <td className={`px-3 py-2 text-right ${getColumnClass('Units', 'text-gray-900')}`}>{line.UDS_A}</td>
                                    <td className="px-3 py-2 text-right text-gray-500">{fmtMoney(line.IMPVENTA_A)}</td>
                                    <td className={`px-3 py-2 text-right ${getColumnClass('Discount', 'text-blue-600')}`}>{fmtMoney(line.IMPDESCUENTO_1)}</td>
                                    <td 
                                        title={netTooltip}
                                        className={`px-3 py-2 text-right font-mono cursor-help underline decoration-dotted decoration-gray-300 ${getColumnClass('Net', 'text-gray-900')}`}
                                    >
                                        {fmtMoney(line.IMPNETO_A)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-500">{line.TAX_RATE/100}%</td>
                                    <td 
                                        title={grossTooltip}
                                        className={`px-3 py-2 text-right font-mono cursor-help underline decoration-dotted decoration-gray-300 ${getColumnClass('Gross', 'text-gray-900 font-bold')}`}
                                    >
                                        {fmtMoney(line.IMPBRUTO_A)}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold sticky bottom-0 z-10 border-t shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
                            <tr>
                                <td colSpan={3} className="px-3 py-2 text-right text-gray-700">TOTALS:</td>
                                <td className={`px-3 py-2 text-right ${getColumnClass('Units', 'text-gray-900')}`}>{data.lines.reduce((a, b) => a + b.UDS_A, 0)}</td>
                                <td className="px-3 py-2 text-right text-gray-900">{fmtMoney(data.lines.reduce((a, b) => a + b.IMPVENTA_A, 0))}</td>
                                <td className={`px-3 py-2 text-right ${getColumnClass('Discount', 'text-gray-900')}`}>{fmtMoney(data.lines.reduce((a, b) => a + b.IMPDESCUENTO_1, 0))}</td>
                                <td className={`px-3 py-2 text-right ${getColumnClass('Net', 'text-gray-900')}`}>{fmtMoney(data.lines.reduce((a, b) => a + b.IMPNETO_A, 0))}</td>
                                <td className="px-3 py-2"></td>
                                <td className={`px-3 py-2 text-right ${getColumnClass('Gross', 'text-gray-900')}`}>{fmtMoney(data.lines.reduce((a, b) => a + b.IMPBRUTO_A, 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* 3. Tax Breakdown (6xx) */}
            <div>
                <h4 className="text-lg font-medium text-gray-800 mb-4 pb-1 border-b">Tax Breakdown (6xx)</h4>
                <div className="overflow-auto border rounded-lg relative shadow-inner">
                    <table className="min-w-full text-xs divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">ID</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">Tax Type</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">Base</th>
                                <th className={`px-3 py-2 text-right font-medium ${getColumnClass('Tax', 'text-gray-500')}`}>Amount (Cuota)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {data.taxes.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400 italic">No tax lines (6xx) found</td></tr>
                            ) : (
                                data.taxes.map((tax, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-400 font-mono">{tax.ID_REGISTRO}</td>
                                        <td className="px-3 py-2 text-gray-600">{tax.TIPO_IMPUESTO}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{fmtMoney(tax.BASE)}</td>
                                        <td className={`px-3 py-2 text-right font-mono ${getColumnClass('Tax', 'text-gray-900')}`}>{fmtMoney(tax.CUOTA)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {data.taxes.length > 0 && (
                            <tfoot className="bg-gray-50 font-bold border-t">
                                <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right text-gray-700">TOTAL TAX:</td>
                                    <td className={`px-3 py-2 text-right ${getColumnClass('Tax', 'text-gray-900')}`}>
                                        {fmtMoney(data.taxes.reduce((a, b) => a + b.CUOTA, 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* 4. Payment Methods (7xx) */}
            <div>
                <h4 className="text-lg font-medium text-gray-800 mb-4 pb-1 border-b">Payment Methods (7xx)</h4>
                <div className="overflow-auto border rounded-lg relative shadow-inner">
                    <table className="min-w-full text-xs divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">ID</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">Payment Type</th>
                                <th className={`px-3 py-2 text-right font-medium ${getColumnClass('Payments', 'text-gray-500')}`}>Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {data.payments.length === 0 ? (
                                <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400 italic">No payment lines (7xx) found</td></tr>
                            ) : (
                                data.payments.map((pay, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-400 font-mono">{pay.ID_REGISTRO}</td>
                                        <td className="px-3 py-2 text-gray-600">{pay.TIPO_MEDIO}</td>
                                        <td className={`px-3 py-2 text-right font-mono ${getColumnClass('Payments', 'text-gray-900')}`}>{fmtMoney(pay.IMPORTE)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {data.payments.length > 0 && (
                            <tfoot className="bg-gray-50 font-bold border-t">
                                <tr>
                                    <td colSpan={2} className="px-3 py-2 text-right text-gray-700">TOTAL PAID:</td>
                                    <td className={`px-3 py-2 text-right ${getColumnClass('Payments', 'text-gray-900')}`}>
                                        {fmtMoney(data.payments.reduce((a, b) => a + b.IMPORTE, 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-medium"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default FileInspector;
