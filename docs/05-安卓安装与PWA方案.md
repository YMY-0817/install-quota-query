# 05 · 安卓安装与 PWA 方案

> 目标：让这个查询器在安卓手机上**像小程序一样**用——桌面有图标、点开全屏无地址栏、断网能查、更新无感。
> 结论：用 **PWA + GitHub Pages（HTTPS）**，零打包、零审核、约 1 MB。本文给出完整配置、验证清单和排查表。

---

## 1. 为什么不是「打包一个 APK」

先看四条路线的真实成本。这里的「成本」指要额外维护的东西，不只是第一次能不能跑起来。

| 路线 | 用户怎么装 | 首次落地成本 | 后续维护 | 体积 | 离线 | 能调原生能力 |
| --- | --- | --- | --- | --- | --- | --- |
| **PWA（本仓库采用）** | Chrome 菜单「添加到主屏幕」 | 部署一个静态站（本项目已有 workflow，5 分钟） | 推代码即更新，无版本号 | ~1 MB | ✅ Service Worker | ❌（够用：本项目纯查询） |
| TWA（Bubblewrap 打包） | 装 APK（侧载或上架） | 需 JDK + Android SDK + 签名 + `assetlinks.json` | 每次发版重签、重传、可能要过审 | ~2 MB | ✅ 同 PWA | 有限 |
| Capacitor 封 WebView | 装 APK | 需完整 Android 工程 + Gradle | 同上，且 WebView 内核版本碎片化 | 3–6 MB | ✅ 需自行处理 | ✅ 全部 |
| 微信小程序 | 微信内搜索/扫码 | **必须重写**为 WXML/WXSS/JS，注册主体、类目审核 | 平台规则约束 | 分包限制 | ✅ | 部分 |
| 纯网页书签 | 加到书签 | 0 | 0 | 0 | ❌ | ❌ |

对「一个只读查询器」来说，PWA 的收益/成本比明显最高：**不用装包、不用签名、不用审核，改完推上去所有人下次打开就是新的**。所以默认走 PWA。

只有两种情况才值得考虑 TWA / Capacitor：

1. 必须上应用商店（Google Play / 国内商店）分发；
2. 需要原生能力（读本地文件、蓝牙、后台任务等），本项目不需要。

---

## 2. 前提：安全上下文

Service Worker 与「安装」入口只在**安全上下文**下可用：

| 打开方式 | Service Worker | 可安装 | 说明 |
| --- | --- | --- | --- |
| `file://` 双击 | ❌ | ❌ | 查询功能正常，但没有离线缓存和安装入口 |
| `http://127.0.0.1` / `localhost` | ✅ | ✅ | 本机调试用 `npm run serve` |
| `http://192.168.x.x`（局域网 IP） | ❌ | ❌ | 手机连电脑调试时页面能开，但装不了 |
| `https://…`（Pages / Vercel / 自建） | ✅ | ✅ | 正式使用走这条 |

这就是「双击就能用」和「能装到桌面」之间唯一的硬门槛：**需要一个 HTTPS 地址**。

---

## 3. 方案 A：GitHub Pages + Chrome 安装（推荐）

### 3.1 一次性部署

仓库自带 [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)，推送到 `main` 会：

1. 校验 `manifest.webmanifest`、`data/dataset.json` 是合法 JSON，`sw.js` 语法正确；
2. 校验 `meta.counts` 与实际数组长度一致（防手改数据改坏了）；
3. 只把 `index.html`、`manifest.webmanifest`、`sw.js`、`icons/` 发布到 Pages。

启用步骤（仓库 Settings）：

```text
Settings → Pages → Build and deployment
  Source: GitHub Actions        ← 选这个，不要选 "Deploy from a branch"
```

推送后等 Actions 绿勾，站点地址为：

```
https://<用户名>.github.io/<仓库名>/
例：https://YMY-0817.github.io/install-quota-query/
```

