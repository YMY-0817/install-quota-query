# Changelog

遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## 3.0.0 — 2026-11-15

首次以开源仓库形式发布。

### 新增

- 单文件应用 `index.html`（内联 React 18 + 全量数据），双击即可离线使用；
- `data/dataset.json` 数据源（7 分部 / 35 分项 / 270 子目 / 2395 条消耗量），可用脚本反向抽取与写回；
- `scripts/extract-data.mjs`、`scripts/build.mjs`（含 4 项自检：数量自洽 + 引用完整性）、
  `scripts/serve.mjs`（零依赖本地服务器）、`scripts/make-icons.py`（图标生成）；
- PWA 能力：`manifest.webmanifest`、`sw.js`、192/512/maskable/apple-touch 图标，
  安卓 Chrome 可「添加到主屏幕」独立运行并离线查询；
- `.github/workflows/pages.yml`：推送即校验并发布到 GitHub Pages；
- 文档：README、`docs/05-安卓安装与PWA方案.md`、NOTICE（数据来源与使用边界）、MIT LICENSE。

### 说明

- `docs/01`–`04` 为原始 Vite 工程阶段的设计与验收档案，保留原样，路径描述以当时工程为准。
