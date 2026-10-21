// Sin caché de cartones, marcas, tokens ni respuestas privadas de Wix.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
