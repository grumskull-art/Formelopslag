/* Prime XML is compiled by Python. Browser code only fills typed input nodes. */
const mcNS='http://schemas.mathsoft.com/math50',mcWS='http://schemas.mathsoft.com/worksheet50';
const mcEntries=new Map(db.catalogs.flatMap(c=>c.entries.map(e=>[e.id,e]))),mcDrafts=new Map();
let mcEntry=null;
function mcParse(xml){const d=new DOMParser().parseFromString(xml,'application/xml');if(d.querySelector('parsererror'))throw Error('Ugyldig Mathcad-XML.');return d;}
function mcNode(tag,children=[],value=null){const n=document.createElementNS(mcNS,tag);if(value!==null)n.textContent=value;children.forEach(c=>n.append(c));return n;}
function mcOp(tag,...args){return mcNode('apply',[mcNode(tag),...args]);}
function mcNumber(value){
 const text=String(value).trim().replace(',','.');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)||!Number.isFinite(Number(text))||Math.abs(Number(text))>1e300||(Number(text)!==0&&Math.abs(Number(text))<1e-300))throw Error('Indtast et endeligt tal; dansk decimalkomma er tilladt.');
 return mcNode('real',[],text.replace(/^\+/,''));
}
function mcExpression(text,x){
 // A small arithmetic input language, not a TeX-to-XML converter. x is the
 // dimensionless argument; every numeric coefficient is in the displayed SI unit.
 const parts=text.replace(/(\d),(\d)/g,'$1.$2').match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z]+|[()+*/^\-]|\S/g)||[];
 if(parts.length>200)throw Error('Funktionsudtrykket er for langt.');
 let at=0;
 const take=()=>parts[at++],peek=()=>parts[at];
 function constant(text){const n=mcNode('id',[],text);n.setAttribute('labels','CONSTANT');n.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');return n;}
 function atom(){const t=take();if(t==='('){const v=add();if(take()!==')')throw Error('En parentes mangler.');return mcNode('parens',[v]);}if(t==='x')return x.cloneNode(true);if(t==='pi'||t==='π')return constant('π');if(t==='e')return constant('e');if(['sin','cos','tan','ln','log','exp','sqrt'].includes(t)){if(take()!=='(')throw Error('Funktioner skal have parenteser.');const v=add();if(take()!==')')throw Error('En parentes mangler.');if(t==='sqrt')return mcOp('nthRoot',mcNode('placeholder'),v);const id=mcNode('id',[],t);id.setAttribute('labels','FUNCTION');id.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');return mcNode('apply',[id,v]);}return mcNumber(t);}
 function power(){let v=atom();if(peek()==='^'){take();v=mcOp('pow',v,unary());}return v;}
 function unary(){if(peek()==='-'){take();return mcOp('neg',unary());}if(peek()==='+'){take();return unary();}return power();}
 function product(){let v=unary();while(['*','/'].includes(peek())){const t=take();v=mcOp(t==='*'?'mult':'div',v,unary());}return v;}
 function add(){let v=product();while(['+','-'].includes(peek())){const t=take();v=mcOp(t==='+'?'plus':'minus',v,product());}return v;}
 const result=add();if(at!==parts.length)throw Error('Brug kun tal, x, + − * / ^, parenteser og de viste funktioner.');return result;
}
function mcJoin(xmls){
 const regions=xmls.flatMap(xml=>{const root=mcParse(xml).documentElement;return root.localName==='region'?[root]:[...root.getElementsByTagNameNS(mcWS,'region')];});
 if(!regions.length)throw Error('Vælg mindst én formel.');
 if(regions.length===1)return new XMLSerializer().serializeToString(regions[0]);
 const d=document.implementation.createDocument(mcWS,'worksheet'),container=d.createElementNS(mcWS,'regions');d.documentElement.append(container);
 let top=0;
 regions.forEach((r,i)=>{const copy=d.importNode(r,true),rows=Math.max(0,...[...copy.getElementsByTagNameNS(mcNS,'matrix')].map(m=>Number(m.getAttribute('rows')))),height=Math.max(96,rows*28+24);copy.setAttribute('id',`formelopslag_${mcEntry?.id||'input'}_${i}`);copy.setAttribute('actualHeight',String(height));copy.setAttribute('top',String(top));copy.setAttribute('left','0');top+=height+24;container.append(copy);});
 return new XMLSerializer().serializeToString(d);
}
function mcSelected(){return mcEntry.mathcad.formulas.find(f=>f.id===$('mathcad-formula').value);}
function mcWorkflow(){
 const selected=mcSelected();
 return [selected,...[...$('mathcad-workflow-items').querySelectorAll('input:checked')].map(i=>mcEntry.mathcad.formulas.find(f=>f.id===i.value))];
}
function mcOrder(forms){
 const pending=[...forms],ordered=[],outputs=new Set();
 for(const f of forms){if(f.output&&outputs.has(f.output))throw Error('Vælg kun én definition af '+f.output+'.');if(f.output)outputs.add(f.output);}
 while(pending.length){const i=pending.findIndex(f=>!f.inputs.some(input=>pending.some(g=>g!==f&&g.output===input.name)));if(i<0)throw Error('Formlerne afhænger af hinanden i en cirkel. Vælg én beregningsvej.');ordered.push(...pending.splice(i,1));}
 return ordered;
}
function mcInputInfos(forms){
 const outputs=new Set(forms.map(f=>f.output).filter(Boolean)),inputs=new Map();
 for(const f of forms)for(const input of f.inputs){const producer=forms.find(g=>g.output===input.name);if(producer&&producer.output_type!==input.type)throw Error(input.name+' bruges som '+input.type+', men den valgte definition giver '+producer.output_type+'. Kopiér formlerne hver for sig.');}
 for(const f of forms)for(const input of f.inputs)if(!outputs.has(input.name)){const previous=inputs.get(input.name);if(previous&&(previous.unit!==input.unit||previous.type!==input.type))throw Error('Formlerne bruger '+input.name+' med forskellige betydninger. Kopiér dem hver for sig.');inputs.set(input.name,input);}
 return [...inputs.values()];
}
function mcDraftKey(info){return JSON.stringify([info.name,info.unit,info.type,info.argument_unit||'']);}
function mcRemember(){if(!mcEntry)return;const values=mcDrafts.get(mcEntry.id)||new Map();document.querySelectorAll('#mathcad-inputs [data-mc-input]').forEach(i=>values.set(i.dataset.mcDraft,i.value));mcDrafts.set(mcEntry.id,values);}
function mcRefresh(){
 mcRemember();$('mathcad-error').textContent='';const mode=$('mathcad-mode').value,selected=mcSelected();
 $('mathcad-preview').innerHTML=mathImage(selected.latex,22);
 $('mathcad-workflow').hidden=mode!=='workflow';$('mathcad-input-help').hidden=!['inputs','workflow'].includes(mode);
 if(!['inputs','workflow'].includes(mode)){$('mathcad-inputs').replaceChildren();return;}
 try{
  const forms=mode==='workflow'?mcOrder(mcWorkflow()):[selected],infos=mcInputInfos(forms),values=mcDrafts.get(mcEntry.id);
  $('mathcad-inputs').innerHTML=infos.map((i,n)=>{const hint=i.type==='function'?`Udtryk i x, hvor x = ${i.argument}/(${i.argument_unit}). Resultatets talværdi i ${i.unit}. Brug *, /, ^, pi, e, sin, cos, tan, ln, log, exp eller sqrt.`:i.type==='vector'?'Værdier adskilles med semikolon. Første element har indeks 1.':i.type==='matrix'?'Semikolon mellem kolonner; ny linje mellem rækker. Indeks starter ved 1.':i.type==='range'?'Første og sidste heltalsindeks adskilles med semikolon.':'';
   return `<div class="mathcad-input"><label for="mc-input-${n}">${esc(i.label.replace(/\s*\[[^\]]+\]/g,''))} · ${esc(i.name)} [${esc(i.unit)}]</label><${i.type==='matrix'?'textarea':'input'} id="mc-input-${n}" data-mc-input="${esc(i.name)}" ${i.type==='matrix'?'':'type="text"'} ${i.type==='scalar'?'inputmode="decimal"':''} autocomplete="off" aria-describedby="mc-hint-${n}">${i.type==='matrix'?'</textarea>':''}<small id="mc-hint-${n}" class="subtle">${esc(hint)}</small></div>`;
  }).join('');
  $('mathcad-inputs').querySelectorAll('[data-mc-input]').forEach(i=>{i.dataset.mcDraft=mcDraftKey(infos.find(info=>info.name===i.dataset.mcInput));i.value=values?.get(i.dataset.mcDraft)||'';});
 }catch(error){$('mathcad-error').textContent=error.message;$('mathcad-inputs').replaceChildren();}
}
function mcOpen(id){
 mcRemember();$('mathcad-inputs').replaceChildren();
 mcEntry=mcEntries.get(id);if(!mcEntry)return;
 $('mathcad-title').textContent='Kopiér til Mathcad · '+id;
 $('mathcad-note').textContent=mcEntry.mathcad.note;$('mathcad-note').hidden=!mcEntry.mathcad.note;
 $('mathcad-formula').innerHTML=mcEntry.mathcad.formulas.map(f=>optionHtml(f.id,f.label+' · '+db.math_assets[f.latex].search)).join('');
 $('mathcad-mode').value='formula';
 const exampleOption=$('mathcad-mode').querySelector('[value="example"]');exampleOption.disabled=!mcEntry.mathcad.example_xml;
 mcChooseWorkflow();mcRefresh();$('mathcad-dialog').showModal();
}
function mcChooseWorkflow(){
 const selected=mcSelected();
 $('mathcad-workflow-items').innerHTML=mcEntry.mathcad.formulas.filter(f=>!['main','example'].includes(f.field)&&(!f.output||f.output!==selected.output)).map(f=>`<label><input type="checkbox" value="${esc(f.id)}"> ${esc(f.label+' · '+db.math_assets[f.latex].search)}</label>`).join('');
}
function mcFill(info,value){
 if(!value.trim())throw Error('Indtast '+info.name+'.');
 const d=mcParse(info.template),placeholder=[...d.getElementsByTagNameNS(mcNS,'id')].find(n=>n.textContent==='formelopslaginput');let node;
 if(info.type==='function'){
  const argument=d.getElementsByTagNameNS(mcNS,'boundVars')[0].firstElementChild.cloneNode(true);
  const unit=mcParse(info.argument_unit_xml).documentElement;
  const x=info.argument_unit==='1'?argument:mcOp('div',argument,unit.cloneNode(true));node=mcExpression(value,x);
 }else if(info.type==='range'){
  const values=value.split(';').map(s=>{const v=Number(s.trim().replace(',','.'));if(!s.trim()||!Number.isSafeInteger(v)||v<0)throw Error('Indeks skal være ikke-negative heltal.');return v;});
  if(values.length!==2||values[1]<values[0]||values[1]-values[0]>10000)throw Error('Angiv første;sidste indeks med højst 10000 led.');node=mcNode('range',values.map(mcNumber));
  // Ranges are mathematical sequences and must not be multiplied by a unit.
  placeholder.parentNode.replaceWith(node);return new XMLSerializer().serializeToString(d.documentElement);
 }else if(info.type==='vector'||info.type==='matrix'){
  const rows=info.type==='matrix'?value.trim().split(/\r?\n/).map(r=>r.split(';')):value.split(';').map(s=>[s]);
  const cols=rows[0].length;if(rows.some(r=>r.length!==cols)||rows.length*cols>10000)throw Error('Alle matrixrækker skal have lige mange kolonner; højst 10000 værdier.');
  // PTC serializes matrices by columns (M[i,j]=i+j² example), not by rows.
  node=mcNode('matrix',Array.from({length:cols},(_,column)=>rows.map(row=>mcNumber(row[column]))).flat());node.setAttribute('rows',String(rows.length));node.setAttribute('cols',String(cols));
 }else node=mcNumber(value);
 placeholder.replaceWith(d.importNode(node,true));return new XMLSerializer().serializeToString(d.documentElement);
}
function mcExport(){
 const selected=mcSelected(),mode=$('mathcad-mode').value;
 if(mode==='formula')return selected.xml;
 if(mode==='example'){if(!mcEntry.mathcad.example_xml)throw Error('Opslaget har ikke et regneeksempel.');return mcEntry.mathcad.example_xml;}
 const forms=mcOrder(mode==='workflow'?mcWorkflow():[selected]),infos=mcInputInfos(forms),xmls=[];
 if(infos.some(i=>['vector','matrix'].includes(i.type)))xmls.push(mcEntry.mathcad.origin_xml);
 for(const info of infos){const input=[...$('mathcad-inputs').querySelectorAll('[data-mc-input]')].find(i=>i.dataset.mcInput===info.name);xmls.push(mcFill(info,input?.value||''));}
 xmls.push(...forms.map(f=>f.xml));for(const f of forms)if(f.evaluation)xmls.push(f.evaluation);
 return mcJoin(xmls);
}
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.mathcad){const e=mcEntries.get(b.dataset.mathcad);if(e)copyText(e.mathcad.formulas[0].xml,'Mathcad-formel');}if(b.dataset.mathcadOptions)mcOpen(b.dataset.mathcadOptions);});
$('mathcad-formula').addEventListener('change',()=>{mcChooseWorkflow();mcRefresh();});
$('mathcad-mode').addEventListener('change',mcRefresh);$('mathcad-workflow-items').addEventListener('change',mcRefresh);
$('mathcad-close').addEventListener('click',()=>{mcRemember();$('mathcad-dialog').close();});
$('mathcad-form').addEventListener('submit',event=>{event.preventDefault();try{const xml=mcExport();mcRemember();$('mathcad-dialog').close();copyText(xml,'Mathcad');}catch(error){$('mathcad-error').textContent=error.message;}});
