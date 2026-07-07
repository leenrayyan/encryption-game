import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import HostPage from "./pages/HostPage";
import ScreenPage from "./pages/ScreenPage";
import JoinPage from "./pages/JoinPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/host" element={<HostPage />} />
      <Route path="/screen" element={<ScreenPage />} />
      <Route path="/play" element={<JoinPage />} />
    </Routes>
  );
}
