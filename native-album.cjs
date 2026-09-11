// Fixtures below use dummy credentials and mock responses; no network requests.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const script=fs.readFileSync(path.join(__dirname,'..','hpoi-exhobby.js'),'utf8');
const NS='HPOI_EXHOBBY_NATIVE_V2:', A=13021283, B=13021284, C=13021285;
const items={[A]:74515,[B]:74516,[C]:74517};
const rows=Object.fromEntries([[A,45],[B,27],[C,0]].map(([id,n])=>[id,Array.from({length:n},(_,i)=>({id:600000+i,path:'2026/09/'+id+'-'+i+'.jpg'}))]));
function html(id){return '<title>Gallery</title><script>query.item="'+id+'";</script>'+rows[id].slice(0,20).map(r=>'<figure><img src="https://res.e39x.com/pic/s/'+r.path+'"></figure>').join('');}
const json=v=>({statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify(v)});
const seedAlbum={id:12345678,itemId:214102,itemType:'album',categoryId:8,name:'Normal',picCount:2,cover:'normal.jpg',user:{id:1,nickname:'Real author'}};
function harness(){
 const prefs=new Map(),logs=[],calls=[];
 prefs.set(NS+'browser-session',JSON.stringify({cookie:'EXHOBBY_BROWSER_COOKIE',agent:'Safari fixture',time:Date.now()}));
 prefs.set(NS+'seed:album/detail',JSON.stringify({p:{id:'214102'},album:seedAlbum}));
 prefs.set(NS+'seed:pic/list/relate-v2',JSON.stringify({p:{itemId:'214102',itemType:'album',page:'1',pageSize:'20'},picture:{id:2,itemId:3,itemType:'pic',categoryId:6,path:'normal.jpg'}}));
 let failPage=0, failItem=0;
 async function fetch(o){
  calls.push(o);
  assert.equal(o.headers.Cookie,'EXHOBBY_BROWSER_COOKIE');
  assert.equal(o.headers['User-Agent'],'Safari fixture');
  assert(o.url.startsWith('https://www.exhobby.net/'));
  assert(!JSON.stringify(o).includes('HPOI_PRIVATE_TOKEN'));
  const u=new URL(o.url);
  if(u.pathname==='/get/pic'){
   const id=u.searchParams.has('id')?Number(u.searchParams.get('id')):Number(Object.keys(items).find(k=>items[k]===Number(u.searchParams.get('itemId'))));
   assert(items[id]);
   if(!rows[id].length)return json({map:{list:[]}});
   return json({map:{list:rows[id].slice(0,6),url:'https://www.exhobby.net/picture?link=G_'+id}});
  }
  if(u.pathname==='/picture')return{statusCode:200,body:html(Number(u.searchParams.get('link').slice(2)))};
  const id=Number(u.pathname.split('/')[2]),p=new URLSearchParams(o.body),page=Number(p.get('page'));
  assert.equal(Number(p.get('item')),id);assert(page>=2);
  if(id===failItem&&page===failPage)return{statusCode:200,headers:{'Content-Length':'0'}};
  return json(rows[id].slice((page-1)*20,page*20));
 }
 function run(req,res){
  return new Promise((resolve,reject)=>{
   let done=0;const env={$request:req,$prefs:{valueForKey:k=>prefs.get(k),setValueForKey:(v,k)=>{prefs.set(k,v);return true;},removeValueForKey:k=>prefs.delete(k)},
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
 async function load(id){return rt('hobby/album','id='+id+'&page=1&pageSize=10&utoken=HPOI_PRIVATE_TOKEN',{success:true,data:{list:[seedAlbum]}});}
 return{prefs,logs,calls,run,begin,end,rt,metadata,load,fail:(id,page)=>{failItem=id;failPage=page;}};
}
const unwrap=r=>JSON.parse(r.body).data;
(async()=>{
 let h=harness();await h.metadata(A);await h.metadata(B);
 const ja=await h.begin('hobby/album','id='+A+'&page=1&pageSize=10'),jb=await h.begin('hobby/album','id='+B+'&page=1&pageSize=10');
 const [rb,ra]=await Promise.all([h.end(jb,{success:true,data:{list:[seedAlbum]}}),h.end(ja,{success:true,data:{list:[seedAlbum]}})]);
 assert.equal(unwrap(ra).list[0].itemId,1000000000+A);
 assert.equal(unwrap(rb).list[0].itemId,1000000000+B);
 assert.equal(unwrap(ra).list[0].picCount,45);assert.equal(unwrap(rb).list[0].picCount,27);
 assert.equal(unwrap(ra).list[0].cover,A+'.jpg');assert.equal(unwrap(rb).list[0].cover,B+'.jpg');
 assert.equal(unwrap(ra).list[1].name,'Normal');
 for(const id of[A,B]){const g=JSON.parse(h.prefs.get(NS+'all:'+id+':gallery'));assert(g.complete);assert(g.rows.every(r=>r.path.includes(id+'-')));}
 const pics=async(id,page)=>unwrap(await h.rt('pic/list/relate-v2','itemId='+(1000000000+id)+'&itemType=album&page='+page+'&pageSize=20',{success:true,data:{list:[]}})).list;
 const pa=await pics(A,1),pb=await pics(B,1);
 assert.equal(pa.length,20);assert.equal(pb.length,20);
 assert.notEqual(pa[0].id,pb[0].id,'different gallery first photos cannot reuse native IDs');
 assert.equal((await pics(A,3)).length,5);assert.equal((await pics(B,2)).length,7);
 assert.equal((await pics(B,3)).length,0);
 let detail=unwrap(await h.rt('album/detail','id='+(1000000000+A),{success:true,data:{album:seedAlbum}}));
 assert.equal(detail.album.picCount,45);
 detail=unwrap(await h.rt('item/get','id='+pa[0].id,{success:true,data:{itemData:{}}}));
 assert.equal(detail.itemData.path,pa[0].pictureInfo.path,'photo details stay with A after visiting B');
 assert.equal(JSON.stringify(await h.rt('album/detail','id=214102',{success:true,data:{album:seedAlbum}})),'{}');
 const count=h.calls.length;await h.load(A);assert.equal(h.calls.length,count,'A cache is reused separately');
 assert(!JSON.stringify([...h.prefs]).includes('HPOI_PRIVATE_TOKEN'));
 assert(!JSON.stringify(h.logs).includes('EXHOBBY_BROWSER_COOKIE'));

 let fallback=harness();let r=await fallback.load(B);
 assert.equal(unwrap(r).list[0].picCount,27);
 assert(fallback.calls[0].url.endsWith('id='+B),'global ID fallback when item/get arrives later');
 assert.equal(unwrap(r).list[0].cover,'/__exhobby__/'+rows[B][0].path);
 r=await fallback.load(C);assert.equal(JSON.stringify(r),'{}','no entry for uncollected item');
 const afterEmpty=fallback.calls.length;await fallback.load(C);assert.equal(fallback.calls.length,afterEmpty,'negative cache');

 let resume=harness();resume.fail(A,2);await resume.load(A);await resume.load(B);
 assert.equal(JSON.parse(resume.prefs.get(NS+'all:'+A+':work')).next,2);
 assert(JSON.parse(resume.prefs.get(NS+'all:'+B+':gallery')).complete);
 assert(!resume.prefs.has(NS+'all:'+A+':gallery'));
 resume.fail(0,0);await resume.load(A);
 assert.equal(JSON.parse(resume.prefs.get(NS+'all:'+A+':gallery')).rows.length,45);

 const browserReq={url:'https://www.exhobby.net/picture/'+B,method:'POST',headers:{Cookie:'NEW_COOKIE','User-Agent':'New Safari'}};
 await h.run(browserReq,json(rows[B].slice(20)));
 assert.equal(JSON.parse(h.prefs.get(NS+'browser-session')).cookie,'NEW_COOKIE','browser capture supports another item');
 await h.run({...browserReq,url:'https://www.exhobby.net/picture?link=x',headers:{Cookie:'AGE_GATE_COOKIE'}},{statusCode:200,body:'<h1>年齡提醒！</h1>'});
 assert.equal(JSON.parse(h.prefs.get(NS+'browser-session')).cookie,'NEW_COOKIE','age gate cannot overwrite confirmed session');

 // Deliberately occupy a picture hash ID; the probe must choose another ID.
 const collision=harness();await collision.metadata(A);await collision.load(A);
 let hash=2166136261;for(const c of rows[A][0].path)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 const taken=2001000000+hash%139999999+1;
 collision.prefs.set(NS+'image:'+taken,JSON.stringify({item:B,row:{path:'different.jpg',id:1}}));
 const cp=unwrap(await collision.rt('pic/list/relate-v2','itemId='+(1000000000+A)+'&itemType=album&page=1&pageSize=20',{success:true,data:{list:[]}})).list;
 assert.notEqual(cp[0].id,taken);assert(cp[0].id<2147483647);
 console.log('PASS: concurrent/out-of-order entries, separate caches and covers, native album/photo navigation, and pagination tails.');
 console.log('PASS: existing session/templates reused, global ID fallback, empty entries, failure isolation/resumption, and ID collision handling.');
 console.log('PASS: all-entry browser capture preserves age checks; no Hpoi credentials forwarded or logged.');
})().catch(e=>{console.error(e);process.exitCode=1;});
