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
import AuthConfirm from "./pages/AuthConfirm";
import Profile from "./pages/Profile";
import PublishedRacing from "./pages/PublishedRacing";

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
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Login />} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      <Route element={<Layout />}>
        <Route
          path="/dashboard"
          element={user.role === "superadmin" ? <Dashboard /> : <Profile />}
        />
        <Route path="/account" element={<Profile />} />
        <Route
          path="/messages"
          element={
            user.role === "superadmin" ? (
              <Messages />
            ) : (
              <Navigate to="/account" replace />
            )
          }
        />
        <Route
          path="/inventory"
          element={
            user.role === "superadmin" ? (
              <Inventory />
            ) : (
              <Navigate to="/account" replace />
            )
          }
        />
        <Route
          path="/tracker"
          element={
            user.role === "superadmin" ? (
              <HorseTracker />
            ) : (
              <Navigate to="/account" replace />
            )
          }
        />
        <Route
          path="/entries"
          element={
            user.role === "superadmin" ? (
              <Entries />
            ) : (
              <PublishedRacing title="Racecards" kinds={["racecards"]} />
            )
          }
        />
        <Route
          path="/results"
          element={
            user.role === "superadmin" ? (
              <Results />
            ) : (
              <PublishedRacing title="Results" kinds={["results"]} />
            )
          }
        />
        <Route
          path="/workouts"
          element={
            user.role === "superadmin" ? (
              <Workouts />
            ) : (
              <PublishedRacing title="Workouts" kinds={["workouts"]} />
            )
          }
        />
        <Route
          path="/speed-figures"
          element={
            user.role === "superadmin" ? (
              <SpeedFigures />
            ) : (
              <PublishedRacing title="Speed figures" kinds={["horses"]} />
            )
          }
        />
        <Route
          path="/statistics"
          element={
            user.role === "superadmin" ? (
              <Statistics />
            ) : (
              <PublishedRacing
                title="Statistics"
                kinds={["horses", "jockeys", "trainers"]}
              />
            )
          }
        />
        <Route
          path="/stakes"
          element={
            user.role === "superadmin" ? (
              <Stakes />
            ) : (
              <PublishedRacing title="Stakes" kinds={["stakes"]} />
            )
          }
        />
        <Route
          path="/virtual-stable"
          element={
            user.role === "superadmin" ? (
              <VirtualStable />
            ) : (
              <Navigate to="/account" replace />
            )
          }
        />
        <Route
          path="/betting"
          element={
            user.role === "superadmin" ? (
              <Betting />
            ) : (
              <Navigate to="/account" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
