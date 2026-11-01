const VERSION='1a3463a8f1408286';
const PREFIX='lexicalspace-shell-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+VERSION;
const CORE=["./", "./index.html", "./assets/ls-loading-normalized.wav", "./assets/ls-loading.mp3", "./css/animations.css", "./css/main.css", "./css/no-script.css", "./js/core/context.js", "./js/core/firebase-config.js", "./js/core/firebase-sync.js", "./js/core/idb-manager.js", "./js/core/offline.js", "./js/core/sound-manager.js", "./js/features/activity.js", "./js/features/application.js", "./js/features/auth.js", "./js/features/entry.js", "./js/features/flashcard.js", "./js/features/library.js", "./js/features/loading-failsafe.js", "./js/features/loading.js", "./js/main.js", "./js/utils/helpers.js"];
const EXTERNAL=[
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@phosphor-icons/web',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);await cache.addAll(CORE);
  await Promise.allSettled(EXTERNAL.map(async url=>{
    const request=new Request(url,{mode:'no-cors'}),response=await fetch(request);
    if(response.ok||response.type==='opaque')await cache.put(request,response);
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url),scope=new URL(self.registration.scope);
  const local=url.origin===scope.origin&&url.pathname.startsWith(scope.pathname);
  const optional=EXTERNAL.some(item=>url.href.startsWith(item));
  if(!local&&!optional)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok||response.type==='opaque'){
        try{await cache.put(request,response.clone());}catch(error){console.warn('Could not cache resource:',error);}
      }
      return response;
    }catch(error){
      const cached=await cache.match(request,{ignoreSearch:local});
      if(cached)return cached;
      if(local&&request.mode==='navigate'&&(url.pathname===scope.pathname||url.pathname===scope.pathname+'index.html'))return (await cache.match('./index.html'))||Response.error();
      return Response.error();
    }
  })());
});
