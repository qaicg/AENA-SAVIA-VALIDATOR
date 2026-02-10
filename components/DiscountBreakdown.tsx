
import React, { useState, useMemo } from 'react';
import { FileDiscountBreakdown } from '../types';
import { fmtMoney } from '../utils/validator';

interface Props {
  data: FileDiscountBreakdown[];
}

type GroupMode = 'file' | 'subfamily';

const DiscountBreakdown: React.FC<Props> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(true); // Default open to see results immediately
  const [groupMode, setGroupMode] = useState<GroupMode>('subfamily'); // Default to subfamily to answer specific questions like "Where does Subfam X come from?"

  if (!data || data.length === 0) return null;

  // 1. Process Data for File View
  const filesWithDiscounts = useMemo(() => {
    return data.filter(file => 
      file.subFamilies.some(sf => sf.discount > 0)
    );
  }, [data]);

  // 2. Process Data for Subfamily View
  const subfamilyData = useMemo(() => {
    const map = new Map<number, {
        id: number,
        totalDiscountSale: number,
        totalDiscountReturn: number,
        items: {
            ticket: string,
            fileName: string,
            isReturn: boolean,
            base: number,
            discount: number,
            gross: number
        }[]
    }>();

    data.forEach(file => {
        file.subFamilies.forEach(sf => {
            if (sf.discount > 0) {
                if (!map.has(sf.id)) {
                    map.set(sf.id, { id: sf.id, totalDiscountSale: 0, totalDiscountReturn: 0, items: [] });
                }
                const entry = map.get(sf.id)!;
                
                if (file.isReturn) {
                    entry.totalDiscountReturn += sf.discount;
                } else {
                    entry.totalDiscountSale += sf.discount;
                }

                entry.items.push({
                    ticket: file.ticketNum,
                    fileName: file.fileName,
                    isReturn: file.isReturn,
                    base: sf.base,
                    discount: sf.discount,
                    gross: sf.gross
                });
            }
        });
    });

    return Array.from(map.values()).sort((a, b) => a.id - b.id);
  }, [data]);

  const totalDiscountValue = subfamilyData.reduce((acc, curr) => acc + curr.totalDiscountSale + curr.totalDiscountReturn, 0);

  if (filesWithDiscounts.length === 0) {
      return (
          <div className="mt-8 bg-white shadow rounded-lg p-6 text-center text-gray-500">
              No discounts found in any loaded sales files.
          </div>
      )
  }

  return (
    <div className="mt-8 bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
      <div 
        className="px-4 py-4 sm:px-6 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div 
            className="flex items-center cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
        >
            <div>
                <h3 className="text-lg leading-6 font-bold text-gray-900">
                Discount Logic Tracer (Calculated Actuals)
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    Trace where the "Actual" values come from by summing individual 11004 lines (Line + Prorated Header).
                </p>
            </div>
            <span className="ml-3 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 font-mono self-start sm:self-center">
                Total: {fmtMoney(totalDiscountValue)}
            </span>
             <svg 
                className={`ml-2 w-5 h-5 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>

        {isOpen && (
            <div className="flex bg-gray-200 p-1 rounded-lg self-start sm:self-auto">
                <button
                    onClick={() => setGroupMode('subfamily')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${groupMode === 'subfamily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                    By SubFamily
                </button>
                <button
                    onClick={() => setGroupMode('file')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${groupMode === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                    By Ticket/File
                </button>
            </div>
        )}
      </div>

      {isOpen && (
        <div className="bg-white max-h-[600px] overflow-y-auto">
          
          {/* VIEW: BY SUBFAMILY */}
          {groupMode === 'subfamily' && (
              <ul className="divide-y divide-gray-100">
                  {subfamilyData.map(group => (
                      <li key={group.id} className="p-0">
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                              <span className="font-bold text-gray-700">SubFamily {group.id}</span>
                              <div className="text-xs space-x-3">
                                  {group.totalDiscountSale > 0 && <span className="text-blue-600 font-medium">Sales Disc: {fmtMoney(group.totalDiscountSale)}</span>}
                                  {group.totalDiscountReturn > 0 && <span className="text-amber-600 font-medium">Returns Disc: {fmtMoney(group.totalDiscountReturn)}</span>}
                              </div>
                          </div>
                          
                          <table className="min-w-full text-xs divide-y divide-gray-100">
                              <thead className="bg-white">
                                  <tr>
                                      <th className="px-4 py-2 text-left font-medium text-gray-500">Ticket</th>
                                      <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                                      <th className="px-4 py-2 text-right font-medium text-gray-500">Base</th>
                                      <th className="px-4 py-2 text-right font-medium text-gray-500">Discount Amount</th>
                                      <th className="px-4 py-2 text-left font-medium text-gray-400">Source File</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                  {group.items.map((item, idx) => (
                                      <tr key={idx} className={item.isReturn ? "bg-amber-50/30 hover:bg-amber-50" : "hover:bg-gray-50"}>
                                          <td className="px-4 py-2 font-mono text-gray-700">{item.ticket}</td>
                                          <td className="px-4 py-2">
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.isReturn ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                  {item.isReturn ? 'Return' : 'Sale'}
                                              </span>
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-500">{fmtMoney(item.base)}</td>
                                          <td className={`px-4 py-2 text-right font-bold font-mono ${item.isReturn ? 'text-amber-700' : 'text-blue-700'}`}>
                                              {fmtMoney(item.discount)}
                                          </td>
                                          <td className="px-4 py-2 text-gray-400 truncate max-w-xs" title={item.fileName}>{item.fileName}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </li>
                  ))}
              </ul>
          )}

          {/* VIEW: BY FILE */}
          {groupMode === 'file' && (
            <ul className="divide-y divide-gray-200">
                {filesWithDiscounts.map((file, idx) => (
                <li key={idx} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between mb-2">
                        <span className="font-medium text-gray-900 text-sm">
                            Ticket: {file.ticketNum} <span className="text-gray-500 font-normal">({file.fileName})</span>
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${file.isReturn ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                            {file.isReturn ? 'Return' : 'Sale'}
                        </span>
                    </div>
                    
                    <table className="min-w-full text-xs">
                        <thead className="bg-gray-100 text-gray-500">
                            <tr>
                                <th className="px-2 py-1 text-left">SubFamily</th>
                                <th className="px-2 py-1 text-right">Base Amount (Venta)</th>
                                <th className="px-2 py-1 text-right">Discount (Calc)</th>
                                <th className="px-2 py-1 text-right">Final Amount (Bruto)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {file.subFamilies.filter(sf => sf.discount > 0).map(sf => (
                                <tr key={sf.id}>
                                    <td className="px-2 py-1 text-gray-700">{sf.id}</td>
                                    <td className="px-2 py-1 text-right text-gray-600 font-medium">{fmtMoney(sf.base)}</td>
                                    <td className="px-2 py-1 text-right font-mono text-blue-600 font-medium">
                                        {fmtMoney(sf.discount)}
                                    </td>
                                    <td className="px-2 py-1 text-right text-gray-600">{fmtMoney(sf.gross)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscountBreakdown;
