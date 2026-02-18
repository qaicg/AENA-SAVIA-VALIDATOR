
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
  const apiEndpoint = `${currentOrigin}api/v1/validate`.replace('//api', '/api');

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
                <p className="text-slate-500">Utiliza el endpoint de validación para integrar SAVIA en tu flujo de CI/CD o software de gestión.</p>
            </div>
        </div>

        {/* ENDPOINT PRINCIPAL */}
        <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 mb-8">
          <div className="px-8 py-6 bg-slate-800/50 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">URL DE VALIDACIÓN (ENDPOINT)</span>
                <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg">POST</span>
                    <code className="text-white font-mono text-lg break-all">{apiEndpoint}</code>
                </div>
            </div>
            <button 
                onClick={() => navigator.clipboard.writeText(apiEndpoint)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center space-x-2 self-start md:self-center"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                <span>Copiar URL</span>
            </button>
          </div>
          
          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Parámetros de Entrada (Body)</h4>
                    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-500 border-b border-slate-700">
                                    <th className="text-left py-2 font-medium">Clave</th>
                                    <th className="text-left py-2 font-medium">Tipo</th>
                                    <th className="text-left py-2 font-medium">Requerido</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-300">
                                <tr className="border-b border-slate-700/50">
                                    <td className="py-3 font-mono text-indigo-400">files[]</td>
                                    <td className="py-3">File (Binary)</td>
                                    <td className="py-3 text-green-400 text-xs font-bold">SÍ</td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="mt-4 text-[11px] text-slate-500 italic">Nota: Debes incluir al menos un archivo 11008 y los 11004 correspondientes para una validación completa.</p>
                    </div>
                </div>

                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Ejemplo con cURL</h4>
                    <div className="bg-black/50 p-5 rounded-2xl border border-white/5 font-mono text-xs text-green-400 leading-relaxed overflow-x-auto">
                        # Subida de múltiples ficheros para validación cruzada<br/>
                        curl -X POST "{apiEndpoint}" \<br/>
                        &nbsp;&nbsp;-F "files[]=@T_11004_V01_S001_Z0001_N000001.txt" \<br/>
                        &nbsp;&nbsp;-F "files[]=@T_11008_V01_S001_Z0001.txt"
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Estructura de Respuesta (JSON)</h4>
                    <div className="bg-black/50 p-5 rounded-2xl border border-white/5 font-mono text-[11px] text-indigo-300 leading-relaxed overflow-x-auto h-[320px]">
{`{
  "certified": false,
  "timestamp": "2023-10-27T10:00:00Z",
  "summary": {
    "totalFiles": 12,
    "errors": 1,
    "warnings": 0
  },
  "results": [
    {
      "status": "invalid",
      "message": "Global Mismatch: Gross Sales",
      "details": [...]
    }
  ],
  "reportUrl": "${currentOrigin}?api_report=ey..."
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
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Simulador de Integración (Playground)</h3>
            <p className="text-slate-500">Prueba cómo respondería tu sistema al hacer la llamada POST.</p>
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
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{selectedFiles ? `${selectedFiles.length} archivos seleccionados` : 'Seleccionar archivos para el test'}</span>
                  <span className="text-xs text-slate-400 mt-1">Simula el payload de un formulario multipart</span>
              </label>
            </div>
            
            <button 
              onClick={handleTestApi}
              disabled={!selectedFiles || isLoading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-3"
            >
              {isLoading && <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              <span>Simular Llamada POST</span>
            </button>
          </div>

          <div className="relative">
             <div className="absolute top-0 right-0 p-3 flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
             </div>
             <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 font-mono text-[10px] overflow-auto h-[350px] shadow-2xl">
                {apiResponse ? (
                  <pre className="text-indigo-300 leading-relaxed">{JSON.stringify(apiResponse, null, 2)}</pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-center max-w-[200px]">La respuesta JSON del endpoint aparecerá aquí tras ejecutar el test.</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      </section>

      {/* GUIA RAPIDA INTEGRACION */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                  <span className="font-bold">1</span>
              </div>
              <h4 className="font-bold text-slate-800 mb-2">Prepara los datos</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Genera tus ficheros 11004 y 11008 desde tu TPV siguiendo la normativa AENA.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
                  <span className="font-bold">2</span>
              </div>
              <h4 className="font-bold text-slate-800 mb-2">Envía el POST</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Realiza una petición multipart/form-data al endpoint indicado arriba.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4">
                  <span className="font-bold">3</span>
              </div>
              <h4 className="font-bold text-slate-800 mb-2">Gestiona el Reporte</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Almacena el campo <code className="text-indigo-600">reportUrl</code> para dar acceso visual al equipo de auditoría.</p>
          </div>
      </section>
    </div>
  );
};

export default ApiDocs;
