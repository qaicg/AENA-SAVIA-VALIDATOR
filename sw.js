
// Este archivo ya no es necesario. La lógica de la API reside en vite.config.ts
// Se mantiene vacío para evitar errores 404 si el navegador tuviera una versión cacheada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