> 没有 workflow 也行：`Source: Deploy from a branch` + 分支 `main` / 目录 `/ (root)`，一样能跑，只是会把 `docs/`、`scripts/` 也一起发出去。

### 3.2 手机上装

1. Chrome 打开上面的地址，**等首屏渲染完**（PWA 要等 Service Worker 装好才判定为可安装，第一次通常 1–2 秒）；
2. 右上角 `⋮`：
   - 出现 **「安装应用」/「添加到主屏幕」** → 点它；
   - 只有「添加到主屏幕」时，加完是**快捷方式**（有地址栏）；两者区别见 §7 排查表；
3. 确认名称「消耗量查询」，桌面出现深蓝色「安」字图标。

装完之后：

- 从桌面图标启动 → **独立窗口**，没有地址栏和标签栏，状态栏是 `#16405b` 深蓝；
- 任务切换器里是一个独立应用，不是浏览器标签；
- 断网 / 飞行模式下打开，照常查询（数据在缓存里）；
- 长按图标可「卸载」，等于清掉这个 Web 应用。

### 3.3 更新怎么生效

`sw.js` 采用 **导航 network-first**：每次从桌面启动，先请求网络拿最新 `index.html`，拿到就顺手更新缓存；断网才回退缓存。所以：

- 推了新版本 → 用户下次启动就是新版，不需要「检查更新」；
- 改了 `index.html` 或图标 → **必须把 `sw.js` 里的 `VERSION` 改一下**（如 `2026-11-15.1` → `2026-11-15.2`），否则图标等静态资源仍命中旧缓存。

```js
const VERSION = '2026-11-15.1';   // ← 每次发布 +1
const CACHE = `quota-${VERSION}`; // 旧缓存会在 activate 时自动清理
```

---

## 4. 配置逐项说明

### 4.1 `manifest.webmanifest`

```json
{
  "name": "安装工程消耗量查询器",
  "short_name": "消耗量查询",
  "start_url": "./index.html?source=pwa",
  "scope": "./",
  "display": "standalone",
  "background_color": "#eef1f5",
  "theme_color": "#16405b",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

| 字段 | 取值理由 |
| --- | --- |
| `display: standalone` | 去掉浏览器 UI；比 `fullscreen` 稳（保留状态栏，能看时间和电量） |
| `display_override` | 依次降级 `standalone → minimal-ui → browser`，老版本 Chrome 也能装 |
| `start_url: ./index.html?source=pwa` | **相对路径**，仓库改名、放子目录、换域名都不会 404；`?source=pwa` 便于统计来源 |
| `scope: ./` | 限制应用边界，超出范围的链接会用浏览器打开 |
| `id` 省略 | 默认取 `start_url`；一旦显式写死绝对路径，换部署路径会变成「另一个应用」、桌面出现两个图标 |
| `background_color` | 启动瞬间的底色，取界面背景 `#eef1f5`，不会闪白/闪黑 |
| `theme_color` | 状态栏颜色，取主色 `#16405b` |
| `maskable` 图标 | 安卓会把图标裁成圆形/水滴/方形，`maskable` 版本把内容压在中间 80% 安全区，任何形状都不缺角 |
| `orientation: any` | 平板横屏四栏更好用，不锁方向 |

图标要求（安卓安装判定的硬条件）：**至少 192×192 与 512×512 各一张 PNG**。本仓库四张图标由 `scripts/make-icons.py` 生成，改配色改文案后 `npm run icons` 重跑即可。

### 4.2 `index.html` 里加的三段

```html
<!-- ① PWA 元信息 -->
<meta name="theme-color" content="#16405b" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="消耗量查询" />
<link rel="manifest" href="./manifest.webmanifest" />
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
```

```html
<!-- ② 注册 Service Worker：file:// 下跳过，避免报错 -->
<script>
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
</script>
```

> `apple-*` 那几个是给 iOS Safari「添加到主屏幕」用的，安卓不读，但加上不吃亏。

### 4.3 `sw.js` 的缓存策略

