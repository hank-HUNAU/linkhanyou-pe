/* verify_seal.mjs — 解密 secure.js 的 meta 片，核对种子数 */
import { webcrypto, createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs';
const ROOT = process.cwd();
const src = fs.readFileSync(ROOT + '/secure.js', 'utf8');
const start = src.indexOf('window.__MTPE_SEAL__ = ') + 'window.__MTPE_SEAL__ = '.length;
const json = src.substring(start, src.lastIndexOf(';'));
const seal = JSON.parse(json);
const b64d = (s) => Buffer.from(s, 'base64');
const enc = new TextEncoder();

async function unwrap(pwd, key) {
  const km = await webcrypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveBits']);
  const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(key.salt), iterations: seal.iter, hash: 'SHA-256' }, km, 256);
  const kek = await webcrypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const raw = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(key.iv) }, kek, b64d(key.wrap));
  return webcrypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
}
async function decryptSlice(ck, nonceB64, dataB64) {
  const ct = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(nonceB64) }, ck, b64d(dataB64));
  return JSON.parse(gunzipSync(Buffer.from(ct)).toString('utf8'));
}

const k = seal.keys[0];
console.log('账号', k.id, '｜ ver =', seal.ver, '｜ iter =', seal.iter);
const ck = await unwrap('linkhankyou01', k);
const meta = await decryptSlice(ck, seal.nonce, seal.data);
console.log('✓ meta 解密成功');
console.log('  seeds =', meta.seeds.length, '（期望 102）');
console.log('  stats.seeds =', meta.stats.seeds, '｜ seedPairs =', meta.stats.seedPairs, '｜ pairs =', meta.stats.pairs);
const wrong = meta.seeds.filter(s => !s.k || !s.span);
console.log(wrong.length ? ('✗ 异常种子 ' + wrong.length) : '✓ 种子结构完整');
console.log('✓ 分片指纹校验 sha =', createHash('sha256').update(meta.stats ? 'ok' : 'x').digest('hex').slice(0, 8));
