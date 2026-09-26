// Cross-platform runtime and configuration fixtures. No live network requests.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'hpoi-exhobby.js'),'utf8');
assert.equal(fs.readFileSync(path.join(root,'hpoi-exhobby-v3.7.0.js'),'utf8'),script,
  'versioned remote runtime must exactly match the main runtime');
const NS='HPOI_EXHOBBY_NATIVE_V2:';
const ITEM=13021283,ROUTE=825000001,NATIVE_ID=12345678,NATIVE_ITEM_ID=214102;
const nativeAlbum={id:NATIVE_ID,itemId:NATIVE_ITEM_ID,itemType:'album',name:'Native',picCount:1,cover:'native.jpg',user:{}};
const nativeRow={id:91,rank:1,subType:7,pictureInfo:{id:91,itemId:92,itemType:'pic',path:'native.jpg'}};

function response(platform,status,body){
  const value={headers:{'Content-Type':'application/json'},body};
  if(platform==='quantumult-x')value.statusCode=status;
  else value.status=status;
  return value;
}

function runtime(platform){
  const store=new Map(),logs=[],notices=[],calls=[];
  let sequence=1;
  function storage(){
    if(platform==='quantumult-x')return {$prefs:{
      valueForKey:key=>store.get(key),
      setValueForKey:(value,key)=>{store.set(key,value);return true;},
      removeValueForKey:key=>store.delete(key)
    }};
    return {$persistentStore:{
      read:key=>store.get(key),
      write:(value,key)=>{store.set(key,String(value));return true;}
    }};
  }
  function transport(){
    if(platform==='quantumult-x')return {
      $task:{fetch:async options=>{calls.push(options);return response(platform,200,'{"code":200}');}},
      $notify:(...args)=>notices.push(args)
    };
    const send=(options,callback)=>{
      calls.push(options);
      callback(null,{status:200,headers:{'Content-Type':'application/json'}},'{"code":200}');
    };
    return {
      $httpClient:{get:send,post:send,put:send,delete:send,head:send,options:send,patch:send},
      $notification:{post:(...args)=>notices.push(args)},
      ...(platform==='loon'?{$loon:'fixture'}:{$environment:{system:'iOS','surge-version':'fixture'}})
    };
  }
  function request(url,body,id,method='POST'){
    const value={url,method,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body||''};
    if(platform==='quantumult-x')value.sessionIndex=id==null?sequence++:id;
    else if(platform==='surge')value.id=id==null?'surge-'+sequence++:String(id);
    // Loon intentionally omits a request ID so the sanitized fingerprint fallback is tested.
    return value;
  }
  function run(req,res){
    return new Promise((resolve,reject)=>{
      let ended=0;
      const env={...storage(),...transport(),$request:req,
        console:{log:value=>logs.push(String(value))},setTimeout,clearTimeout,
        $done:value=>{try{assert.equal(++ended,1);resolve(value);}catch(error){reject(error);}}};
      if(res!==undefined)env.$response=res;
      try{vm.runInNewContext(script,env,{timeout:3000});}catch(error){reject(error);}
    });
  }
  async function roundTrip(endpoint,body,serverData,{mappedResponse=false}={}){
    const id=sequence++;
    const url='https://www.hpoi.net.cn/api/'+endpoint+'?platform=ios';
    const original=request(url,body,id);
    const mapped=await run(original);
    const paired={...original};
    if(mappedResponse){
      if(mapped.url!=null)paired.url=mapped.url;
      if(mapped.body!=null)paired.body=mapped.body;
    }
    const result=await run(paired,response(platform,200,JSON.stringify(serverData)));
    return {mapped,result};
  }
  return {platform,store,logs,notices,calls,request,run,roundTrip};
}

