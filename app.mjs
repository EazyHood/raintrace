import { MONTHS, analyze, claimText, sha256, makePacket, verifyPacket, rowsCsv, parseThresholdInput } from './core.mjs';
const $=id=>document.getElementById(id), fmt=(n,d=1)=>n===null?'—':n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
let catalog, snapshot, raw, analysis, gap=false, loadSequence=0, toastTimer;
const saved = new URL(location.href).searchParams;
for (const [id,selected] of [['start-month',6],['end-month',9]]) MONTHS.forEach((month,i)=>{const o=document.createElement('option');o.value=String(i+1);o.textContent=month;o.selected=i+1===selected;$(id).append(o);});
for(const [field,id] of Object.entries({place:'place',year:'year',startMonth:'start-month',endMonth:'end-month',direction:'direction',threshold:'threshold'})) if(saved.has(field)) $(id).value=saved.get(field);
function config(){return {year:Number($('year').value),startMonth:Number($('start-month').value),endMonth:Number($('end-month').value),direction:$('direction').value,threshold:parseThresholdInput($('threshold').value)};}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function download(name,text,type='application/json') {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function labelPeriod(c){return `${MONTHS[c.startMonth-1]}–${MONTHS[c.endMonth-1]} ${c.year}`;}
function chart(result){
  const w=Math.max(310,$('chart').clientWidth||720),h=238,left=42,bottom=29,top=18,plotH=h-bottom-top,max=Math.max(1,...result.monthly.flatMap(x=>[x.target||0,x.baseline||0]))*1.15;
  $('chart').style.height=`${h}px`;
  const unit=(w-left-10)/12;
  let svg=`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><text x="${left}" y="11" fill="#52646b" font-size="11">mm</text>`;
  for(let i=0;i<4;i++){const v=max*i/3,y=h-bottom-plotH*i/3;svg+=`<line x1="${left}" x2="${w}" y1="${y}" y2="${y}" stroke="#dce2e1"/><text x="${left-8}" y="${y+4}" text-anchor="end" fill="#52646b" font-size="11">${Math.round(v)}</text>`;}
  result.monthly.forEach((m,i)=>{const x=left+i*unit+unit/2; if(m.selected) svg+=`<rect x="${x-unit*.47}" y="${top}" width="${unit*.94}" height="${plotH}" fill="#e7f0f2"/>`;
    for(const [n,value,color] of [[0,m.target,'#155b74'],[1,m.baseline,'#94b1ba']]) if(value!==null){const bh=value/max*plotH,bw=Math.min(16,unit*.32);svg+=`<rect x="${x+(n===0?-bw-1:1)}" y="${h-bottom-bh}" width="${bw}" height="${bh}" fill="${color}" opacity="${m.selected?1:.55}"/>`;}
    svg+=`<text x="${x}" y="${h-9}" fill="#52646b" font-size="12" text-anchor="middle">${MONTHS[i]}</text>`;
  });$('chart').innerHTML=svg+'</svg>';
  $('chart').setAttribute('aria-label',`Monthly precipitation in ${result.config.year} compared with the 1991–2020 mean. ${labelPeriod(result.config)} selected. Exact values are available in the table below.`);
  $('monthly-table').replaceChildren();result.monthly.forEach(m=>{const tr=document.createElement('tr');[MONTHS[m.month-1],fmt(m.target),fmt(m.baseline),m.selected?'Yes':'No'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});$('monthly-table').append(tr);});
}
function history(result){
  if(!result.baselineRange){$('history-plot').textContent='A baseline year is incomplete.';$('history-text').textContent='No range is calculated from incomplete evidence.';return;}
  const totals=result.baseline.map(x=>x.total),max=Math.max(result.target.total||0,...totals)*1.1||1;
  const w=330,position=v=>12+v/max*(w-24);
  let svg=`<svg viewBox="0 0 ${w} 70" aria-hidden="true"><line x1="12" x2="318" y1="37" y2="37" stroke="#abbabf"/>`;
  totals.forEach((v,i)=>svg+=`<circle cx="${position(v)}" cy="${30-(i%3)*7}" r="3" fill="#94b1ba"><title>${1991+i}: ${fmt(v)} mm</title></circle>`);
  if(result.target.total!==null) svg+=`<line x1="${position(result.target.total)}" x2="${position(result.target.total)}" y1="11" y2="43" stroke="#155b74" stroke-width="2"/><text x="${Math.min(290,Math.max(38,position(result.target.total)))}" y="61" font-size="11" fill="#155b74" text-anchor="middle">${result.config.year}</text>`;
  $('history-plot').innerHTML=svg+'</svg>';
  $('history-plot').setAttribute('aria-label',`Baseline seasonal totals range from ${fmt(result.baselineRange.min)} to ${fmt(result.baselineRange.max)} millimeters. Target ${fmt(result.target.total)} millimeters.`);
  $('history-text').textContent=`Middle 50%: ${fmt(result.baselineRange.q25)}–${fmt(result.baselineRange.q75)} mm. Full range: ${fmt(result.baselineRange.min)}–${fmt(result.baselineRange.max)} mm. Descriptive spread, not a confidence interval.`;
}
function render(){
  const c=config();let input=raw;
  if(gap){const altered=JSON.parse(raw);delete altered.properties.parameter.PRECTOTCORR[`${c.year}${String(c.startMonth).padStart(2,'0')}01`];input=altered;}
  analysis=analyze(input,c);
  $('report-content').hidden=false;
  const grid=JSON.parse(raw).geometry.coordinates;
  $('coordinate').textContent=`Requested ${snapshot.latitude.toFixed(4)}, ${snapshot.longitude.toFixed(4)}. Coarse model grid; average elevation ${fmt(grid[2],0)} m.`;
  $('report-title').textContent=snapshot.name;
  $('report-location').textContent=`${snapshot.region} · ${labelPeriod(c)} · historical snapshot`;
  $('claim').textContent=claimText(c);
  const labels={supported:'This snapshot supports the claim','not-supported':'This snapshot does not support the claim',insufficient:'Insufficient data — no verdict'};
  $('finding-title').textContent=labels[analysis.status];$('finding-mark').textContent=analysis.status==='supported'?'✓':analysis.status==='insufficient'?'!':'↔';
  document.querySelector('.finding').className='finding '+analysis.status;
  $('explanation').textContent=analysis.reasons.length?analysis.reasons.join(' '):`Calculated change: ${analysis.changePct>=0?'+':''}${fmt(analysis.changePct)}%. This verdict applies only to the stated period, source and mean—not to drought or flooding.`;
  $('actual').textContent=fmt(analysis.target.total);$('baseline').textContent=fmt(analysis.baselineMean);$('difference').textContent=analysis.changePct===null?'—':`${analysis.changePct>0?'+':''}${fmt(analysis.changePct)}`;
  $('target-coverage').textContent=`${analysis.target.validDays}/${analysis.target.expectedDays} expected days present`;
  $('baseline-coverage').textContent=`${analysis.completeBaselineYears}/30 complete baseline years`;
  $('planning-note').textContent=analysis.status==='insufficient'?'Resolve the missing or invalid records before citing a rainfall comparison. The app will not fill gaps with zero.':analysis.status==='supported'?'This statement can be cited with its period, grid and baseline. Export the evidence so another person can inspect and reproduce it.':'Revise the statement or investigate a different question. Do not publish the original percentage claim as supported by this snapshot.';
  $('retrieval').textContent=`Snapshot retrieved ${new Date(snapshot.retrievedAt).toISOString().slice(0,10)} UTC. ${snapshot.days.toLocaleString('en-US')} daily records, 1991–2025.`;
  $('source-link').href=snapshot.sourceUrl;$('source-hash').textContent=snapshot.sha256;
  $('integrity-status').textContent=gap?'Temporary modified copy':'Matches bundled SHA-256';
  $('gap-banner').hidden=!gap;$('gap-test').hidden=gap;$('gap-reset').hidden=!gap;
  $('download').disabled=gap||analysis.status==='insufficient';$('csv').disabled=gap;$('verify-current').disabled=gap||analysis.status==='insufficient';
  $('download').title=gap?'Restore original data to export.':analysis.status==='insufficient'?'Resolve incomplete data first.':'Download source bytes, settings, result and integrity hashes.';
  chart(analysis);history(analysis);
  const params=new URLSearchParams({place:snapshot.id,...c});historyReplace(params);
  $('form-error').textContent='';$('review').innerHTML='Review claim <span aria-hidden="true">→</span>';
}
function historyReplace(params){window.history.replaceState(null,'','?'+params);}
async function load(){
  const sequence=++loadSequence;$('loading').hidden=false;$('report-content').hidden=true;$('load-error').hidden=true;$('review').disabled=true;
  try {
    if(!catalog){const response=await fetch('catalog.json');if(!response.ok)throw new Error('The snapshot catalog could not be downloaded.');catalog=await response.json();}
    const selected=catalog.places.find(x=>x.id===$('place').value);if(!selected)throw new Error('Choose one of the available Colombian locations.');
    const response=await fetch(selected.file);if(!response.ok)throw new Error('The bundled data file could not be downloaded.');
    const source=await response.text();if(await sha256(source)!==selected.sha256)throw new Error('Source integrity check failed. The file does not match this release; please use a trusted copy.');
    if(sequence!==loadSequence)return;snapshot=selected;raw=source;gap=false;render();$('report-content').hidden=false;
  }catch(error){if(sequence!==loadSequence)return;$('load-error-detail').textContent=error.message;$('load-error').hidden=false;}
  finally{if(sequence===loadSequence){$('loading').hidden=true;$('review').disabled=false;}}
}
$('query-form').addEventListener('submit',async event=>{event.preventDefault();try{if(!snapshot||snapshot.id!==$('place').value)await load();else render();}catch(e){$('form-error').textContent=e.message;}});
$('query-form').addEventListener('input',()=>{$('review').innerHTML='Review changes <span aria-hidden="true">→</span>';});
$('retry').addEventListener('click',load);
$('gap-test').addEventListener('click',()=>{if(!raw)return;try{gap=true;render();toast('One day removed from a temporary copy. No rainfall verdict is issued.');}catch(e){$('form-error').textContent=e.message;}});
$('gap-reset').addEventListener('click',()=>{gap=false;render();toast('Original source restored.');});
$('download').addEventListener('click',async()=>{try{const packet=await makePacket(raw,snapshot,analysis.config);download(`raintrace-${snapshot.id}-${analysis.config.year}.json`,JSON.stringify(packet,null,2));toast('Evidence packet exported. It includes the exact source and reproducible calculation.');}catch(e){toast(e.message);}});
$('csv').addEventListener('click',()=>{download(`raintrace-${snapshot.id}-daily.csv`,rowsCsv(analysis),'text/csv');toast('Selected daily values exported. Source and full method remain in the evidence packet.');});
$('print-report').addEventListener('click',()=>window.print());
async function verify(packet){const box=$('verify-result');box.className='verify-result';box.textContent='Checking packet, source fingerprint and calculation…';try{const verified=await verifyPacket(packet,catalog);box.className='verify-result success';box.textContent=`Reproduced: ${verified.snapshot.name}, ${labelPeriod(verified.analysis.config)}. ${verified.analysis.status==='supported'?'Claim supported':'Claim not supported'}. Source matches this release’s snapshot; result matches a fresh calculation. Packet ${verified.packetSha256.slice(0,16)}… This does not authenticate NASA authorship or validate local weather accuracy.`;}catch(e){box.className='verify-result error';box.textContent=e.message;}}
$('packet-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('Choose a Raintrace JSON packet under 2 MB.');await verify(JSON.parse(await file.text()));}catch(e){$('verify-result').className='verify-result error';$('verify-result').textContent=e.message;}event.target.value='';});
$('verify-current').addEventListener('click',async()=>{try{await verify(await makePacket(raw,snapshot,analysis.config));}catch(e){$('verify-result').textContent=e.message;}});
load();
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(analysis)chart(analysis);},100);});
