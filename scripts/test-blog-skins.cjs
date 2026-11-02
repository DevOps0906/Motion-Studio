const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),sharp=require('sharp'),{unzipSync,strFromU8}=require('fflate');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{module,exports:module.exports,process,Buffer,URL,setTimeout,clearTimeout,console,require:id=>{if(id==='server-only')return {};if(id.startsWith('.')){const target=path.resolve(path.dirname(file),id);return id.endsWith('.json')?require(target):load(target+'.ts');}return require(id);}});cache.set(file,module.exports);return module.exports;}
(async()=>{
 const {DEFAULT_BLOG_SKIN,validateBlogSkin,blogWidgetCoordinates}=load('lib/blog-skin.ts');
 const good=validateBlogSkin(DEFAULT_BLOG_SKIN);assert.equal(good.menus.length,5);
 for(const patch of [{brand:''},{menus:[]},{menus:Array(6).fill(good.menus[0])},{menus:[{label:'test',url:'javascript:alert(1)'}]},{accent:'url(bad)'},{widgetTop:900},{widgetOffsetX:201},{imageId:'../../secret'},{logoImageId:'../secret'},{widgetImageUrl:'file:///secret'}])assert.throws(()=>validateBlogSkin({...good,...patch}));
 for(let count=1;count<=5;count++){const areas=blogWidgetCoordinates({...good,menus:good.menus.slice(0,count)});assert.equal(areas.length,count);assert.ok(areas.every(area=>area.x>=0&&area.x+area.width<=1920&&area.y+area.height<=900&&area.width===170&&area.height===100));}
 const renderer=load('lib/server/rasterize.ts'),blog=load('lib/server/blog-skins.ts');
 const transparent=renderer.rasterizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="170" height="100"/>');
 const pixels=await sharp(transparent).ensureAlpha().raw().toBuffer();assert.ok(pixels.every((value,index)=>index%4!==3||value===0));
 assert.throws(()=>renderer.rasterizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="100"/>'));
 const escaped=blog.blogSkinSvg({...good,brand:'<script>alert(1)</script>'});assert.ok(!escaped.includes('<script>'));
 const zip=unzipSync(await blog.exportBlogSkin(good,{id:'qa',operator:false}));
 for(const [file,width,height]of [['skin-background-1920x900.png',1920,900],['title-966x200.png',966,200],['thumbnail-1200x630.png',1200,630],['mobile-cover-1080x1080.png',1080,1080],['transparent-170x100.png',170,100],['transparent-170x500.png',170,500]]){const meta=await sharp(zip[file]).metadata();assert.equal(meta.width,width);assert.equal(meta.height,height);}
 assert.equal(Object.keys(zip).filter(file=>file.startsWith('widgets/')).length,5);
 assert.ok(strFromU8(zip['widgets/menu-1.html']).includes('__TRANSPARENT_IMAGE_URL__'));
 const coords=JSON.parse(strFromU8(zip['coordinates.json']));assert.equal(coords.naverPositionVerified,false);assert.equal(coords.coordinates.length,5);
 fs.mkdirSync('out/qa',{recursive:true});fs.writeFileSync('out/qa/blog-skin-example.png',zip['skin-background-1920x900.png']);fs.writeFileSync('out/qa/blog-skin-example.zip',await blog.exportBlogSkin(good,{id:'qa',operator:false}));
 console.log('PASS: blog validation, menu bounds, resvg alpha, six PNG sizes, five widget codes and manual-install package');
})().catch(error=>{console.error(error);process.exitCode=1;});
