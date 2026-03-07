import { type Message } from "../type/chat";
import { invoke, Channel } from "@tauri-apps/api/core";

export async function* askModelStream(
  messages: Message[],
  provider: "local" | "deepseek" | "openai" | "ollama",
  apiKey?: string,
  modelName?: string
) {
  if (provider === "local") {
    // 使用 Tauri Channel 实现本地流式输出
    const onToken = new Channel<string>();
    
    // 我们需要一个变量来存储接收到的 token
    const tokenQueue: string[] = [];
    let isDone = false;

    onToken.onmessage = (token: string) => {
      tokenQueue.push(token);
    };

    // 调用 Rust 后端
    const chatPromise = invoke("chat_local", { 
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      onToken 
    }).then(() => {
      isDone = true;
    });

    // 循环生成器
    while (!isDone || tokenQueue.length > 0) {
      if (tokenQueue.length > 0) {
        yield tokenQueue.shift()!;
      } else {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    await chatPromise; // 确保错误被捕获
    return;
  }

  let url = "";
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: any = { messages };

  if (provider === "deepseek") {
    url = "https://api.deepseek.com/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = {
      model: modelName || "deepseek-chat",
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true
    };
  } else if (provider === "ollama") {
    url = "http://localhost:11434/api/chat";
    body = {
      model: modelName || "llama3",
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim() !== "");

    for (const line of lines) {
      if (provider === "ollama") {
        try {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content || "";
          if (content) yield content;
          if (parsed.done) return;
        } catch (e) {
          console.error("解析 Ollama 流失败", e);
        }
      } else if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || "";
          if (content) yield content;
        } catch (e) {
          console.error("解析流数据失败", e);
        }
      }
    }
  }
}