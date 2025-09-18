export async function askModel(
  content: string,
  systemPrompt: string,
  sessionId: string,
  isFirst:boolean,
  time:string
): Promise<{response:string,timestamp:string}> {

  const res = await fetch("http://127.0.0.1:8000/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,       
      text: content,     
      systemPrompt,    
      time:time,
      isFirst:isFirst
    }),
  });

  if (!res.ok) throw new Error(`请求失败: ${res.status}`);

  const data = await res.json();
  return {
    response: data.response,
    timestamp: data.timestamp, // 这里读出来
  };
}