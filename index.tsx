
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { runFullValidationProcess } from './utils/apiCore';

/**
 * VIRTUAL API INTERCEPTOR & EMERGENCY ROUTER
 */
const setupVirtualApi = () => {
    const apiPath = '/api/v1/validate';
    
    // --- 1. EMERGENCY ROUTER (Para cuando entras por la URL del navegador) ---
    // Si la URL actual es la de la API, devolvemos JSON y paramos la ejecución de React.
    if (window.location.pathname.includes(apiPath)) {
        const isGet = window.location.search === '' || !window.location.search.includes('api_report');
        
        // Si no es un reporte (que sí queremos ver en la UI), forzamos respuesta JSON
        if (isGet && !window.location.search.includes('api_report')) {
            document.body.innerHTML = ''; // Limpiamos el HTML
            const response = {
                status: "active",
                endpoint: apiPath,
                method_required: "POST",
                content_type: "multipart/form-data",
                message: "SAVIA Virtual API is running. Use POST to validate files.",
                documentation: window.location.origin + "/#api"
            };
            
            // Estilizamos para que parezca una respuesta de API real en el navegador
            const pre = document.createElement('pre');
            pre.style.padding = '20px';
            pre.style.background = '#1a1a1a';
            pre.style.color = '#00ff00';
            pre.style.fontFamily = 'monospace';
            pre.textContent = JSON.stringify(response, null, 2);
            document.body.appendChild(pre);
            document.body.style.background = '#1a1a1a';
            return true; // Indicamos que hemos interceptado la ruta
        }
    }

    // --- 2. FETCH INTERCEPTOR (Para llamadas programáticas) ---
    const originalFetch = window.fetch.bind(window);
    const virtualFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

        if (url.includes(apiPath)) {
            // Manejar GET (Información)
            if (init?.method === 'GET' || !init?.method) {
                return new Response(JSON.stringify({ 
                    error: "Method Not Allowed", 
                    message: "Use POST with multipart/form-data to validate files." 
                }), {
                    status: 405,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Manejar POST (Validación Real)
            if (init?.method === 'POST') {
                try {
                    if (!(init.body instanceof FormData)) {
                        throw new Error("La petición debe ser de tipo multipart/form-data");
                    }

                    const formData = init.body as FormData;
                    const files: File[] = [];
                    formData.forEach((value) => {
                        if (value instanceof File) files.push(value);
                    });

                    if (files.length === 0) {
                        return new Response(JSON.stringify({ error: "No se proporcionaron archivos (campo 'files[]' requerido)." }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    const result = await runFullValidationProcess(files);
                    return new Response(JSON.stringify(result), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (e: any) {
                    return new Response(JSON.stringify({ error: e.message || "Error interno procesando la validación" }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
        }
        return originalFetch(input, init);
    };

    try {
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: virtualFetch
        });
    } catch (e) {
        (window as any).fetch = virtualFetch;
    }
    return false;
};

// Si el router de emergencia interceptó la ruta, no montamos React
const intercepted = setupVirtualApi();

if (!intercepted) {
    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error("Could not find root element to mount to");
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
}
