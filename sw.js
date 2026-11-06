const CACHE='thomas-pubgolf-v30';
const SHELL=['./index.html','./styles.css?v=30','./app.js?v=30','./manifest.webmanifest','./assets/thomas-stickers.webp','./assets/scare-photo-1.webp','./assets/scare-photo-2.webp','./assets/scare-photo-3.webp','./assets/scare-photo-4.webp','./assets/scare-photo-5.webp'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(error=>console.warn('Offline-cache:',error)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith('thomas-pubgolf-')).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/sw.js')return;
 // Video requests may use Range headers; let Safari fetch native HTTP 206 responses.
 if(url.pathname.endsWith('.mp4'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy)).catch(()=>{});}
   return response;
  }).catch(async()=>await caches.match('./index.html')||Response.error()));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>{
  if(cached)return cached;
  return fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});}
   return response;
  });
 }));
});
