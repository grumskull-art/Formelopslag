const db=JSON.parse(document.getElementById('database').textContent);
function mathImage(latex,size=18){
 const a=db.math_assets[latex];
 return `<div class="math-line"><span class="math-search" aria-hidden="true">${esc(a.search)}</span><img class="math-image" src="${a.src}" decoding="async" alt="${esc(a.search)}" data-latex="${esc(latex)}" style="width:${a.width*size/25}px;height:${a.height*size/25}px"></div>`;
}
function richField(label,source,extraClass=''){
 if(!source)return '';
 return `<section class="helper ${esc(extraClass)}"><h3>${esc(label)}</h3>`+source.split('$').map((value,i)=>!value.trim()?'':i%2?mathImage(value.trim()):`<p>${esc(value.trim()).replaceAll('\n','<br>')}</p>`).join('')+'</section>';
}
function foldedField(label,source){return source?`<details class="card-detail"><summary>${esc(label)}</summary>${richField(label,source)}</details>`:'';}

const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activeGroup='',currentCatalogId='';
const states=new Map();
function activeCatalog(){return db.catalogs.find(c=>c.id===currentCatalogId);}
function state(){
 if(!states.has(currentCatalogId))states.set(currentCatalogId,{known:new Set(),seek:'',method:'',situation:'',search:'',incomplete:true,group:'',acOther:false});
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
 if(box.bottom<=0||room<40)closeSeek();else $('seek-list').style.maxHeight=Math.min(300,room)+'px';
});
function syncMethods(routes,value){
 const el=$('method'),field=$('method-field'),text=$('method-text');
 $('method-label').textContent=routes.length===1?'Anvendt formel':'Vælg beregningsvej';
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
function sources(refs){return `<div class="subtle source"><strong>Kilder</strong>${refs.map(ref=>{
 const source=activeCatalog()?.source_inventory?.find(s=>s.id===ref.split(':')[0]);
 const link=source&&db.source_base_url?`<a href="${esc(db.source_base_url+source.file.split('/').map(encodeURIComponent).join('/'))}" target="_blank" rel="noopener">Åbn kilde på GitHub</a>`:'';
 return `<p>${esc(sourceText(ref))} ${link||`<small>Find filen i projektets ${esc(source?.file||'sources/')}.</small>`}</p>`;
 }).join('')}<small>Kilderne ligger separat fra offlineopslaget.</small></div>`;}
function renderGivens(c,chosen,available){
 const gap=c?.unavailable_targets?.[$('seek').value],all=gap?[]:[...new Set(available.flatMap(e=>e.lookup.given_sets.flat()))];
 const scoped=matchEntries($('seek').value,[], $('situation').value,$('search').value.trim(),true,activeGroup).map(r=>r.entry);
 const relevant=gap?[]:chosen?chosen.option:[...new Set(scoped.flatMap(e=>e.lookup.given_sets.flat()))];
 const overview=!activeGroup&&!$('seek').value&&!$('search').value.trim();
 const other=all.filter(k=>!relevant.includes(k));
 const group=chosen?.entry.lookup.group||activeGroup||(scoped.length&&scoped.every(e=>e.lookup.group===scoped[0].lookup.group)?scoped[0].lookup.group:'');
 const guide=c?.given_guides?.[group],scope=[currentCatalogId,activeGroup,$('seek').value,chosen?.key||''].join(':');
 const focused=document.activeElement?.closest('#givens input')?.value;
 const expanded=$('givens').dataset.scope===scope&&$('other-givens')?.open;
 const overviewExpanded=$('givens').dataset.scope===scope&&$('all-givens')?.open;
 const card=(k,guided=true)=>{
  const info=guided?guide?.quantities[k]:null,help=info?.help;
  return `<label class="given-option"><input type="checkbox" value="${esc(k)}" aria-labelledby="given-name-${esc(k)}" ${state().known.has(k)?'checked':''} ${help?`aria-describedby="given-help-${esc(k)}"`:''}><span><span class="given-name" id="given-name-${esc(k)}">${esc(info?.label||c.quantities[k])}</span>${help?`<small id="given-help-${esc(k)}">${esc(help)}</small>`:''}</span></label>`;
 };
 const grid=(keys,guided=true)=>`<div class="known">${keys.map(k=>card(k,guided)).join('')}</div>`;
 const layout=keys=>{
  if(keys===other&&activeGroup!==group)return grid(keys,false);
  if(!guide||chosen)return grid(keys);
  return guide.groups.map(g=>{
   const items=g.keys.filter(k=>keys.includes(k));
   return items.length?`<section class="given-group"><h3>${esc(g.label)}</h3>${grid(items)}</section>`:'';
  }).join('')+grid(keys.filter(k=>!guide.groups.some(g=>g.keys.includes(k))));
 };
 $('known').hidden=!relevant.length||$('ac-other').checked;
 const selected=all.filter(k=>state().known.has(k)).length;
 $('given-context').textContent=(chosen?'Oplysninger til '+chosen.entry.id+' · '+chosen.entry.seek:$('seek').value?'Relevante oplysninger til '+selectedOptionText('seek'):'Vælg dine oplysninger, så finder vi formlerne.')+` · ${selected} valgt`;
 $('givens').innerHTML=(overview?`<details id="all-givens" ${overviewExpanded||selected?'open':''}><summary>Start med kendte oplysninger (${all.length})</summary>`:'')+`<div id="relevant-givens">${layout(relevant)}</div>`+(other.length?`<details id="other-givens" ${expanded?'open':''}><summary>Andre oplysninger i emnet (${other.length}${other.some(k=>state().known.has(k))?' · '+other.filter(k=>state().known.has(k)).length+' valgt':''})</summary>${layout(other)}</details>`:'')+(overview?'</details>':'');
 $('givens').dataset.scope=scope;
 if(focused){const input=[...$('givens').querySelectorAll('input')].find(i=>i.value===focused);if(input){const details=input.closest('details');if(details)details.open=true;input.focus({preventScroll:true});}}
}
function render(){
  const c=activeCatalog(),known=[...state().known],situation=$('situation').value,query=$('search').value.trim(),selected=$('method').value;
 const detailKey=detail=>JSON.stringify([detail.closest('article').dataset.method,detail.querySelector('summary').textContent]);
 const expandedCards=new Set([...$('results').querySelectorAll('article details[open]')].map(detailKey));
 const chosen=routesForControls().find(r=>r.key===selected);
 const available=c?c.entries.filter(e=>!activeGroup||e.lookup.group===activeGroup):[];
 renderGivens(c,chosen,available);
 const relevant=r=>($('seek').value||query||r.option.some(k=>known.includes(k)))&&(!selected||r.method===selected);
 const started=c&&($('seek').value||query||known.length),found=started&&!$('ac-other').checked?matchEntries($('seek').value,known,situation,query,$('incomplete').checked,activeGroup).filter(relevant):[];
 const gap=c?.unavailable_targets?.[$('seek').value];
 $('results').classList.toggle('single',found.length===1);
 $('status').textContent=!c?'Vælg fag og emne.':gap?'Kildegrundlag mangler · '+c.topic:!started?'Vælg underemne eller søgt størrelse. Du kan også starte med kendte oplysninger.':`${found.length} ${found.length===1?'relevant beregningsvej':'relevante beregningsveje'} · ${found.filter(r=>r.complete).length} med de nødvendige størrelser · ${c.topic}`;
 const missing=chosen?.option.filter(k=>!state().known.has(k))||[];
 const hiddenRoutes=started&&!found.length&&!$('incomplete').checked?matchEntries($('seek').value,known,situation,query,true,activeGroup).filter(relevant):[];
 $('model-note').textContent=$('ac-other').checked?'AC-materialet mangler. Afklar kurveform, RMS, effektfaktor og aktiv/tilsyneladende effekt. DC-formlen I=P/U vælges ikke her.':gap?gap+' Næste skridt: find det nævnte kildemateriale, eller brug Feedback til at beskrive det manglende opslag.':started&&!found.length&&chosen&&missing.length?'Valgt metode mangler oplysninger: '+missing.map(k=>c.quantities[k]).join(', '):hiddenRoutes.length?'Der findes relevante beregningsveje. Slå visning af manglende oplysninger til for at se kravene til hver metode.':started&&!found.length?'Ingen beregningsvej matcher de valgte filtre. Kontrollér emne, søgt størrelse, situation og filtre.':found.length?'Vælg dine oplysninger. Krav og mangler står ved hver beregningsvej; kontrollér betingelser, fortegn og enheder.':'';
 $('results').innerHTML=found.map(({entry:e,method,missing,option,situationConfirmed})=>`<article data-entry="${esc(e.id)}" data-method="${esc(method)}"><h2>${esc(e.id+' · '+e.seek)}</h2>${cardActions(e,method)}<p class="condition"><strong>Gælder:</strong> ${esc(e.condition)}</p><p><strong>Denne metode kræver:</strong> ${option.map(k=>esc(c.quantities[k])).join(', ')}</p>${mathImage(e.latex,26)}${richField('Kort forklaret',e.explanation,'explanation')}<p class="${missing.length?'missing':situationConfirmed?'ready':'pending'}">${missing.length?'Mangler: '+missing.map(k=>esc(c.quantities[k])).join(', '):situationConfirmed?'Størrelserne er oplyst; kontrollér stadig betingelserne.':'Størrelserne er oplyst; fysisk situation skal afklares.'}</p>${selected===method?'':`<button class="choose-method" type="button" data-method="${esc(method)}" data-seek="${esc(e.lookup.seek_key)}">Vælg denne metode</button>`}${foldedField('Trin',e.steps)}${foldedField('Omregn',e.conversion)}${foldedField('Pas på',e.pitfall)}${foldedField('Eksempel',e.example)}${sources(e.source_locations)}<details><summary>Formlens LaTeX</summary><pre>${esc(e.latex)}</pre></details></article>`).join('')||(started&&!gap?'<p>Ingen beregningsvej vises med de aktuelle filtre.</p>':'');
 $('results').querySelectorAll('article details').forEach(detail=>{detail.open=expandedCards.has(detailKey(detail));});
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
function quantitySearchText(catalog,key){return [key,catalog.quantities[key],...(catalog.quantity_aliases?.[key]||[])].join(' ');}
function entrySearchText(entry,catalog){return [entry.id,entry.seek,quantitySearchText(catalog,entry.lookup.seek_key),entry.given,entry.condition,entry.steps,entry.conversion,entry.pitfall,entry.latex,db.search_text[entry.id],catalog.topic,catalog.navigation_groups.find(g=>g.id===entry.lookup.group)?.label,...entry.lookup.given_sets.flat().map(k=>quantitySearchText(catalog,k))].join(' ');}
const discoveryIndex=db.catalogs.flatMap(c=>[
 ...c.entries.map(e=>({catalog:c,entry:e,seek:e.lookup.seek_key,text:entrySearchText(e,c)})),
 ...Object.entries(c.unavailable_targets||{}).map(([key,gap])=>({catalog:c,seek:key,gap,text:[c.topic,c.quantities[key],gap].join(' ')}))
]);
function announce(message){clearTimeout(noticeTimer);$('action-status').textContent=message;noticeTimer=setTimeout(()=>{$('action-status').textContent='';},4500);}
function cardActions(entry,method){return `<div class="card-actions"><button type="button" data-save="${esc(entry.id)}" aria-pressed="${savedEntries.has(entry.id)}" aria-label="Gem ${esc(entry.id)}">${savedEntries.has(entry.id)?'Gemt':'Gem opslag'}</button><button type="button" data-share="${esc(method)}">Kopiér link</button><button type="button" data-mathcad="${esc(entry.id)}">Kopiér til Mathcad</button><button type="button" data-mathcad-options="${esc(entry.id)}">Mathcad-valg</button><button type="button" data-formula="${esc(entry.latex)}">Kopiér som tekst</button><button type="button" data-latex="${esc(entry.latex)}">Kopiér LaTeX</button></div>`;}
function renderDiscovery(){
 const query=$('global-search').value.trim();
 $('saved-count').textContent=savedEntries.size;
 $('saved-toggle').setAttribute('aria-pressed',String(savedOnly));
 if(!query&&!savedOnly){$('discovery-results').innerHTML='';$('show-more').hidden=true;$('discovery-status').textContent='Søg efter en størrelse, et emne eller en formelkode.';return;}
 const found=discoveryIndex.filter(item=>(!savedOnly||savedEntries.has(item.entry?.id))&&(!query||matchesQuery(item.text,query)));
 const matchesQuantity=(item,key)=>[key,...(item.catalog.quantity_aliases?.[key]||[])].some(alias=>normalize(alias)===normalize(query));
 const rank=item=>normalize(item.entry?.id)===normalize(query)?3:matchesQuantity(item,item.seek)?2:item.entry?.lookup.given_sets.flat().some(k=>matchesQuantity(item,k))?1:0;
 found.sort((a,b)=>rank(b)-rank(a));
 $('discovery-status').textContent=found.length?`${found.length} ${found.length===1?'resultat':'resultater'} på tværs af fag · viser ${Math.min(discoveryLimit,found.length)}`:savedOnly&&!savedEntries.size?'Du har ingen gemte opslag endnu. Åbn en formel og vælg “Gem opslag”.':'Ingen resultater. Prøv en størrelse, et emne eller en formelkode; fx strøm eller Carnot.';
 $('discovery-results').innerHTML=found.slice(0,discoveryLimit).map(item=>`<div class="discovery-item"><button type="button" class="discovery-card" data-catalog="${esc(item.catalog.id)}" data-entry="${esc(item.entry?.id||'')}" data-target="${esc(item.seek)}"><span>${esc(item.catalog.discipline+' · '+item.catalog.topic)}${item.gap?' · Kildehul':''}</span><strong>${esc(item.entry?item.entry.id+' · '+item.entry.seek:item.catalog.quantities[item.seek])}</strong><span>${esc(item.gap?'Kildegrundlag mangler – se afgrænsningen':item.entry.given)}</span></button>${item.entry?`<div class="card-actions"><button type="button" data-mathcad="${esc(item.entry.id)}">Kopiér til Mathcad</button><button type="button" data-mathcad-options="${esc(item.entry.id)}">Mathcad-valg</button></div>`:''}</div>`).join('');
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
function syncUrl(){if(restoring)return;try{history.replaceState(null,'',location.pathname+location.search+routeHash());}catch{/* Offline previews can restrict history access. */}updateFeedbackLink();}
function applyHash(){
 const toolHash={ '#diagrammer':'list','#ph':'ph','#gas':'gas','#motor':'motor' };
 if(Object.hasOwn(toolHash,location.hash||'')){setTool(toolHash[location.hash],{fromHash:true});return;}
 if(document.body.dataset.view!=='formulas')setTool('formulas',{fromHash:true});
 const params=new URLSearchParams(location.hash.slice(1)),catalog=db.catalogs.find(c=>c.id===params.get('catalog'));
 if(!catalog){const invalid=!!location.hash;resetChoices(true,true);if(invalid)announce('Linket indeholder ikke et kendt fagområde. Vælg et opslag.');return;}
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
 try{if(navigator.clipboard){await navigator.clipboard.writeText(text);announce(label+' kopieret.');return;}}catch{}
 const input=document.createElement('textarea');input.value=text;input.setAttribute('aria-label',label);input.style.cssText='position:fixed;left:0;top:0;opacity:0';document.body.append(input);
 const previous=document.activeElement;input.focus();input.select();let copied=false;
 const handler=event=>{if(event.clipboardData){event.clipboardData.setData('text/plain',text);event.preventDefault();copied=true;}};
 document.addEventListener('copy',handler);
 try{copied=document.execCommand('copy')||copied;}catch{}finally{document.removeEventListener('copy',handler);input.remove();previous?.focus({preventScroll:true});}
 if(copied)announce(label+' kopieret.');else{$('copy-label').textContent=label;$('copy-value').value=text;$('copy-dialog').showModal();$('copy-value').focus();$('copy-value').select();}
}
function resetChoices(all=false,quiet=false){
 if(all){states.clear();currentCatalogId='';updateTopics();$('global-search').value='';savedOnly=false;renderDiscovery();}
 else if(currentCatalogId){states.delete(currentCatalogId);const c=currentCatalogId;currentCatalogId='';$('topic').value=c;activateTopic();}
 if(!quiet)announce('Valgene er nulstillet.');syncUrl();
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
 if(b.dataset.formula)copyText(db.math_assets[b.dataset.formula].search,'Formel som tekst');
 if(b.dataset.latex)copyText(b.dataset.latex,'LaTeX');
});
const printDetails=new Set();
window.addEventListener('beforeprint',()=>{document.querySelectorAll('article details.card-detail:not([open])').forEach(d=>{printDetails.add(d);d.open=true;});});
window.addEventListener('afterprint',()=>{printDetails.forEach(d=>{d.open=false;});printDetails.clear();});
$('reset').addEventListener('click',()=>resetChoices());
$('print').addEventListener('click',()=>{if(!$('results').querySelector('article'))announce('Vælg et opslag før udskrivning.');else window.print();});
$('theme-toggle').addEventListener('click',()=>{const order=['auto','light','dark'],theme=order[(order.indexOf($('theme-toggle').dataset.theme)+1)%3];applyTheme(theme);writeStorage('formelopslag.theme.v1',theme);});
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();showFormulas();resetChoices(true);window.scrollTo(0,0);});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();const view=document.body.dataset.view;const target=view==='ph'?$('ph'):view==='gas'?$('gas'):view==='motor'?$('motor'):view==='list'?$('diagram-list'):$('workspace');target.focus();target.scrollIntoView({block:'start'});});
window.addEventListener('hashchange',applyHash);
window.addEventListener('popstate',applyHash);
window.addEventListener('storage',event=>{if(event.key===storageKey){const incoming=readStorage(storageKey,[]);savedEntries.clear();if(Array.isArray(incoming))incoming.filter(id=>formulaIds.has(id)).forEach(id=>savedEntries.add(id));document.querySelectorAll('button[data-save]').forEach(button=>{const saved=savedEntries.has(button.dataset.save);button.textContent=saved?'Gemt':'Gem opslag';button.setAttribute('aria-pressed',String(saved));});renderDiscovery();}});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();const view=document.body.dataset.view;if(view==='ph')$('ph-te').focus();else if(view==='gas')$('gas-t').focus();else if(view==='motor')$('motor-r').focus();else $('global-search').focus();}});
const PH={w:1000,h:640,l:96,r:16,t:12,b:50};
let phView=null,phCycle=null,phMode='dome',phLines=null,phKey='',phDrag=null;
const toolMeta={
 list:{hash:'#diagrammer',section:'diagram-list',skip:'Gå til diagrammer'},
 ph:{hash:'#ph',section:'ph',skip:'Gå til diagrammet'},
 gas:{hash:'#gas',section:'gas',skip:'Gå til simulationen'},
 motor:{hash:'#motor',section:'motor',skip:'Gå til diagrammet'}
};
function setTool(view,options={}){
 if(view==='ph'&&typeof Water==='undefined'){announce('log(p)-h-værktøjet findes ikke i denne fil.');return;}
 if(view==='gas'&&typeof Gas==='undefined'){announce('Idealgas-simulationen findes ikke i denne fil.');return;}
 if(view==='motor'&&typeof Motor==='undefined'){announce('Otto- og Diesel-diagrammet findes ikke i denne fil.');return;}
 document.body.dataset.view=view==='list'?'list':view;
 for(const item of Object.values(toolMeta)){const el=$(item.section);if(el)el.hidden=item.section!==(toolMeta[view]&&toolMeta[view].section);}
 $('view-formulas').setAttribute('aria-pressed',String(view==='formulas'));
 $('view-diagrams').setAttribute('aria-pressed',String(view!=='formulas'));
 const skip=document.querySelector('.skip-link');
 if(view==='formulas'){skip.setAttribute('href','#workspace');skip.textContent='Gå til formelopslag';}
 else{skip.setAttribute('href',toolMeta[view].hash);skip.textContent=toolMeta[view].skip;}
 if(view!=='gas'&&typeof Gas!=='undefined')Gas.stop();
 if(!options.fromHash){
  const hash=view==='formulas'?(currentCatalogId?routeHash():''):toolMeta[view].hash;
  if((location.hash||'')!==hash)history.replaceState(null,'',location.pathname+location.search+hash);
 }
 if(view==='ph')drawPh();
 if(view==='gas')paintGas(true);
 if(view==='motor')paintMotor();
 if(!options.fromHash){
  if(view==='formulas')window.scrollTo(0,0);
  else{const target=$(toolMeta[view].section);target.scrollIntoView({block:'start'});target.focus({preventScroll:true});}
 }
}
function showFormulas(){setTool('formulas',{fromHash:true});}
function openFormulas(){
 setTool('formulas',{fromHash:true});
 const hash=currentCatalogId?routeHash():'';
 if((location.hash||'')!==hash)history.replaceState(null,'',location.pathname+location.search+hash);
 window.scrollTo(0,0);
}
function phNum(id){
 const raw=$(id).value.trim();
 if(!raw)return NaN;
 return Number(raw.replace(',','.'));
}
function readPh(){
 const fields=[['ph-qe','QE'],['ph-te','TE'],['ph-tc','TC'],['ph-tsh','dTSH'],['ph-tsc','dTSC'],['ph-eta','eta'],['ph-fq','fQ'],['ph-etav','etaVol'],['ph-dte','dTevap'],['ph-dts','dTsuc'],['ph-tshs','dTSHsuc'],['ph-dpc','dPcond'],['ph-dtd','dTdis'],['ph-dpl','dPliq']];
 const input={};
 for(const [id,key] of fields){const value=phNum(id);if(!Number.isFinite(value))return null;input[key]=value;}
 return input;
}
function phFmt(value,digits){return Number.isFinite(value)?value.toLocaleString('da-DK',{maximumFractionDigits:digits,minimumFractionDigits:digits}):'–';}
function phBar(pMPa){
 const bar=pMPa*10;
 const digits=bar>=100?0:bar>=10?1:bar>=1?2:bar>=0.1?2:bar>=0.01?3:4;
 return phFmt(bar,digits);
}
function phX(h){return PH.l+(h-phView.hMin)/(phView.hMax-phView.hMin)*(PH.w-PH.l-PH.r);}
function phY(p){
 const l0=Math.log10(phView.pMin),l1=Math.log10(phView.pMax);
 return PH.t+(l1-Math.log10(p))/(l1-l0)*(PH.h-PH.t-PH.b);
}
function phPressureTicks(view){
 const ticks=[];
 for(let exp=Math.floor(Math.log10(view.pMin));exp<=Math.ceil(Math.log10(view.pMax));exp++)for(const m of [1,2,5]){
  const p=m*10**exp;
  if(p>view.pMin*1.02&&p<view.pMax*0.98)ticks.push(p);
 }
 return ticks.length?ticks:[Math.sqrt(view.pMin*view.pMax)];
}
function phEnthalpyTicks(view){
 const span=view.hMax-view.hMin,step=span>2200?500:span>1200?250:span>500?100:span>200?50:20,ticks=[];
 for(let h=Math.ceil(view.hMin/step)*step;h<view.hMax-step*0.2;h+=step)ticks.push(h);
 return ticks;
}
function phPath(points){
 let d='',pen=false;
 for(const pt of points){
  const p=pt.p??pt.P;
  if(!Number.isFinite(pt.h)||!Number.isFinite(p)||p<=0){pen=false;continue;}
  d+=`${pen?'L':'M'}${phX(pt.h).toFixed(1)} ${phY(p).toFixed(1)}`;
  pen=true;
 }
 return d;
}
function phLinesNow(){
 const volumes=$('ph-show-v').checked;
 const key=[phView.hMin,phView.hMax,phView.pMin,phView.pMax,volumes].map(v=>typeof v==='number'?v.toPrecision(6):v).join('|');
 if(phLines&&key===phKey)return phLines;
 const temps=phCycle?[phCycle.points[1].T-273.15]:[];
 phLines=Water.isolines(phView,{temps,volumes});
 phKey=key;
 return phLines;
}
function markPhMode(){for(const [id,mode] of [['ph-fit','cycle'],['ph-wide','wide'],['ph-dome','dome']])$(id).setAttribute('aria-pressed',String(phMode===mode));}
function phLayout(){
 const el=$('ph-chart');
 if(!el)return false;
 const w=Math.round(el.clientWidth),h=Math.round(el.clientHeight);
 if(w<240||h<220)return false;
 PH.w=w;PH.h=h;
 PH.l=Math.max(92,Math.min(112,Math.round(w*0.14)));
 PH.r=16;PH.t=12;PH.b=50;
 $('ph-svg').setAttribute('viewBox',`0 0 ${w} ${h}`);
 return true;
}
function phSpread(items,gap,pos){
 const kept=[];
 for(const item of items){
  const at=pos(item);
  if(kept.every(prev=>Math.abs(pos(prev)-at)>=gap))kept.push(item);
 }
 return kept;
}
function phVisible(points){
 return points.filter(pt=>{
  const p=pt.p??pt.P;
  return pt.h>=phView.hMin&&pt.h<=phView.hMax&&p>=phView.pMin&&p<=phView.pMax;
 });
}
function phSpot(points,bias){
 const vis=phVisible(points);
 if(!vis.length)return null;
 const target=phView.hMin+(phView.hMax-phView.hMin)*bias;
 return vis.reduce((best,pt)=>Math.abs(pt.h-target)<Math.abs(best.h-target)?pt:best);
}
function phLabelPressure(frac){
 const lo=Math.log10(phView.pMin),hi=Math.log10(phView.pMax);
 return 10**(lo+(hi-lo)*Math.min(0.9,Math.max(0.1,frac)));
}
function phAtPressure(points,pTarget){
 const vis=phVisible(points);
 if(!vis.length||!(pTarget>0))return null;
 return vis.reduce((best,pt)=>Math.abs(Math.log(pt.p)-Math.log(pTarget))<Math.abs(Math.log(best.p)-Math.log(pTarget))?pt:best);
}
function phIsothermAnchor(tC,segments){
 const p=Water.psat(tC+273.15);
 if(p>=phView.pMin&&p<=phView.pMax){
  const sat=Water.saturation(tC+273.15);
  if(sat&&Number.isFinite(sat.hf))return {x:phX(sat.hf)+26,y:phY(sat.P)-11,anchor:'start'};
 }
 const spot=phAtPressure(segments.flat(),phLabelPressure(0.62));
 if(!spot)return null;
 const x=phX(spot.h);
 return PH.w-PH.r-x>68?{x:x+8,y:phY(spot.p),anchor:'start'}:{x:x-8,y:phY(spot.p),anchor:'end'};
}
function paintPh(){
 if(!phView||!phLayout())return;
 const lines=phLinesNow();
 const on=id=>$(id).checked;
 const grid=[];
 for(const p of phSpread(phPressureTicks(phView),20,p=>phY(p))){
  const y=phY(p);
  grid.push(`<line class="ph-grid" x1="${PH.l}" y1="${y.toFixed(1)}" x2="${PH.w-PH.r}" y2="${y.toFixed(1)}"></line><text class="ph-label" x="${(PH.l-8).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle">${phBar(p)}</text>`);
 }
 const hTicks=phEnthalpyTicks(phView).filter(h=>{
  const label=phFmt(h,0),x=phX(h),half=label.length*4.4+8;
  return x-half>PH.l&&x+half<PH.w-PH.r;
 });
 for(const h of phSpread(hTicks,64,h=>phX(h))){
  const x=phX(h);
  grid.push(`<line class="ph-grid" x1="${x.toFixed(1)}" y1="${PH.t}" x2="${x.toFixed(1)}" y2="${(PH.h-PH.b).toFixed(1)}"></line><text class="ph-label" x="${x.toFixed(1)}" y="${(PH.h-PH.b+22).toFixed(1)}" text-anchor="middle">${phFmt(h,0)}</text>`);
 }
 let curves='';
 const tagBoxes=[];
 const markerPos=[];
 if(on('ph-show-cycle')&&phCycle){
  const placed=[];
  for(const pt of phCycle.points){
   if(pt.n===8&&Math.abs(pt.h-phCycle.points[0].h)<1e-6&&Math.abs(pt.P-phCycle.points[0].P)<1e-12)continue;
   let x=phX(pt.h),y=phY(pt.P);
   if(placed.some(item=>Math.hypot(item.x-x,item.y-y)<30))y-=30;
   placed.push({x,y});
   markerPos.push({pt,x,y});
   tagBoxes.push({l:x-16,r:x+16,t:y-16,b:y+16});
  }
 }
 function phTag(text,x,y,anchor,cls){
  const width=text.length*8.6+8,height=18;
  const plotL=PH.l+2,plotR=PH.w-PH.r-2,plotT=PH.t+height,plotB=PH.h-PH.b-6;
  let ax=x,left=anchor==='end'?x-width:anchor==='middle'?x-width/2:x;
  if(left<plotL){ax+=plotL-left;left=plotL;}
  if(left+width>plotR){const shift=left+width-plotR;ax-=shift;left-=shift;}
  if(left<plotL-1)return '';
  let ay=y;
  if(ay<plotT){if(plotT-ay>18)return '';ay=plotT;}
  if(ay>plotB){if(ay-plotB>18)return '';ay=plotB;}
  const boxAt=yy=>({l:left-2,r:left+width+2,t:yy-height,b:yy+3});
  let box=boxAt(ay);
  const hit=item=>box.l<item.r&&box.r>item.l&&box.t<item.b&&box.b>item.t;
  if(tagBoxes.some(hit)){
   let placed=false;
   for(const dy of [-18,18,-36,36]){
    const yy=ay+dy;
    if(yy<plotT||yy>plotB)continue;
    box=boxAt(yy);
    if(tagBoxes.some(hit))continue;
    ay=yy;placed=true;break;
   }
   if(!placed)return '';
  }
  tagBoxes.push(box);
  return `<text class="ph-tag ${cls}" x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" text-anchor="${anchor}">${esc(text)}</text>`;
 }
 let tags='';
 if(on('ph-show-v'))for(const line of lines.isochores)curves+=`<path class="ph-v" d="${phPath(line.points)}"></path>`;
 if(on('ph-show-t'))for(const line of lines.isotherms){
  for(const segment of line.segments)curves+=`<path class="ph-t" d="${phPath(segment)}"></path>`;
  const anchor=phIsothermAnchor(line.t,line.segments);
  if(anchor)tags+=phTag(`${Math.round(line.t)} °C`,anchor.x,anchor.y,anchor.anchor,'ph-tag-t');
 }
 if(on('ph-show-x'))for(const line of lines.quality){
  curves+=`<path class="ph-x" d="${phPath(line.points)}"></path>`;
  const spot=phAtPressure(line.points,phLabelPressure(0.78));
  if(spot)tags+=phTag(`x ${phFmt(line.x,1)}`,phX(spot.h),phY(spot.p),'middle','ph-tag-x');
 }
 if(on('ph-show-s')){
  const entropy=lines.isentropes;
  entropy.forEach((line,i)=>{
   curves+=`<path class="ph-s" d="${phPath(line.points)}"></path>`;
   const frac=entropy.length===1?0.55:0.8-i*(0.6/(entropy.length-1));
   const spot=phAtPressure(line.points,phLabelPressure(frac));
   if(spot)tags+=phTag(`s ${phFmt(line.s,2)}`,phX(spot.h)-8,phY(spot.p),'end','ph-tag-s');
  });
 }
 if(on('ph-show-sat'))curves+=`<path class="ph-sat" d="${phPath(lines.bubble)}"></path><path class="ph-sat" d="${phPath(lines.dew)}"></path>`;
 if(on('ph-show-cycle')&&phCycle)curves+=`<path class="ph-cycle" d="${phPath(phCycle.points)}"></path>`;
 const markers=markerPos.map(({pt,x,y})=>{
  const tip=`${pt.n} ${pt.name}: ${phFmt(pt.T-273.15,1)} °C, ${phBar(pt.P)} bar, h ${phFmt(pt.h,1)} kJ/kg`;
  return `<g class="ph-marker"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13"></circle><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${pt.n}</text><title>${esc(tip)}</title></g>`;
 }).join('');
 $('ph-svg').innerHTML=`<rect class="ph-bg" width="${PH.w}" height="${PH.h}"></rect><defs><clipPath id="ph-clip"><rect x="${PH.l}" y="${PH.t}" width="${PH.w-PH.l-PH.r}" height="${PH.h-PH.t-PH.b}"></rect></clipPath></defs>${grid.join('')}<rect class="ph-frame" x="${PH.l}" y="${PH.t}" width="${PH.w-PH.l-PH.r}" height="${PH.h-PH.t-PH.b}"></rect><text class="ph-unit" x="${((PH.l+PH.w-PH.r)/2).toFixed(1)}" y="${PH.h-8}" text-anchor="middle">h [kJ/kg]</text><text class="ph-unit" transform="translate(14 ${((PH.t+PH.h-PH.b)/2).toFixed(1)}) rotate(-90)" text-anchor="middle">p [bar]</text><g clip-path="url(#ph-clip)">${curves}</g>${tags}${markers}`;
 markPhMode();
}
let phPaintQueued=false;
function queuePhPaint(){
 if(phPaintQueued)return;
 phPaintQueued=true;
 requestAnimationFrame(()=>{phPaintQueued=false;paintPh();});
}
function phMetric(label,value){return `<div><span>${label}</span><strong>${value}</strong></div>`;}
function fillPh(result){
 const r=result.results;
 $('ph-caption').textContent=`Et-trins kreds ved TE ${phFmt(phNum('ph-te'),1)} °C og TC ${phFmt(phNum('ph-tc'),1)} °C. COP ${phFmt(r.cop,2)}. x6 ${phFmt(r.x6,3)}.`;
 $('ph-results').innerHTML=[
  phMetric('COP',phFmt(r.cop,3)),phMetric('COP*',phFmt(r.copStar,3)),phMetric('Carnot',phFmt(r.copCarnot,3)),
  phMetric('QC [kW]',phFmt(r.QC,2)),phMetric('W [kW]',phFmt(r.W,3)),phMetric('m [kg/h]',phFmt(r.m*3600,2)),
  phMetric('qe [kJ/kg]',phFmt(r.qe,1)),phMetric('w [kJ/kg]',phFmt(r.w,1)),phMetric('x6',phFmt(r.x6,3)),
  phMetric('T2,IS [°C]',phFmt(r.T2is-273.15,1)),phMetric('T2 [°C]',phFmt(r.T2-273.15,1)),phMetric('T2,W [°C]',phFmt(r.T2w-273.15,1)),
  phMetric('p2/p1',phFmt(r.pr,2)),phMetric('Vs [m³/h]',phFmt(r.Vs*3600,0))
 ].join('');
 $('ph-balance').textContent=`Energibalance: QE + W + Qsuge = ${phFmt(r.balanceIn,3)} kW og QC + Qtab = ${phFmt(r.balanceOut,3)} kW. Qsuge er varmen optaget i sugeledningen, og Qtab er fQ·W. COP bruger akselarbejdet. COP* bruger kun den entalpi, kølemidlet optager i kompressoren.`;
 const rows=result.points.map(pt=>`<tr><th scope="row">${pt.n} ${esc(pt.name)}</th><td>${phFmt(pt.T-273.15,1)}</td><td>${phBar(pt.P)}</td><td>${phFmt(pt.h,1)}</td><td>${phFmt(pt.s,3)}</td><td>${phFmt(pt.v,pt.v>=1?2:5)}</td><td>${phFmt(pt.x,3)}</td></tr>`).join('');
 $('ph-states').innerHTML=`<caption class="subtle">Tilstandspunkter for vand efter IAPWS-IF97. Punkt 1 og 8 er ens, når der ikke er sugegaskøler.</caption><thead><tr><th>Punkt</th><th>t [°C]</th><th>p [bar]</th><th>h [kJ/kg]</th><th>s [kJ/kg·K]</th><th>v [m³/kg]</th><th>x</th></tr></thead><tbody>${rows}</tbody>`;
}
function drawPh(){
 const input=readPh();
 if(!input){$('ph-status').textContent='Udfyld alle felter med tal.';return;}
 const result=Water.cycle(input);
 if(!result.ok){
  phCycle=null;
  $('ph-status').textContent=result.error;
  $('ph-results').innerHTML='';
  $('ph-states').innerHTML='';
  $('ph-balance').textContent='';
  $('ph-caption').textContent='Kredsen kan ikke tegnes med de valgte værdier. Diagrammet kan stadig aflæses.';
  if(!phView||phMode==='cycle')phView=phMode==='dome'?Water.frameDome():Water.frameWide();
  paintPh();
  return;
 }
 phCycle=result;
 if(!phView)phView=phMode==='wide'?Water.frameWide():phMode==='cycle'?Water.frameCycle(result.points):Water.frameDome();
 else if(phMode==='cycle')phView=Water.frameCycle(result.points);
 $('ph-status').textContent=result.warnings.join(' ');
 fillPh(result);
 paintPh();
}
function phPointer(event){
 if(!phView)return null;
 const svg=$('ph-svg'),point=svg.createSVGPoint();
 point.x=event.clientX;point.y=event.clientY;
 const matrix=svg.getScreenCTM();
 if(!matrix)return null;
 const loc=point.matrixTransform(matrix.inverse());
 const h=phView.hMin+(loc.x-PH.l)/(PH.w-PH.l-PH.r)*(phView.hMax-phView.hMin);
 const l0=Math.log10(phView.pMin),l1=Math.log10(phView.pMax);
 return {x:loc.x,y:loc.y,h,p:10**(l1-(loc.y-PH.t)/(PH.h-PH.t-PH.b)*(l1-l0))};
}
function phNearest(loc){
 if(!phCycle)return null;
 let best=null;
 for(const pt of phCycle.points){
  if(pt.n===8&&Math.abs(pt.h-phCycle.points[0].h)<1e-6)continue;
  const dist=Math.hypot(phX(pt.h)-loc.x,phY(pt.P)-loc.y);
  if(dist<=30&&(!best||dist<best.dist))best={dist,pt};
 }
 return best?best.pt:null;
}
function phDescribe(state,title){
 return [`${title} · vand, IAPWS-IF97`,`t = ${phFmt(state.T-273.15,2)} °C`,`p = ${phBar(state.P)} bar (${phFmt(state.P*1000,3)} kPa)`,`h = ${phFmt(state.h,2)} kJ/kg`,`s = ${phFmt(state.s,4)} kJ/kg·K`,`v = ${phFmt(state.v,state.v>=1?3:6)} m³/kg`,`x = ${phFmt(state.x,4)}`,`fase = ${state.phase}`,`område = ${state.region}`].join('\n');
}
function phHover(event){
 const loc=phPointer(event);
 if(!loc)return;
 const inside=loc.x>=PH.l&&loc.x<=PH.w-PH.r&&loc.y>=PH.t&&loc.y<=PH.h-PH.b;
 const svg=$('ph-svg');
 let cross=svg.querySelector('#ph-cross');
 if(!inside){if(cross)cross.remove();return;}
 if(!cross){cross=document.createElementNS('http://www.w3.org/2000/svg','g');cross.id='ph-cross';cross.setAttribute('class','ph-cross');svg.appendChild(cross);}
 cross.innerHTML=`<line x1="${PH.l}" y1="${loc.y.toFixed(1)}" x2="${PH.w-PH.r}" y2="${loc.y.toFixed(1)}"></line><line x1="${loc.x.toFixed(1)}" y1="${PH.t}" x2="${loc.x.toFixed(1)}" y2="${PH.h-PH.b}"></line>`;
 const near=phNearest(loc),state=near||Water.statePH(loc.p,loc.h);
 $('ph-readout').textContent=state.ok?`${near?near.n+' '+near.name:'Markør'}: ${phFmt(state.T-273.15,1)} °C · ${phBar(state.P)} bar · h ${phFmt(state.h,1)} kJ/kg · s ${phFmt(state.s,3)} · v ${phFmt(state.v,state.v>=1?2:5)} m³/kg · x ${phFmt(state.x,3)} · ${state.phase}`:state.error;
}
function phCopy(event){
 const loc=phPointer(event);
 if(!loc||loc.x<PH.l||loc.x>PH.w-PH.r||loc.y<PH.t||loc.y>PH.h-PH.b)return;
 const near=phNearest(loc),state=near||Water.statePH(loc.p,loc.h);
 if(!state.ok){announce(state.error);return;}
 copyText(phDescribe(state,near?`Punkt ${near.n} ${near.name}`:'Markør'),near?`Punkt ${near.n}`:'Tilstand');
}
function phZoom(factor){
 if(!phView)return;
 phView=Water.zoomView(phView,factor,(phView.hMin+phView.hMax)/2,Math.sqrt(phView.pMin*phView.pMax));
 phMode='custom';
 paintPh();
}
let gasState={n:2,T:300,V:0.05},gasHold='none',motorKind='otto';
function toolNum(id){const raw=$(id).value.trim();if(!raw)return NaN;return Number(raw.replace(',','.'));}
function toolFmt(value,digits){return Number.isFinite(value)?value.toLocaleString('da-DK',{maximumFractionDigits:digits,minimumFractionDigits:digits}):'–';}
function toolField(value,digits){return Number.isFinite(value)?String(Math.round(value*10**digits)/10**digits):'';}
function paintGas(start){
 if(typeof Gas==='undefined'||!$('gas')||$('gas').hidden){if(typeof Gas!=='undefined')Gas.stop();return;}
 const next=Gas.adjust(gasState,{},gasHold);
 gasState={n:next.n,T:next.T,V:next.V};
 $('gas-n').textContent=toolFmt(gasState.n,gasState.n>=10?0:0)+' mol';
 if(document.activeElement!==$('gas-t'))$('gas-t').value=toolField(gasState.T,2);
 if(document.activeElement!==$('gas-t-range'))$('gas-t-range').value=String(Math.min(800,Math.max(50,gasState.T)));
 $('gas-c').textContent=toolFmt(gasState.T-273.15,1)+' °C';
 if(document.activeElement!==$('gas-v'))$('gas-v').value=toolField(gasState.V,4);
 $('gas-hold').value=gasHold;
 $('gas-wall').disabled=gasHold==='volume';
 $('gas-t').disabled=gasHold==='temperature';
 $('gas-t-range').disabled=gasHold==='temperature';
 $('gas-v').disabled=gasHold==='volume';
 const p=next.p;
 $('gas-readout').textContent=p>0?`${toolFmt(p,0)} Pa · ${toolFmt(p/1e5,3)} bar`:'0 Pa';
 $('gas-metrics').innerHTML=[['p',toolFmt(p,0)+' Pa'],['V',toolFmt(gasState.V,4)+' m³'],['T',toolFmt(gasState.T,1)+' K'],['n',toolFmt(gasState.n,0)+' mol']].map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('');
 $('gas-status').textContent=next.note||'';
 if(start)Gas.start(gasState);else Gas.sync(gasState);
}
function gasChange(change){
 if(typeof Gas==='undefined')return;
 const next=Gas.adjust(gasState,change,gasHold);
 if(!next.ok){$('gas-status').textContent=next.error;return;}
 gasState={n:next.n,T:next.T,V:next.V};
 paintGas(false);
 $('gas-status').textContent=next.note||'';
}
let motorDrag=null;
function motorRead(){
 const input={p1:toolNum('motor-p1'),V1:toolNum('motor-v1'),T1:toolNum('motor-t1'),r:toolNum('motor-r'),kappa:toolNum('motor-k')};
 if(motorKind==='diesel')input.phi=toolNum('motor-phi');else input.T3=toolNum('motor-t3');
 return input;
}
function motorPath(svg,path,xOf,yOf,box){
 const pts=path.map(point=>`${xOf(point).toFixed(1)},${yOf(point).toFixed(1)}`).join(' ');
 return `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5"></polyline>`+(box||'');
}
function paintMotor(){
 if(typeof Motor==='undefined'||!$('motor')||$('motor').hidden)return;
 $('motor-otto').setAttribute('aria-pressed',String(motorKind==='otto'));
 $('motor-diesel').setAttribute('aria-pressed',String(motorKind==='diesel'));
 $('motor-phi-field').hidden=motorKind!=='diesel';
 $('motor-t3-field').hidden=motorKind!=='otto';
 const result=motorKind==='diesel'?Motor.diesel(motorRead()):Motor.otto(motorRead());
 if(!result.ok){$('motor-status').textContent=result.error;$('motor-pv').textContent='';$('motor-st').textContent='';$('motor-metrics').innerHTML='';$('motor-states').innerHTML='';return;}
 $('motor-status').textContent='';
 function chartCall(xKey,yMap,xlabel,ylabel){
  const xs=result.path.map(point=>point[xKey]),ys=result.path.map(yMap);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(0,...ys),maxY=Math.max(...ys);
  const x0=minX-(maxX-minX||1)*0.08,x1=maxX+(maxX-minX||1)*0.12,y0=minY-(Math.abs(maxY-minY)||1)*0.06,y1=maxY+(maxY-minY||1)*0.12;
  const X=v=>64+(v-x0)/(x1-x0)*520,Y=v=>16+(y1-v)/(y1-y0)*262;
  const poly=result.path.map(point=>`${X(point[xKey]).toFixed(1)},${Y(yMap(point)).toFixed(1)}`).join(' ');
  const marks=result.points.map(point=>`<g class="ph-marker"><circle cx="${X(point[xKey]).toFixed(1)}" cy="${Y(yMap(point)).toFixed(1)}" r="4"></circle><text x="${(X(point[xKey])+8).toFixed(1)}" y="${(Y(yMap(point))-8).toFixed(1)}">${point.n}</text></g>`).join('');
  return `<rect width="600" height="320" fill="transparent"></rect><line x1="64" y1="278" x2="584" y2="278" stroke="currentColor" stroke-width="1.2"></line><line x1="64" y1="16" x2="64" y2="278" stroke="currentColor" stroke-width="1.2"></line><text x="324" y="308" text-anchor="middle" font-size="15" fill="currentColor">${xlabel}</text><text transform="translate(18 168) rotate(-90)" text-anchor="middle" font-size="15" fill="currentColor">${ylabel}</text><polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2.5"></polyline>${marks}`;
 }
 $('motor-pv').setAttribute('viewBox','0 0 600 320');
 $('motor-st').setAttribute('viewBox','0 0 600 320');
 $('motor-pv').innerHTML=chartCall('V',point=>point.p/1e5,'V [m³]','p [bar]');
 $('motor-st').innerHTML=chartCall('s',point=>point.T,'s − s₁ [J/(mol·K)]','T [K]');
 $('motor-metrics').innerHTML=[[ 'η₀', toolFmt(result.eta*100,2)+' %' ],[ 'W', toolFmt(result.W,0)+' J/mol' ],[ 'Qind', toolFmt(result.Qin,0)+' J/mol' ]].map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('');
 $('motor-states').innerHTML=`<caption class="subtle">Hjørner for den ideelle ${motorKind==='otto'?'Otto':'Diesel'}-kreds.</caption><thead><tr><th>Punkt</th><th>p [bar]</th><th>V [m³]</th><th>T [°C]</th><th>s−s₁ [J/(mol·K)]</th></tr></thead><tbody>${result.points.map(point=>`<tr><td>${point.n} ${point.name}</td><td>${toolFmt(point.p/1e5,3)}</td><td>${toolFmt(point.V,6)}</td><td>${toolFmt(point.T-273.15,1)}</td><td>${toolFmt(point.s,2)}</td></tr>`).join('')}</tbody>`;
}
function bindPh(){
 if(!$('ph'))return;
 $('view-formulas').addEventListener('click',openFormulas);
 $('view-diagrams').addEventListener('click',()=>setTool('list'));
 document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.tool)));
 document.querySelectorAll('[data-tool-back]').forEach(button=>button.addEventListener('click',()=>setTool('list')));
 $('ph').addEventListener('input',event=>{if(event.target.matches('input'))drawPh();});
 for(const id of ['ph-show-sat','ph-show-x','ph-show-t','ph-show-s','ph-show-v','ph-show-cycle'])$(id).addEventListener('change',paintPh);
 $('ph-reset').addEventListener('click',()=>{
  const d=Water.defaults,map={'ph-qe':d.QE,'ph-te':d.TE,'ph-tc':d.TC,'ph-tsh':d.dTSH,'ph-tsc':d.dTSC,'ph-eta':d.eta,'ph-fq':d.fQ,'ph-etav':d.etaVol,'ph-dte':d.dTevap,'ph-dts':d.dTsuc,'ph-tshs':d.dTSHsuc,'ph-dpc':d.dPcond,'ph-dtd':d.dTdis,'ph-dpl':d.dPliq};
  for(const [id,value] of Object.entries(map))$(id).value=String(value);
  drawPh();
 });
 $('ph-in').addEventListener('click',()=>phZoom(1/1.25));
 $('ph-out').addEventListener('click',()=>phZoom(1.25));
 $('ph-fit').addEventListener('click',()=>{phMode='cycle';if(phCycle)phView=Water.frameCycle(phCycle.points);drawPh();});
 $('ph-wide').addEventListener('click',()=>{phMode='wide';phView=Water.frameWide();paintPh();});
 $('ph-dome').addEventListener('click',()=>{phMode='dome';phView=Water.frameDome();paintPh();});
 const svg=$('ph-svg');
 svg.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  phDrag={x:event.clientX,y:event.clientY,moved:false,view:phView};
  try{svg.setPointerCapture(event.pointerId);}catch{}
  $('ph-chart').classList.add('dragging');
 });
 svg.addEventListener('pointermove',event=>{
  if(!phDrag){phHover(event);return;}
  const dx=event.clientX-phDrag.x,dy=event.clientY-phDrag.y;
  if(Math.hypot(dx,dy)>4)phDrag.moved=true;
  if(!phDrag.moved||!phDrag.view)return;
  const rect=svg.getBoundingClientRect();
  const dh=-(dx/rect.width)*(phDrag.view.hMax-phDrag.view.hMin)*PH.w/(PH.w-PH.l-PH.r);
  const dl=(dy/rect.height)*(Math.log10(phDrag.view.pMax)-Math.log10(phDrag.view.pMin))*PH.h/(PH.h-PH.t-PH.b);
  phView=Water.panView(phDrag.view,dh,dl);
  phMode='custom';
  queuePhPaint();
 });
 svg.addEventListener('pointerup',event=>{
  const click=phDrag&&!phDrag.moved;
  phDrag=null;
  $('ph-chart').classList.remove('dragging');
  if(click)phCopy(event);
 });
 svg.addEventListener('pointerleave',()=>{$('ph-svg').querySelector('#ph-cross')?.remove();});
 svg.addEventListener('dblclick',()=>{$('ph-fit').click();});
 svg.addEventListener('wheel',event=>{event.preventDefault();const loc=phPointer(event);if(!loc)return;phView=Water.zoomView(phView,event.deltaY>0?1.12:1/1.12,loc.h,loc.p);phMode='custom';queuePhPaint();},{passive:false});
 if('ResizeObserver' in window){
  new ResizeObserver(()=>{if(!$('ph').hidden)queuePhPaint();}).observe($('ph-chart'));
  if($('gas-stage'))new ResizeObserver(()=>{if(!$('gas').hidden)paintGas(false);}).observe($('gas-stage'));
 }
 for(const [id,step] of [['gas-add1',1],['gas-add10',10],['gas-sub1',-1],['gas-sub10',-10]])$(id).addEventListener('click',()=>gasChange({n:gasState.n+step}));
 $('gas-t').addEventListener('input',()=>gasChange({T:toolNum('gas-t')}));
 $('gas-t').addEventListener('blur',()=>paintGas(false));
 $('gas-t-range').addEventListener('input',()=>gasChange({T:toolNum('gas-t-range')}));
 $('gas-t-range').addEventListener('change',()=>paintGas(false));
 $('gas-v').addEventListener('input',()=>gasChange({V:toolNum('gas-v')}));
 $('gas-v').addEventListener('blur',()=>paintGas(false));
 $('gas-hold').addEventListener('change',()=>{gasHold=$('gas-hold').value;paintGas(false);});
 $('gas-reset').addEventListener('click',()=>{gasState={n:2,T:300,V:0.05};gasHold='none';paintGas(false);});
 const wall=$('gas-wall');
 wall.addEventListener('pointerdown',event=>{
  if(wall.disabled||event.button!==0)return;
  motorDrag={x:event.clientX,V:gasState.V};
  try{wall.setPointerCapture(event.pointerId);}catch{}
 });
 wall.addEventListener('pointermove',event=>{
  if(!motorDrag||motorDrag.V==null)return;
  const track=Math.max(40,$('gas-stage').getBoundingClientRect().width-92);
  gasChange({V:motorDrag.V+(event.clientX-motorDrag.x)/track*(Gas.VMAX-Gas.VMIN)});
 });
 wall.addEventListener('pointerup',()=>{motorDrag=null;});
 $('motor').addEventListener('input',event=>{if(event.target.matches('input'))paintMotor();});
 $('motor-otto').addEventListener('click',()=>{motorKind='otto';const d=Motor.defaults.otto;$('motor-r').value=d.r;$('motor-k').value=d.kappa;paintMotor();});
 $('motor-diesel').addEventListener('click',()=>{motorKind='diesel';const d=Motor.defaults.diesel;$('motor-r').value=d.r;$('motor-k').value=d.kappa;$('motor-phi').value=d.phi;paintMotor();});
 $('motor-reset').addEventListener('click',()=>{const d=Motor.defaults[motorKind];$('motor-p1').value=d.p1;$('motor-v1').value=d.V1;$('motor-t1').value=d.T1;$('motor-r').value=d.r;$('motor-k').value=d.kappa;if(d.T3)$('motor-t3').value=d.T3;if(d.phi)$('motor-phi').value=d.phi;paintMotor();});
}
bindPh();
$('catalog-count').textContent=`${formulaIds.size} opslag · ${db.catalogs.length} fagområder · kildehenvisninger på hvert kort`;
applyTheme(readStorage('formelopslag.theme.v1','auto'));
// Preserve a requested link while rendering the initial empty form.
const initialHash=location.hash;restoring=true;updateFeedbackUi();updateTopics();restoring=false;
if(initialHash){location.hash=initialHash;applyHash();}
renderDiscovery();
