// task-010 plan C: 3D shape edits. Part 1 exercises lib/cad-edits.ts on a real GLB parsed by three's GLTFLoader (node index <-> clone mapping,
// multi-primitive meshes, matrix nodes, edits-before-layout order, determinism). Part 2 runs the real /api/models/[id]/edits handlers
// against a temp cwd (never the real .local-data): ranges/kinds, caps, revision 409, owner rules, delete cascade, validation cache.
const fs=require('fs'),os=require('os'),path=require('path'),ts=require('typescript'),assert=require('assert/strict'),crypto=require('crypto');
const ROOT=process.cwd(),BASE='http://studio.test',NF={error:'찾을 수 없습니다.'};
function world({cwd,env={},three}){
 const cache=new Map(),fakeProcess={cwd:()=>cwd,env,platform:process.platform,stdout:process.stdout,stderr:process.stderr};
 // The ESM build of three (the one GLTFLoader uses) so that instanceof checks agree between the loader and lib/cad-edits.ts.
 const stubs={'server-only':{},three,'next/server':{after:()=>{},NextResponse:{next:()=>({}),json:(body,init={})=>({status:init.status||200,body})}}};
 function load(file){
  const key=path.resolve(file);if(cache.has(key))return cache.get(key).exports;
  const module={exports:{}};cache.set(key,module);
  const code=ts.transpileModule(fs.readFileSync(key,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const dir=path.dirname(key);
  const localRequire=id=>{
   if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id];
   if(id.startsWith('.')){const target=path.resolve(dir,id);if(id.endsWith('.json'))return require(target);for(const candidate of [target+'.ts',path.join(target,'index.ts')])if(fs.existsSync(candidate))return load(candidate);throw Error('cannot resolve '+id);}
   return require(id);
  };
  new Function('module','exports','require','process',code)(module,module.exports,localRequire,fakeProcess);
  return module.exports;
 }
 return {load};
}
function request(method,pathname,{cookie,json,body,headers={}}={}){
 const init={method,headers:{host:'studio.test',...(cookie?{cookie}:{}),...headers}};
 if(json!==undefined){init.body=JSON.stringify(json);init.headers['content-type']='application/json';init.headers['content-length']=String(Buffer.byteLength(init.body));}
 if(body!==undefined)init.body=body;
 if(!['GET','HEAD','OPTIONS'].includes(method))init.headers.origin=BASE;
 return new Request(BASE+pathname,init);
}
async function sized(options){
 if(!options.form)return options;
 const probe=new Response(options.form),bytes=Buffer.from(await probe.arrayBuffer());
 return {...options,form:undefined,body:bytes,headers:{...(options.headers||{}),'content-type':probe.headers.get('content-type'),'content-length':String(bytes.length)}};
}
function glb(gltf={},bin){
 const base={asset:{version:'2.0'},scenes:[{}],nodes:[{}],meshes:[{}]};
 const json=Buffer.from(JSON.stringify({...base,...gltf}));
 const paddedJson=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
 const paddedBin=bin?Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]):null;
 const total=12+8+paddedJson.length+(paddedBin?8+paddedBin.length:0);
 const header=Buffer.alloc(20);header.write('glTF',0,'ascii');header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);header.writeUInt32LE(paddedJson.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const parts=[header,paddedJson];
 if(paddedBin){const chunk=Buffer.alloc(8);chunk.writeUInt32LE(paddedBin.length,0);chunk.writeUInt32LE(0x004e4942,4);parts.push(chunk,paddedBin);}
 return Buffer.concat(parts);
}
// Five nodes (4 is a joint of a skin = a bone): 0 root(translation) > [1 "multi" (mesh with TWO primitives, storey 2 at 3.6 m), 2 "single" (mesh 1)]; 3 is defined by `matrix` (also mesh 1, so mesh 1 is shared).
const triangle=Buffer.from(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer);
const sample=()=>glb({
 scenes:[{nodes:[0,3,4]}],skins:[{joints:[4]}],
 nodes:[
  {name:'root',translation:[1,2,3],children:[1,2]},
  {name:'multi',mesh:0,extras:{storeyId:'2',elevationM:3.6}},
  {name:'single',mesh:1,translation:[5,0,0]},
  {name:'matrixNode',mesh:1,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,7,0,0,1]},
  {name:'bone'},
 ],
 meshes:[{primitives:[{attributes:{POSITION:0},material:0},{attributes:{POSITION:0},material:1}]},{primitives:[{attributes:{POSITION:0},material:0}]}],
 materials:[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],roughnessFactor:0.9}},{pbrMetallicRoughness:{baseColorFactor:[0,1,0,1]}}],
 accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],bufferViews:[{buffer:0,byteLength:36}],buffers:[{byteLength:36}],
},triangle);

