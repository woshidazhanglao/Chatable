use serde::{Serialize, Deserialize};
use serde_json;
use std::fs;
use walkdir::WalkDir;
use chrono::{DateTime, Local};
use tauri::{State, ipc::Channel};
use tokio::sync::Mutex;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    model::params::LlamaModelParams,
    model::LlamaModel,
    model::Special,
    sampling::LlamaSampler,
};
use faiss::{Index, Idx, FlatIndex, index_factory, MetricType};
use ndarray::Array1;

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
struct ModelConfig {
    temperature: f32,
    top_p: f32,
    top_k: i32,
    repeat_penalty: f32,
    context_size: i32,
    max_tokens: i32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatSession {
    id: String,
    messages: Vec<Message>,
    #[serde(rename = "systemPrompt")]
    system_prompt: String,
    config: Option<ModelConfig>,
    character_id: Option<String>,
    world_id: Option<String>,
    created_at: String,
    last_message_at: String,
    title: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Character {
    id: String,
    name: String,
    description: String,
    first_mes: String,
    mes_example: String,
    avatar: Option<String>,
    creator_notes: Option<String>,
    system_prompt: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorldEntry {
    id: String,
    keys: String,
    content: String,
    enabled: bool,
    depth: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorldBook {
    id: String,
    name: String,
    entries: Vec<WorldEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ArenaParticipant {
    character_id: String,
    model_config: ModelConfig,
    messages: Vec<Message>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ArenaSession {
    id: String,
    title: String,
    scenario: String,
    world_book_id: Option<String>,
    participant_a: ArenaParticipant,
    participant_b: ArenaParticipant,
    shared_history: Vec<Message>,
    created_at: String,
    last_message_at: String,
}

struct LlamaState {
    backend: LlamaBackend,
    model: Mutex<Option<LlamaModel>>,
    sessions_dir: std::path::PathBuf,
    characters_dir: std::path::PathBuf,
    worlds_dir: std::path::PathBuf,
    arenas_dir: std::path::PathBuf,
    indices_dir: std::path::PathBuf,
}

// 辅助函数：生成文本向量
async fn get_text_embedding(
    state: &LlamaState,
    text: &str,
) -> Result<Vec<f32>, String> {
    let model_guard = state.model.lock().await;
    let model = model_guard.as_ref().ok_or("模型未载入，无法生成向量")?;

    let mut ctx_params = LlamaContextParams::default();
    ctx_params = ctx_params.with_embeddings(true);
    
    let mut ctx = model
        .new_context(&state.backend, ctx_params)
        .map_err(|e| format!("创建 Embedding 上下文失败: {}", e))?;

    let tokens = model
        .str_to_token(text, llama_cpp_2::model::AddBos::Always)
        .map_err(|e| format!("Tokenize 失败: {}", e))?;

    let mut batch = llama_cpp_2::llama_batch::LlamaBatch::new(tokens.len(), 1);
    for (i, &token) in tokens.iter().enumerate() {
        batch.add(token, i as i32, &[0], i == tokens.len() - 1);
    }

    ctx.decode(&mut batch).map_err(|e| format!("Embedding 解码失败: {}", e))?;

    // 获取最后一个 token 的 embedding 作为文本表示
    let embeddings = ctx.embeddings_ith(batch.n_tokens() - 1)
        .map_err(|e| format!("获取 Embedding 失败: {}", e))?;

    Ok(embeddings.to_vec())
}

#[tauri::command]
async fn search_relevant_context(
    state: State<'_, LlamaState>,
    query: String,
    index_id: String,
    top_k: usize,
) -> Result<Vec<String>, String> {
    let index_path = state.indices_dir.join(format!("{}.index", index_id));
    let map_path = state.indices_dir.join(format!("{}.map", index_id));

    if !index_path.exists() || !map_path.exists() {
        return Ok(Vec::new());
    }

    // 1. 生成查询向量
    let query_vec = get_text_embedding(&state, &query).await?;
    
    // 2. 加载 Faiss 索引
    let mut index = faiss::read_index(index_path.to_str().unwrap())
        .map_err(|e| format!("读取索引失败: {}", e))?;
    
    // 3. 搜索
    let result = index.search(&query_vec, top_k)
        .map_err(|e| format!("搜索失败: {}", e))?;
    
    // 4. 加载映射表并返回内容
    let map_content = fs::read_to_string(map_path).map_err(|e| e.to_string())?;
    let text_map: Vec<String> = serde_json::from_str(&map_content).map_err(|e| e.to_string())?;
    
    let mut relevant_texts = Vec::new();
    for &id in &result.labels {
        if let Some(val) = id.get() {
            if let Some(text) = text_map.get(val as usize) {
                relevant_texts.push(text.clone());
            }
        }
    }

    Ok(relevant_texts)
}

#[tauri::command]
async fn rebuild_index(
    state: State<'_, LlamaState>,
    index_id: String,
    texts: Vec<String>,
) -> Result<(), String> {
    if texts.is_empty() { return Ok(()); }

    let mut embeddings = Vec::new();
    for text in &texts {
        let vec = get_text_embedding(&state, text).await?;
        embeddings.extend(vec);
    }

    let dim = (embeddings.len() / texts.len()) as u32;
    let mut index = FlatIndex::new_l2(dim).map_err(|e| e.to_string())?;
    index.add(&embeddings).map_err(|e| e.to_string())?;

    let index_path = state.indices_dir.join(format!("{}.index", index_id));
    let map_path = state.indices_dir.join(format!("{}.map", index_id));

    faiss::write_index(&index, index_path.to_str().unwrap())
        .map_err(|e| format!("写入索引失败: {}", e))?;
    
    let map_content = serde_json::to_string(&texts).map_err(|e| e.to_string())?;
    fs::write(map_path, map_content).map_err(|e| e.to_string())?;

    Ok(())
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

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessage {
    role: String,
    content: String,
}

#[tauri::command]
async fn chat_local(
    state: State<'_, LlamaState>,
    messages: Vec<ChatMessage>,
    config: ModelConfig,
    on_token: Channel<String>,
) -> Result<(), String> {
    let model_guard = state.model.lock().await;
    let model = model_guard.as_ref().ok_or("模型未载入")?;

    // ... (Prompt 构造逻辑保持不变)
    let mut prompt = String::new();
    for msg in messages {
        let role = if msg.role == "user" { "user" } else { "assistant" };
        prompt.push_str(&format!("<|im_start|>{}\n{}<|im_end|>\n", role, msg.content));
    }
    prompt.push_str("<|im_start|>assistant\n");

    // 2. 初始化上下文，使用传入的 context_size
    let mut ctx_params = LlamaContextParams::default();
    if let Some(n_ctx) = std::num::NonZeroU32::new(config.context_size as u32) {
        ctx_params = ctx_params.with_n_ctx(Some(n_ctx));
    }
    
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

    // 5. 初始化采样器链
    // 按照温度、Top-K、Top-P、重复惩罚的顺序构造采样逻辑
    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::penalties(64, config.repeat_penalty, 0.0, 0.0),
        LlamaSampler::top_k(config.top_k),
        LlamaSampler::top_p(config.top_p, 1),
        LlamaSampler::temp(config.temperature),
        LlamaSampler::dist(Local::now().timestamp_subsec_nanos()),
    ]);

    // 6. 生成循环
    let mut n_cur = tokens.len();
    while n_cur < (config.max_tokens as usize + tokens.len()) && n_cur < config.context_size as usize {
        // 使用采样器从上下文获取 token
        let token = sampler.sample(&ctx, batch.n_tokens() as i32 - 1);
        
        // 检查停止符
        if model.is_eog_token(token) {
            break;
        }

        // 转换回文本并发送
        let piece = model.token_to_str(token, Special::Plaintext)
            .map_err(|e| e.to_string())?;
        on_token.send(piece).map_err(|e| e.to_string())?;

        // 告知采样器接受了该 token 以更新其内部状态（如重复惩罚）
        sampler.accept(token);

        // 准备下一轮解码
        batch.clear();
        batch.add(token, n_cur as i32, &[0], true);
        ctx.decode(&mut batch).map_err(|e| format!("解码失败: {}", e))?;
        n_cur += 1;
    }

    Ok(())
}

#[tauri::command]
async fn chat_third_party(
    api_url: String,
    api_key: String,
    model_name: String,
    messages: Vec<ChatMessage>,
    config: ModelConfig,
    on_token: Channel<String>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    if !api_key.is_empty() {
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key)).map_err(|e| e.to_string())?);
    }

    let body = serde_json::json!({
        "model": model_name,
        "messages": messages,
        "stream": true,
        "temperature": config.temperature,
        "top_p": config.top_p,
        "max_tokens": config.max_tokens
    });

    let response = client.post(&api_url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API request failed: {}", error_text));
    }

    let mut stream = response.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);
        
        for line in text.lines() {
            if line.is_empty() { continue; }
            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    break;
                }
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                        on_token.send(content.to_string()).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn list_third_party_models(
    api_url: String,
    api_key: String,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    if !api_key.is_empty() {
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key)).map_err(|e| e.to_string())?);
    }

    // 尝试构造 models 接口地址
    let models_url = if api_url.ends_with("/chat/completions") {
        api_url.replace("/chat/completions", "/models")
    } else {
        format!("{}/models", api_url.trim_end_matches('/'))
    };

    let response = client.get(&models_url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to fetch models: {}", error_text));
    }

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    
    let mut models = Vec::new();
    if let Some(data) = json["data"].as_array() {
        for item in data {
            if let Some(id) = item["id"].as_str() {
                models.push(id.to_string());
            }
        }
    }

    Ok(models)
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

