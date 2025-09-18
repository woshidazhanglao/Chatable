import { createBrowserRouter } from "react-router-dom";
import ChatPage from "../page/ChatPage";
import Home from "../page/Home"; 
import Layout from "../components/Layout";
import SettingPage from "../page/SettingPage";
import ModelPage from "../page/ModelPage";


const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />, // 整个布局
    children: [
      { index: true, element: <Home/> },       
      { path: "ChatPage", element: <ChatPage /> } ,
      { path: "SettingPage", element:<SettingPage />},
      { path: "ModelPage", element:<ModelPage/>}
    ]
  }
]);
 
export default router
