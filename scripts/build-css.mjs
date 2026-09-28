#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = ['CSS/tokens.css','CSS/base.css','CSS/components.css','CSS/features.css','CSS/admin.css','CSS/utilities.css'];
const parts = ['/* MRgram app.css — auto-built */'];
for (const f of PARTS) parts.push(`/* --- ${f} --- */\n${readFileSync(join(ROOT,f),'utf8').trim()}`);
const out = parts.join('\n\n')+'\n';
writeFileSync(join(ROOT,'app.css'), out);
const sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
const version = sha ? `b-${sha.slice(0,9)}` : `t-${Date.now()}`;
const swPath = join(ROOT,'firebase-messaging-sw.js');
let sw = readFileSync(swPath,'utf8');
const VER = /const CACHE_VERSION\s*=\s*'[^']*';\s*\/\* BUILD_VERSION_LINE \*\//;
if (VER.test(sw)) writeFileSync(swPath, sw.replace(VER, `const CACHE_VERSION  = '${version}'; /* BUILD_VERSION_LINE */`));
console.log(`OK app.css ${out.split('\n').length} lines`);