(async()=>{
 const THREE=await import('three');
 const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'ms-cadedits-')),data=path.join(cwd,'.local-data'),modelDir=path.join(data,'models');
 const {load}=world({cwd,env:{REQUIREMENTS_ADMIN_EMAILS:'op@example.com'},three:THREE});
 const lib=load('lib/cad-edits.ts');

 // ================= part 1: lib/cad-edits.ts
 const bytes=sample();
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 lib.tagNodeIndices(gltf);
 const byName=(root,name)=>{let found=null;root.traverse(o=>{if(o.name===name)found=o;});return found;};
 const indexed=root=>{const map=new Map();root.traverse(o=>{if(typeof o.userData.nodeIndex==='number')map.set(o.userData.nodeIndex,o);});return map;};
 // original node index <-> object, on the loaded scene and on every clone
 const original=indexed(gltf.scene);
 assert.deepEqual([...original.keys()].sort(),[0,1,2,3,4]);
 assert.equal(original.get(0).name,'root');assert.equal(original.get(2).name,'single');
 const multi=original.get(1);assert.equal(multi.type,'Group','a mesh with several primitives is one node (a Group)');
 assert.equal(multi.children.length,2);assert.ok(multi.children.every(child=>child.isMesh&&child.userData.nodeIndex===undefined),'primitives carry no node index; the parent node does');
 assert.equal(original.get(3).userData.cadMatrix,true);assert.equal(original.get(4).userData.cadSkin,true,'a joint is locked');assert.equal(original.get(3).userData.cadSkin,undefined);assert.equal(original.get(2).userData.cadMatrix,undefined);
 const cloned=indexed(gltf.scene.clone(true));
 assert.deepEqual([...cloned.entries()].map(([i,o])=>[i,o.name]).sort(),[...original.entries()].map(([i,o])=>[i,o.name]).sort(),'clone keeps every index');
 assert.notEqual(cloned.get(1),original.get(1));assert.equal(cloned.get(1).children.length,2);
 lib.tagNodeIndices(gltf);assert.equal(indexed(gltf.scene).size,5,'tagging twice is harmless');
 console.log('PASS: original glTF node index is written to userData.nodeIndex and survives clone, including a mesh with two primitives (index on the parent Group) and a matrix node');

 const layout={visibleFloors:[true,true],exploded:false};
 const none=lib.emptyEdits();
 const edits={schemaVersion:1,revision:3,overrides:{
  '1':{position:[0,10,0],color:'#ff0000',roughness:0.2},
  '2':{rotation:[0,90,0],scale:[2,2,2],position:[1,0,0]},
  '3':{position:[9,9,9],hidden:true,color:'#00ff00'},
  '4':{position:[1,1,1],hidden:true},
 }};
 const snapshot=root=>{const rows=[];root.traverse(o=>{rows.push([o.name,o.type,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray(),o.visible,o.isMesh?(Array.isArray(o.material)?o.material:[o.material]).map(m=>[m.color.getHexString(),m.roughness]):null]);});return JSON.stringify(rows);};
 const baseline=lib.buildEditedScene(gltf.scene,none,layout);
 const a=lib.buildEditedScene(gltf.scene,edits,layout),b=lib.buildEditedScene(gltf.scene,edits,layout);
 assert.equal(snapshot(a.scene),snapshot(b.scene),'same input, same result');
 assert.deepEqual(a.dimensions,baseline.dimensions,'edits never change the centering/dimensions');
 assert.deepEqual(a.scene.position.toArray(),baseline.scene.position.toArray());
 const A=indexed(a.scene),Z=indexed(baseline.scene);
 // node 2: offset added to ORIGINAL local translation, rotation after the original, scale multiplied
 assert.deepEqual(A.get(2).position.toArray(),[6,0,0]);assert.deepEqual(A.get(2).scale.toArray(),[2,2,2]);
 const turned=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,0,'XYZ'));
 assert.ok(A.get(2).quaternion.angleTo(turned)<1e-9);
 // multi-primitive node: material edit reaches both primitives, on clones only
 const own=A.get(1).children.map(child=>child.material);
 assert.deepEqual(own.map(m=>m.color.getHexString()),['ff0000','ff0000']);assert.deepEqual(own.map(m=>m.roughness),[0.2,0.2]);
 assert.notEqual(own[0],original.get(1).children[0].material,'edited material is a clone');
 assert.equal(original.get(1).children[0].material.color.getHexString(),'ffffff','source scene untouched');
 assert.equal(A.get(2).material.color.getHexString(),'ffffff','node 2 keeps its material (the mesh is shared with the matrix node)');
 // matrix node: every edit is ignored
 assert.deepEqual(A.get(4).position.toArray(),Z.get(4).position.toArray());assert.equal(A.get(4).visible,true,'bone/skin nodes ignore edits');
 assert.deepEqual(A.get(3).position.toArray(),Z.get(3).position.toArray());assert.equal(A.get(3).visible,true);assert.equal(A.get(3).material.color.getHexString(),'ffffff');
 console.log('PASS: edits apply on top of the original local TRS, reach both primitives of a multi-primitive node, leave the source scene and matrix nodes alone, and are deterministic');

 // order: edits first, layout (floor + explode) added afterwards, never the other way round and never accumulating
 const explodedLayout={visibleFloors:[true,true],exploded:true};
 const e=lib.buildEditedScene(gltf.scene,edits,explodedLayout),E=indexed(e.scene);
 assert.ok(Math.abs(E.get(1).position.y-(3.6+10+0.85))<1e-9,'storey 2: elevation + edit + explode offset');
 assert.ok(Math.abs(Z.get(1).position.y-3.6)<1e-9);
 assert.ok(Math.abs(indexed(lib.buildEditedScene(gltf.scene,none,explodedLayout).scene).get(1).position.y-(3.6+0.85))<1e-9);
 lib.applyEdits(e.scene,edits,explodedLayout);lib.applyEdits(e.scene,edits,explodedLayout);
 assert.ok(Math.abs(E.get(1).position.y-14.45)<1e-9,'applying twice does not accumulate');
 lib.applyEdits(e.scene,edits,layout);assert.ok(Math.abs(E.get(1).position.y-13.6)<1e-9,'explode off again');
 lib.applyEdits(e.scene,none,layout);assert.equal(snapshot(e.scene).replace(/"root"/,'"root"'),snapshot(baseline.scene).replace(/"root"/,'"root"'),'empty edits restore the original (root offset aside)');
 assert.equal(E.get(1).children[0].material,original.get(1).children[0].material,'empty edits give the original material back');
 // visibility = (not hidden by edit) AND (floor shown)
 const hide={schemaVersion:1,revision:0,overrides:{'1':{hidden:true},'2':{hidden:true}}};
 const floorOff={visibleFloors:[true,false],exploded:false};
 assert.equal(indexed(lib.buildEditedScene(gltf.scene,none,floorOff).scene).get(1).visible,false,'floor off hides the storey node');
 assert.equal(indexed(lib.buildEditedScene(gltf.scene,hide,layout).scene).get(1).visible,false,'edit hides it');
 assert.equal(indexed(lib.buildEditedScene(gltf.scene,hide,layout).scene).get(2).visible,false);
 assert.equal(indexed(lib.buildEditedScene(gltf.scene,{...hide,overrides:{}},layout).scene).get(1).visible,true);
 assert.equal(indexed(lib.buildEditedScene(gltf.scene,hide,floorOff).scene).get(1).visible,false,'hidden by edit stays hidden when its floor is shown again elsewhere');
 console.log('PASS: floor explode is added after the edits (3.6 + 10 + 0.85), repeated/toggled application does not accumulate, empty edits restore the original, hidden and floor visibility combine');


 // isMesh instead of instanceof (two copies of three must not skip materials); dispose; picking helper; pure UI helpers
 assert.ok(!/instanceof\s+THREE\.Mesh/.test(fs.readFileSync(path.join(ROOT,'lib','cad-edits.ts'),'utf8')));
 const fresh=lib.buildEditedScene(gltf.scene,edits,layout),F=indexed(fresh.scene);
 const editedMaterials=F.get(1).children.map(child=>child.material),sourceMaterial=original.get(1).children[0].material;
 const disposed=new Set();for(const material of [...editedMaterials,sourceMaterial])material.addEventListener('dispose',()=>disposed.add(material));
 lib.disposeEditedScene(fresh.scene);
 assert.ok(editedMaterials.every(material=>disposed.has(material)),'edited clones are disposed');assert.ok(!disposed.has(sourceMaterial),'the source material is not');
 assert.equal(F.get(1).children[0].material,sourceMaterial,'disposed scene points back at the originals');
 const rebuilt=lib.buildEditedScene(gltf.scene,edits,layout),R=indexed(rebuilt.scene);
 const firstClone=R.get(1).children[0].material;let freed=false;firstClone.addEventListener('dispose',()=>{freed=true;});
 lib.applyEdits(rebuilt.scene,{...edits,overrides:{...edits.overrides,'1':{color:'#0000ff'}}},layout);
 assert.ok(freed,'re-applying frees the previous clone');assert.equal(R.get(1).children[0].material.color.getHexString(),'0000ff');
 const hiddenScene=lib.buildEditedScene(gltf.scene,{schemaVersion:1,revision:0,overrides:{'1':{hidden:true}}},layout),H=indexed(hiddenScene.scene);
 assert.equal(lib.isEffectivelyVisible(H.get(1).children[0]),false,'a primitive under a hidden node is not pickable');
 assert.equal(lib.isEffectivelyVisible(H.get(2)),true);assert.equal(lib.isEffectivelyVisible(null),true);
 const limits=load('lib/cad-edit-limits.ts');
 assert.equal(limits.clampEditValue('position',5000),1000);assert.equal(limits.clampEditValue('position',-5000),-1000);assert.equal(limits.clampEditValue('rotation',400),360);
 assert.equal(limits.clampEditValue('scale',0),0.01);assert.equal(limits.clampEditValue('scale',500),100);assert.equal(limits.clampEditValue('scale',2),2);
 let stack=[];for(let i=0;i<60;i++)stack=limits.pushUndo(stack,i);
 assert.equal(stack.length,50);assert.equal(stack[0],10);assert.equal(stack[49],59);
 assert.deepEqual(limits.editedNodes({'10':{hidden:true},'2':{color:'#ffffff'}}),[{index:2,hidden:false},{index:10,hidden:true}]);
 assert.equal(limits.hasUnsavedEdits({'1':{hidden:true}},{'1':{hidden:true}}),false);assert.equal(limits.hasUnsavedEdits({},{'1':{hidden:true}}),true);
 const importers=['app/api/models/[id]/edits/route.ts','lib/server/cad-models.ts'].map(file=>fs.readFileSync(path.join(ROOT,file),'utf8'));
 assert.ok(importers.every(text=>!/from '[./]*\/(lib\/)?cad-edits'/.test(text)),'server code imports the limits file, not the three-dependent module');
 console.log('PASS: isMesh check, edited clones disposed on rebuild/dispose (source material untouched), hidden nodes are not pickable, clamp/undo(50)/edited list/unsaved helpers, server code does not import cad-edits');

 // ================= part 2: API
 const {load: loadServer}=world({cwd,env:{REQUIREMENTS_ADMIN_EMAILS:'op@example.com'},three:THREE});
 const accounts=loadServer('lib/account-store.ts');
 const make=async(name,email)=>{const account=await accounts.writeAccount({name,email,password:'correct horse 123'});const token=await accounts.createSession({id:account.id,name,email});return {id:account.id,cookie:`${accounts.SESSION_COOKIE}=${token}`};};
 const A1=await make('가','a@example.com'),B1=await make('나','b@example.com'),OP=await make('운영자','op@example.com');
 const routes={list:loadServer('app/api/models/route.ts'),item:loadServer('app/api/models/[id]/route.ts'),edits:loadServer('app/api/models/[id]/edits/route.ts')};
 const models=loadServer('lib/server/cad-models.ts'),validator=loadServer('lib/glb-validate.ts');
 let validations=0;const realValidate=validator.validateGlb;validator.validateGlb=(...args)=>{validations++;return realValidate(...args);};
 const call=async(mod,method,pathname,who,options={},params={})=>mod[method](request(method,pathname,{cookie:who?.cookie,...await sized(options)}),{params:Promise.resolve(params)});
 const upload=async(who,bytes,name='m.glb')=>{const form=new FormData();form.append('file',new File([bytes],name));return call(routes.list,'POST','/api/models',who,await sized({form}));};
 const getEdits=(who,id)=>call(routes.edits,'GET',`/api/models/${id}/edits`,who,{},{id});
 const putEdits=(who,id,json,options={})=>call(routes.edits,'PUT',`/api/models/${id}/edits`,who,json===undefined?options:{json,...options},{id});
 const doc=(overrides,revision=0,extra={})=>({schemaVersion:1,revision,overrides,...extra});
 const editsFile=id=>path.join(modelDir,id,'edits.json');
 const readModel=id=>JSON.parse(fs.readFileSync(path.join(modelDir,id+'.json'),'utf8'));
 let res;

 res=await upload(A1,sample());assert.equal(res.status,201);const M=await res.json();
 assert.equal(M.validated.nodeCount,5);assert.deepEqual(M.validated.matrixNodes,[3]);assert.deepEqual(M.validated.skinNodes,[4]);
 res=await getEdits(A1,M.id);assert.equal(res.status,200);assert.deepEqual(await res.json(),{schemaVersion:1,revision:0,overrides:{}});
 const valid={'1':{position:[0,10,0],rotation:[0,90,-360],scale:[0.01,1,100],hidden:true,color:'#FF8800',roughness:0},'2':{roughness:1}};
 res=await putEdits(A1,M.id,doc(valid));assert.equal(res.status,200);
 const saved=await res.json();assert.equal(saved.revision,1);assert.equal(saved.overrides['1'].color,'#ff8800');
 assert.deepEqual(await (await getEdits(A1,M.id)).json(),saved);assert.ok(fs.existsSync(editsFile(M.id)));
 assert.equal(readModel(M.id).views,undefined);
 assert.ok(!fs.readdirSync(modelDir).some(name=>name.endsWith('.json')&&name!==M.id+'.json'),'no edits record is listed next to model records');
 assert.equal((await (await call(routes.list,'GET','/api/models',A1)).json()).length,1,'the model list is not affected by the edit document');
 console.log('PASS: edits GET (empty default) / PUT round trip, revision 0 -> 1, color normalized, stored in the model folder');

 // revision
 res=await putEdits(A1,M.id,doc({}));assert.equal(res.status,409);assert.equal((await res.json()).revision,1,'409 tells the current revision');
 assert.deepEqual(await (await getEdits(A1,M.id)).json(),saved,'409 changed nothing');
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},1));assert.equal(res.status,200);assert.equal((await res.json()).revision,2);
 const race=await Promise.all(Array.from({length:5},(_,i)=>putEdits(A1,M.id,doc({'2':{roughness:i/10}},2))));
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409,409,409,409],'concurrent saves from the same revision: exactly one wins');
 assert.equal((await (await getEdits(A1,M.id)).json()).revision,3);
 console.log('PASS: stale revision gives 409 (nothing written), concurrent saves from one revision let exactly one through');

 // ranges and kinds
 const bad={
  'schemaVersion 2':doc({}, 3,{schemaVersion:2}),'no schemaVersion':(({schemaVersion,...rest})=>rest)(doc({},3)),'unknown top field':doc({},3,{extra:1}),'client id':doc({},3,{id:'x'}),
  'revision negative':doc({},-1),'revision fraction':doc({},1.5),'revision string':doc({},'3'),'overrides array':doc([],3),'overrides null':doc(null,3),
  'node out of range':doc({'5':{hidden:true}},3),'skin/bone node':doc({'4':{hidden:true}},3),'node negative':doc({'-1':{hidden:true}},3),'node leading zero':doc({'01':{hidden:true}},3),'node name':doc({abc:{hidden:true}},3),'node float':doc({'1.5':{hidden:true}},3),
  'matrix node':doc({'3':{hidden:true}},3),'empty edit':doc({'1':{}},3),'edit not object':doc({'1':true},3),'edit array':doc({'1':[]},3),
  'metalness':doc({'1':{metalness:0.5}},3),'unknown edit field':doc({'1':{visible:false}},3),
  'position over':doc({'1':{position:[1001,0,0]}},3),'position under':doc({'1':{position:[0,-1001,0]}},3),'position length':doc({'1':{position:[0,0]}},3),'position string':doc({'1':{position:[0,'1',0]}},3),'position null':doc({'1':{position:[0,null,0]}},3),
  'rotation over':doc({'1':{rotation:[361,0,0]}},3),'rotation under':doc({'1':{rotation:[0,-361,0]}},3),
  'scale zero':doc({'1':{scale:[0,1,1]}},3),'scale small':doc({'1':{scale:[0.009,1,1]}},3),'scale big':doc({'1':{scale:[1,101,1]}},3),'scale negative':doc({'1':{scale:[-1,1,1]}},3),
  'hidden type':doc({'1':{hidden:'yes'}},3),'color name':doc({'1':{color:'red'}},3),'color short':doc({'1':{color:'#fff'}},3),'color type':doc({'1':{color:16711680}},3),
  'roughness over':doc({'1':{roughness:1.01}},3),'roughness negative':doc({'1':{roughness:-0.01}},3),'roughness string':doc({'1':{roughness:'0.5'}},3),
 };
 for(const [label,body] of Object.entries(bad)){res=await putEdits(A1,M.id,body);assert.equal(res.status,400,label);assert.ok((await res.json()).error,label);}
 for(const raw of ['not json','null','[]','7']){res=await putEdits(A1,M.id,undefined,{body:Buffer.from(raw),headers:{'content-length':String(raw.length)}});assert.equal(res.status,400,'body '+raw);}
 assert.equal((await (await getEdits(A1,M.id)).json()).revision,3,'no refused body changed anything');
 res=await putEdits(A1,M.id,doc({'0':{position:[1000,-1000,1000],rotation:[360,-360,0],scale:[100,0.01,1],roughness:0.5}},3));assert.equal(res.status,200,'range edges are accepted');
 console.log(`PASS: ${Object.keys(bad).length} out-of-range / wrong-kind / matrix-node / unknown-field bodies give 400, range edges accepted, nothing written by refused bodies`);

 // caps: 500 overrides, 64KB
 res=await upload(A1,glb({nodes:Array.from({length:600},()=>({}))}));assert.equal(res.status,201);const Big=await res.json();
 const many=count=>Object.fromEntries(Array.from({length:count},(_,i)=>[String(i),{hidden:true}]));
 res=await putEdits(A1,Big.id,doc(many(501)));assert.equal(res.status,400);assert.match((await res.json()).error,/500/);
 res=await putEdits(A1,Big.id,doc(many(500)));assert.equal(res.status,200);assert.equal(Object.keys((await res.json()).overrides).length,500);
 const pad=(json,size)=>{const text=JSON.stringify(json);return Buffer.from(text+' '.repeat(size-Buffer.byteLength(text)));};
 const withBody=(buffer,headers={})=>putEdits(A1,Big.id,undefined,{body:buffer,headers:{'content-length':String(buffer.length),...headers}});
 res=await withBody(pad(doc({'1':{hidden:true}},1),65536+1));assert.equal(res.status,413,'65537 bytes');
 res=await withBody(pad(doc({'1':{hidden:true}},1),70000));assert.equal(res.status,413);
 res=await withBody(pad(doc({'1':{hidden:true}},1),70000),{'content-length':'500'});assert.equal(res.status,413,'a lying Content-Length does not hide an oversized body');
 res=await putEdits(A1,Big.id,undefined,{body:Buffer.from('{}')});assert.equal(res.status,411,'no Content-Length');
 res=await withBody(pad(doc({'1':{hidden:true}},1),65536));assert.equal(res.status,200,'exactly 64KB is accepted');
 assert.equal((await (await getEdits(A1,Big.id)).json()).revision,2);
 console.log('PASS: 501 overrides -> 400, 500 ok; body over 64KB -> 413 (also with a lying Content-Length), no Content-Length -> 411, exactly 64KB ok');

 // owners: B session and operator can neither read nor change foreign edits
 const before=fs.readFileSync(editsFile(M.id),'utf8');
 for(const [who,label] of [[B1,'B'],[OP,'operator']]){
  res=await putEdits(who,M.id,doc({'1':{hidden:true}},3));assert.equal(res.status,404,label+' PUT');assert.deepEqual(await res.json(),NF);
 }
 res=await getEdits(B1,M.id);assert.equal(res.status,404);assert.deepEqual(await res.json(),NF);
 res=await getEdits(OP,M.id);assert.equal(res.status,200,'operator may view');
 assert.equal((await getEdits(null,M.id)).status,401);assert.equal((await putEdits(null,M.id,doc({}))).status,401);
 res=await getEdits(A1,crypto.randomUUID());assert.equal(res.status,404);res=await putEdits(A1,'not-an-id',doc({}));assert.equal(res.status,404);
 assert.equal(fs.readFileSync(editsFile(M.id),'utf8'),before,'foreign attempts changed nothing');
 console.log('PASS: B session and operator PUT get the fixed 404 and change nothing, B GET 404, operator GET allowed, anonymous 401');

 // validation cache (10장 9항)
 validations=0;
 const rev=()=>getEdits(A1,M.id).then(r=>r.json()).then(d=>d.revision);
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},await rev()));assert.equal(res.status,200);assert.equal(validations,0,'same mtime and size: no re-validation');
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},await rev()));assert.equal(validations,0);
 const glbFile=path.join(modelDir,M.id+'.glb'),stat=fs.statSync(glbFile);
 fs.utimesSync(glbFile,stat.atime,new Date(stat.mtimeMs-5000));
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},await rev()));assert.equal(res.status,200);assert.equal(validations,1,'changed mtime: validated once');
 assert.equal(readModel(M.id).validated.mtimeMs,fs.statSync(glbFile).mtimeMs);
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},await rev()));assert.equal(validations,1,'and remembered');
 // a record from before this change has no stamp: validated on first use
 const record=readModel(M.id);delete record.validated;fs.writeFileSync(path.join(modelDir,M.id+'.json'),JSON.stringify(record));
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},await rev()));assert.equal(res.status,200);assert.equal(validations,2);assert.ok(readModel(M.id).validated);
 // a stamp without skin information (from before skinNodes) is not trusted either
 const stale=readModel(M.id);delete stale.validated.skinNodes;fs.writeFileSync(path.join(modelDir,M.id+'.json'),JSON.stringify(stale));
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},await rev()));assert.equal(res.status,200);assert.equal(validations,3);assert.deepEqual(readModel(M.id).validated.skinNodes,[4]);
 validations=2;
 // a re-check shares the upload slots
 fs.utimesSync(glbFile,stat.atime,new Date(stat.mtimeMs-9000));
 const held=[models.acquireUploadSlot(),models.acquireUploadSlot()];
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},await rev()));assert.equal(res.status,429);assert.equal(validations,2);
 held.forEach(release=>release());
 // a file that no longer validates is marked invalid and refuses edits from then on
 fs.writeFileSync(glbFile,glb({buffers:[{byteLength:4,uri:'http://evil.example/a.bin'}]}));
 const revision=await rev();
 res=await putEdits(A1,M.id,doc({'2':{hidden:true}},revision));assert.equal(res.status,400);assert.ok(readModel(M.id).invalid);
 res=await putEdits(A1,M.id,doc({},revision));assert.equal(res.status,400);assert.equal(await rev(),revision,'nothing saved for an invalid model');
 console.log('PASS: validation cache — same mtime/size skips validateGlb, changed mtime or missing stamp re-validates once, re-check uses upload slots (429 when full), failure marks the model invalid');

 // a damaged edit document is never silently reset: fixed-message 500, file untouched
 res=await upload(A1,sample());const C=await res.json();
 assert.equal((await putEdits(A1,C.id,doc({'1':{hidden:true}}))).status,200);
 for(const garbage of ['{broken','[]','{"schemaVersion":1,"revision":"x","overrides":{}}','{"schemaVersion":1,"revision":1}']){
  fs.writeFileSync(editsFile(C.id),garbage);
  for(const r of [await getEdits(A1,C.id),await putEdits(A1,C.id,doc({'1':{hidden:true}},1))]){
   assert.equal(r.status,500,garbage);const body=await r.json();assert.deepEqual(body,{error:'저장된 편집 문서를 읽을 수 없습니다.'});
  }
  assert.equal(fs.readFileSync(editsFile(C.id),'utf8'),garbage,'damaged file left as it is');
 }
 fs.rmSync(editsFile(C.id));assert.equal((await getEdits(A1,C.id)).status,200,'a missing document (ENOENT) is simply empty');
 // any other failure (an fs error that carries a path) is a fixed 500 and the message never reaches the client
 const realWrite=fs.promises.writeFile;
 fs.promises.writeFile=async(file)=>{throw Object.assign(new Error('EACCES: permission denied, open '+file),{code:'EACCES'});};
 res=await putEdits(A1,C.id,doc({'1':{hidden:true}}));fs.promises.writeFile=realWrite;
 assert.equal(res.status,500);const failure=await res.text();assert.deepEqual(JSON.parse(failure),{error:'편집을 처리하지 못했습니다.'});assert.ok(!failure.includes(cwd)&&!failure.includes('EACCES'));
 // validation messages are still shown (HttpError 400)
 res=await putEdits(A1,C.id,doc({'1':{hidden:'x'}}));assert.equal(res.status,400);assert.match((await res.json()).error,/숨김/);
 console.log('PASS: damaged edit document -> fixed 500 for GET and PUT without touching the file, missing -> empty, other fs errors -> fixed 500 without paths, validation errors keep their message');

 // delete cascade and a vanished .glb
 res=await upload(A1,sample());const D=await res.json();
 assert.equal((await putEdits(A1,D.id,doc({'1':{hidden:true}}))).status,200);assert.ok(fs.existsSync(editsFile(D.id)));
 res=await call(routes.item,'DELETE','/x',A1,{},{id:D.id});assert.equal(res.status,200);
 assert.ok(!fs.existsSync(path.join(modelDir,D.id)),'edit folder removed with the model');assert.ok(!fs.existsSync(path.join(modelDir,D.id+'.json')));
 assert.equal((await getEdits(A1,D.id)).status,404);assert.equal((await putEdits(A1,D.id,doc({}))).status,404);assert.ok(!fs.existsSync(path.join(modelDir,D.id)),'a write after delete creates nothing');
 res=await upload(A1,sample());const G=await res.json();
 fs.rmSync(path.join(modelDir,G.id+'.glb'));
 res=await putEdits(A1,G.id,doc({'1':{hidden:true}}));assert.equal(res.status,404);assert.ok(!fs.existsSync(path.join(modelDir,G.id)),'a missing .glb is not revived by an edit write');
 console.log('PASS: deleting a model deletes its edit document; writes after delete or with a vanished .glb give 404 and create nothing');
})().catch(error=>{console.error(error);process.exit(1);});
