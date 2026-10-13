// 大模型调用封装。走 OpenAI 兼容的 /v1/chat/completions 协议（flashapi 等聚合网关支持），
// 配置从环境变量读取：LLM_API_KEY / LLM_BASE_URL / LLM_MODEL（见 .env.local）。

const DEFAULT_TIMEOUT_MS = 180000;

function baseUrl() {
  return (process.env.LLM_BASE_URL ?? "").replace(/\/+$/, "");
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && baseUrl() && process.env.LLM_MODEL);
}

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

class LlmError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 失败自动重试：限流(429)/网关5xx/超时/网络错误最多重试 2 次，指数退避。
const MAX_RETRIES = 2;

/**
 * 调用大模型并返回文本内容。调用方自行解析（本项目要求模型输出 JSON）。
 * 对可重试错误（429/5xx/超时/网络）做指数退避重试。
 */
export async function callLlm(
  messages: LlmMessage[],
  options: { temperature?: number; timeoutMs?: number } = {}
): Promise<string> {
  if (!isLlmConfigured()) {
    throw new Error("未配置大模型，请在 .env.local 设置 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await callLlmOnce(messages, options);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof LlmError ? error.retryable : false;
      if (!retryable || attempt === MAX_RETRIES) break;
      await sleep(1000 * 2 ** attempt); // 1s, 2s
    }
  }
  throw lastError instanceof Error ? lastError : new Error("大模型调用失败");
}

async function callLlmOnce(
  messages: LlmMessage[],
  options: { temperature?: number; timeoutMs?: number }
): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${baseUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        temperature: options.temperature ?? 0.2,
        max_tokens: Number(process.env.LLM_MAX_TOKENS ?? 8192),
        messages
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // 429 限流、5xx 网关错误可重试；4xx 其它为请求问题不重试。
      const retryable = response.status === 429 || response.status >= 500;
      throw new LlmError(
        `大模型请求失败：${response.status} ${detail.slice(0, 300)}`,
        retryable
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new LlmError("大模型返回内容为空", true);
    }
    return content;
  } catch (error) {
    if (timedOut) {
      // 超时可重试（网关偶发慢）。
      throw new LlmError(
        `大模型响应超时（超过 ${Math.round(timeoutMs / 1000)} 秒）`,
        true
      );
    }
    if (error instanceof LlmError) throw error;
    // 网络层错误（连接重置等）可重试。
    throw new LlmError(
      error instanceof Error ? error.message : "大模型网络错误",
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从模型返回文本里提取 JSON（兼容 ```json 代码块包裹与前后多余文字）。
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
  if (start === -1 || end === -1 || end < start) {
    throw new Error("无法从大模型返回中解析 JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
