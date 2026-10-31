import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Inventory from "./pages/Inventory";
import HorseTracker from "./pages/HorseTracker";
import Entries from "./pages/Entries";
import Results from "./pages/Results";
import Workouts from "./pages/Workouts";
import SpeedFigures from "./pages/SpeedFigures";
import Statistics from "./pages/Statistics";
import Stakes from "./pages/Stakes";
import VirtualStable from "./pages/VirtualStable";
import Betting from "./pages/Betting";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading Stayblz…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/tracker" element={<HorseTracker />} />
        <Route path="/entries" element={<Entries />} />
        <Route path="/results" element={<Results />} />
        <Route path="/workouts" element={<Workouts />} />
        <Route path="/speed-figures" element={<SpeedFigures />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/stakes" element={<Stakes />} />
        <Route path="/virtual-stable" element={<VirtualStable />} />
        <Route path="/betting" element={<Betting />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
