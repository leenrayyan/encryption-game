import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import ScreenPage from "./pages/ScreenPage";
import JoinPage from "./pages/JoinPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* The screen IS the host now (it runs the game); /host redirects to it. */}
      <Route path="/host" element={<Navigate to="/screen" replace />} />
      <Route path="/screen" element={<ScreenPage />} />
      <Route path="/play" element={<JoinPage />} />
    </Routes>
  );
}
