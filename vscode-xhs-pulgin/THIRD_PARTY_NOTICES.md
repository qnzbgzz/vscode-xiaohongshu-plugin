# 第三方来源与许可证

本项目为非官方的只读阅读扩展。运行时使用 TypeScript 与 Node.js，不需要 Python 或命令行工具。

## xhshow

- 作者：Cloxl；许可证：MIT，Copyright (c) 2024 Cloxl。
- 来源：https://github.com/Cloxl/xhshow/tree/v0.2.0
- 固定版本：0.2.0，提交 `5f45309a06b2bb94131ccb51f158b0f2b2ff873a`。
- 官方 PyPI 源码归档 SHA-256：`1ae45ce889d0041d57b6eff5dbcbcc31a06f3df351c80b4a50bac983a0e1fe44`。
- 改编范围：`src/api/signing/` 的 XYS、XYW、B1/x-s-common、RAP、编码、哈希与会话计数算法及常量。此版本将 Python 算法移植为 TypeScript；AES 使用 Node 内置实现；RAP gzip 使用固定版本的 pako；ARC4 采用字节实现；只计算 B1 实际包含的指纹字段；时间与随机源支持注入。
- 上游签名实现接受完整 Cookie，但 B1 所选择的字段不包含完整 Cookie 字符串；`x-s-common` 的账号字段使用 `a1`，与固定上游一致。
- 许可证全文：`resources/licenses/xhshow-MIT.txt`。

签名回归夹具 `test/fixtures/signing-vectors.json` 来自该固定版本的独立 Python 实现，使用上游测试中的虚构 `test_a1_value` 等字段、固定时间与固定随机源。不存在真实凭据。Python 源码及生成依赖仅用于开发时离线校验，不进入分发包。

## pako 与其 zlib 移植

- 作者：Vitaly Puzrin 与 Andrei Tuputcyn；许可证：项目其余文件为 MIT，`lib/zlib` 为 Zlib。
- 来源：https://github.com/nodeca/pako/tree/1.0.11
- 固定版本：1.0.11。
- 使用范围：为 RAP 生成与固定 xhshow 0.2.0/Python 签名向量字节级一致的 gzip 数据；不处理 Cookie 或其他凭据。
- pako README 明确说明其 JavaScript 压缩核心移植自 zlib 1.2.8，并将 `lib/zlib` 置于 Zlib 许可证下。
- 许可证全文：`resources/licenses/pako-MIT.txt` 与 `resources/licenses/pako-ZLIB.txt`。

## xiaohongshu-cli

- 作者：jackwener。
- 来源：https://github.com/jackwener/xiaohongshu-cli/tree/v0.6.4
- 固定版本：0.6.4，提交 `368b1cf58e4c7548c82073b949577e38ed2cb39a`；该标签的 `pyproject.toml` 明确声明 Apache-2.0。
- 参考范围：只读接口调用流程、请求参数、身份认证与访问频率策略；扩展采用原生 TypeScript 重新实现，不分发或调用 Python CLI。
- 不可变签名来源：该提交的 `xhs_cli/signing.py` 第 56–75 行定义 GET/POST 签名适配并委托 xhshow，第 78–85 行用同一实现构建 GET URI；`tests/test_signing.py` 第 14–26 行固定了无参数、标量参数与逗号分隔列表参数行为，第 37–80 行只断言签名头集合、`XYS_` 前缀、时间戳和异常，没有提供可复制的确定性签名字面量。因此没有伪造第二套签名头向量；`test/fixtures/xiaohongshu-cli-conformance.json` 记录上述不可变行号，并逐字转写其两个确定性 URI 构造用例作为等价本地一致性检查。
- 许可证全文：`resources/licenses/xiaohongshu-cli-APACHE-2.0.txt`。

## Playwright Core

- 作者：Microsoft Corporation 及贡献者；许可证：Apache-2.0。
- 来源：https://github.com/microsoft/playwright/tree/v1.49.1
- 固定版本：1.49.1。
- 使用范围：在 Windows 上读取用户明确选择的 Chromium 浏览器配置，以及创建二维码登录所需的临时 Edge 配置。
- Apache-2.0 许可证全文与 `resources/licenses/xiaohongshu-cli-APACHE-2.0.txt` 相同，分发包中已包含该许可证。

以上开源项目与本扩展没有官方关联。后续改编或依赖增加时，应同步更新此文件及对应许可证。
