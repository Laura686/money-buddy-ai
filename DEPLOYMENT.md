# 钱搭子 AI 真实视觉/OCR API 部署说明

当前仓库已经接入真实视觉模型接口：

- 前端：`index.html`
- 后端：`api/analyze-image.js`
- 部署配置：`vercel.json`

## 重要说明

GitHub Pages 只能托管静态页面，不能运行 `/api/analyze-image` 后端函数。因此真实视觉/OCR能力需要部署到 Vercel、Netlify、Cloudflare Pages Functions 等支持 Serverless API 的平台。

推荐使用 Vercel。

## Vercel 部署步骤

1. 打开 https://vercel.com/
2. 使用 GitHub 登录。
3. Import Project，选择 `Laura686/money-buddy-ai`。
4. Framework Preset 选择 `Other`。
5. 在 Environment Variables 添加：

```text
OPENAI_API_KEY=你的 OpenAI API Key
```

可选：

```text
OPENAI_VISION_MODEL=gpt-4.1-mini
```

6. 点击 Deploy。
7. 部署完成后，访问 Vercel 提供的域名，例如：

```text
https://money-buddy-ai.vercel.app/
```

这个地址才是支持真实图片识别的体验地址。原 GitHub Pages 地址只能展示静态页面，无法执行后端视觉 API。

## 安全边界

- API Key 只保存在 Vercel 环境变量中，不会暴露到前端。
- 基金/理财截图只做风险理解，不推荐买入，不预测涨跌，不承诺收益。
- 低置信度字段会要求用户确认，不编造商品名、价格、基金名称或净值。
