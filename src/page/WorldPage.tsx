import { useState, useEffect } from "react";
import { Globe, Plus, Trash2, Edit3, Save, X, Tag, BookOpen, Book } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { setWorldBooks, addWorldBook, updateWorldBook, deleteWorldBook, selectWorldBook } from "../store/worldSlice";
import { invoke } from "@tauri-apps/api/core";
import { WorldBook, WorldEntry } from "../type/world";
import { toast } from "sonner";
import { ask } from "@tauri-apps/plugin-dialog";

export default function WorldPage() {
  const { books, selectedId } = useSelector((state: RootState) => state.world);
  const dispatch = useDispatch();
  const [isEditingBook, setIsEditingBook] = useState(false);
  const [editBookName, setEditBookName] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<WorldEntry | null>(null);

  useEffect(() => {
    fetchWorldBooks();
  }, []);

  const fetchWorldBooks = async () => {
    try {
      const data = await invoke<WorldBook[]>("get_world_books");
      if (data.length === 0) {
        const defaultBook: WorldBook = {
          id: 'default_world_book',
          name: '默认世界书',
          entries: [
            {
              id: 'default_entry_1',
              keys: 'AI, 机器人',
              content: '在未来的世界中，AI 已经深入到人类生活的每一个角落。',
              enabled: true
            }
          ]
        };
        await invoke("save_world_book", { book: defaultBook });
        dispatch(setWorldBooks([defaultBook]));
      } else {
        dispatch(setWorldBooks(data));
      }
    } catch (err) {
      console.error("获取世界书失败:", err);
    }
  };

  const selectedBook = books.find(b => b.id === selectedId);

  const handleSaveBook = async (book: WorldBook) => {
    try {
      await invoke("save_world_book", { book });
      dispatch(updateWorldBook(book));
      
      // 语义 RAG：保存后异步重建该世界书的 Faiss 索引
      const textsToEmbed = book.entries
        .filter(e => e.enabled && e.content.trim().length > 0)
        .map(e => `[${e.keys}] ${e.content}`);
      
      if (textsToEmbed.length > 0) {
        invoke("rebuild_index", { 
          indexId: `world_${book.id}`, 
          texts: textsToEmbed 
        }).catch(err => console.error("重建世界书索引失败:", err));
      }
    } catch (err) {
      toast.error("保存失败");
    }
  };

  const handleAddNewBook = async () => {
    const newBook: WorldBook = {
      id: `book_${Date.now()}`,
      name: '新世界书',
      entries: []
    };
    await invoke("save_world_book", { book: newBook });
    dispatch(addWorldBook(newBook));
    dispatch(selectWorldBook(newBook.id));
  };

  const handleDeleteBook = async (id: string) => {
    if (id === 'default_world_book') return toast.error("默认世界书不能删除");
    const confirmed = await ask("确定删除整本世界书吗？", { kind: 'warning' });
    if (confirmed) {
      await invoke("delete_world_book", { id });
      dispatch(deleteWorldBook(id));
    }
  };

  const handleAddEntry = () => {
    if (!selectedBook) return;
    const newEntry: WorldEntry = {
      id: `entry_${Date.now()}`,
      keys: "新关键词",
      content: "",
      enabled: true
    };
    const updatedBook = { ...selectedBook, entries: [...selectedBook.entries, newEntry] };
    handleSaveBook(updatedBook);
    setEditingEntryId(newEntry.id);
    setEntryForm(newEntry);
  };

  const handleSaveEntry = () => {
    if (!selectedBook || !entryForm) return;
    const updatedEntries = selectedBook.entries.map(e => e.id === entryForm.id ? entryForm : e);
    handleSaveBook({ ...selectedBook, entries: updatedEntries });
    setEditingEntryId(null);
    setEntryForm(null);
  };

  return (
    <div className="flex h-screen bg-base-100 overflow-hidden">
      {/* 左侧：书列表 */}
      <div className="w-64 bg-base-200 border-r border-base-300 flex flex-col">
        <div className="p-4 border-b border-base-300 flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2"><Globe className="w-4 h-4 text-secondary"/>世界书</h2>
          <button className="btn btn-ghost btn-xs btn-circle" onClick={handleAddNewBook}><Plus className="w-4 h-4"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {books.map(book => (
            <div 
              key={book.id} 
              onClick={() => dispatch(selectWorldBook(book.id))}
              className={`group p-3 rounded-lg cursor-pointer flex justify-between items-center transition-all ${selectedId === book.id ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'hover:bg-base-300'}`}
            >
              <div className="flex items-center gap-2 truncate">
                <Book className="w-4 h-4 opacity-50"/>
                <span className="font-medium truncate">{book.name}</span>
              </div>
              <button className="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs text-error" onClick={(e) => { e.stopPropagation(); handleDeleteBook(book.id); }}><Trash2 className="w-3 h-3"/></button>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：书内容（条目列表） */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedBook ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 书标题栏 */}
            <div className="p-6 border-b border-base-300 flex justify-between items-center">
              {isEditingBook ? (
                <div className="flex items-center gap-2">
                  <input className="input input-bordered input-sm" value={editBookName} onChange={e => setEditBookName(e.target.value)} />
                  <button className="btn btn-primary btn-sm" onClick={() => { handleSaveBook({...selectedBook, name: editBookName}); setIsEditingBook(false); }}><Save className="w-4 h-4"/></button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{selectedBook.name}</h1>
                  <button className="btn btn-ghost btn-xs" onClick={() => { setEditBookName(selectedBook.name); setIsEditingBook(true); }}><Edit3 className="w-3 h-3"/></button>
                </div>
              )}
              <button className="btn btn-secondary btn-sm gap-2" onClick={handleAddEntry}><Plus className="w-4 h-4"/>添加条目</button>
            </div>

            {/* 条目展示/编辑区 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {selectedBook.entries.map(entry => (
                <fieldset key={entry.id} className="fieldset bg-base-200 border-base-300 rounded-box border p-4 relative">
                  {editingEntryId === entry.id ? (
                    <div className="space-y-4 w-full">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="label py-0"><span className="label-text text-xs font-bold opacity-50">触发关键词</span></label>
                          <input className="input input-bordered input-sm w-full" value={entryForm?.keys} onChange={e => setEntryForm(prev => ({...prev!, keys: e.target.value}))} />
                        </div>
                        <div className="flex items-end gap-2">
                          <button className="btn btn-primary btn-sm" onClick={handleSaveEntry}><Save className="w-4 h-4"/>保存</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingEntryId(null)}><X className="w-4 h-4"/></button>
                        </div>
                      </div>
                      <div>
                        <label className="label py-0"><span className="label-text text-xs font-bold opacity-50">设定内容</span></label>
                        <textarea className="textarea textarea-bordered w-full h-32" value={entryForm?.content} onChange={e => setEntryForm(prev => ({...prev!, content: e.target.value}))} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <legend className="fieldset-legend flex items-center gap-2">
                        <span className="font-bold text-secondary">{entry.keys}</span>
                        <input type="checkbox" className="toggle toggle-secondary toggle-xs" checked={entry.enabled} onChange={() => handleSaveBook({...selectedBook, entries: selectedBook.entries.map(e => e.id === entry.id ? {...e, enabled: !e.enabled} : e)})} />
                      </legend>
                      <div className="flex justify-between items-start gap-4">
                        <p className="text-sm opacity-80 leading-relaxed flex-1">{entry.content || <span className="italic opacity-30">无内容</span>}</p>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-xs" onClick={() => { setEditingEntryId(entry.id); setEntryForm(entry); }}><Edit3 className="w-3 h-3"/></button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleSaveBook({...selectedBook, entries: selectedBook.entries.filter(e => e.id !== entry.id)})}><Trash2 className="w-3 h-3"/></button>
                        </div>
                      </div>
                    </>
                  )}
                </fieldset>
              ))}
              {selectedBook.entries.length === 0 && <div className="text-center py-20 opacity-20">点击上方按钮添加第一个设定条目</div>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20"><BookOpen className="w-20 h-20 mb-4"/><p className="text-xl font-bold">选择或创建一本世界书</p></div>
        )}
      </div>
    </div>
  );
}