| 请求类型 | 策略 | 原因 |
| --- | --- | --- |
| 页面导航（HTML） | network-first → 失败回退 `./index.html` | 单文件应用，更新即整个应用；保证「推了就是新的」，断网也有页面 |
| 图标 / manifest | cache-first + 后台补新 | 不变的东西不必每次请求，弱网下也秒开 |
| 非 GET、跨域请求 | 直接放行 | 本项目无网络请求，留作安全默认 |

所有路径都用相对路径（`./`），所以**部署在 `/仓库名/` 这种子路径下也能正常工作**——这是最容易踩的坑。

---

## 5. 验收清单

装之前先在电脑上过一遍，能省掉大半「为什么手机上没反应」。

| # | 检查 | 方法 | 期望 |
| --- | --- | --- | --- |
| 1 | manifest 可访问 | 浏览器打开 `/manifest.webmanifest` | 返回 JSON，不是 404/HTML |
| 2 | SW 已注册且激活 | DevTools → Application → Service Workers | `activated and is running` |
| 3 | 缓存已填充 | Application → Cache Storage → `quota-…` | 有 8 条以上条目 |
| 4 | 图标可访问 | 直接打开 `/icons/icon-512.png` | 512×512 图片 |
| 5 | 可安装性 | DevTools → Application → Manifest | 无红色错误，出现安装按钮 |
| 6 | 离线可用 | Network 面板勾 `Offline` 后刷新 | 页面正常渲染、可查询 |
| 7 | 手机真机 | 手机 Chrome 打开线上地址 → `⋮` | 出现「安装应用」 |
| 8 | 装完形态 | 桌面启动 | 无地址栏、状态栏深蓝、断网可查 |

Lighthouse（DevTools → Lighthouse → 勾 PWA）跑一遍，正常应全绿。若第 5 项报「manifest 中的图标无法下载」，多半是部署在子路径但用了绝对路径 `/icons/...`。

---

## 6. 方案 B：打包成 APK（TWA）

只有在**必须上架应用商店**时才需要。TWA 本质是一个壳，页面仍来自你的 HTTPS 站点，所以服务质量取决于站点是否可用。

### 6.1 环境

```bash
# 需要 JDK 17+ 与 Android SDK（或直接装 Android Studio）
npm i -g @bubblewrap/cli
```

### 6.2 生成工程

```bash
bubblewrap init --manifest https://<用户名>.github.io/install-quota-query/manifest.webmanifest
# 按提示填：应用名、包名（如 io.github.ymy0817.quota）、签名信息
bubblewrap build          # 产出 app-release-signed.apk 与 assetlinks.json
```

`bubblewrap init` 会读你的 manifest，把 `start_url`、`theme_color`、图标一并继承过去。

### 6.3 关键一步：Digital Asset Links

TWA 打开时不显示地址栏的前提是「站点声明信任这个 App」，否则会退化成带地址栏的 Custom Tab。做法是把 `assetlinks.json` 放到站点的 `/.well-known/` 下：

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.github.ymy0817.quota",
    "sha256_cert_fingerprints": ["<你的签名证书 SHA-256>"]
  }
}]
```

```bash
# 取指纹
keytool -list -v -keystore android.keystore -alias androiddebugkey | grep SHA256
```

用 GitHub Pages 发布时，把该文件提交到仓库 `.well-known/assetlinks.json`，并在 workflow 的「组装发布目录」里带上：

```bash
mkdir -p _site/.well-known
cp .well-known/assetlinks.json _site/.well-known/
```

> 换了签名（包括换成 Play 应用签名）就必须更新指纹，否则地址栏会回来。

### 6.4 分发

- 侧载：直接把 APK 发给用户，需允许「安装未知来源应用」；
- 上架：Google Play 要求 targetSdk 跟随新版本，且 TWA 需通过「网站与 App 归属」校验。

---

## 7. 方案 C：Capacitor 封装（一般不需要）

适合「必须离线分发安装包、且要调原生能力」的场景：

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "消耗量查询" io.github.ymy0817.quota --web-dir=.
npx cap add android
npx cap sync && npx cap open android    # 在 Android Studio 里出包
```

