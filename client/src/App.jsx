import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Tutor from "./pages/Tutor";
import Quiz from "./pages/Quiz";
import Planner from "./pages/Planner";
import Progress from "./pages/Progress";
import Career from "./pages/Career";
import Assignments from "./pages/Assignments";
import Doubts from "./pages/Doubts";
import Settings from "./pages/Settings";

function Booting() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", gap: 14 }}>
      <span className="spinner" style={{ width: 26, height: 26, color: "var(--brand)" }} />
      <p className="muted" style={{ fontSize: 13 }}>Loading EduMind…</p>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Booting />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Booting />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="tutor" element={<Tutor />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="planner" element={<Planner />} />
        <Route path="progress" element={<Progress />} />
        <Route path="career" element={<Career />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="doubts" element={<Doubts />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
