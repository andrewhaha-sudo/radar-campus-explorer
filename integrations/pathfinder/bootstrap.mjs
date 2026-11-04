import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {randomBytes,randomUUID,pbkdf2Sync} from 'node:crypto';
import {join} from 'node:path';
async function readOrCreate(file,create){
 try{return await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 const value=create();await writeFile(file,value,{mode:0o600,flag:'wx'});return value;
}
export async function prepareRuntime(root){
 await mkdir(join(root,'.wrangler'),{recursive:true,mode:0o700});
 await chmod(join(root,'.wrangler'),0o700);
 const secret=await readOrCreate(join(root,'.wrangler','radar-jwt'),()=>randomBytes(48).toString('base64url'));
 let previous='';
 try{previous=await readFile(join(root,'.dev.vars'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 const routing=process.env.LIFEROUTER_ORIGIN;
 const retained=previous.split('\n').filter(line=>!/^JWT_SECRET=/.test(line)&&!(routing&&/^LIFEROUTER_ORIGIN=/.test(line))).join('\n');
 await writeFile(join(root,'.dev.vars'),`${retained}\nJWT_SECRET=${JSON.stringify(secret)}\n${routing?`LIFEROUTER_ORIGIN=${JSON.stringify(routing)}\n`:''}`,{mode:0o600});
}
export async function createBootstrapSQL(root){
 const credentials=JSON.parse(await readOrCreate(join(root,'.wrangler','radar-admin.json'),()=>JSON.stringify({email:'admin@campus.local',password:randomBytes(24).toString('base64url')},null,2)));
 const salt=randomUUID();
 const hash=pbkdf2Sync(credentials.password,salt,100000,32,'sha256').toString('base64url');
 const quote=s=>`'${String(s).replaceAll("'","''")}'`;
 return `INSERT OR IGNORE INTO users (id,name,email,password_hash,salt,role,org,active,mfa_enabled,token_version,created_at) VALUES (${quote(randomUUID())},'Campus facility administrator',${quote(credentials.email)},${quote(hash)},${quote(salt)},'admin','Campus Explorer',1,0,0,datetime('now'));`;
}

export function parseUserCount(stdout){
 // Wrangler can print a proxy notice before its JSON result.
 const start=stdout.search(/^\s*\[/m);
 if(start<0)throw new Error('Missing database query result; startup stopped.');
 const output=JSON.parse(stdout.slice(start));
 const count=output[0]?.results?.[0]?.count;
 if(!Number.isSafeInteger(count)||count<0)throw new Error('Invalid user count; startup stopped.');
 return count;
}
