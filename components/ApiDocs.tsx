
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
                <p className="text-slate-500">Configuración avanzada para desarrolladores y herramientas de testing.</p>
            </div>
        </div>

        {/* ALERTA DE ERROR 404 (SOLUCIÓN) */}
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-2xl mb-8 shadow-sm">
            <div className="flex items-center mb-3">
                <svg className="w-6 h-6 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <h3 className="text-red-800 font-bold">¿Obtienes un error 404 en Talend/Postman?</h3>
            </div>
            <p className="text-sm text-red-700 leading-relaxed">
                Este validador utiliza una <strong>API Virtual</strong> basada en Service Workers. Las herramientas externas a veces no pueden "ver" esta API si no se ejecutan dentro del navegador donde la página está abierta. 
                <br/><br/>
                <strong>Para que funcione en Talend:</strong> Asegúrate de usar el <strong>Playground</strong> de esta página o asegúrate de que Talend esté instalado como extensión del navegador y la pestaña de la App esté activa.
            </p>
        </div>

        {/* GUIA PASO A PASO TALEND */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm mb-12">
            <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Configuración en Talend API Tester</h3>
            </div>
            <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1">1</span>
                            <div>
                                <p className="font-bold text-sm">Método y URL</p>
                                <p className="text-xs text-slate-500">Selecciona <span className="text-indigo-600 font-bold">POST</span> y pega <code className="bg-slate-100 px-1">{apiEndpoint}</code></p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1">2</span>
                            <div>
                                <p className="font-bold text-sm">Cabeceras (Headers)</p>
                                <p className="text-xs text-slate-500 text-red-600 font-medium">Borra cualquier cabecera 'Content-Type' manual.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1">3</span>
                            <div>
                                <p className="font-bold text-sm">Cuerpo (Body)</p>
                                <ul className="text-xs text-slate-500 list-disc list-inside mt-1">
                                    <li>Selecciona el tipo <span className="font-bold">Form</span> o <span className="font-bold">Multipart</span>.</li>
                                    <li>Nombre del campo: <code className="text-indigo-600 font-bold">files[]</code></li>
                                    <li>Tipo de campo: <span className="font-bold">File</span>.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-center">
                        <div className="text-center">
                            <div className="inline-block px-3 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full mb-2 uppercase tracking-widest">Vista Previa Config</div>
                            <div className="text-left font-mono text-[10px] text-slate-400 space-y-1">
                                <div><span className="text-indigo-400">KEY:</span> files[] <span className="text-slate-600">{"->"}</span> <span className="text-green-400">T_11004...txt</span></div>
                                <div><span className="text-indigo-400">KEY:</span> files[] <span className="text-slate-600">{"->"}</span> <span className="text-green-400">T_11008...txt</span></div>
                                <div className="pt-2 border-t border-slate-800 mt-2 italic text-slate-500">Content-Type: Auto-generated</div>
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
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">URL DE VALIDACIÓN (ENDPOINT)</span>
                <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg">POST</span>
                    <code className="text-white font-mono text-lg break-all">{apiEndpoint}</code>
                </div>
            </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Estructura Multipart</h4>
                    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-500 border-b border-slate-700">
                                    <th className="text-left py-2 font-medium">Clave Requerida</th>
                                    <th className="text-left py-2 font-medium">Contenido</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-300">
                                <tr className="border-b border-slate-700/50">
                                    <td className="py-3 font-mono text-indigo-400 italic font-bold">files[]</td>
                                    <td className="py-3">Ficheros AENA (.txt)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Ejemplo rápido cURL</h4>
                    <div className="bg-black/50 p-5 rounded-2xl border border-white/5 font-mono text-xs text-green-400 leading-relaxed overflow-x-auto">
                        curl -X POST "{apiEndpoint}" \<br/>
                        &nbsp;&nbsp;-F "files[]=@ticket.txt" \<br/>
                        &nbsp;&nbsp;-F "files[]=@resumen.txt"
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Respuesta Esperada</h4>
                    <div className="bg-black/50 p-5 rounded-2xl border border-white/5 font-mono text-[11px] text-indigo-300 leading-relaxed overflow-x-auto h-[220px]">
{`{
  "certified": false,
  "summary": { "errors": 1, ... },
  "reportUrl": "${currentOrigin}/?api_report=..."
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
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Playground (Llamada POST Real)</h3>
            <p className="text-slate-500">Prueba la API sin salir de esta herramienta.</p>
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
              <span>Ejecutar Petición POST</span>
            </button>
          </div>

          <div className="relative">
             <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 font-mono text-[10px] overflow-auto h-[250px] shadow-2xl">
                {apiResponse ? (
                  <pre className="text-indigo-300">{JSON.stringify(apiResponse, null, 2)}</pre>
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
