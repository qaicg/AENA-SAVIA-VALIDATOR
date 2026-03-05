
import { GoogleGenAI } from "@google/genai";
import { AggregatedData, ParsedSale11004, ParsedSummary11008, ValidationResult } from "../types";
import { fmtMoney } from "./validator";

const getApiKey = (): string | undefined => {
  const key = 
    (typeof process !== 'undefined' && (process.env.API_KEY || process.env.GEMINI_API_KEY)) ||
    (import.meta.env && (import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY));
  return key && key !== 'undefined' ? key : undefined;
};

export const analyzeDiscountMatrixError = async (
  type: 'sale' | 'return',
  summaryValue: number,
  calculatedValue: number,
  contributingFiles: { ticket: string, fileName: string, discount: number, breakdown?: any }[],
  summaryFile: ParsedSummary11008 | null,
  subfamId?: string
): Promise<string> => {
  const apiKey = getApiKey();
  
  console.log("AI Discount Analysis Triggered", { 
    hasApiKey: !!apiKey,
    type,
    subfamId 
  });

  if (!apiKey) {
    return "Error: No se ha configurado la clave API de Gemini. Por favor, asegúrate de que la clave esté disponible en el entorno (API_KEY o GEMINI_API_KEY) o selecciona una clave en el panel superior.";
  }

  const ai = new GoogleGenAI({ apiKey: apiKey as string });

  const systemInstruction = `
    Eres un auditor experto en control de calidad para la certificación AENA SAVIA POS. 
    Tu trabajo es depurar errores de descuentos en el archivo de resumen "11008" comparado con los tickets "11004".
    
    Reglas:
    1. Analiza la discrepancia matemática entre el total del resumen y la suma de los tickets.
    2. Identifica si el error parece ser un redondeo, un ticket faltante, o un error de cálculo en el prorrateo.
    3. Formato de moneda AENA: Enteros que representan "milésimas" (ej: 10€ = 10000).
    4. Responde siempre en ESPAÑOL, de forma técnica y concisa.
    5. IMPORTANTE: Explica cómo se llega al importe calculado de descuento para los tickets analizados, detallando el descuento de línea vs el descuento de cabecera prorrateado.
  `;

  const userPrompt = `
    Se ha detectado una discrepancia en los descuentos de ${type === 'sale' ? 'VENTAS' : 'DEVOLUCIONES'}${subfamId ? ` para la SUBFAMILIA ${subfamId}` : ''}.
    
    DATOS DEL RESUMEN (11008):
    Valor en Resumen: ${fmtMoney(summaryValue)} (${summaryValue} milésimas)
    
    DATOS CALCULADOS (Suma de Tickets 11004):
    Valor Calculado: ${fmtMoney(calculatedValue)} (${calculatedValue} milésimas)
    Diferencia: ${fmtMoney(calculatedValue - summaryValue)} (${calculatedValue - summaryValue} milésimas)
    
    MUESTRA DE TICKETS Y DESGLOSE DE CÁLCULO (Primeros 15):
    ${JSON.stringify(contributingFiles.slice(0, 15), null, 2)}
    
    Por favor:
    1. Analiza por qué ocurre esta diferencia.
    2. Explica el desglose del cálculo de descuento para los tickets de la muestra (cómo se suma el descuento de línea y el de cabecera).
    3. Indica si hay algún patrón de error (ej: redondeos sistemáticos de 1 milésima).
  `;

  try {
    console.log("Calling Gemini API...");
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.1,
        }
    });

    console.log("Gemini API Response Received");
    return response.text || "La IA no pudo generar un análisis detallado.";
  } catch (error: any) {
    console.error("AI Discount Analysis Failed", error);
    return `Error al conectar con la IA de análisis: ${error.message || 'Error desconocido'}`;
  }
};

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

  const apiKey = getApiKey();

  console.log("AI Error Analysis Triggered", { 
    hasApiKey: !!apiKey,
    errorType: criticalError.message 
  });

  if (!apiKey) {
    return "Error: No se ha configurado la clave API de Gemini.";
  }

  const ai = new GoogleGenAI({ apiKey: apiKey as string });

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
    console.log("Calling Gemini API for general error analysis...");
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.1,
        }
    });

    console.log("Gemini API Response Received (General)");
    // Fix: Access .text property directly (it is not a method).
    return response.text || "La IA no pudo generar un informe detallado en este momento.";
  } catch (error: any) {
    console.error("AI Analysis Failed", error);
    return `Error al conectar con la IA de análisis: ${error.message || 'Error desconocido'}`;
  }
};

export const chatWithGemini = async (
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  context: { results: ValidationResult[]; aggregatedData: AggregatedData | null; summary: ParsedSummary11008 | null }
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "Error: No se ha configurado la clave API de Gemini.";
  }
  const ai = new GoogleGenAI({ apiKey: apiKey as string });

  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `Eres un asistente de auditoría SAVIA. Contexto: ${JSON.stringify(context)}`,
    }
  });

  const response = await chat.sendMessage({ message });
  return response.text || "La IA no pudo generar una respuesta.";
};