#[tauri::command]
fn get_characters(state: State<'_, LlamaState>) -> Result<Vec<Character>, String> {
    let mut characters = Vec::new();
    if !state.characters_dir.exists() {
        let _ = fs::create_dir_all(&state.characters_dir);
        return Ok(characters);
    }
    let entries = fs::read_dir(&state.characters_dir).map_err(|e| e.to_string())?;
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(character) = serde_json::from_str::<Character>(&content) {
                    characters.push(character);
                }
            }
        }
    }
    Ok(characters)
}

#[tauri::command]
fn save_character(state: State<'_, LlamaState>, character: Character) -> Result<(), String> {
    if !state.characters_dir.exists() {
        fs::create_dir_all(&state.characters_dir).map_err(|e| e.to_string())?;
    }
    let path = state.characters_dir.join(format!("{}.json", character.id));
    let content = serde_json::to_string_pretty(&character).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_character(state: State<'_, LlamaState>, id: String) -> Result<(), String> {
    let path = state.characters_dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_world_books(state: State<'_, LlamaState>) -> Result<Vec<WorldBook>, String> {
    let mut books = Vec::new();
    if !state.worlds_dir.exists() {
        let _ = fs::create_dir_all(&state.worlds_dir);
        return Ok(books);
    }
    let entries = fs::read_dir(&state.worlds_dir).map_err(|e| e.to_string())?;
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(book) = serde_json::from_str::<WorldBook>(&content) {
                    books.push(book);
                }
            }
        }
    }
    Ok(books)
}

