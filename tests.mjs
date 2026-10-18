import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyze,canonical,dateKeys,makePacket,sha256,verifyPacket,rowsCsv,parseThresholdInput} from './core.mjs';
const config={year:2024,startMonth:6,endMonth:9,direction:'higher',threshold:20};
test('A missing threshold must not become a zero-percent claim',()=>{
  for(const value of ['', ' ', '\t\n', null, undefined]) assert.throws(()=>parseThresholdInput(value),/Enter a percentage/);
  assert.equal(parseThresholdInput('0'),0);
  assert.equal(parseThresholdInput(' 0 '),0);
  assert.equal(parseThresholdInput('20'),20);
  for(const value of ['NaN','Infinity','-1','101']) assert.throws(()=>parseThresholdInput(value),/between 0 and 100/);
});
function fixture(value=1) {
  const values={};
  for(let year=1991;year<=2025;year++)for(const date of dateKeys(year,1,12))values[date]=value;
  return {header:{time_standard:'LST',sources:['MERRA2']},parameters:{PRECTOTCORR:{units:'mm/day'}},properties:{parameter:{PRECTOTCORR:values}}};
}
test('Same matched calendars exclude leap day in target and baseline',()=>{
  assert.equal(dateKeys(2024,1,12).length,365);assert.equal(dateKeys(2023,1,12).length,365);assert.equal(dateKeys(2024,2,2).length,28);
  const data=fixture();data.properties.parameter.PRECTOTCORR['20240229']=999;
  assert.equal(analyze(data,{...config,startMonth:2,endMonth:2}).target.total,28);
});
test('Hand-calculated 50% increase has correct totals and both verdict directions',()=>{
  const data=fixture(2);for(const d of dateKeys(2024,6,9))data.properties.parameter.PRECTOTCORR[d]=3;
  const result=analyze(data,config);assert.equal(result.target.total,366);assert.equal(result.baselineMean,244);assert.equal(result.changePct,50);assert.equal(result.status,'supported');
  assert.equal(analyze(data,{...config,direction:'lower'}).status,'not-supported');
});
test('Threshold equality is inclusive; larger threshold fails',()=>{
  const data=fixture(2);for(const d of dateKeys(2024,6,9))data.properties.parameter.PRECTOTCORR[d]=3;
  assert.equal(analyze(data,{...config,threshold:50}).status,'supported');assert.equal(analyze(data,{...config,threshold:51}).status,'not-supported');
});
test('One missing target day blocks total and verdict without zero-filling',()=>{
  const data=fixture();delete data.properties.parameter.PRECTOTCORR['20240601'];
  const r=analyze(data,config);assert.equal(r.status,'insufficient');assert.equal(r.target.total,null);assert.equal(r.changePct,null);assert.equal(r.target.validDays,121);assert.deepEqual(r.target.missing,['20240601']);
});
test('One baseline gap blocks mean rather than dropping a year silently',()=>{
  const data=fixture();data.properties.parameter.PRECTOTCORR['19930611']=null;
  const r=analyze(data,config);assert.equal(r.status,'insufficient');assert.equal(r.baselineMean,null);assert.equal(r.completeBaselineYears,29);
});
test('Negative NASA fill value, strings, NaN and infinity are invalid records',()=>{
  for(const value of [-999,'0',NaN,Infinity]) {const data=fixture();data.properties.parameter.PRECTOTCORR['20240601']=value;assert.equal(analyze(data,config).status,'insufficient');}
});
test('Zero rainfall is valid, but a zero baseline cannot define percent change',()=>{
  const r=analyze(fixture(0),config);assert.equal(r.target.total,0);assert.equal(r.target.validDays,122);assert.equal(r.baselineMean,0);assert.equal(r.status,'insufficient');
});
test('Invalid date range, overlapping years, bad threshold and unit fail explicitly',()=>{
  for(const c of [{...config,startMonth:10,endMonth:2},{...config,year:2020},{...config,threshold:NaN},{...config,threshold:-1}])assert.throws(()=>analyze(fixture(),c));
  const wrong=fixture();wrong.parameters.PRECTOTCORR.units='inches/day';assert.throws(()=>analyze(wrong,config),/units/);
});
test('Reject different time basis or model before comparison',()=>{
  const data=fixture();data.header.time_standard='UTC';assert.throws(()=>analyze(data,config),/Solar/);data.header.time_standard='LST';data.header.sources=['OTHER'];assert.throws(()=>analyze(data,config),/model/);
});
test('Percent is not calculated when missing target values fall outside visible total',()=>{
  const data=fixture();delete data.properties.parameter.PRECTOTCORR['20240930'];
  assert.equal(analyze(data,config).status,'insufficient');assert.equal(analyze(data,{...config,endMonth:8}).status,'not-supported');
});
const catalog=JSON.parse(await readFile(new URL('catalog.json',import.meta.url),'utf8'));
const raw=await readFile(new URL('santa-marta.json',import.meta.url),'utf8');
test('Bundled real source bytes match both recorded SHA-256 fingerprints',async()=>{
  for(const place of catalog.places){const input=await readFile(new URL(place.file,import.meta.url),'utf8');assert.equal(await sha256(input),place.sha256);assert.equal(Object.keys(JSON.parse(input).properties.parameter.PRECTOTCORR).length,12784);}
});
test('Real NASA result agrees with independent saved Python calculation',async()=>{
  const reference=JSON.parse(await readFile(new URL('independent-reference.json',import.meta.url),'utf8'));
  for(const row of reference.cases){const input=await readFile(new URL(row.file,import.meta.url),'utf8');const r=analyze(input,row.config);assert.ok(Math.abs(r.target.total-row.targetTotal)<1e-6);assert.ok(Math.abs(r.baselineMean-row.baselineMean)<1e-6);assert.ok(Math.abs(r.changePct-row.changePct)<1e-4);}
});
test('Evidence packet reproduces successfully against pinned catalog',async()=>{
  const packet=await makePacket(raw,catalog.places[0],config);const verified=await verifyPacket(packet,catalog);assert.equal(verified.analysis.status,'supported');assert.equal(verified.analysis.target.total,662.4);
});
test('Unmodified source with changed result is rejected even with recomputed packet hash',async()=>{
  const packet=await makePacket(raw,catalog.places[0],config);packet.analysis.target.total=1;const {packetSha256,...body}=packet;packet.packetSha256=await sha256(canonical(body));await assert.rejects(verifyPacket(packet,catalog),/does not reproduce/);
});
test('Altered daily source is rejected even if adversary recalculates every supplied hash',async()=>{
  const packet=await makePacket(raw,catalog.places[0],config);const data=JSON.parse(packet.rawSource);data.properties.parameter.PRECTOTCORR['20240601']=10000;packet.rawSource=JSON.stringify(data);packet.snapshotSha256=await sha256(packet.rawSource);packet.analysis=analyze(packet.rawSource,config);const {packetSha256,...body}=packet;packet.packetSha256=await sha256(canonical(body));await assert.rejects(verifyPacket(packet,catalog),/pinned catalog/);
});
test('Any packet field change without rehashing fails integrity check',async()=>{
  const packet=await makePacket(raw,catalog.places[0],config);packet.sourceUrl='https://example.com';await assert.rejects(verifyPacket(packet,catalog),/integrity failed/);
});
test('CSV retains missing field as empty instead of zero',()=>{
  const data=fixture();delete data.properties.parameter.PRECTOTCORR['20240601'];const csv=rowsCsv(analyze(data,config));assert.ok(csv.includes('2024-06-01,\n'));assert.equal(csv.split('\n').length,124);
});
