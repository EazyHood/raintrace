import { readFile } from 'node:fs/promises';
import { verifyPacket } from './core.mjs';
const file=process.argv[2];
if(!file){console.error('Usage: node verify.mjs /path/to/raintrace-evidence.json');process.exitCode=2;}
else {try{const packet=JSON.parse(await readFile(file,'utf8'));const catalog=JSON.parse(await readFile(new URL('catalog.json',import.meta.url),'utf8'));const verified=await verifyPacket(packet,catalog);console.log(JSON.stringify({valid:true,snapshot:verified.snapshot.id,status:verified.analysis.status,targetMm:verified.analysis.target.total,baselineMm:verified.analysis.baselineMean,changePct:verified.analysis.changePct,packetSha256:verified.packetSha256},null,2));}catch(error){console.error('Verification failed: '+error.message);process.exitCode=1;}}
