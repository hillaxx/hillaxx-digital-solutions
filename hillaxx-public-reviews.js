/* HILLAXX dual-purpose public reviews script + offline service worker.
   The page script runs normally; when registered as a service worker it provides
   a small, conservative offline cache for public site assets and pages. */
if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
 const CACHE_NAME = 'hillaxx-public-shell-v2';
 const SHELL = [
  '/privacy-premium.html', '/terms-premium.html',
  '/client-reviews', '/client-reviews.html', '/portal.css', '/portal-config.js',
  '/hillaxx-public-reviews.js'
 ];
 const cacheable = response => response && response.status === 200 &&
  (response.type === 'basic' || response.type === 'default');
 self.addEventListener('install', event => {
  event.waitUntil((async () => {
   const cache = await caches.open(CACHE_NAME);
   await Promise.allSettled(SHELL.map(async path => {
    try { const response = await fetch(path, {cache:'reload'}); if (cacheable(response)) await cache.put(path, response); }
    catch (_) { /* One missing optional page must not block installation. */ }
   }));
   await self.skipWaiting();
  })());
 });
 self.addEventListener('activate', event => {
  event.waitUntil((async () => {
   const names = await caches.keys();
   await Promise.all(names.filter(name => name.startsWith('hillaxx-public-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)));
   await self.clients.claim();
  })());
 });
 self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/(?:api|auth|rest|storage|functions)(?:\/|$)/i.test(url.pathname)) return;
  if (request.mode === 'navigate') {
   event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request) || await cache.match(url.pathname === '/' ? '/index.html' : url.pathname);
    try {
     let response;
     if (cached) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      try { response = await fetch(request, {signal:controller.signal}); }
      finally { clearTimeout(timer); }
     } else {
      // On a visitor's first visit, do not impose a timeout that could make a slow
      // connection worse; let the initial page request complete normally.
      response = await fetch(request);
     }
     if (cacheable(response)) await cache.put(request, response.clone());
     return response.ok || !cached ? response : cached;
    } catch (_) {
     return cached || ((url.pathname === '/' || url.pathname === '/index.html') ? await cache.match('/index.html') : null) || new Response('This page is not saved for offline use. Reconnect to the internet and try again.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
   })());
   return;
  }
  if (!/\.(?:css|js|png|jpe?g|webp|avif|svg|woff2?|ttf|ico)$/i.test(url.pathname)) return;
  event.respondWith((async () => {
   const cache = await caches.open(CACHE_NAME);
   const cached = await cache.match(request);
   if (cached) return cached;
   try {
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
   } catch (_) {
    return new Response('', {status:504,statusText:'Offline'});
   }
  })());
 });
} else {
(()=>{
 const list=document.getElementById('hillaxx-review-list'),summary=document.getElementById('hillaxx-review-summary');
 if(!list||!summary)return;
 const cfg=window.HILLAXX_PORTAL_CONFIG;
 if(!cfg||!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){summary.textContent='Client reviews are temporarily unavailable because the review service is not configured.';list.replaceChildren();return;}
 const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
 const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
 const cardStyle='background:#fff;border:1px solid #e7eaf0;border-radius:18px;padding:24px;box-shadow:0 8px 28px rgba(16,24,40,.05)';
 async function load(){
  try{
   const {data,error}=await db.from('hillaxx_client_reviews').select('id,rating,review_text,display_name,show_name,featured,created_at').eq('status','approved').order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(6);
   if(error)throw error;
   list.replaceChildren();
   if(!data||!data.length){summary.textContent='Client reviews will be displayed here once approved.';list.append(el('p','', 'No published reviews yet.'));return;}
   const avg=data.reduce((a,r)=>a+Number(r.rating||0),0)/data.length;
   summary.textContent=`${avg.toFixed(1)} / 5 average across the latest ${data.length} approved review${data.length===1?'':'s'}`;
   for(const r of data){
    const card=el('article');card.setAttribute('style',cardStyle);
    const stars=el('div','',`${'★'.repeat(Math.max(0,Math.min(5,Number(r.rating))))}${'☆'.repeat(5-Math.max(0,Math.min(5,Number(r.rating))))}`);stars.style.cssText='color:#b78335;letter-spacing:3px;font-size:1.15rem;margin-bottom:12px';stars.setAttribute('aria-label',`${r.rating} out of 5 stars`);
    const quote=el('p','',r.review_text||'');quote.style.cssText='color:#475467;line-height:1.75;margin:0 0 18px;white-space:pre-wrap;overflow-wrap:anywhere';
    const by=el('p','',r.show_name&&r.display_name?r.display_name:'Verified client');by.style.cssText='font-weight:700;color:#172033;margin:0';
    card.append(stars,quote,by);list.append(card);
   }
  }catch(e){summary.textContent='Approved reviews could not be loaded. Please try again later.';list.replaceChildren();}
 }
 load();
 try{db.channel('hillaxx-public-reviews').on('postgres_changes',{event:'*',schema:'public',table:'hillaxx_client_reviews',filter:'status=eq.approved'},load).subscribe();}catch(_){ }
})();

}
