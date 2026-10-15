import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicPaths, site, pageMetadata } from '../dist/server/entry-server.mjs';
const html = p => readFile(new URL('../dist/public/'+(p==='/'?'':p.slice(1)+'/')+'index.html',import.meta.url),'utf8');
test('Every public page has pre-rendered content, unique metadata and a canonical',async()=>{
 const titles=new Set();
 for(const p of publicPaths) {
  const s=await html(p); const title=s.match(/<title>(.*?)<\/title>/)?.[1];
  assert.ok(title,p); assert.ok(!titles.has(title),p); titles.add(title);
  assert.equal((s.match(/<h1[ >]/g)||[]).length,1,p);
  assert.equal((s.match(/rel="canonical"/g)||[]).length,1,p);
  assert.ok(s.includes(pageMetadata(p).canonical),p);
  assert.ok(s.includes('property="og:title"'),p);
  assert.ok(s.includes('name="robots" content="'+(pageMetadata(p).indexable?'index,follow':'noindex,nofollow')+'"'),p);
  const schema=JSON.parse(s.match(/<script id="site-schema" type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(schema['@context'],'https://schema.org');
  assert.ok(!s.includes('917000000000')); assert.ok(!s.includes('500+ Projects'));
  for(const [,href] of s.matchAll(/href="(\/(?!assets\/)[^"#?]*)"/g)) {
   if(href==='/' || href.endsWith('.png') || href.endsWith('.jpg') || href==='/track' || href==='/sign-in' || href==='/admin' || href.startsWith('/account')) continue;
   assert.ok(publicPaths.includes(href),`${p} links to unknown route ${href}`);
  }
 }
});
test('Sitemap lists all public routes and excludes private routes',async()=>{
 const xml=await readFile(new URL('../dist/public/sitemap.xml',import.meta.url),'utf8');
 if(pageMetadata('/').indexable) for(const p of publicPaths) assert.ok(xml.includes(`<loc>${site.url}${p}</loc>`),p);
 assert.ok(!xml.includes('/dashboard')); assert.ok(!xml.includes('/sign-in')); assert.ok(!xml.includes('/admin')); assert.ok(!xml.includes('/track'));
 const robots=await readFile(new URL('../dist/public/robots.txt',import.meta.url),'utf8'); assert.ok(robots.includes('Allow: /')); assert.ok(robots.includes(site.url+'/sitemap.xml'));
});
test('Private shell and 404 cannot be indexed; Vercel fallback returns 404',async()=>{
 for(const file of ['app.html','404.html']) { const s=await readFile(new URL('../dist/public/'+file,import.meta.url),'utf8'); assert.ok(s.includes('noindex,nofollow')); assert.ok(!s.includes('rel="canonical"')); }
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8')); assert.equal(config.routes.at(-1).status,404);
});
test('Enquiry submission and project status use protected account routes',async()=>{
 const s=await html('/contact');
 assert.ok(s.includes('href="/account/new"'));
 assert.ok(s.includes('href="/account/projects"'));
 assert.ok(!s.includes('<form'));
});
