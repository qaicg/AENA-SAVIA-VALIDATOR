
import { defineConfig } from 'vite';
import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';
import { identifyTransactionType, parse11004, parse11008, parseSystemEvent } from './utils/parser';
import { aggregateSales, generateDiscountBreakdown, validateCoherence } from './utils/validator';
import { validateSyntaxAndSemantics } from './utils/syntaxValidator';
import { TransactionType } from './types';

/**
 * Comprime y codifica el objeto en un formato seguro para URL (Gzip + Base64Url)
 * Esto reduce el tamaño de la URL hasta en un 80%, evitando errores 400 del servidor.
 */
function encodeReport(obj: any): string {
  const json = JSON.stringify(obj);
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf-8'));
  return compressed.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Parser minimalista para multipart/form-data 
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
          const nameMatch = part.match(/filename="(.+?)"/);
          const name = nameMatch ? nameMatch[1] : 'file.txt';
          const headerEndIndex = part.indexOf('\r\n\r\n');
          if (headerEndIndex !== -1) {
            let content = part.substring(headerEndIndex + 4);
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
          if (req.url?.startsWith('/api/v1/validate') && req.method === 'POST') {
            try {
              const uploadedFiles = await parseMultipartData(req);

              if (uploadedFiles.length === 0) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: "No files uploaded." }));
              }

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
                return res.end(JSON.stringify({ error: "Missing mandatory 11004 or 11008 files." }));
              }

              const sortedSales = [...sales].sort((a, b) => parseInt(a.header.NUM_TICKET) - parseInt(b.header.NUM_TICKET));
              const syntaxResults = validateSyntaxAndSemantics(sortedSales);
              const aggregated = aggregateSales(sortedSales);
              const coherenceResults = validateCoherence(aggregated, summary, start, end, sortedSales);
              const discountBreakdown = generateDiscountBreakdown(sortedSales);
              
              const allResults = [...syntaxResults, ...coherenceResults];
              const issuesOnly = allResults.filter(r => r.status !== 'valid');
              const errorsCount = allResults.filter(r => r.status === 'invalid').length;
              const warningsCount = allResults.filter(r => r.status === 'warning').length;

              // Generar Report URL con Payload Minificado
              const host = req.headers.host || 'localhost:5001';
              const protocol = req.headers['x-forwarded-proto'] || 'http';
              const baseUrl = `${protocol}://${host}/`;

              const minifiedPayload = {
                v: "1.3", // Versión Gzip
                m: { // Meta
                    f: uploadedFiles.length,
                    e: errorsCount,
                    w: warningsCount,
                    t: Date.now()
                },
                r: issuesOnly, // Solo discrepancias para ahorrar espacio
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

              const reportUrl = `${baseUrl}?api_report=${encodeReport(minifiedPayload)}`;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                certified: errorsCount === 0,
                timestamp: new Date().toISOString(),
                summary: {
                  totalFiles: uploadedFiles.length,
                  errors: errorsCount,
                  warnings: warningsCount
                },
                results: allResults,
                reportUrl,
                serverInfo: "SAVIA Native Backend (Vite-Node Compressed)"
              }));

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
