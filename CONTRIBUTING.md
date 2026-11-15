# 参与贡献

## 报数据错误（最常见）

提 Issue 时请写清四件事，否则很难核对：

1. 位置：分部 → 分项 → 子目编号（或直接贴地址栏的 `#/...` 深链接）；
2. 现状：界面上显示的消耗量（含资源名、单位）；
3. 期望：应该是多少；
4. 依据：源表截图或标准原文页码。

## 提代码 / 数据 PR

```bash
git clone https://github.com/YMY-0817/install-quota-query.git
cd install-quota-query
npm run serve                          # 本地预览 http://127.0.0.1:8123/
# 改 data/dataset.json（数据）或 index.html（界面）
npm run build                          # 自检 + 写回单文件，失败会中止
```

提交前检查：

- [ ] `npm run build` 通过（数量自洽 + 子目引用完整）；
- [ ] 桌面（≥1320px）与手机（<640px）各截一张图，贴进 PR 描述；
- [ ] 若改了 `index.html` 或 `icons/`，把 `sw.js` 的 `VERSION` 加一；
- [ ] 不提交 `_*.png`、`*.bak` 等临时文件（已在 `.gitignore`）。

## 不接受的内容

- 把数据用于计价软件或商业分发（见 [NOTICE](NOTICE)）；
- 引入需要联网的 CDN、统计脚本、字体服务——本项目承诺离线可用、零外部请求；
- 未经说明的大规模格式化改动（会让 diff 无法 review）。