async function verifyPlatform(platform){
  const rt=runtime(platform);
  await rt.roundTrip('item/get','id='+ITEM,{success:true,data:{
    itemData:{id:ITEM,itemId:74515,itemType:'hobby',cover:'cover.jpg'}
  }});
  assert.equal(JSON.parse(rt.store.get(NS+'all:'+ITEM+':hobby')).hobbyId,74515,
    platform+' stores metadata across request/response phases');

  rt.store.set(NS+'seed:album/detail',JSON.stringify({
    p:{id:String(NATIVE_ITEM_ID),itemId:String(NATIVE_ITEM_ID),itemType:'album'},album:nativeAlbum
  }));
  rt.store.set(NS+'seed:pic/list/relate-v2',JSON.stringify({
    p:{itemId:String(NATIVE_ITEM_ID),itemType:'album',page:'1',pageSize:'20'},
    row:nativeRow,picture:nativeRow.pictureInfo
  }));
  rt.store.set(NS+'exhobby-route:'+ROUTE,JSON.stringify({item:ITEM,route:ROUTE,time:Date.now()}));
  rt.store.set(NS+'all:'+ITEM+':gallery',JSON.stringify({
    version:30,complete:true,time:Date.now(),rows:[{id:1,path:'fixture/one.jpg'}]
  }));
  const virtual=await rt.roundTrip('album/detail',
    'id='+ROUTE+'&itemId='+ROUTE+'&itemType=album',
    {success:true,data:{album:nativeAlbum}},{mappedResponse:true});
  assert.equal(new URLSearchParams(virtual.mapped.body).get('itemId'),String(NATIVE_ITEM_ID),
    platform+' remaps the virtual route before the upstream request');
  const virtualAlbum=JSON.parse(virtual.result.body).data.album;
  assert.equal(virtualAlbum.id,ROUTE,platform+' restores the virtual route in the response');
  assert.equal(virtualAlbum.itemId,ROUTE,platform+' keeps id/itemId aligned');

  const browser=rt.request('https://www.exhobby.net/picture/'+ITEM,'',900,'POST');
  browser.headers={Cookie:'PLATFORM_COOKIE','User-Agent':'Safari fixture'};
  await rt.run(browser,response(platform,200,'[{"id":1,"path":"fixture/one.jpg"}]'));
  assert.equal(JSON.parse(rt.store.get(NS+'browser-session')).cookie,'PLATFORM_COOKIE',
    platform+' accepts its native response status field');

  const statusReq=rt.request('https://www.exhobby.net/__hpoi_cache_status__','',901,'GET');
  const status=await rt.run(statusReq,response(platform,404,'not found'));
  assert(String(status.body).includes('EXHOBBY 缓存状态'));
  if(platform==='quantumult-x')assert.equal(status.status,'HTTP/1.1 200 OK');
  else assert.equal(status.status,200,platform+' receives a numeric replacement status');

  // Missing browser session exercises the platform notification adapter.
  rt.store.delete(NS+'browser-session');
  rt.store.delete(NS+'all:'+ITEM+':gallery');
  rt.notices.length=0;
  const notice=await rt.roundTrip('hobby/album','id='+ITEM+'&page=1&pageSize=10',
    {success:true,data:{list:[nativeAlbum]}});
  assert.equal(JSON.stringify(notice.result),'{}');
  assert.equal(rt.notices.length,1,platform+' posts one verification notification');
  const noticeOptions=rt.notices[0][3];
  if(platform==='quantumult-x')assert.equal(noticeOptions['open-url'],'https://www.exhobby.net/search');
  if(platform==='surge')assert.equal(noticeOptions.url,'https://www.exhobby.net/search');
  if(platform==='loon')assert.equal(noticeOptions.openUrl,'https://www.exhobby.net/search');

  // A configured Bark endpoint exercises $task.fetch or $httpClient without exposing cookies/tokens.
  const bark=runtime(platform);
  bark.store.set(NS+'seed:album/detail',rt.store.get(NS+'seed:album/detail'));
  bark.store.set(NS+'seed:pic/list/relate-v2',rt.store.get(NS+'seed:pic/list/relate-v2'));
  bark.store.set(NS+'all:'+ITEM+':hobby',JSON.stringify({hobbyId:74515}));
  bark.store.set(NS+'bark-push-url','https://api.day.app/FAKE_KEY');
  await bark.roundTrip('hobby/album','id='+ITEM+'&page=1&pageSize=10',
    {success:true,data:{list:[nativeAlbum]}});
  assert(bark.calls.some(call=>call.url==='https://api.day.app/FAKE_KEY'),
    platform+' uses its HTTP adapter for Bark');
  assert.equal(bark.notices.length,0,platform+' does not duplicate a successful Bark push');
}

