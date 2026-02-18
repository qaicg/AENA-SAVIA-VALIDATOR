
import { defineConfig } from 'vite';
// Fix: Import Buffer from node:buffer to resolve TypeScript errors
import { Buffer } from 'node:buffer';
import { identifyTransactionType, parse11004, parse11008, parseSystemEvent } from './utils/parser';
import { aggregateSales, generateDiscountBreakdown, validateCoherence } from './utils/validator';
import { validateSyntaxAndSemantics } from './utils/syntaxValidator';
import { TransactionType } from './types';

/**
 * Parser minimalista para multipart/form-data 
 * Diseñado específicamente para archivos de texto AENA en el entorno de desarrollo.
 */
async function parseMultipartData(req: any) {
  return new Promise<{ name: string, content: string }[]>((resolve, reject) => {
    let chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
      const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;

      if (!boundary) return resolve([]);

      const boundaryStr = '--' + boundary;
      const parts = buffer.toString('binary').split(boundaryStr);
      const files: { name: string, content: string }[] = [];

      parts.forEach(part => {
        if (part.includes('filename=')) {
          // Extraer nombre del archivo
          const nameMatch = part.match(/filename="(.+?)"/);
          const name = nameMatch ? nameMatch[1] : 'file.txt';
          
          // Extraer contenido (después de los headers de la parte)
          const headerEndIndex = part.indexOf('\r\n\r\n');
          if (headerEndIndex !== -1) {
            let content = part.substring(headerEndIndex + 4);
            // Quitar el salto de línea final antes del siguiente boundary
            content = content.substring(0, content.lastIndexOf('\r\n'));
            files.push({ name, content });
          }
        }
      });
      resolve(files);
    });
    req.on('error', reject);
  });
}

export default defineConfig({
  server: {
    port: 5001,
    strictPort: true,
    host: true
  },
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env': {}
  },
  plugins: [
    {
      name: 'aena-server-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Interceptar solo nuestra ruta de API y método POST
          if (req.url?.startsWith('/api/v1/validate') && req.method === 'POST') {
            try {
              const uploadedFiles = await parseMultipartData(req);

              if (uploadedFiles.length === 0) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: "No se han subido archivos. Asegúrate de usar el campo 'files[]' con archivos .txt" }));
              }

              // Reutilizar la lógica de negocio existente
              const sales: any[] = [];
              let summary: any = null;
              let start: any = null;
              let end: any = null;

              uploadedFiles.forEach(file => {
                const type = identifyTransactionType(file.name, file.content);
                if (type === TransactionType.SALE) sales.push(parse11004(file.name, file.content));
                else if (type === TransactionType.SUMMARY) summary = parse11008(file.name, file.content);
                else if (type === TransactionType.START_DAY) start = parseSystemEvent(file.name, file.content, TransactionType.START_DAY);
                else if (type === TransactionType.END_DAY) end = parseSystemEvent(file.name, file.content, TransactionType.END_DAY);
              });

              if (!summary || sales.length === 0) {
                res.statusCode = 422;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ 
                    error: "Faltan archivos obligatorios para la validación.",
                    details: "Se requiere al menos un fichero 11004 (Ventas) y el 11008 (Resumen Z)." 
                }));
              }

              // Ejecutar proceso de auditoría
              const sortedSales = [...sales].sort((a, b) => parseInt(a.header.NUM_TICKET) - parseInt(b.header.NUM_TICKET));
              const syntaxResults = validateSyntaxAndSemantics(sortedSales);
              const aggregated = aggregateSales(sortedSales);
              const coherenceResults = validateCoherence(aggregated, summary, start, end, sortedSales);
              
              const allResults = [...syntaxResults, ...coherenceResults];
              const errors = allResults.filter(r => r.status === 'invalid').length;
              const warnings = allResults.filter(r => r.status === 'warning').length;

              const responseBody = {
                certified: errors === 0,
                timestamp: new Date().toISOString(),
                summary: {
                  totalFiles: uploadedFiles.length,
                  errors,
                  warnings
                },
                results: allResults,
                serverInfo: "SAVIA Native Backend (Vite-Node Middleware)"
              };

              // Responder al cliente
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*'); // Habilitar CORS para herramientas externas
              res.end(JSON.stringify(responseBody));

            } catch (error: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: "Internal Server Error", message: error.message }));
            }
          } else {
            next();
          }
        });
      }
    }
  ]
});
