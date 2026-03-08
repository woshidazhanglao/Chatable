import { type Message, type ModelConfig } from "../type/chat";
import { invoke, Channel } from "@tauri-apps/api/core";

export async function* askModelStream(
  messages: Message[],
  provider: "local" | "third-party" | "ollama",
  apiKey?: string,
  modelName?: string,
  apiUrl?: string,
  config?: ModelConfig
) {
  if (provider === "local" || provider === "third-party") {
    // 使用 Tauri Channel 实现流式输出
    const onToken = new Channel<string>();
    
    const tokenQueue: string[] = [];
    let isDone = false;
    let error: any = null;

    onToken.onmessage = (token: string) => {
      tokenQueue.push(token);
    };

    const command = provider === "local" ? "chat_local" : "chat_third_party";
    
    let args: any;
    if (provider === "local") {
      args = { 
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        config,
        onToken 
      };
    } else {
      // 确保 URL 格式正确
      let finalUrl = apiUrl || "";
      if (finalUrl && !finalUrl.includes("/chat/completions")) {
        finalUrl = finalUrl.replace(/\/$/, "") + "/chat/completions";
      }
      
      args = {
        apiUrl: finalUrl,
        apiKey: apiKey || "",
        modelName: modelName || "gpt-3.5-turbo",
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        config,
        onToken
      };
    }

    // 调用 Rust 后端
    const chatPromise = invoke(command, args).then(() => {
      isDone = true;
    }).catch((err) => {
      isDone = true;
      error = err;
    });

    // 循环生成器
    while (!isDone || tokenQueue.length > 0) {
      if (tokenQueue.length > 0) {
        yield tokenQueue.shift()!;
      } else {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (error) throw new Error(error);
    }
    
    await chatPromise; 
    return;
  }

  let url = "";
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: any = { messages };

  if (provider === "ollama") {
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