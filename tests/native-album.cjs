// Fixtures below use dummy credentials and mock responses; no network requests.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const script=fs.readFileSync(path.join(__dirname,'..','hpoi-exhobby.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8'));
assert(script.startsWith('// Hpoi + EXHOBBY native album v3.7.0'));
assert.equal(pkg.version,'3.7.0');
const NS='HPOI_EXHOBBY_NATIVE_V2:', A=13021283, B=13021284, C=13021285;
const items={[A]:74515,[B]:74516,[C]:74517};
const rows=Object.fromEntries([[A,45],[B,27],[C,0]].map(([id,n])=>[id,Array.from({length:n},(_,i)=>({id:600000+i,path:'2026/09/'+id+'-'+i+'.jpg'}))]));
function htmlRows(id,list){return '<title>Gallery</title><script>query.item="'+id+'";</script>'+list.slice(0,20).map(r=>'<figure><img src="https://res.e39x.com/pic/s/'+r.path+'"></figure>').join('');}
function html(id){return htmlRows(id,rows[id]);}
const json=v=>({statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify(v)});
const seedAlbum={id:12345678,itemId:214102,itemType:'album',categoryId:8,name:'Normal',picCount:2,cover:'normal.jpg',user:{id:1,nickname:'Real author'}};
function albumFor(id){const d=id-A;return {...seedAlbum,id:seedAlbum.id+d*10,itemId:seedAlbum.itemId+d*10};}
function secondAlbumFor(id){const d=id-A;return {...seedAlbum,id:12345778+d*10,itemId:214202+d*10,name:'Normal 2',cover:'normal-2.jpg'};}
function scopedAlbumRows(itemId){
 for(const id of [A,B,C]){
  if(itemId===albumFor(id).itemId)return rows[id].slice(0,Math.min(12,rows[id].length));
  if(itemId===secondAlbumFor(id).itemId)return rows[id].slice(12,Math.min(20,rows[id].length));
 }
 return [];
}
function harness(){
  const prefs=new Map(),logs=[],calls=[],notices=[];
 prefs.set(NS+'browser-session',JSON.stringify({cookie:'EXHOBBY_BROWSER_COOKIE',agent:'Safari fixture',time:Date.now()}));
 prefs.set(NS+'seed:album/detail',JSON.stringify({p:{id:'214102'},album:seedAlbum}));
 prefs.set(NS+'seed:pic/list/relate-v2',JSON.stringify({p:{itemId:'214102',itemType:'album',page:'1',pageSize:'20'},picture:{id:2,itemId:3,itemType:'pic',categoryId:6,path:'normal.jpg'},row:{id:2,rank:1,subType:7,pictureInfo:{id:2,itemId:3,itemType:'pic',categoryId:6,path:'normal.jpg'}}}));
  let failPage=0, failItem=0, ageGate=0, barkFails=false;
  async function fetch(o){
   calls.push(o);
   if(o.url.startsWith('https://api.day.app/'))return barkFails?{statusCode:503}:json({code:200});
  assert.equal(o.headers.Cookie,'EXHOBBY_BROWSER_COOKIE');
  assert.equal(o.headers['User-Agent'],'Safari fixture');
  assert(o.url.startsWith('https://www.exhobby.net/'));
  assert(!JSON.stringify(o).includes('HPOI_PRIVATE_TOKEN'));
  const u=new URL(o.url);
  if(u.pathname==='/get/pic'){
   const itemType=u.searchParams.get('itemType');
   const itemId=Number(u.searchParams.get('itemId'));
   if(itemType==='album'){
    const scoped=scopedAlbumRows(itemId);
    if(!scoped.length)return json({map:{list:[]}});
    return json({map:{list:scoped.slice(0,6),url:'https://www.exhobby.net/picture?link=A_'+itemId}});
   }
   const id=u.searchParams.has('id')?Number(u.searchParams.get('id')):Number(Object.keys(items).find(k=>items[k]===itemId));
   assert(items[id]);
   if(!rows[id].length)return json({map:{list:[]}});
   return json({map:{list:rows[id].slice(0,6),url:'https://www.exhobby.net/picture?link=G_'+id}});
  }
   if(u.pathname==='/picture'){
    const link=String(u.searchParams.get('link')||'');
    if(link.startsWith('A_')){
      const itemId=Number(link.slice(2)),scoped=scopedAlbumRows(itemId);
      return{statusCode:200,body:htmlRows(itemId,scoped)};
    }
    const id=Number(link.slice(2));
    if(ageGate===-id)return{statusCode:403,body:'<div class="cf-turnstile">Browser verification</div>'};
    return{statusCode:200,body:ageGate===id?'<h1>年齡提醒！</h1>':html(id)};
   }
  const id=Number(u.pathname.split('/')[2]),p=new URLSearchParams(o.body),page=Number(p.get('page'));
  assert.equal(Number(p.get('item')),id);assert(page>=2);
  if(id===failItem&&page===failPage)return{statusCode:200,headers:{'Content-Length':'0'}};
  const source=rows[id]||scopedAlbumRows(id);
  return json(source.slice((page-1)*20,page*20));
 }
 function run(req,res){
  return new Promise((resolve,reject)=>{
    let done=0;const env={$request:req,$prefs:{valueForKey:k=>prefs.get(k),setValueForKey:(v,k)=>{prefs.set(k,v);return true;},removeValueForKey:k=>prefs.delete(k)},$notify:(...a)=>notices.push(a),
    $task:{fetch},console:{log:s=>logs.push(s)},setTimeout,clearTimeout,$done:v=>{assert.equal(++done,1);resolve(v);}};
   if(res!==undefined)env.$response=res;
   try{vm.runInNewContext(script,env,{timeout:2000})}catch(e){reject(e)}
  });
 }
 let n=1;
 async function begin(endpoint,body){
  const req={url:'https://www.hpoi.net.cn/api/'+endpoint+'?platform=ios',method:'POST',sessionIndex:n++,body,headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'HPOI_PRIVATE_TOKEN'}};
  const mapped=await run(req);return {req,mapped};
 }
 async function end(job,data){const req={...job.req,...job.mapped};delete req.body;return run(req,json(data));}
 async function rt(endpoint,body,data){return end(await begin(endpoint,body),data);}
 async function metadata(id){return rt('item/get','id='+id,{success:true,data:{itemData:{id,itemId:items[id],itemType:'hobby',cover:id+'.jpg'}}});}
 async function load(id){return rt('hobby/album','id='+id+'&page=1&pageSize=10&utoken=HPOI_PRIVATE_TOKEN',{success:true,data:{list:[albumFor(id),secondAlbumFor(id)]}});}
  return{prefs,logs,calls,notices,run,begin,end,rt,metadata,load,fail:(id,page)=>{failItem=id;failPage=page;},gate:id=>{ageGate=id;},barkFail:()=>{barkFails=true;}};
}
const unwrap=r=>JSON.parse(r.body).data;
(async()=>{
 let h=harness();await h.metadata(A);await h.metadata(B);
 const ja=await h.begin('hobby/album','id='+A+'&page=1&pageSize=10'),jb=await h.begin('hobby/album','id='+B+'&page=1&pageSize=10');
 const [rb,ra]=await Promise.all([
  h.end(jb,{success:true,data:{list:[albumFor(B),secondAlbumFor(B)]}}),
  h.end(ja,{success:true,data:{list:[albumFor(A),secondAlbumFor(A)]}})
 ]);
 const listA=unwrap(ra).list,listB=unwrap(rb).list;
 const homeA=listA[0],homeB=listB[0];
 assert(homeA.id>=800000000&&homeA.id<1000000000,'EXHOBBY uses a native-looking local route');
 assert.equal(homeA.itemId,homeA.id,'EXHOBBY id and itemId use the same unique local route');
 assert(homeB.id>=800000000&&homeB.id<1000000000,'each item gets a native-looking local route');
 assert.equal(homeB.itemId,homeB.id,'each EXHOBBY card keeps a unique local route');
 assert.notEqual(homeA.id,homeB.id,'different hobbies must not reuse the same EXHOBBY route');
 assert.equal(homeA.picCount,45);assert.equal(homeB.picCount,27);
 assert.equal(homeA.cover,'/__exhobby__/2026/09/'+A+'-0.jpg');
 assert.equal(homeB.cover,'/__exhobby__/2026/09/'+B+'-0.jpg');
 assert.equal(homeA.name,'EXHOBBY 相册');
 // Unique EXHOBBY route is fully local and safely remapped before Hpoi backend.
 const stagedJob=await h.begin('album/detail',
   'id='+homeA.id+'&itemId='+homeA.itemId+'&itemType=album');
 const stagedMapped=new URLSearchParams(stagedJob.mapped.body);
 assert.equal(stagedMapped.get('id'),'214102','unique EXHOBBY id is safely remapped for Hpoi backend');
 assert.equal(stagedMapped.get('itemId'),'214102','unique EXHOBBY itemId is safely remapped for Hpoi backend');
 const stagedDetail=unwrap(await h.end(stagedJob,{success:true,data:{album:albumFor(A)}}));
 assert.equal(stagedDetail.album.id,homeA.id);
 assert.equal(stagedDetail.album.itemId,homeA.itemId);
 assert.equal(stagedDetail.album.picCount,45);

 const pics=async(route,page)=>unwrap(await h.rt('pic/list/relate-v2','itemId='+route+'&itemType=album&page='+page+'&pageSize=20',{success:true,data:{list:[]}})).list;
 const pa=await pics(homeA.itemId,1),pb=await pics(homeB.itemId,1);
 assert.equal(pa.length,20);assert.equal(pb.length,20);
 assert(pa.every(row=>row.subType===7),
   'EXHOBBY rows preserve native outer-row fields such as subType');
 // A later native response without subType must not downgrade the saved row template.
 await h.rt('pic/list/relate-v2','itemId=214999&itemType=album&page=1&pageSize=20',
   {success:true,data:{list:[{id:777,rank:1,pictureInfo:{id:777,itemId:778,itemType:'pic',path:'later.jpg'}}]}});
 const preservedSeed=JSON.parse(h.prefs.get(NS+'seed:pic/list/relate-v2'));
 assert.equal(preservedSeed.row.subType,7,
   'later rows missing subType must preserve the previously learned subtype');
 const paAfter=await pics(homeA.itemId,1);
 assert(paAfter.every(row=>row.subType===7),
   'EXHOBBY rows keep rendering metadata after template refreshes');
 assert.notEqual(pa[0].id,pb[0].id,'different gallery first photos cannot reuse native IDs');
 assert.equal((await pics(homeA.itemId,3)).length,5);assert.equal((await pics(homeB.itemId,2)).length,7);
 assert.equal((await pics(homeB.itemId,3)).length,0);
 let detail=unwrap(await h.rt('album/detail','id='+homeA.id+'&itemId='+homeA.itemId+'&itemType=album',{success:true,data:{album:seedAlbum}}));
 assert.equal(detail.album.picCount,45);
 assert.equal(detail.album.cover,'/__exhobby__/2026/09/'+A+'-0.jpg');
 const itemIdDetailJob=await h.begin('album/detail','id='+homeA.id+'&itemId='+homeA.itemId+'&itemType=album');
 const remappedDetailParams=new URLSearchParams(itemIdDetailJob.mapped.body);
 assert.equal(remappedDetailParams.get('itemId'),'214102');
 assert.equal(remappedDetailParams.get('id'),'214102');
 detail=unwrap(await h.end(itemIdDetailJob,{success:true,data:{album:seedAlbum}}));
 assert.equal(detail.album.picCount,45);
 detail=unwrap(await h.rt('item/get','id='+pa[0].id,{success:true,data:{itemData:{}}}));
 assert.equal(detail.itemData.path,pa[0].pictureInfo.path);
 assert.equal(JSON.stringify(await h.rt('album/detail','itemId='+albumFor(A).itemId+'&itemType=album',
   {success:true,data:{album:albumFor(A)}})),'{}',
   'native album detail is passed through untouched');
 const nativeFirst=unwrap(await h.rt('pic/list/relate-v2',
   'itemId='+albumFor(A).itemId+'&itemType=album&page=1&pageSize=20',
   {success:true,data:{list:[{id:901,rank:1,subType:7,pictureInfo:{id:901,itemId:902,itemType:'pic',path:'normal.jpg'}}]}})).list;
 assert.equal(nativeFirst.filter(r=>String(r.pictureInfo&&r.pictureInfo.path||'').startsWith('/__exhobby__/')).length,12,
   'first native album receives only its own EXHOBBY scoped gallery');
 assert(nativeFirst.slice(0,12).every(r=>r.pictureInfo.path.includes('/'+A+'-')),
   'first native album scoped rows belong to the current album subset');
 assert.equal(nativeFirst.at(-1).pictureInfo.path,'normal.jpg',
   'native picture remains after injected EXHOBBY rows');

 const otherFirst=unwrap(await h.rt('pic/list/relate-v2',
   'itemId='+secondAlbumFor(A).itemId+'&itemType=album&page=1&pageSize=20',
   {success:true,data:{list:[{id:903,rank:1,subType:7,pictureInfo:{id:903,itemId:904,itemType:'pic',path:'normal2.jpg'}}]}})).list;
 assert.equal(otherFirst.filter(r=>String(r.pictureInfo&&r.pictureInfo.path||'').startsWith('/__exhobby__/')).length,8,
   'second native album receives only its own EXHOBBY scoped gallery');
 assert.equal(otherFirst.at(-1).pictureInfo.path,'normal2.jpg');

 assert.equal(JSON.stringify(await h.rt('pic/list/relate-v2',
   'itemId='+secondAlbumFor(A).itemId+'&itemType=album&page=2&pageSize=20',
   {success:true,data:{list:[{id:905,rank:21,subType:7,pictureInfo:{id:905,itemId:906,itemType:'pic',path:'normal2-page2.jpg'}}]}})),'{}',
   'later native pages stay untouched and do not repeat EXHOBBY rows');

 const count=h.calls.length;await h.load(A);assert.equal(h.calls.length,count,'A cache is reused separately');
 assert(!JSON.stringify([...h.prefs]).includes('HPOI_PRIVATE_TOKEN'));
 assert(!JSON.stringify(h.logs).includes('EXHOBBY_BROWSER_COOKIE'));

 let fallback=harness();let r=await fallback.load(B);
 assert.equal(unwrap(r).list[0].picCount,27);
 assert(fallback.calls[0].url.endsWith('id='+B),'global ID fallback when item/get arrives later');
 assert.equal(unwrap(r).list[0].cover,'/__exhobby__/2026/09/'+B+'-0.jpg');
 r=await fallback.load(C);assert.equal(JSON.stringify(r),'{}','no entry for uncollected item');
 const afterEmpty=fallback.calls.length;await fallback.load(C);assert.equal(fallback.calls.length,afterEmpty,'negative cache');

 let noNative=harness();await noNative.metadata(A);
 const noNativeHome=unwrap(await noNative.rt('hobby/album','id='+A+'&page=1&pageSize=10',
   {success:true,data:{list:[]}})).list[0];
 assert(noNativeHome.id>=800000000&&noNativeHome.id<1000000000,'homepage entry remains available without a native album');
 assert.equal(noNativeHome.itemId,noNativeHome.id,'no-native-album entries use their unique local route');

 let resume=harness();resume.fail(A,2);await resume.load(A);await resume.load(B);
 assert.equal(JSON.parse(resume.prefs.get(NS+'all:'+A+':work')).next,2);
 assert(JSON.parse(resume.prefs.get(NS+'all:'+B+':gallery')).complete);
 assert(!resume.prefs.has(NS+'all:'+A+':gallery'));
 resume.fail(0,0);await resume.load(A);
 assert.equal(JSON.parse(resume.prefs.get(NS+'all:'+A+':gallery')).rows.length,45);

 // Standalone album opened outside a hobby page self-registers and resolves its own EXHOBBY gallery.
 let standalone=harness();
 const standaloneAlbum={id:40154473,itemId:404807,itemType:'album',name:'Standalone',user:{}};
 // Mock a scoped EXHOBBY cache for this standalone album to isolate route registration behavior.
 standalone.prefs.set(NS+'album-gallery:40154473:404807',JSON.stringify({
  version:31,complete:true,time:Date.now(),scoped:true,albumItemId:404807,
  rows:[{id:701,path:'standalone/1.jpg'},{id:702,path:'standalone/2.jpg'}]
 }));
 await standalone.rt('album/detail','id=40154473&itemId=404807',
  {success:true,data:{album:standaloneAlbum}});
 const standaloneMap=JSON.parse(standalone.prefs.get(NS+'standalone-album:404807'));
 assert.equal(standaloneMap.item,40154473,'standalone album registers its own local scope');
 assert.equal(standaloneMap.itemId,404807);
 const standalonePics=unwrap(await standalone.rt('pic/list/relate-v2',
  'itemId=404807&itemType=album&page=1&pageSize=20',
  {success:true,data:{list:[{id:9901,rank:1,subType:7,pictureInfo:{id:9901,itemId:9902,itemType:'pic',path:'standalone-native.jpg'}}]}})).list;
 assert.equal(standalonePics.filter(r=>String(r.pictureInfo&&r.pictureInfo.path||'').startsWith('/__exhobby__/')).length,2,
  'standalone album injects its own scoped EXHOBBY gallery');
 assert.equal(standalonePics.at(-1).pictureInfo.path,'standalone-native.jpg');

 const browserReq={url:'https://www.exhobby.net/picture/'+B,method:'POST',headers:{Cookie:'NEW_COOKIE','User-Agent':'New Safari'}};
 await h.run(browserReq,json(rows[B].slice(20)));
  assert.equal(JSON.parse(h.prefs.get(NS+'browser-session')).cookie,'NEW_COOKIE','browser capture supports another item');
 await h.run({...browserReq,url:'https://www.exhobby.net/picture?link=x',headers:{Cookie:'AGE_GATE_COOKIE'}},{statusCode:200,body:'<h1>年齡提醒！</h1>'});
  assert.equal(JSON.parse(h.prefs.get(NS+'browser-session')).cookie,'NEW_COOKIE','age gate cannot overwrite confirmed session');

  let reusable=harness();
  reusable.prefs.set(NS+'browser-session',JSON.stringify({cookie:'EXHOBBY_BROWSER_COOKIE',agent:'Safari fixture',time:Date.now()-2*86400000}));
  assert.equal(unwrap(await reusable.load(A)).list[0].picCount,45,'old browser session works while accepted by the website');
  assert.equal(reusable.notices.length,0,'no notification for an accepted old cookie');

  let missing=harness();
  missing.prefs.delete(NS+'browser-session');
  missing.prefs.set(NS+'all:'+A+':gallery-link',JSON.stringify('https://www.exhobby.net/picture?link=G_'+A));
  assert.equal(JSON.stringify(await missing.load(A)),'{}');
  assert.equal(missing.notices.length,1,'missing session triggers a Quantumult X notification');
  assert(missing.notices[0][2].includes('https://www.exhobby.net/picture?link=G_'+A),'prior gallery opens directly');
  await missing.load(B);
  assert.equal(missing.notices.length,1,'different entries do not spam verification notices');
  await missing.run({url:'https://www.exhobby.net/picture?link=G_'+A,method:'GET',headers:{Cookie:'RECOVERED_COOKIE','User-Agent':'Safari fixture'}},{statusCode:200,body:html(A)});
  assert.equal(missing.prefs.has(NS+'verify-notice'),false,'successful browser verification clears notice cooldown');
  assert.equal(JSON.parse(missing.prefs.get(NS+'all:'+A+':gallery-link')),'https://www.exhobby.net/picture?link=G_'+A);

  let gated=harness();gated.gate(A);
  assert.equal(JSON.stringify(await gated.load(A)),'{}');
  assert.equal(gated.notices.length,1,'explicit website age reminder triggers a notification');
  assert(gated.notices[0][2].includes('https://www.exhobby.net/picture?link=G_'+A));
  let challenged=harness();challenged.gate(-A);
  assert.equal(JSON.stringify(await challenged.load(A)),'{}');
  assert.equal(challenged.notices.length,1,'explicit HTTP 403 human challenge triggers a notification');

  let pushed=harness();pushed.prefs.delete(NS+'browser-session');
  pushed.prefs.set(NS+'bark-push-url','https://api.day.app/FAKE_KEY');
  pushed.prefs.set(NS+'all:'+A+':gallery-link',JSON.stringify('https://www.exhobby.net/picture?link=G_'+A));
  await pushed.load(A);
  assert.equal(pushed.notices.length,0,'successful Bark send does not duplicate Quantumult X alert');
  const bark=pushed.calls.find(c=>c.url==='https://api.day.app/FAKE_KEY');
  assert(bark,'Bark endpoint is called');
  assert.equal(JSON.parse(bark.body).url,'https://www.exhobby.net/picture?link=G_'+A);
  assert(!JSON.stringify(bark).includes('EXHOBBY_BROWSER_COOKIE'));
  assert(!JSON.stringify(bark).includes('HPOI_PRIVATE_TOKEN'));
  let pushFailed=harness();pushFailed.prefs.delete(NS+'browser-session');pushFailed.barkFail();
  pushFailed.prefs.set(NS+'bark-push-url','https://api.day.app/FAKE_KEY');
  await pushFailed.load(A);
  assert.equal(pushFailed.notices.length,1,'failed Bark delivery falls back to Quantumult X');
  assert(pushFailed.notices[0][2].includes('https://www.exhobby.net/search'),'unknown galleries open the search page');

 // Lazy scoped pagination: 26 EXHOBBY + 18 native rows become 20 / 20 / 4.
 let lazy=harness();
 lazy.prefs.set(NS+'all:'+A+':known',JSON.stringify(true));
 lazy.prefs.set(NS+'all:'+A+':hobby',JSON.stringify({hobbyId:items[A]}));
 lazy.prefs.set(NS+'album-owner:'+albumFor(A).itemId,JSON.stringify({
  item:A,itemId:albumFor(A).itemId,nativeId:albumFor(A).id,time:Date.now()
 }));
 const lazyRows=Array.from({length:26},(_,i)=>({id:800000+i,path:'lazy/'+(i+1)+'.jpg'}));
 lazy.prefs.set(NS+'album-gallery:'+A+':'+albumFor(A).itemId,JSON.stringify({
  version:31,complete:true,time:Date.now(),scoped:true,
  albumItemId:albumFor(A).itemId,rows:lazyRows
 }));
 lazy.prefs.set(NS+'cache-index',JSON.stringify({
  [A]:{last:Date.now(),albums:[albumFor(A).itemId],
   albumLast:{[albumFor(A).itemId]:Date.now()},images:[],routes:[]}
 }));
 const lazyNative=Array.from({length:18},(_,i)=>({
  id:910000+i,rank:i+1,subType:7,
  pictureInfo:{id:910000+i,itemId:920000+i,itemType:'pic',path:'lazy-native/'+(i+1)+'.jpg'}
 }));
 async function lazyPage(page){
  const start=(page-1)*20;
  return unwrap(await lazy.rt('pic/list/relate-v2',
   'itemId='+albumFor(A).itemId+'&itemType=album&page='+page+'&pageSize=20',
   {success:true,data:{list:lazyNative.slice(start,start+20)}})).list;
 }
 const lazy1=await lazyPage(1),lazy2=await lazyPage(2),lazy3=await lazyPage(3);
 assert.equal(lazy1.length,20,'lazy page 1 is capped at 20 rows');
 assert(lazy1.every(r=>String(r.pictureInfo.path).startsWith('/__exhobby__/')),
  'lazy page 1 exposes only the first 20 EXHOBBY rows');
 assert.equal(lazy2.length,20,'lazy page 2 is filled to 20 rows');
 assert.equal(lazy2.filter(r=>String(r.pictureInfo.path).startsWith('/__exhobby__/')).length,6,
  'lazy page 2 contains remaining 6 EXHOBBY rows');
 assert.equal(lazy2.filter(r=>!String(r.pictureInfo.path).startsWith('/__exhobby__/')).length,14,
  'lazy page 2 fills the rest with the first 14 native rows');
 assert.equal(lazy3.length,4,'lazy page 3 contains the final four native rows');
 assert(lazy3.every(r=>String(r.pictureInfo.path).startsWith('lazy-native/')),
  'lazy page 3 continues native rows without duplication');
 assert(lazy.logs.some(line=>line.includes('lazy scoped album')&&line.includes('page=2')&&
  line.includes('exhobbyShown=6')&&line.includes('nativeShown=14')),
  'lazy pagination log reports both sources on the transition page');

 // Seven-day cache GC: stale items and stale albums are purged independently.
 let gc=harness();
 const now=Date.now(),day=86400000,oldItem=98765432,staleAlbum=7654321,freshAlbum=7654322;
 gc.prefs.set(NS+'all:'+A+':gallery',JSON.stringify({version:30,complete:true,time:now,rows:rows[A]}));
 gc.prefs.set(NS+'cache-index',JSON.stringify({
  [A]:{last:now-day,albums:[staleAlbum,freshAlbum],albumLast:{[staleAlbum]:now-8*day,[freshAlbum]:now-day},images:[],routes:[]},
  [oldItem]:{last:now-8*day,albums:[],albumLast:{},images:[],routes:[]}
 }));
 gc.prefs.set(NS+'album-gallery:'+A+':'+staleAlbum,JSON.stringify({version:31,complete:true,time:now,rows:[{id:1,path:'old/stale.jpg'}],scoped:true}));
 gc.prefs.set(NS+'album-gallery:'+A+':'+freshAlbum,JSON.stringify({version:31,complete:true,time:now,rows:[{id:2,path:'fresh/keep.jpg'}],scoped:true}));
 gc.prefs.set(NS+'album-owner:'+staleAlbum,JSON.stringify({item:A,itemId:staleAlbum}));
 gc.prefs.set(NS+'album-owner:'+freshAlbum,JSON.stringify({item:A,itemId:freshAlbum}));
 await gc.run({url:'https://www.hpoi.net.cn/api/hobby/album?platform=ios',method:'POST',sessionIndex:998,
  body:'id='+A+'&page=1&pageSize=10',headers:{'Content-Type':'application/x-www-form-urlencoded'}});
 const gcIndex=JSON.parse(gc.prefs.get(NS+'cache-index'));
 assert(!gcIndex[String(oldItem)],'items not viewed for 7 days are automatically purged');
 assert(!gcIndex[String(A)].albums.includes(staleAlbum),'albums not viewed for 7 days are automatically purged');
 assert(gcIndex[String(A)].albums.includes(freshAlbum),'recent albums remain cached');
 assert(gc.logs.some(line=>line.includes('cache GC checked')&&line.includes('staleItems=1')&&line.includes('staleAlbums=1')),
  'automatic GC logs each real check');

 const statusResult=await gc.run({url:'https://www.exhobby.net/__hpoi_cache_status__',method:'GET',sessionIndex:997,headers:{}},{statusCode:404,body:'not found'});
 assert(String(statusResult.body||'').includes('EXHOBBY 缓存状态'),'cache status page is available');
 assert(String(statusResult.body||'').includes('超过 7 天未看的相册'),'cache status reports 7-day album retention');

 // Deliberately occupy a picture hash ID; the probe must choose another ID.
 const collision=harness();await collision.metadata(A);await collision.load(A);
 let hash=2166136261;for(const c of rows[A][0].path)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 const taken=2001000000+hash%139999999+1;
 collision.prefs.set(NS+'image:'+taken,JSON.stringify({item:B,row:{path:'different.jpg',id:1}}));
 const cp=unwrap(await collision.rt('pic/list/relate-v2','itemId='+(1000000000+A)+'&itemType=album&page=1&pageSize=20',{success:true,data:{list:[]}})).list;
 assert.notEqual(cp[0].id,taken);assert(cp[0].id<2147483647);
 // Keep the old cover redirect before the general photo rule for v3.4.1 cache compatibility.
 for(const file of ['hpoi-exhobby.snippet','hpoi-exhobby.local.conf']){
  const rules=fs.readFileSync(path.join(__dirname,'..',file),'utf8').split('\n');
  const upgrade=rules.findIndex(line=>line.includes('url 307 https://www.exhobby.net/$1'));
  const capture=rules.findIndex(line=>line.includes('url script-response-body')&&line.includes('www\\.exhobby\\.net/picture'));
  assert(upgrade>=0&&capture>upgrade,file+' must upgrade HTTP before HTTPS session capture');
  if(file==='hpoi-exhobby.snippet'){
   const remoteScripts=rules.filter(line=>line.includes('url script-')&&line.includes('hpoi-exhobby-v3.7.0.js'));
   assert(remoteScripts.length>=4&&remoteScripts.every(line=>line.includes('hpoi-exhobby-v3.7.0.js')),
    'remote EXHOBBY scripts must use the versioned v3.7.0 runtime');
  }
  const [upgradeSource,upgradeTarget]=rules[upgrade].split(' url 307 ');
  const upgradePattern=new RegExp(upgradeSource);
  const oldSafariURL='http://www.exhobby.net/picture/32625940?page=2&item=32625940';
  assert.equal(oldSafariURL.replace(upgradePattern,upgradeTarget),
    'https://www.exhobby.net/picture/32625940?page=2&item=32625940');
  assert(!upgradePattern.test('https://www.exhobby.net/picture/32625940'));
  const brand=rules.findIndex(line=>line.includes('cover-v3\\.2\\.png'));
  const photos=rules.findIndex(line=>line.includes('https://res.e39x.com/pic/n/$1'));
  assert(brand>=0&&photos>brand,file+' must match the branded cover first');
  assert(rules[brand].includes('/assets/exhobby-cover-v3.2.png'));
  const pattern=new RegExp(rules[brand].split(' url 302 ')[0]);
  assert(pattern.test('https://rfx.hpoi.net/pic/s/__exhobby__/cover-v3.2.png?size=small'));
  assert(pattern.test('https://rfx.hpoi.net/pic/s/__exhobby__/cover-v3.2.png/120x120'));
  assert(!pattern.test('https://rfx.hpoi.net/pic/s/__exhobby__/2026/09/photo.jpg'));
 }
 const remoteConfig=fs.readFileSync(path.join(__dirname,'..','hpoi-exhobby.snippet'),'utf8');
 assert(!remoteConfig.includes('reject-200'),
  'third-party ad SDKs must not receive empty successful responses during cold start');
 const mitmLine=remoteConfig.split('\n').find(line=>line.startsWith('hostname = '));
 assert.equal(mitmLine,'hostname = www.hpoi.net.cn, rfx.hpoi.net, www.exhobby.net',
  'MITM must stay limited to the three hosts required by the native album integration');
 const adFilter=fs.readFileSync(path.join(__dirname,'..','hpoi-ads-filter.list'),'utf8');
 assert(!adFilter.split('\n').some(line=>/^host(?:-suffix)?,\s*(?:hpoi\.net\.cn|hpoi\.net),/i.test(line)),
  'HPOI hosts must not be in the ad subscription: force-policy=reject would block them');
 const cover=fs.readFileSync(path.join(__dirname,'..','assets/exhobby-cover-v3.2.png'));
 assert.equal(cover.subarray(0,8).toString('hex'),'89504e470d0a1a0a','cover is a PNG');
 console.log('PASS: concurrent/out-of-order entries, unique EXHOBBY routes, scoped album galleries, pagination, and photo navigation.');
 console.log('PASS: existing session/templates reused, global ID fallback, empty entries, failure isolation/resumption, and ID collision handling.');
  console.log('PASS: native Hpoi albums receive only their own EXHOBBY scoped galleries; later pages stay native.');
  console.log('PASS: age reminders, accepted old cookies, notification cooldown, saved gallery links and optional Bark privacy.');
  console.log('PASS: v3.3 upgrades legacy HTTP gallery URLs with POST-preserving 307 rules before session capture.');
  console.log('PASS: v3.3.1 keeps third-party ad SDK hosts out of MITM and HPOI core hosts out of force-policy=reject subscriptions.');
})().catch(e=>{console.error(e);process.exitCode=1;});
