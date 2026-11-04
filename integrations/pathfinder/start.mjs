import {spawnSync,spawn} from 'node:child_process';
import {writeFile,unlink} from 'node:fs/promises';
import {prepareRuntime,createBootstrapSQL,parseUserCount} from './bootstrap.mjs';
const root=process.cwd();
const wrangler='node_modules/wrangler/bin/wrangler.js';
const run=(args,options={})=>{
 const result=spawnSync(process.execPath,[wrangler,...args],{cwd:root,stdio:'inherit',...options});
 if(result.status!==0)throw new Error('Pathfinder database setup failed; startup stopped.');return result;
};
await prepareRuntime(root);
run(['d1','migrations','apply','pathfinder','--local']);
const result=run(['d1','execute','pathfinder','--local','--command','SELECT COUNT(*) AS count FROM users','--json'],{encoding:'utf8',stdio:['ignore','pipe','inherit']});
const count=parseUserCount(result.stdout);
if(count===0){
 const file='.wrangler/bootstrap.sql';await writeFile(file,await createBootstrapSQL(root),{mode:0o600});
 try{run(['d1','execute','pathfinder','--local','--file',file]);}finally{await unlink(file);}
 console.log('Created a private initial administrator. Run the documented credentials command locally to view its password.');
}else console.log('Existing Pathfinder accounts preserved.');
// Upstream secrets and real plans remain in the private Docker volume, not source archives.
const child=spawn(process.execPath,[wrangler,'pages','dev','.svelte-kit/cloudflare','--local','--ip','0.0.0.0','--port','8082'],{cwd:root,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
