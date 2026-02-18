
import { GoogleGenAI } from "@google/genai";
import { AggregatedData, ParsedSale11004, ParsedSummary11008, ValidationResult } from "../types";

export const analyzeErrorWithGemini = async (
  results: ValidationResult[],
  salesFiles: ParsedSale11004[],
  summaryFile: ParsedSummary11008 | null,
  aggregatedData: AggregatedData | null
): Promise<string> => {
  
  // 1. Encontrar el error más crítico para analizar
  const criticalError = results.find(r => r.status === 'invalid') || results.find(r => r.status === 'warning');

  if (!criticalError) {
    return "No se encontraron errores críticos para analizar.";
  }

  // Fix: Obtained API key exclusively from process.env.API_KEY and use it directly per SDK guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  // 2. Preparar contexto basado en el tipo de error
  let contextData = "";
  let promptContext = "";

  const errMsg = criticalError.message.toLowerCase();

  if (errMsg.includes('ticket internal math') || errMsg.includes('mismatch')) {
    const contextStr = criticalError.details?.[0]?.context || "";
    const problemFile = salesFiles.find(f => contextStr.includes(f.fileName) || (f.header.NUM_TICKET && contextStr.includes(f.header.NUM_TICKET)));
    
    if (problemFile) {
        promptContext = `
        El usuario tiene un error de consistencia interna en un archivo individual.
        Archivo: ${problemFile.fileName}
        Error: ${criticalError.message}
        Detalles: ${JSON.stringify(criticalError.details)}
        `;
        contextData = `RAW CONTENT START:\n${problemFile.rawContent}\nRAW CONTENT END`;
    }
  } 
  else if (errMsg.includes('global') || errMsg.includes('summary')) {
      promptContext = `
      El usuario tiene una discrepancia global entre los archivos de ventas agregados (11004) y el archivo de resumen (11008).
      Error: ${criticalError.message}
      Detalles: ${JSON.stringify(criticalError.details)}
      
      Calculated Globals from 11004:
      Total Gross Sale: ${aggregatedData?.global.totalGrossSale}
      Total Net Sale: ${aggregatedData?.global.totalNetSale}
      Total Discount: ${aggregatedData?.global.totalDiscountSale}
      `;

      if (summaryFile) {
          const sampleSales = salesFiles.slice(0, 3).map(f => f.header);
          contextData = `
          SUMMARY FILE (11008) HEADER:
          ${JSON.stringify(summaryFile.header, null, 2)}
          
          SAMPLE SALES FILES (11004) HEADERS (First 3):
          ${JSON.stringify(sampleSales, null, 2)}
          `;
      }
  }
  else {
      promptContext = `Error: ${criticalError.message}\nDetails: ${JSON.stringify(criticalError.details)}`;
      contextData = "No specific raw file context extracted for this error type.";
  }

  // 3. Instrucciones del sistema y Prompt
  const systemInstruction = `
    Eres un auditor experto en control de calidad para la certificación AENA SAVIA POS. 
    Tu trabajo es depurar errores de validación en archivos separados por tuberías "11004" (Ticket) y "11008" (Resumen).
    
    Reglas:
    1. Analiza la discrepancia matemática basándote en los datos.
    2. Sugiere la causa probable según la normativa AENA.
    3. Formato de moneda AENA: Enteros que representan "milésimas" (ej: 10€ = 10000).
    4. Responde siempre en ESPAÑOL, de forma técnica y concisa.
  `;

  const userPrompt = `
    Contexto de error:
    ${promptContext}

    Datos crudos:
    ${contextData}

    Por favor, analiza estos datos y explica por qué ocurre este error técnico.
  `;

  try {
    // Fix: Using correct ai.models.generateContent pattern with Gemini 3 Flash model.
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.1,
        }
    });

    // Fix: Access .text property directly (it is not a method).
    return response.text || "La IA no pudo generar un informe detallado en este momento.";
  } catch (error) {
    console.error("AI Analysis Failed", error);
    return "Error al conectar con la IA de análisis. Verifica tu clave API y conexión.";
  }
};
