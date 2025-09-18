fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        // .invoke_handler(tauri::generate_handler![ask_deepseek])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
