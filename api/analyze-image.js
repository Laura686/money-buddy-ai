const MAX_DATA_URL_LENGTH = 12 * 1024 * 1024;

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

const schemaHint = `
请只返回 JSON，不要返回 Markdown 代码块。字段如下：
{
  "image_type": "商品截图|基金/理财产品截图|K线/收益走势图|微信/支付宝账单|银行短信|外卖订单|消费记录|理财文章截图|无法确认",
  "confidence": "高|中|低",
  "needs_confirmation": true/false,
  "extracted": {
    "product_name": "",
    "brand": "",
    "category": "",
    "price": "",
    "original_price": "",
    "platform": "",
    "discount": "",
    "fund_or_product_name": "",
    "product_nature": "",
    "risk_level": "低|中低|中|中高|高|无法确认",
    "return_or_change": "",
    "merchant": "",
    "amount": "",
    "time": ""
  },
  "source_notes": ["说明每个关键字段来自图片哪一区域；看不清就写未明确识别"],
  "tags": ["风险标签/情绪标签/场景标签"],
  "summary": "一句话总结",
  "analysis": "面向大学生的生活化分析。商品要分析预算影响、攒钱目标、情绪消费和是否适合冷静清单；基金/理财要解释产品本质、风险、波动、适合/不适合人群，不推荐买入，不预测涨跌；账单要提取金额、类别、情绪消费线索。",
  "follow_up_question": "如果识别不确定，需要问用户确认的问题；否则为空字符串",
  "safety_flags": ["不推荐具体买入|不承诺收益|不鼓励借钱投资"]
}
`;

export default async function handler(request) {
  if (request.method === "OPTIONS") return json(200, { ok: true });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(500, { error: "OPENAI_API_KEY is not configured on the server." });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const { imageDataUrl, userText = "", userState = {} } = payload || {};
  if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return json(400, { error: "imageDataUrl must be a base64 data URL." });
  }
  if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
    return json(413, { error: "Image is too large. Please upload a smaller screenshot." });
  }

  const prompt = `你是“钱搭子 AI”，一个面向在校大学生的校园理财搭子。你正在处理用户上传的截图。

用户补充文字：${userText || "未补充"}

用户当前状态：
- 本月生活费：2500 元
- 当前余额：540 元
- 距离下次到账：9 天
- 本周剩余预算：156 元
- 攒钱目标：日本旅行基金，目标 8000 元，已攒 1260 元
- 应急金完成度：约 20%

要求：
1. 必须先判断图片类型，不同类型走不同分析逻辑。
2. 如果是基金/理财/K线，不要输出商品购买分析，不推荐买入，不预测涨跌，不承诺收益。
3. 如果是商品截图，先提取商品名、品牌、品类、价格、平台和优惠；低置信度必须要求用户确认。
4. 如果是账单/订单/短信，提取商户、金额、时间、类别，并识别是否可能是情绪消费。
5. 如果看不清或字段不确定，明确写“未明确识别，需用户确认”，不要编造。
6. 语言像朋友，不要像金融客服。

${schemaHint}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl, detail: "high" }
          ]
        }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return json(response.status, { error: data.error?.message || "OpenAI vision request failed." });
  }

  const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n") || "";
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
  } catch {
    parsed = {
      image_type: "无法确认",
      confidence: "低",
      needs_confirmation: true,
      extracted: {},
      source_notes: ["模型返回了非 JSON 内容，已保留原始分析。"],
      tags: ["需确认"],
      summary: "这张图需要进一步确认后再分析。",
      analysis: text || "未能读取到有效分析结果。",
      follow_up_question: "你可以补充这是基金、商品还是账单，以及最想分析的问题吗？",
      safety_flags: ["不推荐具体买入", "不承诺收益", "不鼓励借钱投资"]
    };
  }

  return json(200, { ok: true, result: parsed });
}
