#[derive(Serialize, Deserialize, Clone)]
struct Character {
    id: String,
    name: String,
    description: String,
    first_mes: String,
    mes_example: String,
    avatar: Option<String>, // 图片路径或 Base64
}

#[derive(Serialize, Deserialize, Clone)]
struct WorldEntry {
    id: String,
    keys: Vec<String>, // 触发关键词
    content: String,
    enabled: bool,
}