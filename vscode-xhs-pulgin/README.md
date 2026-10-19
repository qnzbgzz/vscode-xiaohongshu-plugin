# 阅读（VS Code）

一个仅支持 Windows 的非官方 VS Code 扩展，用于在侧边栏只读浏览小红书内容。界面采用接近 VS Code 的深色样式，不提供点赞、收藏、评论发布、删除或内容发布功能。

> 本项目与小红书无隶属或授权关系，仅供个人学习与只读浏览。接口和风控规则可能随时变化，请遵守平台条款、当地法律并控制请求频率。

## 功能

- 扫码登录、从本机浏览器读取登录状态、手动输入 Cookie
- 推荐、热门、搜索和分页浏览
- 帖子正文、封面、原图、一级评论和回复
- 深色侧边栏界面
- 请求串行、限速、可取消
- 仅支持 Windows

## 安装发布版

在 VS Code 中打开“扩展”视图，选择右上角菜单中的“从 VSIX 安装…”，选中 `xhs-reader-0.0.2.vsix`，然后运行“开发人员: 重新加载窗口”。

## 从源码运行

需要 Windows 10/11、Node.js 18 或更高版本，以及 VS Code 1.85 或更高版本。

```powershell
npm ci
npm run check
npm run build
```

随后在 VS Code 中打开项目并按 `F5`，启动扩展开发宿主。

生成 VSIX：

```powershell
npm run package
```

## 登录

- 扫码登录：使用 Microsoft Edge 的临时隔离配置，完成后自动关闭并清理临时目录。
- 从浏览器读取：选择本机 Edge 或 Chrome 配置；如果浏览器正在占用配置，请完全退出浏览器后重试。
- 手动输入：在 VS Code 的密码型输入框中粘贴完整 Cookie。

Cookie 仅保存在 VS Code `SecretStorage` 中，不会写入项目文件、设置、Webview 或日志。退出账号时会删除安全存储中的登录信息并清空界面数据。

## 常见问题

- 登录失效：退出账号后重新连接。
- 需要验证：在浏览器中完成验证后重试。
- IP 受限：减少刷新频率，等待一段时间或更换网络。
- 无法从浏览器读取：完全关闭对应浏览器后重试，或使用手动输入。

## 隐私与安全

不要在 Issue、截图、日志或提交中公开 Cookie、`a1`、`web_session` 等登录信息。发现安全问题时，请参阅 `SECURITY.md`。

## 参与贡献

贡献方式和本地检查要求见 `CONTRIBUTING.md`。

## 许可证

项目源码采用 MIT License，详见 `LICENSE`。第三方组件许可证见 `THIRD_PARTY_NOTICES.md`。
