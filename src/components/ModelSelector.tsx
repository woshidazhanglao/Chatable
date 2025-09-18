"use client"
import { useSelector, useDispatch } from "react-redux";
import { useState } from "react";
import { RootState } from "../store/store";
import { selectFile, setHasLoaded } from "../store/modelSlice";
import axios from "axios";
import { toast } from "sonner"

export default function ModelSelector() {
  const files = useSelector((state: RootState) => state.model.files);
  const folder = useSelector((state: RootState) => state.model.folder);
  const selected = useSelector((state: RootState) => state.model.selected);
  const [loading, setLoading] = useState(false);

  const [hasSelect,setHasSelect] = useState(false);

  const dispatch = useDispatch();

  const loadModel=async ()=>{
    setLoading(true)
    try {
      const filePath=folder+'/'+selected?.name
      const res = await axios.post("http://localhost:8000/load_model", null, {
        params: { path: filePath },
      });
      dispatch(setHasLoaded(true))
      toast(res.data.message)
    } catch (err) {
      console.error(err);
      toast("加载模型失败")
    }
    finally{
        setLoading(false)
    }
  }


  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">模型</legend>
      <div className="flex items-center gap-2">
      <select
        defaultValue="Pick a browser"
        value={selected?.name || ""}
        onChange={(e) => {
          setHasSelect(true)
          const file = files.find((f) => f.name === e.target.value);
          if (file) dispatch(selectFile(file));
        }}
        className="select"
      >
        <option value="" disabled={true}>请选择模型</option>
        {files.map((f, i) => (
          <option key={i} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>
      {!loading?(<button className="btn btn-soft w-18"
      onClick={loadModel}
      disabled={!hasSelect}>载入</button>):
      (<span className="loading loading-infinity loading-xs w-16"></span>)}
      </div>
    </fieldset>
  );
}
