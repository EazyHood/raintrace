// One bounded request per place. Existing snapshots are never silently overwritten.
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const places = [
  { id: 'santa-marta', name: 'Santa Marta', region: 'Magdalena, Colombia', latitude: 11.2408, longitude: -74.1990 },
  { id: 'bogota', name: 'Bogotá', region: 'Distrito Capital, Colombia', latitude: 4.7110, longitude: -74.0721 }
];
const entries = [];
for (const place of places) {
  const filename = `${place.id}.json`;
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=${place.longitude}&latitude=${place.latitude}&start=19910101&end=20251231&format=JSON&time-standard=LST`;
  let raw, retrievedAt;
  try { raw = await readFile(new URL(filename, import.meta.url), 'utf8'); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  if (!raw) {
    const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`${place.id}: HTTP ${response.status}; no retry performed`);
    raw = await response.text();
    const json = JSON.parse(raw);
    if (!json.properties?.parameter?.PRECTOTCORR || json.header?.start !== '19910101' || json.header?.end !== '20251231') throw new Error('Unexpected data response');
    await writeFile(new URL(filename, import.meta.url), raw);
    retrievedAt = new Date().toISOString();
  } else {
    const old = JSON.parse(await readFile(new URL('catalog.json', import.meta.url), 'utf8'));
    retrievedAt = old.places.find(x => x.id === place.id)?.retrievedAt;
    if (!retrievedAt) throw new Error('Existing snapshot has no retrieval record; inspect before re-downloading.');
  }
  const json = JSON.parse(raw);
  const entry = { ...place, file: filename, sourceUrl: url, retrievedAt, sha256: createHash('sha256').update(raw).digest('hex'), bytes: Buffer.byteLength(raw), days: Object.keys(json.properties.parameter.PRECTOTCORR).length, source: 'NASA POWER', dataset: json.header.sources, timeStandard: json.header.time_standard };
  entries.push(entry);
  console.log(`${place.id}: ${entry.days} daily records; ${entry.bytes} bytes; SHA-256 ${entry.sha256}`);
}
await writeFile(new URL('catalog.json', import.meta.url), JSON.stringify({ schema: 'raintrace-snapshot-catalog/1', places: entries }, null, 2) + '\n');
