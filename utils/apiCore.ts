
import { identifyTransactionType, parse11004, parse11008, parseSystemEvent } from './parser';
import { aggregateSales, generateDiscountBreakdown, validateCoherence } from './validator';
import { validateSyntaxAndSemantics } from './syntaxValidator';
import { TransactionType, ValidationResult, ApiResponse } from '../types';

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

  const allResults = [...syntaxResults, ...coherenceResults];
  const errors = allResults.filter(r => r.status === 'invalid').length;
  const warnings = allResults.filter(r => r.status === 'warning').length;

  // --- RECONSTRUCCIÓN DE URL (SOLUCIÓN AL 404) ---
  // Usamos la URL actual sin parámetros para evitar el 404 en servidores que no manejan SPA routing
  const baseUrl = window.location.href.split('?')[0];
  
  // Codificamos un estado mínimo para que el App.tsx pueda reconstruir la UI
  const reportPayload = {
    v: "1.0",
    summary: {
      totalFiles: files.length,
      errors,
      warnings,
      certified: errors === 0,
      timestamp: new Date().toISOString()
    },
    // Solo enviamos los nombres para la lista de archivos
    fileNames: files.map(f => f.name),
    // Los resultados de validación son lo más importante para la vista de "Overview"
    results: allResults,
    // Pasamos los datos agregados para los KPIs
    aggregated: aggregated
  };

  // Usamos encodeURIComponent y btoa para una URL segura
  const encodedData = btoa(JSON.stringify(reportPayload));
  const reportUrl = `${baseUrl}?api_report=${encodeURIComponent(encodedData)}`;

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
