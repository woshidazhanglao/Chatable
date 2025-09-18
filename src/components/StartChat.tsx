import {  useSelector } from "react-redux";
import { RootState } from "../store/store";

interface StartChatProps {
  startQuestion: string;
  setStartQuestion: (val: string) => void;
  handleStartChat: () => void;
}

export default function StartChat({ startQuestion, setStartQuestion, handleStartChat }: StartChatProps) {
  const hasLoaded = useSelector(
        (state: RootState) => state.model.hasLoaded
    );
  return (
    <div className="flex  h-screen">
      {/* 侧边栏按钮 */}
      <div className="p-2 border-b flex mb-4">
        <label htmlFor="left-drawer" className="btn btn-sm btn-primary">
          会话列表
        </label>
      </div>

      <div className="flex flex-col flex-1 h-full w-full items-center justify-center">
        <input
        type="text"
        placeholder="输入你的问题，按回车开始聊天"
        className="input input-bordered w-96"
        value={startQuestion}
        onChange={(e) => setStartQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleStartChat();
        }}
      />

      <button
        className="btn btn-primary mt-4"
        disabled={!hasLoaded||!startQuestion.trim()}
        onClick={handleStartChat}
      >
        提问并开始聊天
      </button>
      </div>
    </div>
  );
}