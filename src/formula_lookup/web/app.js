const db=JSON.parse(document.getElementById('database').textContent);
function mathImage(latex,size=18){
 const a=db.math_assets[latex];
 return `<div class="math-line"><span class="math-search" aria-hidden="true">${esc(a.search)}</span><img class="math-image" src="${a.src}" decoding="async" alt="${esc(a.search)}" data-latex="${esc(latex)}" style="width:${a.width*size/25}px;height:${a.height*size/25}px"></div>`;
}
function richField(label,source){
 if(!source)return '';
 return `<section class="helper"><h3>${esc(label)}</h3>`+source.split('$').map((value,i)=>!value.trim()?'':i%2?mathImage(value.trim()):`<p>${esc(value.trim()).replaceAll('\n','<br>')}</p>`).join('')+'</section>';
}

const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activeGroup='',currentCatalogId='';
const states=new Map();
function activeCatalog(){return db.catalogs.find(c=>c.id===currentCatalogId);}
function state(){
 if(!states.has(currentCatalogId))states.set(currentCatalogId,{known:new Set(),seek:'',method:'',situation:'',search:'',incomplete:false,group:'',acOther:false});
 return states.get(currentCatalogId);
}
function remember(){if(currentCatalogId)Object.assign(state(),{seek:$('seek').value,method:$('method').value,situation:$('situation').value,search:$('search').value,incomplete:$('incomplete').checked,group:activeGroup,acOther:$('ac-other').checked});}
const feedbackText={da:{type:'Type',open:'Åbn mail',missing:'Modtager mangler i project.json',to:'Modtager',kinds:{bug:'Fejl',missing:'Mangel',wish:'Ønske'}},en:{type:'Type',open:'Open mail',missing:'Recipient is missing in project.json',to:'Recipient',kinds:{bug:'Error',missing:'Missing content',wish:'Wish'}}};
const feedbackKinds=['bug','missing','wish'];
function lang(){return (document.documentElement.lang||'da').toLowerCase().startsWith('en')?'en':'da';}
function selectedOptionText(id){if(id==='seek')return seekItems.find(x=>x.value===$('seek').value)?.label||'';const el=$(id);return el&&el.selectedIndex>=0?el.options[el.selectedIndex].textContent:'';}
function feedbackContext(){
 const c=activeCatalog(),articles=[...document.querySelectorAll('article[data-entry]')],group=c?.navigation_groups.find(g=>g.id===activeGroup);
 const section=articles.length===1?articles[0].querySelector('h2').textContent:group?`Sektion: ${group.label}`:$('seek').value?`Søger: ${selectedOptionText('seek')}`:'Intet opslag valgt';
 const known=[...$('givens').querySelectorAll('input:checked')].map(x=>c?.quantities[x.value]||x.value);
 return {section,topic:c?`${c.discipline} / ${c.topic}`:'Intet emne valgt',method:selectedOptionText('method'),seek:selectedOptionText('seek'),situation:selectedOptionText('situation'),known:known.join(', ')||'Ingen valgt',search:$('search').value.trim()||'Ingen'};
}
function updateFeedbackUi(){
 const t=feedbackText[lang()],current=$('feedback-type').value||'bug';
 $('feedback-summary').textContent='Feedback';$('feedback-type-label').textContent=t.type;$('feedback-link').textContent=t.open;
 $('feedback-type').innerHTML=feedbackKinds.map(k=>`<option value="${k}">${esc(t.kinds[k])}</option>`).join('');$('feedback-type').value=current;
 updateFeedbackLink();
}
function updateFeedbackLink(){
 const t=feedbackText[lang()],kind=$('feedback-type').value||'bug',recipient=(db.feedback_email||'').trim().replace(/[\s?&]/g,''),ctx=feedbackContext();
 const hosted=/^https?:/.test(location.href)?location.href:'';
 const body=[`Type: ${t.kinds[kind]} / ${feedbackText.da.kinds[kind]}`,`Version: ${db.cheatsheet_version}`,`Opslag/sektion: ${ctx.section}`,`URL: ${hosted}`,'','Beskrivelse:','','','Kontekst:',`Fag/emne: ${ctx.topic}`,`Metode: ${ctx.method}`,`Søger: ${ctx.seek}`,`Situation: ${ctx.situation}`,`Opgivet: ${ctx.known}`,`Søgning: ${ctx.search}`].join('\n');
 $('feedback-link').href=`mailto:${recipient}?subject=${encodeURIComponent('Formelopslag feedback')}&body=${encodeURIComponent(body)}`;
 $('feedback-help').textContent=recipient?`${t.to}: ${recipient}`:t.missing;
}
function matchEntries(seek,known,situation,query='',includeMissing=true,group='',catalog=activeCatalog()){
 if(!catalog)return [];
 return catalog.entries.filter(e=>(!seek||e.lookup.seek_key===seek)&&(!group||e.lookup.group===group)&&(!situation||e.lookup.situations.includes(situation))&&(!query||matchesQuery(entrySearchText(e,catalog),query))).flatMap(e=>e.lookup.given_sets.map((option,index)=>{
  const missing=option.filter(k=>!known.includes(k));
  return {entry:e,method:e.id+':'+index,missing,option,complete:!missing.length,situationConfirmed:!!situation};
 })).filter(r=>includeMissing||r.complete).sort((a,b)=>a.missing.length-b.missing.length);
}
function optionHtml(value,label,extra=''){return `<option value="${esc(value)}" ${extra}>${esc(label)}</option>`;}
function syncChoice(id,items,value=''){
 const el=$(id),field=$(id+'-field'),text=$(id+'-text');
 el.innerHTML=items.map(x=>optionHtml(x.value,x.label)).join('');
 field.hidden=!items.length;text.hidden=items.length!==1;el.hidden=items.length===1||!items.length;
 text.textContent=items.length===1?items[0].label:'';
 if(items.length===1)el.value=items[0].value;
 else if(items.some(x=>x.value===value))el.value=value;
 else el.selectedIndex=-1;
 return el.value;
}
function scopedEntries(){
 const c=activeCatalog(),seek=$('seek').value;
 return c&&seek?c.entries.filter(e=>e.lookup.seek_key===seek&&(!activeGroup||e.lookup.group===activeGroup)):[];
}
function routesForControls(){
 return scopedEntries().flatMap(e=>e.lookup.given_sets.map((option,index)=>({entry:e,key:e.id+':'+index,option,label:e.id+' · '+e.seek+(e.lookup.given_sets.length>1?' · kræver '+option.map(k=>activeCatalog().quantities[k]).join(', '):'')})));
}
function seekOptions(c){return c?[...new Set([...c.entries.filter(e=>!activeGroup||e.lookup.group===activeGroup).map(e=>e.lookup.seek_key),...(!activeGroup?Object.keys(c.unavailable_targets||{}):[])])]:[];}
// One value on the combobox; its list is derived only from the active context.
let seekItems=[],seekIndex=-1;
function closeSeek(){
 $('seek-list').hidden=true;$('seek').setAttribute('aria-expanded','false');$('seek').removeAttribute('aria-activedescendant');
}
function syncSeek(c,value=''){
 closeSeek();seekItems=seekOptions(c).map(k=>({value:k,label:c.quantities[k]}));
 $('seek').value=seekItems.some(x=>x.value===value)?value:'';
 $('seek').textContent=selectedOptionText('seek')||'Vælg størrelse';
 $('seek-field').hidden=!seekItems.length;
 $('seek-list').innerHTML=seekItems.map((x,i)=>`<div role="option" id="seek-option-${i}" data-value="${esc(x.value)}" aria-selected="${x.value===$('seek').value}">${esc(x.label)}</div>`).join('');
}
function focusSeekOption(index){
 seekIndex=(index+seekItems.length)%seekItems.length;
 for(const [i,option] of [...$('seek-list').children].entries())option.classList.toggle('active',i===seekIndex);
 const option=$('seek-list').children[seekIndex];
 $('seek').setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});
}
function openSeek(index=seekItems.findIndex(x=>x.value===$('seek').value)){
 if(!seekItems.length)return;
 // Make room below the field rather than flipping the list above it.
 $('seek').scrollIntoView({block:'nearest'});
 const bottom=$('seek').getBoundingClientRect().bottom,room=window.innerHeight-bottom-12;
 if(room<240)window.scrollBy(0,Math.min(240,window.innerHeight/2)-room);
 const remaining=window.innerHeight-$('seek').getBoundingClientRect().bottom-12;
 $('seek-list').style.maxHeight=Math.max(1,Math.min(300,remaining))+'px';
 $('seek-list').hidden=false;$('seek').setAttribute('aria-expanded','true');
 focusSeekOption(index<0?0:index);
}
function chooseSeek(index){
 $('seek').value=seekItems[index].value;closeSeek();$('seek').focus({preventScroll:true});
 $('seek').dispatchEvent(new Event('change'));
}
$('seek').addEventListener('click',()=>{$('seek-list').hidden?openSeek():closeSeek();});
$('seek').addEventListener('keydown',event=>{
 const opened=!$('seek-list').hidden;
 if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(event.key)){
  event.preventDefault();
  if(event.key==='Escape'){closeSeek();return;}
  if(event.key==='Enter'||event.key===' '){opened?chooseSeek(seekIndex):openSeek();return;}
  const index=event.key==='Home'?0:event.key==='End'?seekItems.length-1:opened?seekIndex+(event.key==='ArrowDown'?1:-1):event.key==='ArrowUp'?seekItems.length-1:0;
  opened?focusSeekOption(index):openSeek(index);
 }else if(event.key==='Tab')closeSeek();
});
$('seek-list').addEventListener('mousedown',event=>event.preventDefault());
$('seek-list').addEventListener('click',event=>{const option=event.target.closest('[role="option"]');if(option)chooseSeek([...$('seek-list').children].indexOf(option));});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#seek-field'))closeSeek();});
$('seek').addEventListener('blur',closeSeek);
window.addEventListener('resize',closeSeek);
window.addEventListener('scroll',()=>{
 if($('seek-list').hidden)return;
 const box=$('seek').getBoundingClientRect(),room=window.innerHeight-box.bottom-12;
 if(box.top<0||room<40)closeSeek();else $('seek-list').style.maxHeight=Math.min(300,room)+'px';
});
function syncMethods(routes,value){
 const el=$('method'),field=$('method-field'),text=$('method-text');
 el.innerHTML=routes.length>1?optionHtml('','Alle formler – find ud fra mine oplysninger')+routes.map(r=>optionHtml(r.key,r.label)).join(''):routes.map(r=>optionHtml(r.key,r.label)).join('');
 field.hidden=!routes.length;text.hidden=routes.length!==1;el.hidden=routes.length<=1;
 text.textContent=routes.length===1?routes[0].label:'';
 el.value=routes.length===1?routes[0].key:routes.some(r=>r.key===value)?value:'';
 return el.value;
}
function syncSituations(c,routes,value){
 const scenes=[...new Set(routes.flatMap(r=>r.entry.lookup.situations))];
 const items=scenes.map(s=>({value:s,label:c.situations[s]}));
 const selected=syncChoice('situation',items,value);
 $('situation-field').hidden=!items.length;
 $('situation-label').textContent=items.length===1?'Forudsætning':'Fysisk situation';
 $('situation-text').hidden=items.length!==1&&!(items.length>1&&selected);
 if(items.length===1)$('situation-text').textContent=items[0].label;
 if(items.length>1){const current=items.find(x=>x.value===selected);$('situation-text').hidden=!current;$('situation-text').textContent=current?'Forudsætning: '+current.label:'';}
 return selected;
}
function options(){
 const c=activeCatalog(),oldMethod=$('method').value,oldSituation=$('situation').value;
 syncSeek(c, $('seek').value);
 $('ac-other-field').hidden=!c||c.discipline!=='EL'||!$('seek').value;
 if($('ac-other-field').hidden)$('ac-other').checked=false;
 const base=routesForControls(),methodRoutes=$('ac-other').checked?[]:base;
 const method=syncMethods(methodRoutes,oldMethod),chosen=methodRoutes.find(r=>r.key===method);
 syncSituations(c,chosen?[chosen]:base,oldSituation);
 render();
}
function sourceText(ref,c=activeCatalog()){
 const [id,pages]=ref.split(':'),source=c?.source_inventory?.find(s=>s.id===id);
 return source?`${(source.original_file||source.file).split('/').pop()} · ${source.unit||'slide'} ${pages}`:ref;
}
function sources(refs){return `<p class="subtle source"><strong>Kilder</strong>${refs.map(ref=>`<span>${esc(sourceText(ref))}</span>`).join('')}</p>`;}
function render(){
  const c=activeCatalog(),known=[...state().known],situation=$('situation').value,query=$('search').value.trim(),selected=$('method').value;
 const chosen=routesForControls().find(r=>r.key===selected);
 const available=c?c.entries.filter(e=>!activeGroup||e.lookup.group===activeGroup):[];
 const givenKeys=[...new Set(available.flatMap(e=>e.lookup.given_sets.flat()))];
 $('known').hidden=!givenKeys.length;
 const focusedKnown=document.activeElement?.closest('#givens input')?.value;
 $('givens').innerHTML=givenKeys.map(k=>`<label><input type="checkbox" value="${esc(k)}" ${state().known.has(k)?'checked':''}> ${esc(c.quantities[k])}</label>`).join('');
 if(focusedKnown)[...$('givens').querySelectorAll('input')].find(input=>input.value===focusedKnown)?.focus({preventScroll:true});
 const started=c&&($('seek').value||query||known.length),found=started&&!$('ac-other').checked?matchEntries($('seek').value,known,situation,query,$('incomplete').checked,activeGroup).filter(r=>!selected||r.method===selected):[];
 const gap=c?.unavailable_targets?.[$('seek').value];
 $('results').classList.toggle('single',found.length===1);
 $('status').textContent=!c?'Vælg fag og emne.':!started?'Vælg de oplysninger, du har. Du kan også vælge, hvad du søger.':`${found.length} ${found.length===1?'formel':'formler'} · ${found.filter(r=>r.complete).length} med de nødvendige størrelser · ${c.topic}`;
 const missing=chosen?.option.filter(k=>!state().known.has(k))||[];
 const missingInCompare=!$('incomplete').checked&&!selected?[...new Set(matchEntries($('seek').value,known,situation,query,true,activeGroup).flatMap(r=>r.missing))]:[];
 $('model-note').textContent=$('ac-other').checked?'AC-materialet mangler. Afklar kurveform, RMS, effektfaktor og aktiv/tilsyneladende effekt. DC-formlen I=P/U vælges ikke her.':gap||(started&&!found.length&&chosen&&missing.length?'Valgt metode mangler oplysninger: '+missing.map(k=>c.quantities[k]).join(', '):started&&!found.length&&missingInCompare.length?'Beregningsvejene mangler oplyste størrelser: '+missingInCompare.map(k=>c.quantities[k]).join(', ')+'. Slå visning af manglende oplysninger til for at se kravene.':started&&!found.length?'Ingen beregningsvej matcher de valgte filtre. Kontrollér emne, søgt størrelse, situation og filtre.':found.length?'Formler ud fra dine oplysninger. Kontrollér procesbetingelser, fortegn og enheder.':'');
 $('results').innerHTML=found.map(({entry:e,method,missing,option,situationConfirmed})=>`<article data-entry="${esc(e.id)}" data-method="${esc(method)}"><h2>${esc(e.id+' · '+e.seek)}</h2>${cardActions(e,method)}<p class="condition"><strong>Gælder:</strong> ${esc(e.condition)}</p><p><strong>Denne metode kræver:</strong> ${option.map(k=>esc(c.quantities[k])).join(', ')}</p>${mathImage(e.latex,26)}<p class="${missing.length?'missing':situationConfirmed?'ready':'pending'}">${missing.length?'Mangler: '+missing.map(k=>esc(c.quantities[k])).join(', '):situationConfirmed?'Størrelserne er oplyst; kontrollér stadig betingelserne.':'Størrelserne er oplyst; fysisk situation skal afklares.'}</p>${selected===method?'':`<button class="choose-method" type="button" data-method="${esc(method)}" data-seek="${esc(e.lookup.seek_key)}">Vælg denne metode</button>`}${richField('Trin',e.steps)}${richField('Omregn',e.conversion)}${richField('Pas på',e.pitfall)}${richField('Eksempel',e.example)}${sources(e.source_locations)}<details><summary>Formlens LaTeX</summary><pre>${esc(e.latex)}</pre></details></article>`).join('')||(started&&!gap?'<p>Ingen kildeunderbygget beregningsvej matcher de valgte filtre.</p>':'');
 const notes=(c?.notes||[]).filter(n=>!query||[n.title,n.text].join(' ').toLocaleLowerCase('da').includes(query.toLocaleLowerCase('da')));
 $('topic-notes').hidden=!notes.length;
 $('notes').innerHTML=notes.map(n=>`<section class="note-item"><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>${sources(n.source_locations)}</section>`).join('');
 if(query&&notes.length)$('topic-notes').open=true;
 $('groups').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===activeGroup)));
 remember();updateFeedbackLink();syncUrl();
}
function activateTopic(){
 remember();currentCatalogId=$('topic').value;
 const c=activeCatalog(),s=state();
 $('discipline-field').hidden=!c;$('discipline-text').textContent=c?.discipline==='EL'?'Elektroteknik':c?'Varmelære og motorlære (TM)':'';
 $('search').disabled=!c;$('search').value=s.search;$('incomplete').checked=s.incomplete;$('ac-other').checked=s.acOther;activeGroup=s.group;
 syncSeek(c,s.seek);
 $('groups').innerHTML=c?c.navigation_groups.map(g=>`<button type="button" data-group="${esc(g.id)}">${esc(g.label)}</button>`).join('')+'<button type="button" data-group="">Alle i emnet</button>':'';
 $('groups').hidden=!c||!c.navigation_groups.length;
 $('scope').textContent=c?.scope||'';
 $('register-section').hidden=!c?.constants?.length;
 $('registers').innerHTML=c?.constants?.length?table(['Konstant / værdi','Tal','Enhed','Gyldighed / type','Kilde'],c.constants)+table(['Materiale','ρ [Ω·mm²/m]','α20 [K⁻¹]','Reference / kilde'],c.materials.map(m=>[...m,c.material_reference.temperature+'; '+c.material_reference.source])):'';
 // Seed remembered values; options() keeps only values still available here.
 $('method').innerHTML=optionHtml(s.method,s.method);$('situation').innerHTML=optionHtml(s.situation,s.situation);options();
}
function updateTopics(discipline='',value=''){
 const catalogs=db.catalogs.filter(c=>c.discipline===discipline);
 syncChoice('topic',catalogs.map(c=>({value:c.id,label:c.topic})),value);
 $('topic-field').hidden=!discipline||!catalogs.length;activateTopic();
}
$('topic').addEventListener('change',activateTopic);
$('groups').addEventListener('click',event=>{const b=event.target.closest('button');if(b){activeGroup=b.dataset.group;options();}});
$('seek').addEventListener('change',()=>{$('method').value='';options();});
$('method').addEventListener('change',options);$('situation').addEventListener('change',options);
$('givens').addEventListener('change',event=>{const input=event.target;if(input.matches('input[type=checkbox]')){input.checked?state().known.add(input.value):state().known.delete(input.value);options();}});
$('search').addEventListener('input',options);$('incomplete').addEventListener('change',options);$('ac-other').addEventListener('change',options);
$('results').addEventListener('click',event=>{const b=event.target.closest('button[data-method]');if(b){$('seek').value=b.dataset.seek;options();$('method').value=b.dataset.method;options();$('known').scrollIntoView({block:'nearest'});}});
$('feedback-type').addEventListener('change',updateFeedbackLink);$('version').textContent=`EL / TM · BM4 · Version ${db.cheatsheet_version}`;
function table(headers,rows){return '<table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}


// Product features are independent of the presentation export.
const storageKey='formelopslag.saved.v1';
function readStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
const formulaIds=new Set(db.catalogs.flatMap(c=>c.entries.map(e=>e.id)));
const storedSaved=readStorage(storageKey,[]);
const savedEntries=new Set(Array.isArray(storedSaved)?storedSaved.filter(id=>formulaIds.has(id)):[]);
let savedOnly=false,discoveryLimit=24,restoring=false,noticeTimer;
function normalize(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('ø','o').replaceAll('æ','ae').replaceAll('stroem','strom').replaceAll('η',' eta ').replaceAll('Ω',' ohm ').replaceAll('ω',' omega ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function matchesQuery(text,query){const haystack=normalize(text);return normalize(query).split(/\s+/).every(word=>haystack.includes(word));}
function entrySearchText(entry,catalog){return [entry.id,entry.seek,entry.given,entry.condition,entry.steps,entry.conversion,entry.pitfall,entry.latex,db.search_text[entry.id],catalog.topic,catalog.navigation_groups.find(g=>g.id===entry.lookup.group)?.label,...entry.lookup.given_sets.flat().map(k=>catalog.quantities[k])].join(' ');}
const discoveryIndex=db.catalogs.flatMap(c=>[
 ...c.entries.map(e=>({catalog:c,entry:e,seek:e.lookup.seek_key,text:entrySearchText(e,c)})),
 ...Object.entries(c.unavailable_targets||{}).map(([key,gap])=>({catalog:c,seek:key,gap,text:[c.topic,c.quantities[key],gap].join(' ')}))
]);
function announce(message){clearTimeout(noticeTimer);$('action-status').textContent=message;noticeTimer=setTimeout(()=>{$('action-status').textContent='';},4500);}
function cardActions(entry,method){return `<div class="card-actions"><button type="button" data-save="${esc(entry.id)}" aria-pressed="${savedEntries.has(entry.id)}" aria-label="Gem ${esc(entry.id)}">${savedEntries.has(entry.id)?'Gemt':'Gem opslag'}</button><button type="button" data-share="${esc(method)}">Kopiér link</button><button type="button" data-formula="${esc(entry.latex)}">Kopiér formel</button></div>`;}
function renderDiscovery(){
 const query=$('global-search').value.trim();
 $('saved-count').textContent=savedEntries.size;
 $('saved-toggle').setAttribute('aria-pressed',String(savedOnly));
 if(!query&&!savedOnly){$('discovery-results').innerHTML='';$('show-more').hidden=true;$('discovery-status').textContent='Søg efter en størrelse, et emne eller en formelkode.';return;}
 const found=discoveryIndex.filter(item=>(!savedOnly||savedEntries.has(item.entry?.id))&&(!query||matchesQuery(item.text,query)));
 found.sort((a,b)=>Number(normalize(b.entry?.id)===normalize(query))-Number(normalize(a.entry?.id)===normalize(query)));
 $('discovery-status').textContent=found.length?`${found.length} resultater på tværs af fag · viser ${Math.min(discoveryLimit,found.length)}`:savedOnly&&!savedEntries.size?'Du har ingen gemte opslag endnu. Åbn en formel og vælg “Gem opslag”.':'Ingen resultater. Prøv en størrelse, et emne eller en formelkode; fx strøm eller Carnot.';
 $('discovery-results').innerHTML=found.slice(0,discoveryLimit).map(item=>`<button type="button" class="discovery-card" data-catalog="${esc(item.catalog.id)}" data-entry="${esc(item.entry?.id||'')}" data-target="${esc(item.seek)}"><span>${esc(item.catalog.discipline+' · '+item.catalog.topic)}${item.gap?' · Kildehul':''}</span><strong>${esc(item.entry?item.entry.id+' · '+item.entry.seek:item.catalog.quantities[item.seek])}</strong><span>${esc(item.gap?'Kildegrundlag mangler – se afgrænsningen':item.entry.given)}</span></button>`).join('');
 $('show-more').hidden=found.length<=discoveryLimit;
}
function openCatalog(catalogId){
 const catalog=db.catalogs.find(c=>c.id===catalogId);if(!catalog)return false;
 remember();if(activeCatalog()&&activeCatalog().discipline!==catalog.discipline){states.clear();currentCatalogId='';}
 updateTopics(catalog.discipline,catalog.id);return true;
}
function openEntry(catalogId,entryId,seek){
 if(!openCatalog(catalogId))return;
 const c=activeCatalog(),entry=c.entries.find(e=>e.id===entryId);
 activeGroup='';$('search').value='';$('ac-other').checked=false;$('incomplete').checked=true;
 $('seek').value=entry?.lookup.seek_key||seek||'';$('method').value='';$('situation').value='';options();
 if(entry){$('method').value=entry.id+':0';options();}
 $('workspace').scrollIntoView({block:'start'});$('workspace').focus({preventScroll:true});
}
function routeHash(method=$('method').value){
 const c=activeCatalog();if(!c)return '';
 const params=new URLSearchParams({catalog:c.id});
 for(const [key,value] of [['seek',$('seek').value],['method',method],['situation',$('situation').value],['group',activeGroup],['known',[...state().known].join(',')],['q',$('search').value.trim()]])if(value)params.set(key,value);
 if(!$('incomplete').checked)params.set('complete','1');if($('ac-other').checked)params.set('ac','1');
 return '#'+params.toString();
}
function syncUrl(){if(restoring)return;try{history.replaceState(null,'',location.pathname+location.search+routeHash());}catch{/* Offline previews can restrict history access. */}}
function applyHash(){
 const params=new URLSearchParams(location.hash.slice(1)),catalog=db.catalogs.find(c=>c.id===params.get('catalog'));
 if(!catalog){if(location.hash)announce('Linket indeholder ikke et kendt fagområde. Vælg et opslag.');return;}
 restoring=true;
 try{
  openCatalog(catalog.id);const s=state();
  activeGroup=catalog.navigation_groups.some(g=>g.id===params.get('group'))?params.get('group'):'';
  s.known=new Set((params.get('known')||'').split(',').filter(k=>Object.hasOwn(catalog.quantities,k)));
  $('seek').value=seekOptions(catalog).includes(params.get('seek'))?params.get('seek'):'';
  $('search').value=(params.get('q')||'').slice(0,200);$('incomplete').checked=params.get('complete')!=='1';$('ac-other').checked=params.get('ac')==='1'&&catalog.discipline==='EL';
  $('method').value='';$('situation').value='';options();
  const method=routesForControls().find(r=>r.key===params.get('method'));
  if(method)$('method').value=method.key;
  const scene=params.get('situation');if(Object.hasOwn(catalog.situations,scene))$('situation').value=scene;
  options();
 }finally{restoring=false;}syncUrl();
}
async function copyText(text,label){
 try{if(navigator.clipboard&&location.protocol!=='file:'){await navigator.clipboard.writeText(text);announce(label+' kopieret.');return;}}catch{}
 const input=document.createElement('textarea');input.value=text;input.setAttribute('aria-label',label);input.style.cssText='position:fixed;left:0;top:0;opacity:0';document.body.append(input);
 const previous=document.activeElement;input.focus();input.select();let copied=false;try{copied=document.execCommand('copy');}catch{}input.remove();previous?.focus({preventScroll:true});
 if(copied)announce(label+' kopieret.');else{$('copy-label').textContent=label;$('copy-value').value=text;$('copy-dialog').showModal();$('copy-value').focus();$('copy-value').select();}
}
function resetChoices(all=false){
 if(all){states.clear();currentCatalogId='';updateTopics();$('global-search').value='';savedOnly=false;renderDiscovery();}
 else if(currentCatalogId){states.delete(currentCatalogId);const c=currentCatalogId;currentCatalogId='';$('topic').value=c;activateTopic();}
 announce('Valgene er nulstillet.');syncUrl();
}
function applyTheme(theme){
 if(!['auto','light','dark'].includes(theme))theme='auto';
 if(theme==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;
 $('theme-toggle').dataset.theme=theme;$('theme-toggle').textContent='Tema: '+({auto:'automatisk',light:'lyst',dark:'mørkt'})[theme];
}
$('global-search').addEventListener('input',()=>{discoveryLimit=24;renderDiscovery();});
$('saved-toggle').addEventListener('click',()=>{savedOnly=!savedOnly;discoveryLimit=24;renderDiscovery();});
$('show-more').addEventListener('click',()=>{discoveryLimit+=24;renderDiscovery();});
$('discovery-results').addEventListener('click',event=>{const b=event.target.closest('button[data-catalog]');if(b)openEntry(b.dataset.catalog,b.dataset.entry,b.dataset.target);});
$('topic-shortcuts').innerHTML=db.catalogs.map(c=>`<button type="button" data-catalog="${esc(c.id)}"><strong>${esc(c.topic)}</strong><span>${esc(c.discipline)} · ${c.entries.length} opslag</span></button>`).join('');
$('topic-shortcuts').addEventListener('click',event=>{const b=event.target.closest('button[data-catalog]');if(b){openCatalog(b.dataset.catalog);$('workspace').scrollIntoView({block:'start'});$('workspace').focus({preventScroll:true});}});
$('results').addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.save){const id=b.dataset.save;savedEntries.has(id)?savedEntries.delete(id):savedEntries.add(id);const persisted=writeStorage(storageKey,[...savedEntries]);
  document.querySelectorAll('button[data-save]').forEach(button=>{const saved=savedEntries.has(button.dataset.save);button.textContent=saved?'Gemt':'Gem opslag';button.setAttribute('aria-pressed',String(saved));});renderDiscovery();if(!persisted)announce('Gemt for denne session. Browseren tillader ikke lokal lagring.');}
 if(b.dataset.share){const url=new URL(location.href);url.hash=routeHash(b.dataset.share);copyText(url.href,'Link');}
 if(b.dataset.formula)copyText(db.math_assets[b.dataset.formula].search,'Formel');
});
$('reset').addEventListener('click',()=>resetChoices());
$('print').addEventListener('click',()=>{if(!$('results').querySelector('article'))announce('Vælg et opslag før udskrivning.');else window.print();});
$('theme-toggle').addEventListener('click',()=>{const order=['auto','light','dark'],theme=order[(order.indexOf($('theme-toggle').dataset.theme)+1)%3];applyTheme(theme);writeStorage('formelopslag.theme.v1',theme);});
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();resetChoices(true);window.scrollTo(0,0);});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();$('workspace').focus();$('workspace').scrollIntoView({block:'start'});});
window.addEventListener('hashchange',applyHash);
window.addEventListener('popstate',applyHash);
window.addEventListener('storage',event=>{if(event.key===storageKey){const incoming=readStorage(storageKey,[]);savedEntries.clear();if(Array.isArray(incoming))incoming.filter(id=>formulaIds.has(id)).forEach(id=>savedEntries.add(id));document.querySelectorAll('button[data-save]').forEach(button=>{const saved=savedEntries.has(button.dataset.save);button.textContent=saved?'Gemt':'Gem opslag';button.setAttribute('aria-pressed',String(saved));});renderDiscovery();}});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();$('global-search').focus();}});
$('catalog-count').textContent=`${formulaIds.size} opslag · ${db.catalogs.length} fagområder · kildehenvisninger på hvert kort`;
applyTheme(readStorage('formelopslag.theme.v1','auto'));
// Preserve a requested link while rendering the initial empty form.
const initialHash=location.hash;restoring=true;updateFeedbackUi();updateTopics();restoring=false;
if(initialHash){location.hash=initialHash;applyHash();}
renderDiscovery();
