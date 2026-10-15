import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import assert from 'node:assert/strict';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw new Error('Run inside demo-mindforge emulators:exec only.');
const frontend=fileURLToPath(new URL('../../../artifacts/mindforge-hub/',import.meta.url));
const vite=spawn(process.execPath,[frontend+'node_modules/vite/bin/vite.js','--config','vite.config.ts','--host','127.0.0.1','--strictPort'],{cwd:frontend,stdio:['ignore','pipe','pipe'],windowsHide:true});
vite.stdout.on('data',x=>process.stdout.write(x));vite.stderr.on('data',x=>process.stderr.write(x));
async function run(file,env={}){await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[file],{stdio:'inherit',env:{...process.env,...env},windowsHide:true});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(file+' failed: '+code)));});}
try{
 let ready=false;for(let n=0;n<60;n++){try{const r=await fetch('http://localhost:5173');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready)throw new Error('Local preview did not start.');
 await run('tests/browser.test.mjs');
 initializeApp({projectId:'demo-mindforge'});const auth=getAuth(),db=getFirestore(),owner=await auth.getUserByEmail('mindforgehub26@gmail.com');
 function provision(args){return spawnSync(process.execPath,['provision-admin.mjs','--project=demo-mindforge','--uid='+owner.uid,...args],{encoding:'utf8',windowsHide:true});}
 assert.equal(provision(['--role=customer']).status,0);assert.equal((await db.doc('access/'+owner.uid).get()).data().role,'admin');
 assert.notEqual(provision(['--role=customer','--apply','--confirm=wrong-project']).status,0);
 assert.equal(provision(['--role=customer','--apply','--confirm=demo-mindforge']).status,0);assert.equal((await db.doc('access/'+owner.uid).get()).data().role,'customer');assert.notEqual((await auth.getUser(owner.uid)).customClaims?.admin,true);
 assert.equal(provision(['--role=admin','--apply','--confirm=demo-mindforge']).status,0);assert.equal((await auth.getUser(owner.uid)).customClaims?.admin,true);
 await writeFile(new URL('../../../qa/provision-results.json',import.meta.url),JSON.stringify({passed:['Dry run does not change role','Mismatched project confirmation rejected','Demotion clears claim and changes server role','Promotion restores both trusted controls']},null,2));
 await run('tests/admin-browser.test.mjs');
 await run('tests/rules.test.mjs');
 console.log('INTEGRATION COMPLETE: public, customer, admin, provisioning and security checks passed.');
}finally{vite.kill();}
