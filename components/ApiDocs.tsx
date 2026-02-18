
import React, { useState } from 'react';
import { runFullValidationProcess } from '../utils/apiCore';

const ApiDocs: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestApi = async () => {
    if (!selectedFiles) return;
    setIsLoading(true);
    try {
      const files = Array.from(selectedFiles) as File[];
      const result = await runFullValidationProcess(files);
      setApiResponse(result);
    } catch (e: any) {
      setApiResponse({ error: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const currentOrigin = window.location.origin + window.location.pathname;

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <section>
        <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">SAVIA API Portal</h2>
        <p className="text-slate-600 mb-8 max-w-3xl">
          Automatiza la validación de archivos 11004 y 11008. Nuestra API virtual procesa los datos localmente y devuelve un JSON detallado junto con una <strong>URL de reporte compartible</strong>.
        </p>

        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
          <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-green-500 text-white text-[10px] font-bold rounded">POST</span>
              <code className="text-slate-300 font-mono text-sm">{currentOrigin}api/v1/validate</code>
            </div>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Endpoint Virtual</span>
          </div>
          <div className="p-6 space-y-6">
            <div>
                <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Ejemplo de llamada (cURL)</h4>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-xs text-green-400 overflow-x-auto">
                    curl -X POST "{currentOrigin}api/v1/validate" \<br/>
                    &nbsp;&nbsp;-F "files[]=@T_11004_..." \<br/>
                    &nbsp;&nbsp;-F "files[]=@T_11008_..."
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Respuesta (JSON)</h4>
                    <pre className="bg-black/20 p-4 rounded-xl text-[10px] text-slate-300 border border-white/5 h-40 overflow-y-auto">
{`{
  "certified": false,
  "summary": { "errors": 2, "warnings": 0 },
  "reportUrl": "${currentOrigin}?api_report=ey..."
}`}
                    </pre>
                </div>
                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Estructura del Report Link</h4>
                    <div className="bg-slate-800/50 p-4 rounded-xl text-xs text-slate-400 border border-white/5 space-y-2">
                        <p>La propiedad <code className="text-indigo-400">reportUrl</code> es una URL de tipo GET que:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Contiene todo el estado de auditoría codificado.</li>
                            <li>Es 100% estática (no requiere base de datos).</li>
                            <li>Permite ver Matrix, Ops y Finance al instante.</li>
                        </ul>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-2 text-aena-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Probar en el Playground
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Carga archivos locales para ver el JSON que generaría la API y el enlace de reporte resultante.</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:border-aena-green transition-colors">
              <input 
                type="file" 
                multiple 
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-aena-green hover:file:bg-green-100"
                onChange={(e) => setSelectedFiles(e.target.files)}
              />
            </div>
            <button 
              onClick={handleTestApi}
              disabled={!selectedFiles || isLoading}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
            >
              {isLoading && <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              <span>Generar Llamada API</span>
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono text-[10px] overflow-auto max-h-[400px]">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
              <span className="text-slate-400 font-bold uppercase tracking-widest">Respuesta de la API</span>
              {apiResponse && <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${apiResponse.error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{apiResponse.error ? '500 ERROR' : '200 OK'}</span>}
            </div>
            {apiResponse ? (
              <pre className="text-slate-700">{JSON.stringify(apiResponse, null, 2)}</pre>
            ) : (
              <div className="text-slate-400 flex items-center justify-center h-full min-h-[100px] text-center px-8">
                Selecciona archivos y pulsa "Generar" para ver la respuesta aquí.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ApiDocs;
