import { RouterProvider } from "react-router-dom"
import router from "./router"; 
import { store } from "./store/store";
import { Provider,useDispatch,useSelector  } from "react-redux";
import { RootState } from "./store/store";
import { useEffect } from "react";
import { loadFilesUtils } from "./utils/model";
import { invoke } from "@tauri-apps/api/core";
import { setCharacters } from "./store/characterSlice";
import { setWorldBooks } from "./store/worldSlice";
import { Character } from "./type/character";
import { WorldBook } from "./type/world";


function App() {
   const dispatch = useDispatch();
   const folder = useSelector((state: RootState) => state.model.folder);

     useEffect(() => {
    // 应用启动时加载模型列表
    loadFilesUtils(folder, dispatch);
    
    // 加载角色卡和世界书
    loadCharacters();
    loadWorldBooks();
  }, []);

  const loadCharacters = async () => {
    try {
      const chars = await invoke<Character[]>("get_characters");
      dispatch(setCharacters(chars));
    } catch (err) {
      console.error("加载角色失败:", err);
    }
  };

  const loadWorldBooks = async () => {
    try {
      const books = await invoke<WorldBook[]>("get_world_books");
      dispatch(setWorldBooks(books));
    } catch (err) {
      console.error("加载世界书失败:", err);
    }
  };

  return (
      <RouterProvider router={router} />

  );
}

export default App;
