(()=>{
 const list=document.getElementById('hillaxx-review-list'),summary=document.getElementById('hillaxx-review-summary');
 if(!list||!summary)return;
 const cfg=window.HILLAXX_PORTAL_CONFIG;
 if(!cfg||!window.supabase){summary.textContent='Client reviews are temporarily unavailable.';list.replaceChildren();return;}
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
