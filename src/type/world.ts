export interface WorldEntry {
  id: string;
  keys: string; // 以逗号分隔的关键词
  content: string;
  enabled: boolean;
  depth?: number; // 检索深度，决定在 Prompt 中的插入位置
}

export interface WorldBook {
  id: string;
  name: string;
  entries: WorldEntry[];
}