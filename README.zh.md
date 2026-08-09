# Send-to-Grabbit

[English](README.md) | [中文](README.zh.md) | [日本語](README.ja.md)

将 Chrome 浏览器中的下载自动发送到 Grabbit 的扩展。

## 为什么使用

它省去了手动复制、粘贴下载 URL 到 Grabbit 的步骤。

它无需任何配置。

更重要的是，它会在可用时附带有用的请求信息，包括 cookie、referrer、user agent 和捕获到的请求头。这对需要登录状态或签名上下文的下载尤其有用，能提高 Grabbit 的下载成功率。

## 命令

- `npm install` 安装依赖。
- `npm run typecheck` 运行 TypeScript 检查。
- `npm run build` 将扩展构建到 `dist/`。

## 在 Chrome 中加载

1. 运行 `npm run build`。
2. 打开 `chrome://extensions`。
3. 打开开发者模式。
4. 点击“加载已解压的扩展程序”，选择本仓库的 `dist/` 目录。

## 协议

下载会通过一种固定的协议发送到 Grabbit：

```text
grabbit://addUri?payload=<url-encoded-json>
```

`payload` 查询参数是 URL 编码后的 JSON，包含 `url` 和 aria2 风格的 `header` 行：

```json
{
  "url": "https://example.com/file.zip",
  "header": ["Accept-Language: ja", "Accept-Charset: utf-8"]
}
```
