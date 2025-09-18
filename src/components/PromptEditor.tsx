import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { updateSystemPrompt } from "../store/chatSlice";


export default function PromptEditor(){
    const dispatch = useDispatch();
    const systemPrompt = useSelector(
        (state: RootState) => state.chat.systemPrompt
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        dispatch(updateSystemPrompt(e.target.value));
    };


    return (
        <fieldset className="fieldset">
        <legend className="fieldset-legend">系统提示词</legend>
        <textarea
            className="textarea h-24"
            placeholder="例：说话只能押韵"
            value={systemPrompt}
            onChange={handleChange}
        />
        <div className="label">可选</div>
        </fieldset>
    );
}