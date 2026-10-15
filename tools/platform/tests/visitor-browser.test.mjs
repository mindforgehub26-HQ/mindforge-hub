import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if(process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local emulators required');
initializeApp({projectId:'demo-mindforge'});
const db=getFirestore(), browser=await chromium.launch({headless:true,channel:'msedge'});
const ctx=await browser.newContext();
await ctx.route('**/*',r=>/^(http|ws):\/\/(localhost|127\.0\.0\.1):/.test(r.request().url())?r.continue():r.abort());
const page=await ctx.newPage();
try {
 await page.goto('http://localhost:5173/');
 await page.getByRole('button',{name:'Allow analytics',exact:true}).waitFor();
 assert.equal((await db.collection('visitorPresence').get()).size,0);
 await page.getByRole('button',{name:'Allow analytics',exact:true}).click();
 let visits;
 for(let i=0;i<40;i++){visits=await db.collection('visitorPresence').get();if(visits.size)break;await new Promise(r=>setTimeout(r,250));}
 assert.equal(visits.size,1);
 assert.deepEqual(Object.keys(visits.docs[0].data()).sort(),['createdAt','lastSeen']);
 assert.equal(await page.evaluate(async()=>{const {auth}=await import('/src/firebase/config.ts');return auth.currentUser?.uid || null;}),null);
 await page.reload();await page.getByRole('heading',{level:1}).waitFor();
 assert.equal((await db.collection('visitorPresence').get()).size,1);
 await page.goto('http://localhost:5173/account/new');
 await page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor();
 await page.goto('http://localhost:5173/privacy');
 await page.getByRole('button',{name:'Withdraw analytics consent'}).click();
 await page.waitForLoadState('domcontentloaded');
 assert.equal(await page.evaluate(()=>localStorage.getItem('analytics-consent')),'denied');
 console.log('Visitor tracking browser checks passed: opt-in, session deduplication, timestamp-only data, isolated auth, protected enquiry, withdrawal.');
} finally {await browser.close();}
