# 第三方开源组件合规声明

**项目**：lmgallery（仓库 `cefengxu/lmgallery`）  
**适用范围**：本仓库源代码、构建产物及服务器端运行所依赖的第三方开源组件  
**版本基准**：分支 `add-serpapi` 所锁定的 `package-lock.json`  
**声明日期**：2026-11-08  

## 1. 项目自身权利说明

本项目采用 **BSD-3-Clause** 开源许可证（与仓库 `main` 分支 `LICENSE` 及 GitHub 元数据一致）。本分支若尚未包含根目录 `LICENSE` 文件，应以 BSD-3-Clause 全文为准，并尽快将 `LICENSE` 同步至本分支；建议在根 `package.json` 中声明 `"license": "BSD-3-Clause"`。

除本文件及第三方组件各自许可证另有规定外，使用本项目源代码应遵守 BSD-3-Clause。

## 2. 双许可 / 强 copyleft

基于当前锁定依赖树的审查：**未发现** `MIT OR GPL` 等双许可生产依赖，亦**未发现**纯 GPL / AGPL / SSPL 等强 copyleft 生产依赖路径。

## 3. 弱 copyleft（MPL-2.0）

| 组件 | 引入路径（摘要） | 许可证 | 义务摘要 |
|---|---|---|---|
| `lightningcss@1.32.0` 及各平台 optional 二进制 | `@tailwindcss/vite` → `@tailwindcss/node` → `lightningcss` | MPL-2.0 | 文件级弱 copyleft：未修改该组件源码再分发时，通常不强制开源整站；若修改 `lightningcss` 本身再分发，须按 MPL 开源改动文件 |

## 4. Apache-2.0 组件（再分发时须保留 NOTICE/版权）

本项目使用了以下 Apache-2.0（或等价表述）组件（含传递依赖，不完全列举）：

- `@google/genai` 及其传递的 `google-auth-library`、`gaxios`、`gcp-metadata`、`google-logging-utils`、`ecdsa-sig-formatter` 等  
- 构建链中的 `baseline-browser-mapping` 等  
- `long`（经 `protobufjs`）等  

若对外再分发含上述组件的二进制或源码包，应保留相应版权声明与 NOTICE（如有）。

**说明**：Google Gemini、SerpAPI、Unsplash、Pexels 等**在线服务的服务合同 / 数据处理 / 署名要求**独立于 SDK 或 HTTP 调用所涉开源许可证，须另行遵守，不在本开源合规声明完全覆盖范围内。SerpAPI 在本项目中通过 `axios` 调用其 HTTP API，并非 npm 上的 `serpapi` 包。

## 5. 署名类许可

| 组件 | 引入路径（摘要） | 许可证 |
|---|---|---|
| `caniuse-lite` | `@vitejs/plugin-react` → Babel / browserslist 链 | CC-BY-4.0（保留署名） |

## 6. 其他第三方组件

其余生产依赖及其传递依赖，据锁定清单主要为 MIT、ISC、BSD-2-Clause、BSD-3-Clause、0BSD 等宽松许可证。使用时应保留各组件要求的版权与许可声明。完整包清单以当前分支的 `package-lock.json` 为准；需要时可另行提供 SBOM（CycloneDX / SPDX）。

## 7. 未发现事项

基于上述锁定依赖树的审查：**未发现**须强制适用纯 GPL / AGPL / SSPL 等强 copyleft 许可证的生产依赖路径。

## 8. 变更与维护

- 新增、升级依赖前应确认 SPDX 许可证，禁止在未评估的情况下引入强 copyleft 或许可证不明的组件。  
- 依赖变更后应更新本文件及（如有）SBOM。  
- 本声明不构成法律意见；重大对外分发、开源发布或投融资尽调场景，建议法务最终复核。

---

**权利人确认**  
项目自身许可证：☑ BSD-3-Clause  

签署人：__________　日期：__________
