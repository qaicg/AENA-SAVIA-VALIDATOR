import React, { useState, useMemo } from 'react';
import { ParsedSale11004 } from '../types';
import { fmtMoney } from '../utils/validator';

interface Props {
  salesFiles: ParsedSale11004[];
}

interface ItemStats {
  code: string;
  subfamilies: Set<number>;
  prices: Set<number>; // Store unique unit prices (IMPVENTA / UDS)
  minPrice: number;
  maxPrice: number;
  totalUnits: number;
  occurrences: number;
  exampleTicket: string;
}

const ItemConsistencyCheck: React.FC<Props> = ({ salesFiles }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showOnlyIssues, setShowOnlyIssues] = useState(true);

  const itemsData = useMemo(() => {
    const map = new Map<string, ItemStats>();

    salesFiles.forEach(file => {
      file.items.forEach(item => {
        const code = item.CD_ARTICULO;
        
        // Calculate Unit Price (Base Amount / Units)
        // Handle potential division by zero just in case
        const unitPrice = item.UDS_A !== 0 ? Math.round((item.IMPVENTA_A / item.UDS_A) * 100) / 100 : 0;

        if (!map.has(code)) {
          map.set(code, {
            code,
            subfamilies: new Set(),
            prices: new Set(),
            minPrice: unitPrice,
            maxPrice: unitPrice,
            totalUnits: 0,
            occurrences: 0,
            exampleTicket: file.header.NUM_TICKET
          });
        }

        const stats = map.get(code)!;
        stats.subfamilies.add(item.TIPO_SUBFAMILIA);
        stats.prices.add(unitPrice);
        stats.minPrice = Math.min(stats.minPrice, unitPrice);
        stats.maxPrice = Math.max(stats.maxPrice, unitPrice);
        stats.totalUnits += item.UDS_A;
        stats.occurrences += 1;
      });
    });

    // Convert to array and sort
    // Priority: Multi-Subfamily > Multi-Price > Occurrences
    return Array.from(map.values()).sort((a, b) => {
        const aIssue = a.subfamilies.size > 1 ? 2 : a.prices.size > 1 ? 1 : 0;
        const bIssue = b.subfamilies.size > 1 ? 2 : b.prices.size > 1 ? 1 : 0;
        if (bIssue !== aIssue) return bIssue - aIssue;
        return b.occurrences - a.occurrences;
    });
  }, [salesFiles]);

  if (!salesFiles || salesFiles.length === 0) return null;

  const issuesCount = itemsData.filter(i => i.prices.size > 1 || i.subfamilies.size > 1).length;
  const filteredData = showOnlyIssues ? itemsData.filter(i => i.prices.size > 1 || i.subfamilies.size > 1) : itemsData;

  // If showing only issues but there are none, show all
  const dataToRender = (showOnlyIssues && issuesCount === 0 && isOpen) ? itemsData : filteredData;

  return (
    <div className="mt-8 bg-white shadow sm:rounded-lg overflow-hidden">
      <div 
        className={`px-4 py-5 sm:px-6 flex items-center justify-between border-b border-gray-200 cursor-pointer transition-colors ${issuesCount > 0 ? 'bg-amber-50 hover:bg-amber-100' : 'bg-gray-50 hover:bg-gray-100'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
            <h3 className={`text-lg leading-6 font-medium ${issuesCount > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
            Item Master Data Consistency
            </h3>
            {issuesCount > 0 ? (
                <span className="ml-3 px-2 py-0.5 rounded text-xs bg-amber-200 text-amber-900 font-bold">
                    {issuesCount} Inconsistencies Detected
                </span>
            ) : (
                <span className="ml-3 px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                    All Items Consistent
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
        <div className="flex flex-col">
            {issuesCount > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b flex justify-end">
                    <label className="inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="form-checkbox h-4 w-4 text-aena-green rounded border-gray-300 focus:ring-green-500"
                            checked={showOnlyIssues}
                            onChange={(e) => setShowOnlyIssues(e.target.checked)}
                        />
                        <span className="ml-2 text-sm text-gray-700">Show only items with variations</span>
                    </label>
                </div>
            )}
            
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase">Item Code</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase">SubFamilies</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase">Unit Price Range (Base)</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase">Total Sold</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase">Tickets</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {dataToRender.length === 0 ? (
                             <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">
                                    No inconsistent items found. Uncheck filter to see all items.
                                </td>
                             </tr>
                        ) : (
                            dataToRender.map((item) => {
                                const multiSubfam = item.subfamilies.size > 1;
                                const multiPrice = item.prices.size > 1;
                                
                                return (
                                    <tr key={item.code} className={multiSubfam || multiPrice ? "bg-amber-50" : "hover:bg-gray-50"}>
                                        <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900">
                                            {item.code}
                                            {multiSubfam && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-800 border border-red-200">MULTI-SUBFAM</span>}
                                            {multiPrice && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-200">VAR-PRICE</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {Array.from(item.subfamilies).join(', ')}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                                            {item.prices.size === 1 ? (
                                                <span>{fmtMoney(item.minPrice)}</span>
                                            ) : (
                                                <span className="text-amber-700 font-bold">
                                                    {fmtMoney(item.minPrice)} - {fmtMoney(item.maxPrice)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600">
                                            {item.totalUnits}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">
                                            {item.occurrences} <span className="text-[10px]">(e.g. {item.exampleTicket})</span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default ItemConsistencyCheck;