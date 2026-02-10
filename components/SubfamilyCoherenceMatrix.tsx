
import React, { useState, useMemo } from 'react';
import { AggregatedData, ParsedSummary11008, ParsedSale11004 } from '../types';
import { fmtMoney, calculateTotalItemDiscount } from '../utils/validator';

interface Props {
  calculated: AggregatedData | null;
  summary: ParsedSummary11008 | null;
  files?: ParsedSale11004[];
}

const SubfamilyCoherenceMatrix: React.FC<Props> = ({ calculated, summary, files }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [discountDetail, setDiscountDetail] = useState<'sale' | 'return' | null>(null);

  // Process data for the table
  const matrixRows = useMemo(() => {
    if (!calculated || !summary) return [];

    // 1. Map Summary (11008) lines by Subfamily to handle duplicates/aggregation
    const summaryMap: Record<number, { 
        qtyV: number, grossV: number, discountV: number, 
        qtyD: number, grossD: number, discountD: number 
    }> = {};
    
    summary.aggregations.forEach(line => {
        const id = line.TIPO_SUBFAMILIA;
        if (!summaryMap[id]) {
            summaryMap[id] = { qtyV: 0, grossV: 0, discountV: 0, qtyD: 0, grossD: 0, discountD: 0 };
        }
        
        // Sales (Ventas - Positivas)
        summaryMap[id].qtyV += line.ARTICULOS_V;
        summaryMap[id].grossV += line.IMPBRUTO_VSFZ;
        summaryMap[id].discountV += line.IMPDESCUENTO_VSFZ;

        // Returns (Devoluciones - Negativas)
        summaryMap[id].qtyD += line.ARTICULOS_D;
        summaryMap[id].grossD += line.IMPBRUTO_DSFZ;
        summaryMap[id].discountD += line.IMPDESCUENTO_DSFZ;
    });

    // 2. Get all unique Subfamily IDs from both sources
    const allIds = new Set([
        ...Object.keys(calculated.groups).map(Number),
        ...Object.keys(summaryMap).map(Number)
    ]);

    // 3. Build comparison rows
    return Array.from(allIds).sort((a, b) => a - b).map(id => {
        const calc = calculated.groups[String(id)] || { 
            qtySale: 0, grossSale: 0, discountSale: 0, 
            qtyReturn: 0, grossReturn: 0, discountReturn: 0 
        };
        const sum = summaryMap[id] || { qtyV: 0, grossV: 0, discountV: 0, qtyD: 0, grossD: 0, discountD: 0 };

        // Check discrepancies (Sales)
        const diffQtyV = calc.qtySale - sum.qtyV;
        const diffGrossV = calc.grossSale - sum.grossV;
        const diffDescV = calc.discountSale - sum.discountV;

        // Check discrepancies (Returns)
        const diffQtyD = calc.qtyReturn - sum.qtyD;
        const diffGrossD = calc.grossReturn - sum.grossD;
        const diffDescD = calc.discountReturn - sum.discountD;

        // Tolerance of < 10 cents (< 100 units) for money fields
        // REMOVED discount check from row error logic as columns are hidden
        const hasError = 
            diffQtyV !== 0 || 
            Math.abs(diffGrossV) > 50 || // Gross usually has wider tolerance or similar
            diffQtyD !== 0 || 
            Math.abs(diffGrossD) > 50;

        return {
            id,
            calc,
            sum,
            diffs: { diffQtyV, diffGrossV, diffDescV, diffQtyD, diffGrossD, diffDescD },
            hasError
        };
    });
  }, [calculated, summary]);

  // Logic to get the list of files contributing to the selected discount sum
  const contributingFiles = useMemo(() => {
      if (!files || !discountDetail) return [];
      
      const targetType = discountDetail === 'sale' ? 1 : 2; // 1 = Normal Sale, 2 = Return
      
      return files
        .filter(f => f.header.TIPO_VENTA === targetType)
        .map(f => {
            // Recalculate discount based on lines to match Global Logic
            const fileTotalDiscount = f.items.reduce((acc, item) => {
                return acc + calculateTotalItemDiscount(item, f.header);
            }, 0);

            return {
                ticket: f.header.NUM_TICKET,
                fileName: f.fileName,
                discount: fileTotalDiscount
            };
        })
        .filter(f => Math.abs(f.discount) > 0) // Filter out files with 0 effective discount
        .sort((a, b) => parseInt(a.ticket) - parseInt(b.ticket));
  }, [files, discountDetail]);


  if (!calculated || !summary) return null;

  // Global Counters Logic
  const globalSaleDiff = calculated.global.countSale - summary.header.N_VENTAS;
  const globalReturnDiff = calculated.global.countReturn - summary.header.N_DEVOLUCIONES;
  
  // Ticket Range Logic (Strict comparison, no sums)
  const sumStart = parseInt(summary.header.CD_TICKET_I);
  const sumEnd = parseInt(summary.header.CD_TICKET_F);
  const calcStart = calculated.global.minTicket;
  const calcEnd = calculated.global.maxTicket;
  
  const isStartTicketError = sumStart !== calcStart;
  const isEndTicketError = sumEnd !== calcEnd;

  // Global Discount Logic (Headers vs Summary)
  // Tolerance: STRICT < 100 units
  const sumDescV = summary.header.IMPDESCUENTO_V;
  const calcDescV = calculated.global.totalDiscountSale;
  const diffDescV = calcDescV - sumDescV;
  const isDescVError = Math.abs(diffDescV) >= 100; // STRICT

  const sumDescD = summary.header.IMPDESCUENTO_D;
  const calcDescD = calculated.global.totalDiscountReturn;
  const diffDescD = calcDescD - sumDescD;
  const isDescDError = Math.abs(diffDescD) >= 100; // STRICT


  const isGlobalSaleError = globalSaleDiff !== 0;
  const isGlobalReturnError = globalReturnDiff !== 0;

  const errorCount = matrixRows.filter(r => r.hasError).length + 
                     (isGlobalSaleError ? 1 : 0) + 
                     (isGlobalReturnError ? 1 : 0) +
                     (isStartTicketError ? 1 : 0) + 
                     (isEndTicketError ? 1 : 0) +
                     (isDescVError ? 1 : 0) +
                     (isDescDError ? 1 : 0);

  return (
    <div className="mt-8 bg-white shadow sm:rounded-lg overflow-hidden relative">
      <div 
        className={`px-4 py-5 sm:px-6 flex items-center justify-between border-b border-gray-200 cursor-pointer transition-colors ${errorCount > 0 ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
            <h3 className={`text-lg leading-6 font-medium ${errorCount > 0 ? 'text-red-800' : 'text-gray-900'}`}>
            Cross-Reference Matrix (11004 vs 11008)
            </h3>
            {errorCount > 0 ? (
                <span className="ml-3 px-2 py-0.5 rounded text-xs bg-red-200 text-red-800 font-bold animate-pulse">
                    {errorCount} Issues Found
                </span>
            ) : (
                <span className="ml-3 px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                    Balanced
                </span>
            )}
        </div>
        <svg 
            className={`w-5 h-5 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div>
            {/* Global Transaction Verification Section */}
            <div className="px-4 py-4 bg-gray-50 border-b border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                
                {/* 1. N_VENTAS Check */}
                <div className={`p-4 rounded-lg border flex flex-col justify-between ${isGlobalSaleError ? 'bg-red-50 border-red-200' : 'bg-white border-green-200 shadow-sm'}`}>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Total Sales Docs</h4>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Summary:</span> <span className="font-mono font-bold text-gray-800">{summary.header.N_VENTAS}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Files:</span> <span className="font-mono font-bold text-gray-800">{calculated.global.countSale}</span>
                        </div>
                    </div>
                    {isGlobalSaleError && <div className="mt-2 text-right text-red-600 font-bold text-xs">Diff: {globalSaleDiff}</div>}
                </div>

                {/* 2. N_DEVOLUCIONES Check */}
                <div className={`p-4 rounded-lg border flex flex-col justify-between ${isGlobalReturnError ? 'bg-red-50 border-red-200' : 'bg-white border-green-200 shadow-sm'}`}>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Total Return Docs</h4>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Summary:</span> <span className="font-mono font-bold text-gray-800">{summary.header.N_DEVOLUCIONES}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Files:</span> <span className="font-mono font-bold text-gray-800">{calculated.global.countReturn}</span>
                        </div>
                    </div>
                    {isGlobalReturnError && <div className="mt-2 text-right text-red-600 font-bold text-xs">Diff: {globalReturnDiff}</div>}
                </div>

                {/* 3. Ticket Start Check (Boundary Check) */}
                <div className={`p-4 rounded-lg border flex flex-col justify-between ${isStartTicketError ? 'bg-red-50 border-red-200' : 'bg-white border-green-200 shadow-sm'}`}>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">First Ticket ID</h4>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Summary:</span> <span className="font-mono font-bold text-gray-800">{summary.header.CD_TICKET_I}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">First Found:</span> <span className="font-mono font-bold text-gray-800">{calculated.global.minTicket}</span>
                        </div>
                    </div>
                    {isStartTicketError ? (
                         <div className="mt-2 text-right text-red-600 font-bold text-xs">Mismatch</div>
                    ) : (
                         <div className="mt-2 text-right text-green-600 font-bold text-xs">Match</div>
                    )}
                </div>

                {/* 4. Ticket End Check (Boundary Check) */}
                <div className={`p-4 rounded-lg border flex flex-col justify-between ${isEndTicketError ? 'bg-red-50 border-red-200' : 'bg-white border-green-200 shadow-sm'}`}>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Last Ticket ID</h4>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Summary:</span> <span className="font-mono font-bold text-gray-800">{summary.header.CD_TICKET_F}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Last Found:</span> <span className="font-mono font-bold text-gray-800">{calculated.global.maxTicket}</span>
                        </div>
                    </div>
                    {isEndTicketError ? (
                         <div className="mt-2 text-right text-red-600 font-bold text-xs">Mismatch</div>
                    ) : (
                         <div className="mt-2 text-right text-green-600 font-bold text-xs">Match</div>
                    )}
                </div>

                {/* 5. Sales Discount Check (Header Total vs Summary) - INTERACTIVE */}
                <div 
                    className={`p-4 rounded-lg border flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${isDescVError ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-green-200 shadow-sm hover:bg-green-50'}`}
                    onClick={(e) => { e.stopPropagation(); setDiscountDetail('sale'); }}
                >
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Discount (Sales)</h4>
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Summary:</span> <span className="font-mono font-bold text-gray-800">{fmtMoney(sumDescV)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Lines Sum:</span> <span className="font-mono font-bold text-gray-800">{fmtMoney(calcDescV)}</span>
                        </div>
                    </div>
                    {isDescVError ? (
                         <div className="mt-2 text-right text-red-600 font-bold text-xs flex justify-end items-center gap-1">
                            Diff: {fmtMoney(diffDescV)} <span className="underline cursor-pointer">Analyze</span>
                         </div>
                    ) : (
                         <div className="mt-2 text-right text-green-600 font-bold text-xs">Match</div>
                    )}
                </div>

                {/* 6. Returns Discount Check (Header Total vs Summary) - INTERACTIVE */}
                <div 
                    className={`p-4 rounded-lg border flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${isDescDError ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-green-200 shadow-sm hover:bg-green-50'}`}
                    onClick={(e) => { e.stopPropagation(); setDiscountDetail('return'); }}
                >
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Discount (Returns)</h4>
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Summary:</span> <span className="font-mono font-bold text-gray-800">{fmtMoney(sumDescD)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Lines Sum:</span> <span className="font-mono font-bold text-gray-800">{fmtMoney(calcDescD)}</span>
                        </div>
                    </div>
                    {isDescDError ? (
                         <div className="mt-2 text-right text-red-600 font-bold text-xs flex justify-end items-center gap-1">
                            Diff: {fmtMoney(diffDescD)} <span className="underline cursor-pointer">Analyze</span>
                         </div>
                    ) : (
                         <div className="mt-2 text-right text-green-600 font-bold text-xs">Match</div>
                    )}
                </div>

            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                    <div className="border-b border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th rowSpan={2} className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider border-r sticky left-0 bg-gray-100">SubFam</th>
                                    <th colSpan={3} className="px-3 py-1 text-center font-medium text-gray-500 border-b border-r bg-blue-50">Sales (Venta Normal)</th>
                                    <th colSpan={3} className="px-3 py-1 text-center font-medium text-gray-500 border-b bg-amber-50">Returns (Devoluciones)</th>
                                </tr>
                                <tr>
                                    {/* Sales Columns */}
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 bg-blue-50">Units</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 bg-blue-50">Calc Gross</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 bg-blue-50 border-r border-gray-200">Sum Gross</th>

                                    {/* Returns Columns */}
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 bg-amber-50">Units</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 bg-amber-50">Calc Gross</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 bg-amber-50">Sum Gross</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {matrixRows.map((row) => {
                                    const isGrossVError = Math.abs(row.diffs.diffGrossV) > 50;
                                    const isQtyVError = row.diffs.diffQtyV !== 0;

                                    const isGrossDError = Math.abs(row.diffs.diffGrossD) > 50;
                                    const isQtyDError = row.diffs.diffQtyD !== 0;

                                    return (
                                        <tr key={row.id} className={row.hasError ? "bg-red-50" : "hover:bg-gray-50"}>
                                            <td className="px-3 py-2 whitespace-nowrap font-bold text-gray-700 border-r sticky left-0 bg-inherit">{row.id}</td>
                                            
                                            {/* --- Sales Data --- */}
                                            <td className={`px-2 py-2 text-right ${isQtyVError ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                                {row.calc.qtySale} <span className="text-[10px] text-gray-400">vs</span> {row.sum.qtyV}
                                            </td>
                                            {/* Gross */}
                                            <td className={`px-2 py-2 text-right font-mono ${isGrossVError ? 'text-red-600 font-bold bg-red-100' : 'text-blue-600'}`}>
                                                {fmtMoney(row.calc.grossSale)}
                                            </td>
                                            <td className={`px-2 py-2 text-right font-mono border-r border-gray-200 ${isGrossVError ? 'text-red-600 font-bold bg-red-100' : 'text-gray-600'}`}>
                                                {fmtMoney(row.sum.grossV)}
                                                {isGrossVError && <span className="block text-[10px] text-red-500">Diff: {fmtMoney(row.diffs.diffGrossV)}</span>}
                                            </td>

                                            {/* --- Returns Data --- */}
                                            <td className={`px-2 py-2 text-right ${isQtyDError ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                                {row.calc.qtyReturn} <span className="text-[10px] text-gray-400">vs</span> {row.sum.qtyD}
                                            </td>
                                            {/* Gross */}
                                            <td className={`px-2 py-2 text-right font-mono ${isGrossDError ? 'text-red-600 font-bold bg-red-100' : 'text-amber-600'}`}>
                                                {fmtMoney(row.calc.grossReturn)}
                                            </td>
                                            <td className={`px-2 py-2 text-right font-mono ${isGrossDError ? 'text-red-600 font-bold bg-red-100' : 'text-gray-600'}`}>
                                                {fmtMoney(row.sum.grossD)}
                                                {isGrossDError && <span className="block text-[10px] text-red-500">Diff: {fmtMoney(row.diffs.diffGrossD)}</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Discount Detail Modal */}
      {discountDetail && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm rounded-lg">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90%]">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                        {discountDetail === 'sale' ? 'Sales' : 'Returns'} Discount Analysis
                    </h3>
                    <button onClick={() => setDiscountDetail(null)} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="space-y-4 overflow-y-auto pr-1">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Source 1: Summary File (11008)</p>
                        <div className="flex justify-between items-baseline">
                             <span className="text-sm text-gray-600">Field: {discountDetail === 'sale' ? 'IMPDESCUENTO_V' : 'IMPDESCUENTO_D'}</span>
                             <span className="text-lg font-mono font-bold text-gray-800">
                                 {fmtMoney(discountDetail === 'sale' ? sumDescV : sumDescD)}
                             </span>
                        </div>
                    </div>

                    <div className="flex justify-center text-gray-400">
                        <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded-full">VS</span>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Source 2: Sum of Lines (11004)</p>
                            <span className="text-xs text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full font-bold">
                                {contributingFiles.length} Tickets
                            </span>
                        </div>
                        
                         <div className="flex justify-between items-baseline mb-2">
                             <span className="text-sm text-gray-600">Summing individual line discounts (D1+D2+D3 + Prorated Header)</span>
                             <span className="text-lg font-mono font-bold text-gray-800">
                                 {fmtMoney(discountDetail === 'sale' ? calcDescV : calcDescD)}
                             </span>
                        </div>

                        {/* Detailed List */}
                        <div className="bg-white rounded border border-purple-200 max-h-48 overflow-y-auto text-xs shadow-inner">
                            {contributingFiles.length === 0 ? (
                                <div className="p-4 text-center text-gray-400 italic">No tickets with discounts found for this category.</div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-100">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-2 py-1 text-left font-medium text-gray-500">Ticket</th>
                                            <th className="px-2 py-1 text-left font-medium text-gray-500">File</th>
                                            <th className="px-2 py-1 text-right font-medium text-gray-500">Line Sum</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {contributingFiles.map((f, i) => (
                                            <tr key={i} className="hover:bg-purple-50">
                                                <td className="px-2 py-1 text-gray-700 font-mono">{f.ticket}</td>
                                                <td className="px-2 py-1 text-gray-500 truncate max-w-[120px]" title={f.fileName}>{f.fileName}</td>
                                                <td className="px-2 py-1 text-right font-mono font-medium text-purple-700">{fmtMoney(f.discount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className={`p-3 rounded-lg border flex justify-between items-center ${
                        (discountDetail === 'sale' ? isDescVError : isDescDError) 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                        <span className="font-semibold text-gray-700">Difference</span>
                        <span className={`font-mono font-bold ${(discountDetail === 'sale' ? isDescVError : isDescDError) ? 'text-red-600' : 'text-green-600'}`}>
                            {fmtMoney(discountDetail === 'sale' ? diffDescV : diffDescD)}
                        </span>
                    </div>
                </div>

                <div className="mt-6 flex justify-end pt-2 border-t border-gray-100">
                    <button 
                        onClick={() => setDiscountDetail(null)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium py-2 px-4 rounded transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SubfamilyCoherenceMatrix;