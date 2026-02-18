
import React, { useState } from 'react';

const ApiDocs: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestApi = async () => {
    if (!selectedFiles) return;
    setIsLoading(true);
    try {
      const files = Array.from(selectedFiles) as File[];
      const formData = new FormData();
      files.forEach(f => formData.append('files[]', f));

      const response = await fetch('/api/v1/validate', {
          method: 'POST',
          body: formData
      });
      
      const result = await response.json();
      setApiResponse(result);
    } catch (e: any) {
      setApiResponse({ error: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const currentOrigin = window.location.origin;
  const apiEndpoint = `${currentOrigin}/api/v1/validate`;

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <section>
        <div className="flex items-center space-x-4 mb-6">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            </div>
            <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Documentación de la API</h2>
                <p className="text-slate-500">Acceso programático y validación automática "Headless".</p>
            </div>
        </div>

        {/* INFO API NATIVA */}
        <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-r-2xl mb-8 shadow-sm">
            <div className="flex items-center mb-3">
                <svg className="w-6 h-6 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="text-green-800 font-bold">API Nativa Activada</h3>
            </div>
            <p className="text-sm text-green-700 leading-relaxed">
                Este validador expone una API real en el servidor. A diferencia de las versiones anteriores, <strong>no necesitas tener el navegador abierto</strong> para que las peticiones POST funcionen desde herramientas como Postman, Talend o scripts automáticos.
                <br/><br/>
                La respuesta incluye un campo <strong>reportUrl</strong>: un enlace directo que abre este Dashboard con todos los resultados de la auditoría cargados.
            </p>
        </div>

        {/* GUIA PASO A PASO TALEND */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm mb-12">
            <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Configuración en Talend / Postman</h3>
            </div>
            <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1">1</span>
                            <div>
                                <p className="font-bold text-sm">Endpoint</p>
                                <p className="text-xs text-slate-500">Usa <span className="text-indigo-600 font-bold">POST</span> en <code className="bg-slate-100 px-1">{apiEndpoint}</code></p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1">2</span>
                            <div>
                                <p className="font-bold text-sm">Body (Form-Data)</p>
                                <p className="text-xs text-slate-500">Envía los archivos bajo la clave <code className="text-indigo-600 font-bold">files[]</code>.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1">3</span>
                            <div>
                                <p className="font-bold text-sm">Visualización</p>
                                <p className="text-xs text-slate-500">Copia el <code className="text-green-600 font-bold">reportUrl</code> del JSON para ver el informe visual.</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-center">
                        <div className="text-center">
                            <div className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded-full mb-2 uppercase tracking-widest">Respuesta API</div>
                            <div className="text-left font-mono text-[10px] text-slate-400 space-y-1">
                                <div><span className="text-green-400">"certified":</span> true,</div>
                                <div><span className="text-green-400">"reportUrl":</span> "http://.../?api_report=..."</div>
                                <div className="pt-2 border-t border-slate-800 mt-2 italic text-slate-500 tracking-tighter">Acceso directo al dashboard</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* ENDPOINT PRINCIPAL */}
        <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 mb-8">
          <div className="px-8 py-6 bg-slate-800/50 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">URL DE VALIDACIÓN (NATIVA)</span>
                <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg">POST</span>
                    <code className="text-white font-mono text-lg break-all">{apiEndpoint}</code>
                </div>
            </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Parámetros</h4>
                    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-500 border-b border-slate-700">
                                    <th className="text-left py-2 font-medium">Clave</th>
                                    <th className="text-left py-2 font-medium">Tipo</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-300">
                                <tr className="border-b border-slate-700/50">
                                    <td className="py-3 font-mono text-indigo-400">files[]</td>
                                    <td className="py-3 italic">File (Binary)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Ejemplo cURL</h4>
                    <div className="bg-black/50 p-5 rounded-2xl border border-white/5 font-mono text-xs text-green-400 leading-relaxed overflow-x-auto">
                        curl -X POST "{apiEndpoint}" \<br/>
                        &nbsp;&nbsp;-F "files[]=@T_11004.txt"
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Esquema de Respuesta</h4>
                    <div className="bg-black/50 p-5 rounded-2xl border border-white/5 font-mono text-[11px] text-indigo-300 leading-relaxed overflow-x-auto h-[220px]">
{`{
  "certified": boolean,
  "summary": {
    "errors": number,
    "warnings": number
  },
  "results": [...],
  "reportUrl": "string (enlace al dashboard)"
}`}
                    </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLAYGROUND SECTION */}
      <section className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-xl shadow-slate-200/50">
        <div className="mb-10">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Playground (Petición Real)</h3>
            <p className="text-slate-500">Ejecuta la misma llamada que haría un sistema externo.</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-8 border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-all group">
              <input 
                type="file" 
                multiple 
                id="apiTestFiles"
                className="hidden"
                onChange={(e) => setSelectedFiles(e.target.files)}
              />
              <label htmlFor="apiTestFiles" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-all mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{selectedFiles ? `${selectedFiles.length} archivos` : 'Seleccionar archivos'}</span>
              </label>
            </div>
            
            <button 
              onClick={handleTestApi}
              disabled={!selectedFiles || isLoading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-3"
            >
              <span>Testear Endpoint</span>
            </button>
          </div>

          <div className="relative">
             <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 font-mono text-[10px] overflow-auto h-[250px] shadow-2xl">
                {apiResponse ? (
                  <div className="space-y-4">
                    {apiResponse.reportUrl && (
                        <div className="bg-green-500/20 border border-green-500/50 p-2 rounded text-[9px]">
                            <p className="text-green-400 font-bold mb-1 uppercase tracking-tighter">REPORT URL GENERADO:</p>
                            <a href={apiResponse.reportUrl} target="_blank" className="text-blue-400 underline break-all">{apiResponse.reportUrl}</a>
                        </div>
                    )}
                    <pre className="text-indigo-300">{JSON.stringify(apiResponse, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <p>La respuesta aparecerá aquí.</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ApiDocs;
