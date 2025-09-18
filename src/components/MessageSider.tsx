import React from "react";

export default function MessageSider({ children, sidebar }: { children: React.ReactNode, sidebar: React.ReactNode }) {
  return (
    <div className="drawer drawer-start">
      {/* 控制开关 */}
      <input id="left-drawer" type="checkbox" className="drawer-toggle" />

      {/* 主体内容 */}
      <div className="drawer-content">
        {children}
      </div>

      {/* 左侧抽屉 */}
      <div className="drawer-side">
        <label htmlFor="left-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        <div className="bg-base-200 text-base-content min-h-full w-80 p-4">
          {sidebar}
        </div>
      </div>
    </div>
  );
}
