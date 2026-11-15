// 从 index.html 中抽出内嵌的消耗量数据集，写入 data/dataset.json
// 用法: node scripts/extract-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'index.html');
const OUT = join(ROOT, 'data', 'dataset.json');

const START_TOKEN = 'const ct=';
const START_MARK = '/*DATA:START*/';
const END_MARK = '/*DATA:END*/';

const html = readFileSync(HTML, 'utf8');

// 1. 定位数据对象起点：兼容带/不带标记两种写法
let from = html.indexOf(START_MARK);
let objStart;
if (from !== -1) {
  objStart = from + START_MARK.length;
} else {
  const at = html.indexOf(START_TOKEN);
  if (at === -1) throw new Error('未找到 `const ct=`，index.html 可能已被改动');
  objStart = at + START_TOKEN.length;
}

// 2. 花括号配对（跳过字符串、模板串、注释内的括号）
let depth = 0;
let i = objStart;
let inStr = null;
let inTmpl = false;
let inLine = false;
let inBlock = false;
let objEnd = -1;

for (; i < html.length; i++) {
  const c = html[i];
  const next = html[i + 1];
  if (inLine) {
    if (c === '\n') inLine = false;
    continue;
  }
  if (inBlock) {
    if (c === '*' && next === '/') { inBlock = false; i++; }
    continue;
  }
  if (inStr) {
    if (c === '\\') { i++; continue; }
    if (c === inStr) inStr = null;
    continue;
  }
  if (inTmpl) {
    if (c === '\\') { i++; continue; }
    if (c === '`') inTmpl = false;
    continue;
  }
  if (c === '/' && next === '/') { inLine = true; i++; continue; }
  if (c === '/' && next === '*') { inBlock = true; i++; continue; }
  if (c === '"' || c === "'") { inStr = c; continue; }
  if (c === '`') { inTmpl = true; continue; }
  if (c === '{') depth++;
  else if (c === '}') {
    depth--;
    if (depth === 0) { objEnd = i + 1; break; }
  }
}

if (objEnd === -1) throw new Error('数据对象没有闭合，解析失败');
const literal = html.slice(objStart, objEnd);

// 3. 用 vm 求值，拿到真正的对象（对象字面量，不含函数）
const dataset = vm.runInNewContext('(' + literal + ')', Object.create(null));

// 4. 写 JSON
mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(dataset, null, 0);
writeFileSync(OUT, json, 'utf8');

// 5. 给 index.html 打上标记，方便之后 build 时定位（不改动数据本身）
const marked =
  html.slice(0, objStart) + START_MARK + literal + END_MARK + html.slice(objEnd);
if (marked !== html) writeFileSync(HTML, marked, 'utf8');

const counts = {
  divisions: dataset.divisions?.length ?? 0,
  sections: dataset.sections?.length ?? 0,
  items: dataset.items?.length ?? 0,
  records: dataset.records?.length ?? 0,
};
console.log('已导出 data/dataset.json');
console.log('  体积:', (Buffer.byteLength(json) / 1024).toFixed(1), 'KB');
console.log('  规模:', JSON.stringify(counts));
console.log('  源文件:', (dataset.meta?.sources ?? []).map((s) => s.file).join(', '));
