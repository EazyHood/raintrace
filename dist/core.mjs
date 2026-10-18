/** Raintrace analysis v1. Daily precipitation rates represent one day each.
 * For matched calendars, 29 February is excluded from every season.
 * A single missing/non-finite/negative value blocks that year's comparison.
 */
export const VERSION = 'raintrace-analysis/1';
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const BASELINE = [1991, 2020];
const round = value => Number(value.toFixed(6));
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key)+':'+canonical(value[key])).join(',') + '}';
}
export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
}
export function parseThresholdInput(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new Error('Enter a percentage between 0 and 100.');
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('The percentage must be between 0 and 100.');
  return value;
}
export function validateConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('The comparison settings are missing.');
  const { year, startMonth, endMonth, direction, threshold } = input;
  if (!Number.isInteger(year) || year < 2021 || year > 2025) throw new Error('Choose a target year from 2021 to 2025.');
  if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || startMonth < 1 || endMonth > 12 || startMonth > endMonth) throw new Error('Choose a valid month range within one calendar year.');
  if (!['lower','higher'].includes(direction)) throw new Error('Choose lower or higher rainfall.');
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error('The percentage must be between 0 and 100.');
  return { year, startMonth, endMonth, direction, threshold };
}
export function dateKeys(year, startMonth, endMonth) {
  const keys = [];
  for (let month = startMonth; month <= endMonth; month++) {
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= days; day++) {
      if (month === 2 && day === 29) continue;
      keys.push(`${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`);
    }
  }
  return keys;
}
function season(values, year, startMonth, endMonth) {
  const dates = dateKeys(year, startMonth, endMonth);
  let total = 0;
  const missing = [];
  const daily = dates.map(date => {
    const value = values[date];
    const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (valid) total += value; else missing.push(date);
    return { date, value: valid ? value : null };
  });
  return { year, expectedDays: dates.length, validDays: dates.length - missing.length, missing, total: missing.length ? null : round(total), daily };
}
export function readSource(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (data?.header?.time_standard !== 'LST') throw new Error('This analysis requires the documented Local Solar Time snapshot.');
  if (data?.parameters?.PRECTOTCORR?.units !== 'mm/day') throw new Error('Unexpected precipitation units. Expected mm/day.');
  if (!Array.isArray(data?.header?.sources) || !data.header.sources.includes('MERRA2')) throw new Error('Unexpected data model; expected the MERRA2 snapshot.');
  const values = data?.properties?.parameter?.PRECTOTCORR;
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Daily precipitation records are missing.');
  return values;
}
function quantile(values, p) {
  const sorted = [...values].sort((a,b)=>a-b), index = (sorted.length-1)*p;
  const low = Math.floor(index), high = Math.ceil(index);
  return round(sorted[low] + (sorted[high]-sorted[low])*(index-low));
}
export function analyze(raw, input) {
  const config = validateConfig(input), values = readSource(raw);
  const target = season(values, config.year, config.startMonth, config.endMonth);
  const baseline = Array.from({length:30},(_,i)=>season(values,BASELINE[0]+i,config.startMonth,config.endMonth));
  const complete = baseline.filter(x=>x.total!==null);
  const reasons = [];
  if (target.missing.length) reasons.push(`${target.missing.length} target day(s) missing or invalid.`);
  if (complete.length !== 30) reasons.push(`${30-complete.length} baseline year(s) incomplete; all 30 are required.`);
  const baselineMean = complete.length===30 ? round(complete.reduce((sum,x)=>sum+x.total,0)/30) : null;
  if (baselineMean === 0) reasons.push('The baseline mean is zero; percentage comparison is undefined.');
  const changePct = reasons.length ? null : round((target.total-baselineMean)/baselineMean*100);
  const supports = changePct === null ? null : (config.direction==='lower' ? -changePct : changePct) + 1e-8 >= config.threshold;
  const monthly = Array.from({length:12},(_,i)=> {
    const month=i+1, actual=season(values,config.year,month,month);
    const history=Array.from({length:30},(_,j)=>season(values,1991+j,month,month));
    return { month, target: actual.total, baseline: history.every(x=>x.total!==null) ? round(history.reduce((s,x)=>s+x.total,0)/30) : null, selected: month>=config.startMonth && month<=config.endMonth };
  });
  return {
    analysisVersion:VERSION, config,
    status:reasons.length ? 'insufficient' : supports ? 'supported' : 'not-supported',
    reasons, target, baseline:baseline.map(({daily,...rest})=>rest), completeBaselineYears:complete.length,
    baselineMean, changePct,
    baselineRange:complete.length===30 ? { min:Math.min(...complete.map(x=>x.total)), q25:quantile(complete.map(x=>x.total),.25), median:quantile(complete.map(x=>x.total),.5), q75:quantile(complete.map(x=>x.total),.75), max:Math.max(...complete.map(x=>x.total)) } : null,
    monthly,
    method:'Sum daily PRECTOTCORR for selected months. Exclude 29 February in all years. Compare target total with arithmetic mean of 30 complete same-season totals (1991–2020). Do not impute missing values.',
    limits:'Gridded reanalysis at approximately 0.5° latitude × 0.625° longitude; not a local rain gauge. The result tests this rainfall claim only, not drought, flooding, water availability, causation or climate change attribution.'
  };
}
export function claimText(config) {
  return `At least ${config.threshold}% ${config.direction} precipitation in ${MONTHS[config.startMonth-1]}–${MONTHS[config.endMonth-1]} ${config.year} than the 1991–2020 same-season mean.`;
}
export async function makePacket(raw, snapshot, config) {
  if (await sha256(raw)!==snapshot.sha256) throw new Error('The source bytes do not match the pinned snapshot. Export is blocked.');
  const analysis = analyze(raw, config);
  if (analysis.status==='insufficient') throw new Error('Resolve missing data before exporting a supported comparison.');
  const payload={ schema:'raintrace-evidence/1', snapshotId:snapshot.id, snapshotSha256:snapshot.sha256, sourceUrl:snapshot.sourceUrl, retrievedAt:snapshot.retrievedAt, rawSource:raw, analysis };
  return { ...payload, packetSha256:await sha256(canonical(payload)) };
}
export async function verifyPacket(packet, catalog) {
  if (!packet || packet.schema!=='raintrace-evidence/1') throw new Error('This is not a Raintrace evidence packet.');
  const {packetSha256,...payload}=packet;
  if (typeof packetSha256!=='string' || await sha256(canonical(payload))!==packetSha256) throw new Error('Packet integrity failed. At least one field changed after export.');
  const snapshot=catalog.places.find(x=>x.id===packet.snapshotId);
  if (!snapshot || snapshot.sha256!==packet.snapshotSha256) throw new Error('This snapshot is not in this release’s pinned catalog.');
  if (packet.sourceUrl!==snapshot.sourceUrl || packet.retrievedAt!==snapshot.retrievedAt) throw new Error('The source metadata differs from the pinned catalog.');
  if (typeof packet.rawSource!=='string' || await sha256(packet.rawSource)!==snapshot.sha256) throw new Error('Source integrity failed. The records differ from the pinned snapshot.');
  const rebuilt=analyze(packet.rawSource,packet.analysis.config);
  if (canonical(rebuilt)!==canonical(packet.analysis)) throw new Error('The reported result does not reproduce from the source and settings.');
  return { snapshot, analysis:rebuilt, packetSha256 };
}
export function rowsCsv(analysis) {
  return 'date,precipitation_mm\n' + analysis.target.daily.map(x=>`${x.date.slice(0,4)}-${x.date.slice(4,6)}-${x.date.slice(6)},${x.value===null?'':x.value}`).join('\n')+'\n';
}