代价：多一整套 Gradle 工程要维护，WebView 内核随系统版本差异大，得自己处理返回键、文件权限、深色模式。**本项目是纯只读查询，收益为零，不建议。**

---

## 8. 局域网真机调试（不想先部署）

想让手机临时以 `localhost` 的身份访问电脑上的服务（这样 SW 也能注册）：

```bash
# 电脑已跑 node scripts/serve.mjs（127.0.0.1:8123）
# 手机开 USB 调试并连电脑
adb reverse tcp:8123 tcp:8123
# 手机 Chrome 打开 http://localhost:8123/
```

`adb reverse` 把手机的 `localhost:8123` 映射到电脑，于是满足安全上下文，可以看到真实的安装入口。

其他方式：

- 手机 Chrome 打开 `chrome://flags/#unsafely-treat-insecure-origin-as-secure`，填入 `http://192.168.1.x:8123` 并重启浏览器（仅调试，别长期开）；
- 用 `npx localtunnel` / `cloudflared tunnel` 之类临时给个 https 域名。

---

## 9. 排查表

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 菜单里没有「安装应用」 | 未满足安装条件：无 manifest / 缺 192+512 图标 / 无 SW / 非 HTTPS | 按 §5 逐项过；先看 DevTools → Application → Manifest 有无红字 |
| 有「添加到主屏幕」但没有「安装应用」 | 同上，Chrome 降级成了快捷方式 | 装上去仍有地址栏；修好条件后**先卸载再重装** |
| 装完打开是白屏 | 部署在子路径但资源用了绝对路径 `/…` | 全部改相对路径 `./…`；本项目已如此 |
| 装完图标是灰色的「G」 | 图标 URL 404 或尺寸不符 | 打开 `/icons/icon-512.png` 验证；确认 `purpose` 写法 |
| 更新了代码手机上还是旧的 | SW 缓存未换版本 | 改 `sw.js` 的 `VERSION`；临时验证可在 DevTools → Application → Storage → Clear site data |
| 断网打开报 `ERR_INTERNET_DISCONNECTED` | 首次访问时 SW 没装完就断网 | 联网状态打开一次，等 `activated`，再断网测 |
| 手机上排版挤成一团 | 视口未声明 / 用了固定宽度 | 本仓库已有 `width=device-width, initial-scale=1`，<1024px 走单栏 |
| iOS 上没全屏 | Safari 用的是 `apple-mobile-web-app-capable` | 已加；iOS 不支持 manifest 的 display，只能靠这个 meta |

---

## 10. 如果确实要做微信小程序

必须认清一点：**Web 应用不能直接「变成」小程序**。可行的两条路：

1. **重写**：把 `dataset.json` 原样搬进小程序，界面用 WXML/WXSS 重做（分包控制在 2 MB 内，`dataset.json` 544 KB 放主包没问题），查询逻辑照抄 `index.html` 里的索引与筛选；需要注册主体、选类目、过审。
2. **web-view 内嵌**：小程序里用一个 `web-view` 指向已备案的 HTTPS 域名。限制很硬——需要企业主体 + 域名备案、`web-view` 无法使用小程序的本地能力、审核对「纯网页套壳」不友好。

如果目标是「轻量、点开即用、桌面有图标」，PWA 已经能达到 90% 的小程序体验，且不需要任何审核与备案。建议先用 PWA 验证需求，真有必要再投入小程序重写。

---

## 11. 一页速查

```bash
npm run serve                 # 本地 http://127.0.0.1:8123/ （唯一能测 PWA 的本地方式）
# 改完 index.html / 图标
npm run build                 # 数据自检 + 写回单文件
# 改完 sw.js 的 VERSION 后
git push origin main          # Actions 自动发布 → 手机 Chrome 添加到主屏幕
```
