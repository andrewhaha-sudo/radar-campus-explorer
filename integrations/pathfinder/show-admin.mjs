import {readFile} from 'node:fs/promises';
try{
 const credentials=JSON.parse(await readFile('.wrangler/radar-admin.json','utf8'));
 console.log(`Initial local Pathfinder administrator\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nIf you changed the password in Pathfinder, use the updated password instead.`);
}catch{console.error('No bootstrap credentials are stored. Existing accounts were preserved; use your existing Pathfinder login.');process.exitCode=1;}
