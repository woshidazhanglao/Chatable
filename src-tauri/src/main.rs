use serde::{Serialize, Deserialize};
use serde_json;
use std::fs;
use std::sync::Arc;
use walkdir::WalkDir;
use chrono::{DateTime, Local};
use tauri::{State, ipc::Channel};
use tokio::sync::Mutex;
use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    model::params::LlamaModelParams,
    model::LlamaModel,
    token::data_array::LlamaTokenDataArray,
    model::Special,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GGUFFile {
    name: String,
    size: u64,
    modified: String,
    arch: String,
    params: String,
    quant: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Message {
    role: String,
    content: String,
    time: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatSession {
    id: String,
    messages: Vec<Message>,
    #[serde(rename = "systemPrompt")]
    system_prompt: String,
    created_at: String,
    last_message_at: String,
    title: String,
}

struct LlamaState {
    backend: LlamaBackend,
    model: Mutex<Option<LlamaModel>>,
    sessions_dir: std::path::PathBuf,
}

#[tauri::command]
fn list_gguf_files(folder_path: String) -> Result<Vec<GGUFFile>, String> {
    let mut files = Vec::new();
    if !fs::metadata(&folder_path).is_ok() {
        return Ok(files);
    }

    for entry in WalkDir::new(&folder_path).max_depth(1).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("gguf") {
            let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
            let modified: DateTime<Local> = metadata.modified().map_err(|e| e.to_string())?.into();
            
            files.push(GGUFFile {
                name: path.file_name().unwrap().to_string_lossy().to_string(),
                size: metadata.len(),
                modified: modified.format("%Y-%m-%d %H:%M:%S").to_string(),
                arch: "GGUF".to_string(),
                params: "unknown".to_string(),
                quant: "unknown".to_string(),
            });
        }
    }
    Ok(files)
}

#[tauri::command]
async fn load_local_model(state: State<'_, LlamaState>, path: String) -> Result<String, String> {
    // 1. 先取消旧模型载入
    let mut model_guard = state.model.lock().await;
    *model_guard = None;

    // 2. 检查路径
    if !fs::metadata(&path).is_ok() {
        return Err("模型文件不存在".to_string());
    }
    
    // 3. 载入新模型
    let model_params = LlamaModelParams::default();
    let model = LlamaModel::load_from_file(&state.backend, &path, &model_params)
        .map_err(|e| format!("加载模型失败: {}", e))?;
    
    *model_guard = Some(model);
    
    println!("模型加载成功: {}", path);
    Ok(format!("模型 {} 已载入并准备就绪", path))
}

#[tauri::command]
async fn unload_local_model(state: State<'_, LlamaState>) -> Result<String, String> {
    let mut model_guard = state.model.lock().await;
    *model_guard = None;
    println!("模型已卸载");
    Ok("模型已成功卸载".to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessage {
    role: String,
    content: String,
}

#[tauri::command]
async fn chat_local(
    state: State<'_, LlamaState>,
    messages: Vec<ChatMessage>,
    on_token: Channel<String>,
) -> Result<(), String> {
    let model_guard = state.model.lock().await;
    let model = model_guard.as_ref().ok_or("模型未载入")?;

    // 1. 构造 Prompt (简单的 ChatML 格式)
    let mut prompt = String::new();
    for msg in messages {
        let role = if msg.role == "user" { "user" } else { "assistant" };
        prompt.push_str(&format!("<|im_start|>{}\n{}<|im_end|>\n", role, msg.content));
    }
    prompt.push_str("<|im_start|>assistant\n");

    // 2. 初始化上下文
    let ctx_params = LlamaContextParams::default();
    let mut ctx = model
        .new_context(&state.backend, ctx_params)
        .map_err(|e| format!("创建上下文失败: {}", e))?;

    // 3. Tokenize
    let tokens = model
        .str_to_token(&prompt, llama_cpp_2::model::AddBos::Always)
        .map_err(|e| format!("Tokenize 失败: {}", e))?;

    // 4. Batch 预测
    let mut batch = llama_cpp_2::llama_batch::LlamaBatch::new(tokens.len(), 1);
    for (i, &token) in tokens.iter().enumerate() {
        batch.add(token, i as i32, &[0], i == tokens.len() - 1);
    }

    ctx.decode(&mut batch).map_err(|e| format!("解码失败: {}", e))?;

    // 5. 生成循环
    let mut n_cur = tokens.len();
    while n_cur < 2048 { // 最大生成长度
        let candidates = ctx.candidates_ith(batch.n_tokens() - 1);
        let mut candidates_p = LlamaTokenDataArray::from_iter(candidates, false);
        
        // 采样 (简单的 Greedy Search)
        let token = candidates_p.sample_token_greedy();
        
        // 检查停止符
        if model.is_eog_token(token) {
            break;
        }

        // 转换回文本并发送
        let piece = model.token_to_str(token, Special::Plaintext)
    .map_err(|e| e.to_string())?;
        on_token.send(piece).map_err(|e| e.to_string())?;

        // 准备下一轮解码
        batch.clear();
        batch.add(token, n_cur as i32, &[0], true);
        ctx.decode(&mut batch).map_err(|e| format!("解码失败: {}", e))?;
        n_cur += 1;
    }

    Ok(())
}

#[tauri::command]
fn get_sessions(state: State<'_, LlamaState>) -> Result<Vec<ChatSession>, String> {
    let mut sessions = Vec::new();
    
    // 确保目录存在，防止 os error 3 (路径不存在)
    if !state.sessions_dir.exists() {
        let _ = fs::create_dir_all(&state.sessions_dir);
        return Ok(sessions);
    }

    let entries = fs::read_dir(&state.sessions_dir).map_err(|e| format!("无法读取会话目录: {}", e))?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(session) = serde_json::from_str::<ChatSession>(&content) {
                        sessions.push(session);
                    }
                }
            }
        }
    }
    
    // 按最后消息时间排序 (降序)
    sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    Ok(sessions)
}

#[tauri::command]
fn get_session(state: State<'_, LlamaState>, id: String) -> Result<ChatSession, String> {
    let path = state.sessions_dir.join(format!("{}.json", id));
    
    if !path.exists() {
        return Err(format!("会话文件不存在: {}", id));
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取文件失败 ({}): {}", id, e))?;
    let session: ChatSession = serde_json::from_str(&content).map_err(|e| format!("解析会话失败: {}", e))?;
    Ok(session)
}

#[tauri::command]
fn save_session(state: State<'_, LlamaState>, session: ChatSession) -> Result<(), String> {
    if !state.sessions_dir.exists() {
        fs::create_dir_all(&state.sessions_dir).map_err(|e| e.to_string())?;
    }
    let path = state.sessions_dir.join(format!("{}.json", session.id));
    let content = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    let backend = LlamaBackend::init().unwrap();
    
    // 使用指定的持久化路径
    let sessions_dir = std::path::PathBuf::from("F:\\React\\project\\session");
    if !sessions_dir.exists() {
        let _ = fs::create_dir_all(&sessions_dir);
    }

    tauri::Builder::default()
        .manage(LlamaState {
            backend,
            model: Mutex::new(None),
            sessions_dir,
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_gguf_files, 
            load_local_model, 
            unload_local_model,
            chat_local,
            get_sessions,
            get_session,
            save_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}