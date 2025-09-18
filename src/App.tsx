import { RouterProvider } from "react-router-dom"
import router from "./router"; 
import { store } from "./store/store";
import { Provider,useDispatch,useSelector  } from "react-redux";
import { RootState } from "./store/store";
import { useEffect } from "react";
import { loadFilesUtils } from "./utils/model";


function App() {
   const dispatch = useDispatch();
   const folder = useSelector((state: RootState) => state.model.folder);

     useEffect(() => {
    // 应用启动时加载模型列表
    loadFilesUtils(folder, dispatch);
  }, []);

  return (
      <RouterProvider router={router} />

  );
}

export default App;
