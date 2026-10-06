/* Real Chromium tests of the offline export and clipboard denial. */
const assert=require('assert'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async function({browser,htmlPath,screenshots,cases}){
 const context=await browser.newContext({viewport:{width:1280,height:950},offline:true}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__mathcadCopied=value;}}});});
 try{
  await page.goto(pathToFileURL(htmlPath).href);
  const entries=await page.evaluate(()=>db.catalogs.flatMap(c=>c.entries.map(e=>({catalog:c.id,id:e.id,xml:e.mathcad.formulas[0].xml}))));
  async function open(catalog,id){await page.evaluate(({catalog,id})=>openEntry(catalog,id),{catalog,id});}
  for(const entry of entries){
   await open(entry.catalog,entry.id);await page.locator(`[data-mathcad="${entry.id}"]`).click();assert.equal(await page.evaluate(()=>window.__mathcadCopied),entry.xml,entry.id);
   await options(entry.catalog,entry.id,'formula');await page.evaluate(()=>{window.__mathcadCopied=null;});assert.equal(await copy(),entry.xml,'dialog: '+entry.id);
  }
  cases.push('Mathcad: primary XML copied directly and through options from all '+entries.length+' configured entries');
  async function options(catalog,id,mode='inputs'){await open(catalog,id);await page.locator(`#results [data-mathcad-options="${id}"]`).click();await page.selectOption('#mathcad-mode',mode);}
  async function fill(values){for(const [name,value] of Object.entries(values))await page.locator(`[data-mc-input="${name}"]`).fill(String(value));}
  async function copy(){await page.locator('#mathcad-copy').click();assert(await page.locator('#mathcad-dialog').isHidden(),await page.locator('#mathcad-error').innerText());return page.evaluate(()=>window.__mathcadCopied);}
  async function summary(xml){return page.evaluate(xml=>{
   const d=new DOMParser().parseFromString(xml,'application/xml');if(d.querySelector('parsererror'))throw Error('clipboard XML did not parse');
   const ml='http://schemas.mathsoft.com/math50',ws='http://schemas.mathsoft.com/worksheet50';
   for(const n of d.getElementsByTagName('*'))if(!['id','real','Span','Subscript'].includes(n.localName))for(const c of n.childNodes)if(c.nodeType===Node.TEXT_NODE&&c.textContent.trim())throw Error('Unexpected structural text: '+c.textContent);
   const defines=[...d.getElementsByTagNameNS(ml,'define')];
   return {root:d.documentElement.localName,regions:d.getElementsByTagNameNS(ws,'region').length,left:defines.map(n=>n.firstElementChild.textContent),right:defines.map(n=>n.lastElementChild.textContent),
    labels:[...d.getElementsByTagNameNS(ml,'id')].map(n=>({text:n.textContent,label:n.getAttribute('labels'),contextual:n.getAttribute('label-is-contextual')})),
    functions:d.getElementsByTagNameNS(ml,'function').length,derivatives:d.getElementsByTagNameNS(ml,'derivative').length,evaluations:d.getElementsByTagNameNS(ml,'eval').length,
    matrixValues:[...d.getElementsByTagNameNS(ml,'matrix')].map(n=>[...n.children].map(c=>c.textContent)),
    matrices:[...d.getElementsByTagNameNS(ml,'matrix')].map(n=>({rows:n.getAttribute('rows'),cols:n.getAttribute('cols')}))};
  },xml);}
  const inputExports=await page.evaluate(()=>{
   let count=0;
   for(const entry of db.catalogs.flatMap(c=>c.entries))for(const formula of entry.mathcad.formulas){
    mcOpen(entry.id);$('mathcad-formula').value=formula.id;$('mathcad-mode').value='inputs';mcRefresh();
    for(const info of mcInputInfos([mcSelected()])){
     const input=[...$('mathcad-inputs').querySelectorAll('[data-mc-input]')].find(i=>i.dataset.mcInput===info.name);
     input.value=info.type==='range'?'1;2':info.type==='vector'?'1;2':info.type==='matrix'?'1;2\n3;4':'1';
    }
    mcParse(mcExport());$('mathcad-dialog').close();count++;
   }
   mcDrafts.clear();$('mathcad-inputs').replaceChildren();return count;
  });
  assert.equal(inputExports,await page.evaluate(()=>db.catalogs.reduce((n,c)=>n+c.entries.reduce((m,e)=>m+e.mathcad.formulas.length,0),0)));
  cases.push('Mathcad options: input exports from all '+inputExports+' formula choices');
  await options('el','R09');assert.deepEqual(await page.locator('#mathcad-inputs input').evaluateAll(els=>els.map(i=>i.value)),['','','']);
  await page.locator('#mathcad-copy').click();assert.match(await page.locator('#mathcad-error').innerText(),/Indtast/);
  await fill({E:'<script>',U_kl:10,I:1});await page.locator('#mathcad-copy').click();assert.match(await page.locator('#mathcad-error').innerText(),/endeligt tal/);
  await fill({E:'12,4',U_kl:'11,2',I:6});const reference=await summary(await copy());assert.equal(reference.root,'worksheet');assert.equal(reference.regions,5);assert.deepEqual(reference.left,['E','Ukl','I','ri']);assert.equal(reference.right[0],'12.4V');assert(reference.labels.some(n=>n.text==='Ω'&&n.label==='UNIT'));assert(reference.labels.every(n=>n.contextual===null));
  await options('el','R09');await fill({E:12,U_kl:10,I:1});await copy();
  await options('el','R07');await fill({R:'200;160;140',n:3});const arrays=await summary(await copy());assert.equal(arrays.left[0],'ORIGIN');assert.deepEqual(arrays.matrices,[{rows:'3',cols:'1'}]);
  await options('tm-heat','VH07');await fill({p_del:'200000;300000',i:'1;2'});const pressure=await summary(await copy());assert.deepEqual(pressure.left,['ORIGIN','pdel','i','p']);assert.equal(pressure.matrices.length,1);
  await options('tm-heat','VH07');await fill({i:'0;2'});await page.locator('#mathcad-copy').click();assert.match(await page.locator('#mathcad-error').innerText(),/fra 1/);assert(await page.locator('#mathcad-dialog').isVisible());await page.locator('#mathcad-close').click();
  await options('el','I07');await page.selectOption('#mathcad-formula',await page.evaluate(()=>mcEntry.mathcad.formulas.find(f=>f.output==='I_k').id));await fill({I_total:4,G:'1;2',j:'1;2'});await page.evaluate(()=>{window.__mathcadCopied=null;});
  for(const k of ['0','-1','1,5','1;2']){await fill({k});await page.locator('#mathcad-copy').click();assert.match(await page.locator('#mathcad-error').innerText(),/heltal fra 1/);assert.equal(await page.evaluate(()=>window.__mathcadCopied),null);}
  await fill({k:2});const branch=await summary(await copy());assert.equal(branch.evaluations,1);assert.equal(branch.left.at(-1),'Ik');
  await options('el','U07');await page.selectOption('#mathcad-formula',await page.evaluate(()=>mcEntry.mathcad.formulas.find(f=>f.latex==='E_k=0').id));await fill({k:'1;2'});const zero=await summary(await copy());assert.deepEqual(zero.left,['ORIGIN','k','Ek']);assert.equal(zero.evaluations,1);assert(zero.labels.some(n=>n.text==='V'&&n.label==='UNIT'));
  await options('el','P05','formula');await page.selectOption('#mathcad-formula',await page.locator('#mathcad-formula option').filter({hasText:'Faglig bemærkning'}).first().getAttribute('value'));await page.selectOption('#mathcad-mode','inputs');await fill({'η':'0,9;0,8',k:'1;2'});const product=await copy();assert(product.includes('<product'));assert((await summary(product)).matrices.length===1);
  await options('el','U07','workflow');await page.locator('#mathcad-workflow-items label').filter({hasText:/I_k/}).locator('input').check();await fill({E:'12;0',R:'6;12',k:'1;2'});const sequence=await summary(await copy());assert(sequence.left.includes('Va'));assert.equal(sequence.left.at(-1),'Ik');
  await options('el','N01');await fill({V:'12;0',R:'6;8\n12;24',I_ind:'1;0',a:1,b:'1;2'});const matrix=await summary(await copy());assert(matrix.matrices.some(m=>m.rows==='2'&&m.cols==='2'));assert(matrix.matrixValues.some(values=>JSON.stringify(values)===JSON.stringify(['6','12','8','24'])));
  await options('el','C20');await fill({U_s:440,u_0:0,R:220,C:'0,0001',t:'0,022'});const rc=await summary(await copy());assert.equal(rc.functions,1);assert(rc.labels.some(n=>n.text==='e'&&n.label==='CONSTANT'));
  await options('el','E02');await fill({N:100,Φ:'2*x^2',t:'0,5'});const derivative=await summary(await copy());assert.equal(derivative.functions,2);assert.equal(derivative.derivatives,1);
  await options('el','E05');await fill({L:'0,02',i:'x^2',t:'0,5'});const scalarDerivative=await summary(await copy());assert(scalarDerivative.left.includes('t'));assert.equal(scalarDerivative.evaluations,1);
  await options('el','B04');await page.selectOption('#mathcad-formula',await page.evaluate(()=>mcEntry.mathcad.formulas.find(f=>f.latex===String.raw`\mu\approx\mu_0`).id));assert.match(await page.locator('#mathcad-note').innerText(),/≈/);await fill({'μ_0':'0,000001256637'});const approximate=await summary(await copy());assert.equal(approximate.evaluations,1);assert.deepEqual(approximate.left,['μ0']);
  await options('tm-heat','VH22');await fill({Q_rev:'900*x',T:300});const entropy=await summary(await copy());assert.equal(entropy.functions,2);assert.equal(entropy.derivatives,1);
  await options('tm-heat','VH26');assert.match(await page.locator('#mathcad-note').innerText(),/hele cyklussen/);await fill({p:'150000+50000*cos(2*pi*x)',V:'0.002+0.001*sin(2*pi*x)'});const cycle=await summary(await copy());assert(cycle.labels.some(n=>n.text==='π'&&n.label==='CONSTANT'));
  await options('tm-engine','MO13');await fill({c_b:'0,2',h_i:42000});const coefficient=await summary(await copy());for(const unit of ['kW','hr','kJ'])assert(coefficient.labels.some(n=>n.text===unit&&n.label==='UNIT'));
  await options('tm-engine','MO20','example');const example=await summary(await copy());assert(example.labels.some(n=>n.text==='kJ'&&n.label==='UNIT'));
  await options('el','W05','formula');assert(await page.locator('#mathcad-formula option').count()>=2);await page.selectOption('#mathcad-formula','main-0-1');await page.selectOption('#mathcad-mode','inputs');assert.match(await page.locator('[data-mc-input="H_u"]').locator('..').innerText(),/MJ\/m\^3/);await page.locator('#mathcad-close').click();
  cases.push('Mathcad: blank/invalid/Danish inputs, ordered workflow, vectors/matrices/ranges, functions, calculus, source examples and per-formula units');
  await page.fill('#global-search','R09');await page.locator('#discovery-results [data-mathcad="R09"]').click();assert.equal(await page.evaluate(()=>window.__mathcadCopied),entries.find(e=>e.id==='R09').xml);await page.locator('.discovery-card').first().click();assert(await page.locator('#results [data-mathcad="R09"]').isVisible());await page.locator('[data-save="R09"]').click();await page.fill('#global-search','');await page.locator('#saved-toggle').click();assert(await page.locator('#discovery-results [data-mathcad="R09"]').isVisible());await page.locator('.discovery-card').first().click();assert(await page.locator('#results [data-mathcad="R09"]').isVisible());
  await page.goto(pathToFileURL(htmlPath).href+'#catalog=el&seek=ri&method=R09:0');assert(await page.locator('#results [data-mathcad="R09"]').isVisible());
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('denied');};document.execCommand=()=>{const data=new DataTransfer(),event=new ClipboardEvent('copy',{clipboardData:data,cancelable:true});document.dispatchEvent(event);window.__legacyCopy={text:data.getData('text/plain'),types:[...data.types],prevented:event.defaultPrevented};return true;};});
  await page.locator('#results [data-mathcad="R09"]').click();const legacy=await page.evaluate(()=>window.__legacyCopy);assert.equal(legacy.text,entries.find(e=>e.id==='R09').xml);assert.deepEqual(legacy.types,['text/plain']);assert(legacy.prevented);
  assert(await page.evaluate(()=>{const data=new DataTransfer(),event=new ClipboardEvent('copy',{clipboardData:data,cancelable:true});document.dispatchEvent(event);return !event.defaultPrevented&&!data.types.length;}));
  await page.evaluate(()=>{document.execCommand=()=>{throw Error('copy blocked');};});await page.locator('#results [data-mathcad="R09"]').click();assert(await page.locator('#copy-dialog').isVisible());assert.equal(await page.locator('#copy-value').inputValue(),legacy.text);assert(await page.locator('#copy-value').evaluate(i=>i.selectionStart===0&&i.selectionEnd===i.value.length));await page.locator('#copy-dialog button').click();
  await options('el','R09','formula');await page.locator('#mathcad-copy').click();assert(await page.locator('#mathcad-dialog').isHidden());assert(await page.locator('#copy-dialog').isVisible());assert.equal(await page.locator('#copy-value').inputValue(),legacy.text);assert(await page.locator('#copy-value').evaluate(i=>i.selectionStart===0&&i.selectionEnd===i.value.length));await page.locator('#copy-dialog button').click();
  assert(await page.evaluate(()=>{const event=new ClipboardEvent('copy',{clipboardData:new DataTransfer(),cancelable:true});document.dispatchEvent(event);return !event.defaultPrevented;}));
  await page.setViewportSize({width:390,height:844});await options('el','R09');await page.screenshot({path:path.join(screenshots,'mathcad-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:320,height:720});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#mathcad-copy').isVisible());await page.locator('#mathcad-close').click();
  cases.push('Mathcad: search/saved/deep links, text/plain legacy cleanup, Ctrl+C fallback and mobile 320/390px offline');
  const nativeContext=await browser.newContext({permissions:['clipboard-read','clipboard-write'],offline:true});
  try{
   for(const legacyMode of [false,true])for(const mode of ['formula','inputs']){
    const native=await nativeContext.newPage();
    native.on('pageerror',e=>errors.push(e.message));native.on('console',e=>{if(e.type()==='error')errors.push(e.text());});native.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    await native.addInitScript(()=>{document.addEventListener('submit',event=>{if(event.target.id==='mathcad-form'){event.preventDefault();event.stopImmediatePropagation();}},true);});
    await native.goto(pathToFileURL(htmlPath).href+'#catalog=el&seek=ri&method=R09:0');
    await native.evaluate(async legacyMode=>{await navigator.clipboard.writeText('sentinel');if(legacyMode)navigator.clipboard.writeText=async()=>{throw Error('denied');};},legacyMode);
    await native.locator('#results [data-mathcad-options="R09"]').click();await native.selectOption('#mathcad-mode',mode);
    if(mode==='inputs')for(const [name,value] of Object.entries({E:'12',U_kl:'10',I:'1'}))await native.locator(`[data-mc-input="${name}"]`).fill(value);
    assert.equal(await native.locator('#mathcad-copy').getAttribute('type'),'button');await native.locator('#mathcad-copy').click();assert(await native.locator('#mathcad-dialog').isHidden());
    await native.locator('#action-status').filter({hasText:'Mathcad kopieret.'}).waitFor();
    const copied=await native.evaluate(()=>navigator.clipboard.readText());
    if(mode==='formula')assert.equal(copied,entries.find(e=>e.id==='R09').xml);else{const parsed=await summary(copied);assert.equal(parsed.regions,5);assert.deepEqual(parsed.left,['E','Ukl','I','ri']);}
    await native.close();
   }
   cases.push('Mathcad options: real Chromium clipboard and real legacy copy for formula/inputs, with form submissions blocked');
  }finally{await nativeContext.close();}
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 }finally{await context.close();}
};
