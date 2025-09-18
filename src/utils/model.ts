import axios from "axios";
import { type GGUFFile } from "../type/model";
import { setFiles } from "../store/modelSlice";
import { AppDispatch } from "../store/store";
import { toast } from "sonner"

export const loadFilesUtils = async (path: string, dispatch: AppDispatch) => {
    try {
        if (!path) return;
        const res = await axios.get<GGUFFile[]>(
            `http://localhost:8000/ModelList`,
            { params: { folder: path } }
        );
        dispatch(setFiles(res.data));
    }
    catch (err) {
        console.error(err);
        toast("模型加载失败")
    }
};