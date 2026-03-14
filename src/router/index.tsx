import { createBrowserRouter } from "react-router-dom";
import ChatPage from "../page/ChatPage";
import Home from "../page/Home"; 
import Layout from "../components/Layout";
import SettingPage from "../page/SettingPage";
import ModelPage from "../page/ModelPage";
import WorldPage from "../page/WorldPage";
import CharacterPage from "../page/CharacterPage";
import ArenaPage from "../page/ArenaPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />, // 整个布局
    children: [
      { index: true, element: <Home/> },       
      { path: "ChatPage", element: <ChatPage /> } ,
      { path: "CharacterPage", element: <CharacterPage /> } ,
      { path: "WorldPage", element: <WorldPage /> } ,
      { path: "ArenaPage", element: <ArenaPage /> } ,
      { path: "SettingPage", element:<SettingPage />},
      { path: "ModelPage", element:<ModelPage/>}
    ]
  }
]);
 
export default router
