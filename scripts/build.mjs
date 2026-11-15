// 把 data/dataset.json 写回 index.html 的数据槽位，产出一份新的单文件应用
// 用法: node scripts/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'index.html');
const DATA = join(ROOT, 'data', 'dataset.json');

const START = '/*DATA:START*/';
const END = '/*DATA:END*/';

const html = readFileSync(HTML, 'utf8');
const dataset = JSON.parse(readFileSync(DATA, 'utf8'));

const a = html.indexOf(START);
const b = html.indexOf(END);
if (a === -1 || b === -1 || b < a) {
  throw new Error('index.html 里找不到 DATA:START / DATA:END 标记，先跑一次 `npm run extract`');
}

// 构建前自检：四层数量必须自洽，否则宁可失败也不要产出错数据
const checks = [];
const c = dataset.meta?.counts ?? {};
const actual = {
  divisions: dataset.divisions.length,
  sections: dataset.sections.length,
  items: dataset.items.length,
  records: dataset.consumptions.length,
};
for (const [k, v] of Object.entries(actual)) {
  const declared = c[k];
  checks.push({ name: `meta.counts.${k}`, ok: declared === v, declared, actual: v });
}

// 引用完整性：每个子目的消耗量 id 都能在 consumptions 里找到
const recIds = new Set(dataset.consumptions.map((r) => r.id));
let missing = 0;
for (const item of dataset.items) {
  for (const id of item.consumptionIds ?? []) if (!recIds.has(id)) missing++;
}
checks.push({ name: '子目 → 消耗量 引用完整', ok: missing === 0, missing });

const failed = checks.filter((x) => !x.ok);
for (const x of checks) console.log(`${x.ok ? '✓' : '✗'} ${x.name}`, x.ok ? '' : JSON.stringify(x));
if (failed.length) {
  console.error(`\n构建中止：${failed.length} 项自检未通过`);
  process.exit(1);
}

const payload = JSON.stringify(dataset);
const next = html.slice(0, a + START.length) + payload + html.slice(b);
writeFileSync(HTML, next, 'utf8');

console.log('\n已写回 index.html');
console.log('  数据体积:', (Buffer.byteLength(payload) / 1024).toFixed(1), 'KB');
console.log('  文件体积:', (Buffer.byteLength(next) / 1024).toFixed(1), 'KB');
console.log('  规模:', JSON.stringify(actual));
