import { useState,useEffect,useRef  } from "react";
import"../App.css"
import { useDispatch,useSelector } from "react-redux";
import { setFolder } from "../store/modelSlice";
import { RootState } from "../store/store";
import { toast } from "sonner"
import { loadFilesUtils } from "../utils/model";

const DEFAULT_FOLDER = "F:/lm-STUDIO/publisher/model";

export default function ModelPage() {
  const folder = useSelector((state: RootState) => state.model.folder);
  const files = useSelector((state: RootState) => state.model.files);

  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFolder(e.target.value));
  };

  useEffect(() => {
    loadFiles(folder);
  }, []);

  useEffect(() => {
    if (folder) {
      loadFiles(folder);
    }
  }, [folder]);

  const loadFiles = async (path: string) => {
    if (!path) return;
    setLoading(true);
    loadFilesUtils(path,dispatch);
    setLoading(false);
  };

  const handleSelectFolder = async () => {
    
  };

  const handleResetFolder = () => {
    dispatch(setFolder(DEFAULT_FOLDER));
  };

    // 刷新当前路径
  const handleRefresh = () => {
    if (folder) {
      loadFiles(folder);
    }
  };


  return (
    <div className="p-4 ">
      <label className="input">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/><path d="M13 3v6h6"/></svg>
        <input
          type="text"
          placeholder="请输入文件夹路径"
          value={folder}
          onChange={handleFolderChange}
          className="grow "
          disabled
        />

        <div className="dropdown dropdown-hover">
        <div tabIndex={0} role="button" className="btn btn-sm btn-ghost text-gray-700">...</div>
        <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
            <li onClick={()=>{
                handleSelectFolder()
            }}><a>更改路径</a></li>
            <li onClick={()=>{
                handleResetFolder()
            }}><a>恢复默认路径</a></li>
            <li onClick={()=>{
                handleRefresh()
            }}><a>刷新</a></li>
        </ul>
        </div>
      </label>
        <div className="overflow-x-auto">
        <table className="table">
            <thead>
            <tr>
                <th>Name</th>
                <th>Arch</th>
                <th>Params</th>
                <th>Size</th>
                <th>Quant</th>
                <th>Date Modified</th>
            </tr>
            </thead>
            <tbody>
            {files.length === 0&&!loading ? (
                <tr>
                <td colSpan={6} className="text-center">
                    暂无文件
                </td>
                </tr>
            ) : (
                files.map((f, idx) => (
                <tr key={idx} className="border-b hover:bg-base-300">
                    <td>{f.name}</td>
                    <td>{f.arch}</td>
                    <td>{f.params}</td>
                    <td>{f.size}</td>
                    <td>{f.quant}</td>
                    <td>{f.modified}</td>
                </tr>
                ))
            )}
            </tbody>
        </table>
        </div>

        {loading?(<div className="skeleton h-64 w-full"></div>):<p></p>}
    </div>
  );
}
