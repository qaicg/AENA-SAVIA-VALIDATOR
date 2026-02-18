
const API_PATH = '/api/v1/validate';

// Escuchar peticiones de red
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === API_PATH) {
    if (event.request.method === 'POST') {
      event.respondWith(handlePostRequest(event.request));
    } else if (event.request.method === 'GET') {
      event.respondWith(handleGetRequest());
    }
  }
});

async function handleGetRequest() {
  const data = {
    status: "active",
    message: "SAVIA Virtual API (Service Worker Mode) is running.",
    instructions: "Use POST with multipart/form-data to validate files."
  };
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handlePostRequest(request) {
  try {
    // Necesitamos pasar la pelota a la ventana principal porque allí está la lógica de validación
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    if (clients.length === 0) {
      return new Response(JSON.stringify({ error: "La aplicación debe estar abierta en una pestaña para procesar la API." }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Leer el body (FormData)
    const formData = await request.formData();
    const filesData = [];
    
    // Extraer archivos para enviarlos por mensaje
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        filesData.push({
          name: value.name,
          content: await value.text(), // Enviamos el texto para simplificar el paso de mensaje
          type: value.type
        });
      }
    }

    // Enviar a la App y esperar respuesta
    const responsePromise = new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(event.data);
      
      clients[0].postMessage({
        type: 'API_VALIDATE_REQUEST',
        files: filesData
      }, [channel.port2]);
    });

    const result = await responsePromise;
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Service Worker Error: " + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