(async()=>{
  for(const platform of ['quantumult-x','surge','loon'])await verifyPlatform(platform);

  const surge=fs.readFileSync(path.join(root,'hpoi-exhobby.sgmodule'),'utf8');
  assert(surge.includes('[Script]')&&surge.includes('[MITM]'));
  assert(surge.includes('type=http-request')&&surge.includes('type=http-response'));
  assert(surge.includes('hpoi-exhobby-v3.7.0.js'));
  assert(surge.includes('hostname = %APPEND% www.hpoi.net.cn, rfx.hpoi.net, www.exhobby.net'));
  surge.split('\n').filter(line=>line.includes('type=http-')).forEach(line=>{
    const match=line.match(/pattern=(.*?),requires-body=|pattern=(.*?),timeout=/);
    assert(match,'Surge script pattern is readable: '+line);
    assert.doesNotThrow(()=>new RegExp(match[1]||match[2]));
  });

  const loon=fs.readFileSync(path.join(root,'hpoi-exhobby.plugin'),'utf8');
  assert(loon.includes('[Url Rewrite]')&&loon.includes('[Script]')&&loon.includes('[MITM]'));
  assert(loon.includes('http-request ')&&loon.includes('http-response '));
  assert(loon.includes('hpoi-exhobby-v3.7.0.js'));
  assert(loon.includes('reject-dict'));
  loon.split('\n').filter(line=>/^http-(?:request|response) /.test(line)).forEach(line=>{
    const match=line.match(/^http-(?:request|response) (.*?) script-path=/);
    assert(match,'Loon script pattern is readable: '+line);
    assert.doesNotThrow(()=>new RegExp(match[1]));
  });

  const clash=fs.readFileSync(path.join(root,'hpoi-ads-clash.yaml'),'utf8');
  const clashExample=fs.readFileSync(path.join(root,'hpoi-clash-example.yaml'),'utf8');
  assert(clash.startsWith('# HPOI third-party ad domains'));
  assert(clash.includes('payload:')&&clash.includes('DOMAIN-SUFFIX,pangolin-sdk-toutiao.com'));
  assert(clashExample.includes('behavior: classical')&&clashExample.includes('RULE-SET,hpoi-ads,REJECT'));
  assert(!clash.includes('hpoi.net.cn'),'Clash ad provider must not block HPOI core hosts');

  function canonicalRules(text,kind){
    return text.split('\n').map(line=>line.trim()).filter(line=>{
      if(!line||line.startsWith('#'))return false;
      if(kind==='qx')return /^(?:host|host-suffix),/i.test(line);
      if(kind==='clash')return /^- DOMAIN(?:-SUFFIX)?,/.test(line);
      return /^DOMAIN(?:-SUFFIX)?,/.test(line);
    }).map(line=>{
      line=line.replace(/^-\s*/, '');
      const parts=line.split(',').map(value=>value.trim());
      if(kind==='qx')parts[0]=parts[0].toLowerCase()==='host'?'DOMAIN':'DOMAIN-SUFFIX';
      return parts[0]+','+parts[1].toLowerCase();
    }).sort();
  }
  const qxAds=fs.readFileSync(path.join(root,'hpoi-ads-filter.list'),'utf8');
  assert.deepEqual(canonicalRules(surge,'surge'),canonicalRules(qxAds,'qx'),
    'Surge ad domains stay aligned with Quantumult X');
  assert.deepEqual(canonicalRules(loon,'loon'),canonicalRules(qxAds,'qx'),
    'Loon ad domains stay aligned with Quantumult X');
  assert.deepEqual(canonicalRules(clash,'clash'),canonicalRules(qxAds,'qx'),
    'Clash/Mihomo ad domains stay aligned with Quantumult X');

  console.log('PASS: Quantumult X, Surge and Loon runtime adapters preserve request correlation, storage, status, notifications and HTTP calls.');
  console.log('PASS: Surge module, Loon plugin and Clash/Mihomo classical ad provider contain the required platform sections.');
})().catch(error=>{console.error(error);process.exitCode=1;});
