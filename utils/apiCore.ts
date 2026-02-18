
import { identifyTransactionType, parse11004, parse11008, parseSystemEvent } from './parser';
import { aggregateSales, generateDiscountBreakdown, validateCoherence } from './validator';
import { validateSyntaxAndSemantics } from './syntaxValidator';
import { TransactionType, ValidationResult, ApiResponse } from '../types';

/**
 * Codificación de reportes (Lado cliente - Playground)
 * Nota: En el cliente no usamos compresión Gzip directamente para simplificar el Playground
 * pero minificamos claves para consistencia.
 */
const encodeReportForUrl = (obj: any): string => {
  const str = JSON.stringify(obj);
  const base64 = btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Procesa una lista de archivos y devuelve el resultado completo de la validación.
 */
export const runFullValidationProcess = async (files: File[]): Promise<any> => {
  const sales: any[] = [];
  let summary: any = null;
  let start: any = null;
  let end: any = null;

  for (const file of files) {
    const content = await file.text();
    const type = identifyTransactionType(file.name, content);

    if (type === TransactionType.SALE) sales.push(parse11004(file.name, content));
    else if (type === TransactionType.SUMMARY) summary = parse11008(file.name, content);
    else if (type === TransactionType.START_DAY) start = parseSystemEvent(file.name, content, TransactionType.START_DAY);
    else if (type === TransactionType.END_DAY) end = parseSystemEvent(file.name, content, TransactionType.END_DAY);
  }

  if (!summary || sales.length === 0) {
    throw new Error("Missing mandatory files (11004 and 11008 required).");
  }

  const sortedSales = [...sales].sort((a, b) => parseInt(a.header.NUM_TICKET) - parseInt(b.header.NUM_TICKET));
  const syntaxResults = validateSyntaxAndSemantics(sortedSales);
  const aggregated = aggregateSales(sortedSales);
  const coherenceResults = validateCoherence(aggregated, summary, start, end, sortedSales);
  const discountBreakdown = generateDiscountBreakdown(sortedSales);

  const allResults = [...syntaxResults, ...coherenceResults];
  
  const issuesOnly = allResults.filter(r => r.status !== 'valid');
  const errors = allResults.filter(r => r.status === 'invalid').length;
  const warnings = allResults.filter(r => r.status === 'warning').length;

  const baseUrl = window.location.origin + window.location.pathname;
  
  // Usar el nuevo mapeo minificado
  const minifiedPayload = {
    v: "1.2-legacy", // Marcamos como legacy para App.tsx si no está comprimido
    m: {
        f: files.length,
        e: errors,
        w: warnings,
        t: Date.now()
    },
    r: issuesOnly, 
    a: aggregated,
    s: summary, 
    d: discountBreakdown,
    o: sortedSales.map(s => ({ 
      n: s.fileName, 
      h: { 
          NUM_TICKET: s.header.NUM_TICKET, 
          HORA_REAL: s.header.HORA_REAL, 
          TIPO_VENTA: s.header.TIPO_VENTA,
          IMPBRUTO_T: s.header.IMPBRUTO_T 
      } 
    }))
  };

  const reportUrl = `${baseUrl}?api_report=${encodeReportForUrl(minifiedPayload)}`;

  return {
    certified: errors === 0,
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: files.length,
      errors,
      warnings
    },
    results: allResults,
    reportUrl
  };
};