#[tauri::command]
fn save_world_book(state: State<'_, LlamaState>, book: WorldBook) -> Result<(), String> {
    if !state.worlds_dir.exists() {
        fs::create_dir_all(&state.worlds_dir).map_err(|e| e.to_string())?;
    }
    let path = state.worlds_dir.join(format!("{}.json", book.id));
    let content = serde_json::to_string_pretty(&book).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_world_book(state: State<'_, LlamaState>, id: String) -> Result<(), String> {
    let path = state.worlds_dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_arenas(state: State<'_, LlamaState>) -> Result<Vec<ArenaSession>, String> {
    let mut arenas = Vec::new();
    if !state.arenas_dir.exists() {
        let _ = fs::create_dir_all(&state.arenas_dir);
        return Ok(arenas);
    }
    let entries = fs::read_dir(&state.arenas_dir).map_err(|e| e.to_string())?;
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(arena) = serde_json::from_str::<ArenaSession>(&content) {
                    arenas.push(arena);
                }
            }
        }
    }
    arenas.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    Ok(arenas)
}

#[tauri::command]
fn save_arena(state: State<'_, LlamaState>, arena: ArenaSession) -> Result<(), String> {
    if !state.arenas_dir.exists() {
        fs::create_dir_all(&state.arenas_dir).map_err(|e| e.to_string())?;
    }
    let path = state.arenas_dir.join(format!("{}.json", arena.id));
    let content = serde_json::to_string_pretty(&arena).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_arena(state: State<'_, LlamaState>, id: String) -> Result<(), String> {
    let path = state.arenas_dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn delete_session(state: State<'_, LlamaState>, id: String) -> Result<(), String> {
    let path = state.sessions_dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    let backend = LlamaBackend::init().unwrap();
    
    // 使用指定的持久化路径
    let sessions_dir = std::path::PathBuf::from("F:\\React\\project\\session");
    let characters_dir = std::path::PathBuf::from("F:\\React\\project\\characters");
    let worlds_dir = std::path::PathBuf::from("F:\\React\\project\\worlds");
    let arenas_dir = std::path::PathBuf::from("F:\\React\\project\\arenas");
    let indices_dir = std::path::PathBuf::from("F:\\React\\project\\indices");

    for dir in &[&sessions_dir, &characters_dir, &worlds_dir, &arenas_dir, &indices_dir] {
        if !dir.exists() {
            let _ = fs::create_dir_all(dir);
        }
    }

    tauri::Builder::default()
        .manage(LlamaState {
            backend,
            model: Mutex::new(None),
            sessions_dir,
            characters_dir,
            worlds_dir,
            arenas_dir,
            indices_dir,
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_gguf_files, 
            load_local_model, 
            unload_local_model,
            chat_local,
            chat_third_party,
            list_third_party_models,
            get_sessions,
            get_session,
            save_session,
            get_characters,
            save_character,
            delete_character,
            get_world_books,
            save_world_book,
            delete_world_book,
            get_arenas,
            save_arena,
            delete_arena,
            delete_session,
            search_relevant_context,
            rebuild_index
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}