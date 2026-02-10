import React, { useState, useMemo } from 'react';
import { ParsedSale11004 } from '../types';

interface Props {
  files: ParsedSale11004[];
}

interface SequenceRow {
  type: 'TICKET' | 'GAP';
  ticketNum: number;
  gapSize?: number; // Only for GAP
  file?: ParsedSale11004; // Only for TICKET
  timeError?: boolean; // If time is earlier than previous
  duplicate?: boolean; // If ticket number exists multiple times
}

const SequenceTimeAnalysis: React.FC<Props> = ({ files }) => {
  const [isOpen, setIsOpen] = useState(false);

  const { rows, stats } = useMemo(() => {
    if (!files || files.length === 0) return { rows: [], stats: { gaps: 0, timeErrors: 0, duplicates: 0 } };

    // 1. Sort files by Ticket Number strictly
    const sorted = [...files].sort((a, b) => {
        return parseInt(a.header.NUM_TICKET) - parseInt(b.header.NUM_TICKET);
    });

    const result: SequenceRow[] = [];
    let gaps = 0;
    let timeErrors = 0;
    let duplicates = 0;

    // Helper to parse "HH:MM:SS" or "HH:MM" to minutes for comparison
    const parseTime = (t: string) => {
        if (!t) return 0;
        const parts = t.split(':').map(Number);
        return parts[0] * 60 + (parts[1] || 0);
    };

    let prevTicketNum = -1;
    let prevTimeVal = -1;

    sorted.forEach((file) => {
        const currentTicket = parseInt(file.header.NUM_TICKET);
        const currentTimeVal = parseTime(file.header.HORA_REAL);

        // Check for Duplicates
        if (currentTicket === prevTicketNum) {
            duplicates++;
            result.push({
                type: 'TICKET',
                ticketNum: currentTicket,
                file: file,
                duplicate: true,
                timeError: false // irrelevant if dup
            });
            return; // Skip gap/time check for duplicate line
        }

        // Check for Gaps
        if (prevTicketNum !== -1 && currentTicket > prevTicketNum + 1) {
            const missingCount = currentTicket - prevTicketNum - 1;
            gaps += missingCount;
            result.push({
                type: 'GAP',
                ticketNum: prevTicketNum + 1, // Start of gap
                gapSize: missingCount
            });
        }

        // Check for Time Inversion (Time Travel)
        // Only check if we are in the same date (Simple check, assumes files are roughly same day or handled externally)
        let isTimeError = false;
        if (prevTimeVal !== -1 && currentTimeVal < prevTimeVal) {
             // Allow small tolerance? No, POS logs should be strict.
             isTimeError = true;
             timeErrors++;
        }

        result.push({
            type: 'TICKET',
            ticketNum: currentTicket,
            file: file,
            timeError: isTimeError
        });

        prevTicketNum = currentTicket;
        prevTimeVal = currentTimeVal;
    });

    return { rows: result, stats: { gaps, timeErrors, duplicates } };
  }, [files]);

  if (!files || files.length === 0) return null;

  const hasIssues = stats.gaps > 0 || stats.timeErrors > 0 || stats.duplicates > 0;

  return (
    <div className="mt-8 bg-white shadow sm:rounded-lg overflow-hidden">
      <div 
        className={`px-4 py-5 sm:px-6 flex items-center justify-between border-b border-gray-200 cursor-pointer transition-colors ${hasIssues ? 'bg-orange-50 hover:bg-orange-100' : 'bg-gray-50 hover:bg-gray-100'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
            <h3 className={`text-lg leading-6 font-medium ${hasIssues ? 'text-orange-800' : 'text-gray-900'}`}>
            Operational Sequence & Timing
            </h3>
            {hasIssues ? (
                <div className="flex space-x-2 ml-3">
                    {stats.gaps > 0 && <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 font-bold">{stats.gaps} Gaps</span>}
                    {stats.duplicates > 0 && <span className="px-2 py-0.5 rounded text-xs bg-red-800 text-white font-bold">{stats.duplicates} Dups</span>}
                    {stats.timeErrors > 0 && <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800 font-bold">{stats.timeErrors} Time Inversions</span>}
                </div>
            ) : (
                <span className="ml-3 px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                    Sequence Perfect
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
        <div className="max-h-96 overflow-y-auto">
             <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Ticket #</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Time (Hora Real)</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((row, idx) => {
                        if (row.type === 'GAP') {
                            return (
                                <tr key={`gap-${idx}`} className="bg-gray-100 border-2 border-dashed border-red-300">
                                    <td className="px-4 py-3 font-bold text-red-600 tracking-wider">
                                        MISSING SEQ
                                    </td>
                                    <td colSpan={3} className="px-4 py-3 text-red-500 italic">
                                        Gap of {row.gapSize} tickets detected (from {row.ticketNum} to {row.ticketNum + (row.gapSize || 1) - 1})
                                    </td>
                                    <td className="px-4 py-3 font-bold text-red-600 text-center">GAP</td>
                                </tr>
                            );
                        }

                        // Ticket Row
                        const f = row.file!;
                        return (
                            <tr key={`t-${idx}`} className={row.duplicate ? 'bg-red-50' : row.timeError ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                                <td className="px-4 py-2 font-mono text-gray-900 font-medium">
                                    {row.ticketNum}
                                </td>
                                <td className={`px-4 py-2 font-mono ${row.timeError ? 'text-orange-700 font-bold' : 'text-gray-600'}`}>
                                    {f.header.HORA_REAL}
                                    {row.timeError && <span className="ml-2 text-[10px] uppercase tracking-wide">⚠ Time Travel</span>}
                                </td>
                                <td className="px-4 py-2 text-gray-600">
                                    {f.header.TIPO_VENTA === 1 ? 'Sale' : 'Return'}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-gray-600">
                                    {(f.header.IMPBRUTO_T / 1000).toFixed(2)}
                                </td>
                                <td className="px-4 py-2">
                                    {row.duplicate ? (
                                        <span className="text-red-600 font-bold text-[10px] border border-red-200 bg-red-100 px-1 rounded">DUPLICATE</span>
                                    ) : row.timeError ? (
                                        <span className="text-orange-600 font-bold text-[10px] border border-orange-200 bg-orange-100 px-1 rounded">SEQUENCE ERR</span>
                                    ) : (
                                        <span className="text-green-600 text-[10px] font-medium">OK</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
             </table>
        </div>
      )}
    </div>
  );
};

export default SequenceTimeAnalysis;