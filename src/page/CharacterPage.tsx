import { useState, useEffect } from "react";
import { User, Plus, Trash2, Edit3, Save, X, Upload } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { setCharacters, addCharacter, updateCharacter, deleteCharacter, selectCharacter } from "../store/characterSlice";
import { invoke } from "@tauri-apps/api/core";
import { Character } from "../type/character";
import { toast } from "sonner";

import { ask } from "@tauri-apps/plugin-dialog";

export default function CharacterPage() {
  const { characters, selectedId } = useSelector((state: RootState) => state.character);
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Character | null>(null);

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const data = await invoke<Character[]>("get_characters");
      if (data.length === 0) {
        // 如果没有角色，创建一个默认角色
        const defaultChar: Character = {
          id: 'default_char',
          name: '默认助手',
          description: '你是一个乐于助人、知识渊博的 AI 助手。',
          firstMes: '你好！我是你的 AI 助手，有什么我可以帮你的吗？',
          mesExample: '用户: 你好\n助手: 你好！很高兴见到你。有什么我可以帮你的吗？'
        };
        await invoke("save_character", { character: defaultChar });
        dispatch(setCharacters([defaultChar]));
      } else {
        dispatch(setCharacters(data));
      }
    } catch (err) {
      console.error("获取角色列表失败:", err);
      toast.error("获取角色列表失败");
    }
  };

  const selectedChar = characters.find(c => c.id === selectedId);

  const handleEdit = (char: Character) => {
    setEditForm({ ...char });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editForm) return;
    try {
      await invoke("save_character", { character: editForm });
      dispatch(updateCharacter(editForm));
      setIsEditing(false);
      setEditForm(null);
      toast.success("角色保存成功");

      // 语义 RAG：保存后异步重建角色的 Faiss 索引（包括设定和示例）
      const textsToEmbed = [
        `角色名称: ${editForm.name}`,
        `角色设定: ${editForm.description}`,
        `对话示例: ${editForm.mesExample}`
      ].filter(t => t.length > 20); // 仅对有意义的长文本建立索引

      if (textsToEmbed.length > 0) {
        invoke("rebuild_index", { 
          indexId: `char_${editForm.id}`, 
          texts: textsToEmbed 
        }).catch(err => console.error("重建角色索引失败:", err));
      }
    } catch (err) {
      console.error("保存角色失败:", err);
      toast.error("保存角色失败");
    }
  };

  const handleAddNew = async () => {
    const newChar: Character = {
      id: `char_${Date.now()}`,
      name: '新角色',
      description: '',
      firstMes: '',
      mesExample: ''
    };
    try {
      await invoke("save_character", { character: newChar });
      dispatch(addCharacter(newChar));
      dispatch(selectCharacter(newChar.id));
      handleEdit(newChar);
    } catch (err) {
      console.error("创建角色失败:", err);
      toast.error("创建角色失败");
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'default_char') {
      toast.error("默认角色卡不能被删除");
      return;
    }

    const confirmed = await ask("确定要删除这个角色吗？", {
      title: "确认删除",
      kind: "warning",
    });

    if (!confirmed) return;

    try {
      await invoke("delete_character", { id });
      dispatch(deleteCharacter(id));
      toast.success("角色已删除");
    } catch (err) {
      console.error("删除角色失败:", err);
      toast.error("删除角色失败");
    }
  };

  return (
    <div className="flex h-screen bg-base-100 overflow-hidden">
      {/* 角色列表 */}
      <div className="w-80 bg-base-200 border-r border-base-300 flex flex-col">
        <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-200 sticky top-0 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            角色卡
          </h2>
          <button 
            className="btn btn-primary btn-sm btn-circle"
            onClick={handleAddNew}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {characters.map(char => (
            <div 
              key={char.id}
              onClick={() => dispatch(selectCharacter(char.id))}
              className={`p-3 rounded-xl cursor-pointer transition-all border ${
                selectedId === char.id 
                  ? 'bg-primary/10 border-primary shadow-sm' 
                  : 'bg-base-100 border-transparent hover:border-base-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center text-base-content/50 overflow-hidden border border-base-300">
                  {char.avatar ? <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{char.name}</h3>
                  <p className="text-xs opacity-60 truncate">{char.description || '暂无描述'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 角色详情 / 编辑区域 */}
      <div className="flex-1 flex flex-col bg-base-100 overflow-hidden">
        {selectedId ? (
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center text-base-content/50 overflow-hidden border border-base-300 shadow-sm">
                  {selectedChar?.avatar ? <img src={selectedChar.avatar} alt={selectedChar.name} className="w-full h-full object-cover" /> : <User className="w-8 h-8" />}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{selectedChar?.name}</h1>
                  <div className="badge badge-ghost badge-sm font-mono mt-1 opacity-50">ID: {selectedChar?.id}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <>
                    <button className="btn btn-outline btn-sm gap-2" onClick={() => handleEdit(selectedChar!)}>
                      <Edit3 className="w-4 h-4" />
                      编辑
                    </button>
                    <button className="btn btn-ghost btn-sm text-error gap-2" onClick={() => handleDelete(selectedId)}>
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-primary btn-sm gap-2" onClick={handleSave}>
                      <Save className="w-4 h-4" />
                      保存
                    </button>
                    <button className="btn btn-ghost btn-sm gap-2" onClick={() => setIsEditing(false)}>
                      <X className="w-4 h-4" />
                      取消
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
              {isEditing ? (
                <div className="max-w-4xl space-y-6">
                  <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
                    <legend className="fieldset-legend text-base font-bold">基本信息</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                      <div className="form-control w-full">
                        <label className="label py-1">
                          <span className="label-text font-bold opacity-70">角色名称</span>
                        </label>
                        <input 
                          type="text" 
                          className="input input-bordered w-full"
                          value={editForm?.name}
                          onChange={e => setEditForm(prev => ({ ...prev!, name: e.target.value }))}
                        />
                      </div>
                      <div className="form-control w-full">
                        <label className="label py-1">
                          <span className="label-text font-bold opacity-70">头像上传</span>
                        </label>
                        <button className="btn btn-outline btn-block gap-2 border-dashed border-2">
                          <Upload className="w-4 h-4" />
                          选择图片
                        </button>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
                    <legend className="fieldset-legend text-base font-bold">角色设定 (Description)</legend>
                    <textarea 
                      className="textarea textarea-bordered h-48 w-full leading-relaxed"
                      value={editForm?.description}
                      onChange={e => setEditForm(prev => ({ ...prev!, description: e.target.value }))}
                      placeholder="详细描述角色的性格、外貌、背景等..."
                    ></textarea>
                  </fieldset>

                  <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
                    <legend className="fieldset-legend text-base font-bold">开场白 (First Message)</legend>
                    <textarea 
                      className="textarea textarea-bordered h-32 w-full"
                      value={editForm?.firstMes}
                      onChange={e => setEditForm(prev => ({ ...prev!, firstMes: e.target.value }))}
                      placeholder="会话开始时角色的第一句话..."
                    ></textarea>
                  </fieldset>

                  <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
                    <legend className="fieldset-legend text-base font-bold">对话示例 (Message Examples)</legend>
                    <textarea 
                      className="textarea textarea-bordered h-64 font-mono text-sm w-full"
                      value={editForm?.mesExample}
                      onChange={e => setEditForm(prev => ({ ...prev!, mesExample: e.target.value }))}
                      placeholder="用户: 你好&#10;角色: 你好，我是..."
                    ></textarea>
                  </fieldset>
                </div>
              ) : (
                <div className="max-w-4xl space-y-6">
                  <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
                    <legend className="fieldset-legend text-base font-bold text-primary">角色描述</legend>
                    <div className="whitespace-pre-wrap leading-relaxed opacity-80">
                      {selectedChar?.description || <span className="italic opacity-40">暂无描述</span>}
                    </div>
                  </fieldset>

                  <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
                    <legend className="fieldset-legend text-base font-bold text-secondary">开场白</legend>
                    <div className="whitespace-pre-wrap italic opacity-80">
                      {selectedChar?.firstMes || <span className="italic opacity-40">暂无内容</span>}
                    </div>
                  </fieldset>

                  <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
                    <legend className="fieldset-legend text-base font-bold text-accent">对话示例</legend>
                    <div className="bg-base-300 p-4 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap opacity-80">
                      {selectedChar?.mesExample || <span className="italic opacity-40">暂无示例</span>}
                    </div>
                  </fieldset>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4">
            <div className="w-24 h-24 rounded-full bg-base-200 flex items-center justify-center border border-base-300 shadow-sm">
              <User className="w-12 h-12" />
            </div>
            <p className="font-medium">请从左侧选择一个角色或创建一个新角色</p>
            <button className="btn btn-primary btn-sm px-6" onClick={handleAddNew}>立即创建</button>
          </div>
        )}
      </div>
    </div>
  );
}