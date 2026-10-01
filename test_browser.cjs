/* Optional real-browser checks. Production needs no Node/browser. */
const fs=require('fs'),path=require('path'),os=require('os'),{pathToFileURL}=require('url'),assert=require('assert');
const cache=path.join(os.homedir(),'.npm','_npx');
const modules=fs.existsSync(cache)?fs.readdirSync(cache).map(n=>path.join(cache,n,'node_modules','playwright')).filter(p=>fs.existsSync(path.join(p,'package.json'))):[];
const playwright=require(process.env.PLAYWRIGHT_MODULE||modules[0]||'playwright');
const browsers=path.join(os.homedir(),'.cache','ms-playwright');
const executable=process.env.BROWSER_BIN||fs.readdirSync(browsers).filter(n=>/^chromium-/.test(n)).map(n=>path.join(browsers,n,'chrome-linux64','chrome')).find(p=>fs.existsSync(p));
const htmlPath=path.resolve(process.env.FORMULA_HTML||path.join(__dirname,'docs/index.html'));
const reportPath=process.env.FORMULA_REPORT||path.join(os.tmpdir(),'formelopslag-browser-'+Date.now()+'.json');
const screenshots=fs.mkdtempSync(path.join(os.tmpdir(),'formelopslag-browser-'));
(async()=>{
 const browser=await playwright.chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:950},offline:true});
  const page=await context.newPage(),errors=[],network=[],cases=[];
  const exportedHtml=fs.readFileSync(htmlPath,'utf8');assert.match(exportedHtml,/function scopedEntries\(/);assert.match(exportedHtml,/function seekOptions\(/);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.goto(pathToFileURL(htmlPath).href);
  assert.equal(await page.locator('article').count(),0);assert(await page.locator('#seek').isHidden());assert(await page.locator('#known').isHidden());
  async function topic(discipline,id){await page.selectOption('#discipline',discipline);if(await page.locator('#topic').isVisible())await page.selectOption('#topic',id);else assert.equal(await page.locator('#topic').inputValue(),id);}
  async function selectMethod(key,label){if(await page.locator('#method').isVisible())await page.selectOption('#method',key);else{assert.equal(await page.locator('#method').inputValue(),key);assert.equal(await page.locator('#method-text').innerText(),label);}}
  async function selectSituation(key,label){if(await page.locator('#situation').isVisible())await page.selectOption('#situation',key);else{assert.equal(await page.locator('#situation').inputValue(),key);assert((await page.locator('#situation-text').innerText()).includes(label));}}
  async function route(id,index=0){
   const entry=await page.evaluate(id=>activeCatalog().entries.find(e=>e.id===id),id);
   await page.fill('#search','');await page.locator('#incomplete').check();await page.locator('#groups button[data-group=""]').click();await page.selectOption('#seek',entry.lookup.seek_key);
   if(await page.locator('#situation').isVisible())await page.selectOption('#situation',entry.lookup.situations[0]);
   await selectMethod(`${id}:${index}`,`${id} · ${entry.seek}${entry.lookup.given_sets.length>1?' · vej '+(index+1):''}`);await selectSituation(entry.lookup.situations[0],await page.evaluate(s=>activeCatalog().situations[s],entry.lookup.situations[0]));
   assert.deepEqual(await page.locator('#givens input').evaluateAll(els=>els.map(x=>x.value)),entry.lookup.given_sets[index]);
  }
  async function given(...keys){for(const key of keys)await page.locator(`#givens input[value="${key}"]`).check();}
  async function only(id){assert.deepEqual(await page.locator('article').evaluateAll(els=>els.map(x=>x.dataset.entry)),[id]);}
  await topic('EL','el');assert.equal(await page.locator('article').count(),0);assert.equal(await page.locator('#seek option[value="Pfuel"]').count(),0);
  await page.selectOption('#seek','I');assert(await page.locator('#known').isHidden());
  await route('I01');await given('U','R');await page.locator('#incomplete').uncheck();await only('I01');
  await page.locator('.feedback summary').click();await page.selectOption('#feedback-type','missing');
  const feedback=new URL(await page.locator('#feedback-link').getAttribute('href')),body=feedback.searchParams.get('body');
  assert.equal(feedback.pathname,'Grumskull@gmail.com');assert.equal(feedback.searchParams.get('subject'),'Formelopslag feedback');
  assert.match(body,/Type: Mangel \/ Mangel/);assert.match(body,/Version: \S+/);assert.match(body,/Opslag\/sektion: I01/);assert.match(body,/URL: $/m);
  await page.evaluate(()=>{document.documentElement.lang='en';updateFeedbackUi();});assert.equal(await page.locator('#feedback-link').innerText(),'Open mail');
  await page.evaluate(()=>{document.documentElement.lang='da';updateFeedbackUi();});await page.locator('.feedback summary').click();
  assert(await page.locator('#ac-other').isVisible());await page.locator('#ac-other').check();assert.equal(await page.locator('article').count(),0);assert.match(await page.locator('#model-note').innerText(),/AC-materialet mangler/);await page.locator('#ac-other').uncheck();
  await route('I02');await given('P','U');await only('I02');await route('I02',1);await given('P_mech','U');assert.match(await page.locator('article .missing').innerText(),/η/);
  await route('R04');await given('l','S');assert.match(await page.locator('article .missing').innerText(),/Resistivitet/);await given('rho');assert.equal(await page.locator('article .ready').count(),1);
  await route('C05');await given('Q','U');await only('C05');await route('C27');await given('u0','targetU','R','C');await only('C27');
  cases.push('EL: Ohm, DC-effekt, manglende eta, modstand, kapacitans, RC, AC-kildehul og feedback DA/EN');
  await topic('TM','tm-heat');assert.equal(await page.locator('article').count(),0);
  const heatOptions=await page.locator('#seek option').evaluateAll(els=>els.map(x=>x.value));assert(!heatOptions.includes('Pi'));assert(!heatOptions.includes('I'));
  await route('VH02');await given('n','T');assert.match(await page.locator('article .missing').innerText(),/Volumen/);await given('V');
  await page.fill('#search','noget der ikke findes');assert.equal(await page.locator('article').count(),0);assert(await page.locator('#givens input[value="T"]').isChecked());
  await page.fill('#search','');await only('VH02');assert(await page.locator('#givens input[value="T"]').isChecked());
  await page.locator('#groups button[data-group="cycle"]').click();assert.equal(await page.locator('article').count(),0);assert(await page.locator('#method-field').isHidden());
  await page.locator('#groups button[data-group=""]').click();await route('VH02');await only('VH02');
  await page.selectOption('#seek','cn');assert.equal(await page.locator('article').count(),0);assert.match(await page.locator('#model-note').innerText(),/Ingen kildeunderbygget/);
  await page.selectOption('#seek','steam_h');assert.equal(await page.locator('article').count(),0);assert.match(await page.locator('#model-note').innerText(),/damptabeller mangler/);
  await page.goto(pathToFileURL(htmlPath).href);await topic('TM','tm-heat');await page.fill('#search','damp');assert.match(await page.locator('#notes').innerText(),/damptabeller/);
  await route('VH16');await given('p1','V1','V2');await page.screenshot({path:path.join(screenshots,'heat-desktop.png'),fullPage:true});
  assert.match(await page.locator('article .source').innerText(),/Lektion 5 og 6 9.22-9.27.pptx · slide 7/);
  cases.push('Varmelaere: isolerede variable, metodespecifikke input, bevaret tilstand, kildehuller og kildehenvisning');
  await page.selectOption('#topic','tm-engine');assert.equal(await page.locator('article').count(),0);assert.equal(await page.locator('#seek option[value="steam_h"]').count(),0);assert.equal(await page.locator('#seek option[value="I"]').count(),0);
  await route('MO08');await only('MO08');assert(await page.locator('#method').isHidden());assert.equal(await page.locator('#method-text').innerText(),'MO08 · Mekanisk virkningsgrad');assert.equal(await page.locator('#method').inputValue(),'MO08:0');assert(await page.locator('#situation').isHidden());assert.equal(await page.locator('#situation-label').innerText(),'Forudsætning');assert.equal(await page.locator('#situation-text').innerText(),'Aksel- og bremseeffekt ved samme driftspunkt');assert.equal(await page.locator('#situation').inputValue(),'shaft');assert.match(await page.locator('article .missing').innerText(),/P_b|P_i/);
  assert(await page.locator('#seek').isVisible());assert.equal(await page.locator('#seek option[value=""]').count(),0);assert.equal(await page.locator('#seek').inputValue(),'eta_m');
  await route('MO03');assert.match(await page.locator('article .missing').innerText(),/Indiceret middeltryk/);await page.locator('#incomplete').uncheck();assert.equal(await page.locator('article').count(),0);assert.match(await page.locator('#model-note').innerText(),/Valgt metode mangler oplysninger: Indiceret middeltryk/);await page.locator('#incomplete').check();await given('pi','Vs','c','rpm');await only('MO03');assert(await page.locator('#method').isVisible());assert.equal(await page.locator('#method option[value="MO03:0"]').count(),1);assert.equal(await page.locator('#method option[value="MO04:0"]').count(),1);assert.equal(await page.locator('#method option[value=""]').innerText(),'Sammenlign beregningsveje');
  await page.selectOption('#method','MO04:0');assert.equal(await page.locator('#method').isVisible(),true);assert.equal(await page.locator('#situation').isHidden(),true);assert.equal(await page.locator('#situation-text').innerText(),'Firetaktsmotor');await only('MO04');
  await page.selectOption('#topic','tm-heat');assert.equal(await page.locator('#method').inputValue(),'VH16:0');assert(await page.locator('#givens input[value="V1"]').isChecked());
  await page.selectOption('#topic','tm-engine');assert.equal(await page.locator('#method').inputValue(),'MO04:0');assert(await page.locator('#givens input[value="rpm"]').isChecked());
  await page.screenshot({path:path.join(screenshots,'engine-desktop.png'),fullPage:true});
  const allRoutes=await page.evaluate(()=>db.catalogs.flatMap(c=>c.entries.flatMap(e=>e.lookup.given_sets.map((set,i)=>({c,e,set,i})))).filter(({c,e,set,i})=>!matchEntries(e.lookup.seek_key,set,e.lookup.situations[0],e.id,false,'',c).some(r=>r.method===e.id+':'+i&&r.complete)).map(({e,i})=>e.id+':'+i));assert.deepEqual(allRoutes,[]);
  let count=0;
  for(const [discipline,id] of [['EL','el'],['TM','tm-heat'],['TM','tm-engine']]){
   await page.goto(pathToFileURL(htmlPath).href);await topic(discipline,id);await page.locator('#incomplete').check();await page.locator('#groups button[data-group=""]').click();
   const ids=await page.evaluate(()=>activeCatalog().entries.map(e=>e.id));
   for(const entry of ids){await page.fill('#search',entry);assert(await page.locator(`article[data-entry="${entry}"]`).count()>0,entry);assert(await page.locator('article img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),entry);}
   count+=ids.length;
  }
  cases.push('Motorlaere: 2-/4-takt, fagadskillelse og bevaret emnetilstand; alle '+count+' opslag og metoder findes');
  let selectorAudits=0;
  for(const catalog of await page.evaluate(()=>db.catalogs.map(c=>({id:c.id,discipline:c.discipline})) )){
   await page.goto(pathToFileURL(htmlPath).href);await topic(catalog.discipline,catalog.id);
   const data=await page.evaluate(()=>{const c=activeCatalog();return {targets:[...new Set([...c.entries.map(e=>e.lookup.seek_key),...Object.keys(c.unavailable_targets||{})])],groups:c.navigation_groups.map(g=>g.id),topics:db.catalogs.filter(x=>x.discipline===c.discipline).length,disciplines:[...new Set(db.catalogs.map(x=>x.discipline))].length};});
   assert.equal(await page.locator('#discipline').isVisible(),data.disciplines>1);assert.equal(await page.locator('#topic').isVisible(),data.topics>1);
   assert.equal(await page.locator('#seek option:not([value=""])').count(),data.targets.length);
   for(const key of data.targets){if(await page.locator('#seek').isVisible())await page.selectOption('#seek',key);else assert.equal(await page.locator('#seek').inputValue(),key);
    if(await page.locator('#seek').isVisible())assert.equal(await page.locator('#seek option[value=""]').count(),0);
    for(const group of [...data.groups,'']){await page.locator(`#groups button[data-group="${group}"]`).click();
     const expected=await page.evaluate(({key,group})=>{const c=activeCatalog(),entries=c.entries.filter(e=>e.lookup.seek_key===key&&(!group||e.lookup.group===group)),routes=entries.flatMap(e=>e.lookup.given_sets.map((_,i)=>({key:e.id+':'+i,e}))),chosen=routes.find(r=>r.key===document.querySelector('#method').value),scenes=[...new Set((chosen?[chosen]:routes).flatMap(r=>r.e.lookup.situations))];return {routes:routes.map(r=>r.key),scenes:scenes.map(s=>[s,c.situations[s]])};},{key,group});
     assert.equal(await page.locator('#method-field').isVisible(),expected.routes.length>0);assert.equal(await page.locator('#method').isVisible(),expected.routes.length>1);
     assert.equal(await page.locator('#method option:not([value=""])').count(),expected.routes.length);
     if(expected.routes.length===1){const route=await page.evaluate(k=>{const [id,index]=k.split(':');const e=activeCatalog().entries.find(x=>x.id===id);return e.id+' · '+e.seek+(e.lookup.given_sets.length>1?' · vej '+(+index+1):'');},expected.routes[0]);assert.equal(await page.locator('#method-text').innerText(),route);assert.equal(await page.locator('#method').inputValue(),expected.routes[0]);}
     assert.equal(await page.locator('#situation-field').isVisible(),expected.scenes.length>0);assert.equal(await page.locator('#situation').isVisible(),expected.scenes.length>1);
     assert.equal(await page.locator('#situation option:not([value=""])').count(),expected.scenes.length);
     if(expected.scenes.length===1){assert(await page.locator('#situation option[value=""]').count()===0);assert((await page.locator('#situation-text').innerText()).includes(expected.scenes[0][1]));}
     if(expected.scenes.length>1)assert.equal(await page.locator('#situation option[value=""]').count(),0);selectorAudits++;
    }
   }
  }
  cases.push('Alle fag/emner/søgte størrelser/underemnefiltre: '+selectorAudits+' kardinalitetskontroller af metode og situation');
  const dark=await browser.newContext({viewport:{width:390,height:844},offline:true,colorScheme:'dark'}),mobile=await dark.newPage();
  mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(pathToFileURL(htmlPath).href);await mobile.selectOption('#discipline','TM');await mobile.selectOption('#topic','tm-engine');await mobile.selectOption('#seek','Pi');await mobile.selectOption('#method','MO04:0');
  assert.notEqual(await mobile.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await mobile.locator('.feedback summary').isVisible());
  await mobile.screenshot({path:path.join(screenshots,'engine-mobile-dark.png'),fullPage:true});await mobile.locator('.feedback summary').click();assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.setViewportSize({width:320,height:720});assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await dark.close();
  cases.push('Mobil 320/390 px: dark mode, feedback og ingen vandret sideoverloeb');
  const hosted=await browser.newContext(),hostedPage=await hosted.newPage();
  await hostedPage.route('https://formelopslag.test/**',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(htmlPath,'utf8')}));await hostedPage.goto('https://formelopslag.test/');
  await hostedPage.selectOption('#discipline','TM');await hostedPage.selectOption('#topic','tm-engine');await hostedPage.selectOption('#seek','Pi');await hostedPage.selectOption('#method','MO03:0');
  const mail=new URL(await hostedPage.locator('#feedback-link').getAttribute('href'));assert.match(mail.searchParams.get('body'),/URL: https:\/\/formelopslag.test\//);assert.match(mail.searchParams.get('body'),/Fag\/emne: TM \/ Motorlære/);assert.match(mail.searchParams.get('body'),/MO03/);await hosted.close();

   // Cross-subject discovery, direct links and durable personal preferences.
   await page.goto(pathToFileURL(htmlPath).href);
   assert.equal((await page.locator('body').innerText()).includes('PPmaker'),false);
   await page.fill('#global-search','stroem');assert(await page.locator('.discovery-card').count()>0);
   await page.fill('#global-search','MO04');await page.locator('.discovery-card').click();await only('MO04');
   await given('pi','Vs','c','rpm');assert.equal(await page.locator('article .ready').count(),1);
   const deepLink=page.url();assert.match(deepLink,/method=MO04/);
   await page.locator('button[data-save="MO04"]').click();assert.equal(await page.locator('#saved-count').innerText(),'1');
   await page.fill('#global-search','');await page.locator('#saved-toggle').click();assert.equal(await page.locator('.discovery-card').count(),1);
   await page.goto(deepLink);await only('MO04');assert.equal(await page.locator('#givens input:checked').count(),4);
   await page.locator('#reset').click();assert.equal(await page.locator('article').count(),0);assert(await page.locator('#known').isHidden());
   await page.goto(pathToFileURL(htmlPath).href);await page.fill('#global-search','U06');await page.locator('.discovery-card').click();await only('U06');
   assert.equal(await page.locator('#seek').inputValue(),'U1');await given('U','R1','R2');assert.equal(await page.locator('article .ready').count(),1);
   await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
   await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.goto(pathToFileURL(htmlPath).href+'#catalog=tm-engine&seek=Pi&method=EVIL%3A0&known=bad&group=evil');
   assert.equal(await page.locator('#givens input:checked').count(),0);assert.equal(await page.locator('#method').inputValue(),'');
   // Offline clipboard fallback exposes selectable text if browser permissions deny copying.
   await page.goto(deepLink);
   await page.evaluate(()=>{document.execCommand=()=>false;});
   await page.locator('button[data-share]').click();assert(await page.locator('#copy-dialog').isVisible());assert.match(await page.locator('#copy-value').inputValue(),/method=MO04/);await page.locator('#copy-dialog button').click();
   await page.locator('button[data-formula]').click();assert(await page.locator('#copy-dialog').isVisible());assert.match(await page.locator('#copy-value').inputValue(),/P/);await page.locator('#copy-dialog button').click();
   await page.locator('#givens input[value="pi"]').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#givens input[value="pi"]').evaluate(el=>el===document.activeElement),true);
   await page.emulateMedia({media:'print'});assert(await page.locator('.hero').isHidden());assert(await page.locator('article').isVisible());await page.emulateMedia({media:'screen'});
   cases.push('Selvstaendigt produkt: global soegning, U/U1, direkte links, gemte opslag, nulstilling, valideret URL, tema, kopiering, tastatur og print');
   assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const result={html_sha256:require('crypto').createHash('sha256').update(fs.readFileSync(htmlPath)).digest('hex'),browser:await browser.version(),method:'Real Chromium, offline file URL; intercepted HTML for hosted URL context',cases,all_codes_found:count,all_structured_routes_found:true,errors,external_requests:network,screenshots};
  fs.writeFileSync(reportPath,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
