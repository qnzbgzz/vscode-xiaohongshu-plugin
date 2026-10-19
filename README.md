# vscode-xiaohongshu-plugin
A VS Code extension that brings Xiaohongshu (REDnote) into your editor, making it easy to browse content without leaving your coding environment.（一个将小红书引入 VS Code 的扩展插件，让开发者无需频繁切换应用，即可在编辑器中浏览小红书内容。）
一个将小红书引入 Visual Studio Code 的扩展插件，让你在熟悉的代码编辑器中直接浏览小红书内容。
希望通过这个有趣的小工具，为开发者提供一种更加便捷的内容浏览方式。

✨ 功能特点
编辑器内浏览：在 VS Code 中打开小红书，无需频繁切换浏览器窗口。
便捷的使用体验：在熟悉的开发环境中访问小红书内容。
轻量化设计：专注于核心功能，持续优化插件的使用体验。
注：具体功能以当前版本的实际实现为准。

📸 效果展示
<img width="820" height="967" alt="image" src="https://github.com/user-attachments/assets/8384df34-7a13-47cd-9de1-951eb1b2e728" />

🚀 安装方式
在 VS Code 中打开“扩展”视图，选择“从 VSIX 安装…”，选中项目生成的 `xhs-reader-0.0.2.vsix`，重载窗口后点击活动栏中的“阅读”。

登录
- 扫码登录：使用系统 Microsoft Edge 打开临时隔离配置，扫码完成后自动关闭并删除临时目录。
- 从浏览器读取：选择本机 Edge 或 Chrome 配置；若浏览器正在占用配置，请先完全关闭后重试。
- 手动输入：通过 VS Code 的密码型安全输入框粘贴 Cookie。Cookie 不进入 Webview，只保存在 VS Code `SecretStorage`。暂时只支持输入cookie登录，浏览器先登录自己的小红书，按下F12进入开发者模式获取cookie，在VS Code里面按下Ctrl+Shift+P,输入阅读:连接账号，选择手动输入，输入cookie完成登录。

🛠️ 开发计划
持续优化插件的使用体验

根据用户反馈改进功能

探索更多实用功能

⚠️ 免责声明
本项目为独立开发的第三方项目，与小红书（REDnote）及 Microsoft 官方不存在隶属、合作或官方授权关系。
小红书及相关商标归其各自权利人所有。
使用本插件时，请遵守相关平台的使用规则、适用法律法规及所在组织的管理要求。



💬 反馈与交流
欢迎提交 Issue 反馈问题、提出功能建议，或参与项目改进。
