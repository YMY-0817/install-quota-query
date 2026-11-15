// 零依赖的本地静态服务器：Service Worker 需要 http(s) 环境，双击 file:// 打开时无法注册
// 用法: node scripts/serve.mjs [端口]
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let rel = normalize(url).replace(/^([/\\])+/, '');
  if (rel === '' || rel.endsWith('/')) rel = join(rel, 'index.html');
  const file = join(ROOT, rel);

  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const st = statSync(file);
    if (st.isDirectory()) {
      res.writeHead(302, { Location: url.replace(/\/?$/, '/') + 'index.html' }).end();
      return;
    }
    // sw.js 与 index.html 始终取最新，避免本地调试时被浏览器缓存骗到
    const noCache = /(sw\.js|index\.html)$/.test(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': noCache ? 'no-cache' : 'public, max-age=3600',
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`本地预览: http://127.0.0.1:${PORT}/`);
  console.log('提示: 手机同一 Wi-Fi 下想访问，把监听地址改成 0.0.0.0 再用 http://<电脑IP>:端口 打开');
});
