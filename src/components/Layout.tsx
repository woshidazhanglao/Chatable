import { Outlet } from "react-router-dom";
import Menu from "./Menu";
import { Toaster } from "./ui/sonner"

export default function Layout() {
  return (
    <div className="flex">
      <Menu />
      <div className="flex-1">
        <Toaster />
        <Outlet /> 
      </div>
    </div>
  );
}
