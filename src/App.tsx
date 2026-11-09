import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { canonicalPPPath } from "./components/pps/legacyRoutes";
import { isPPDestination } from "./components/pps/catalog";
import { useAuth } from "./auth";
import { CartProvider } from "./components/pps/CartContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Inventory from "./pages/Inventory";
import HorseTracker from "./pages/HorseTracker";
import MyRacing from "./pages/MyRacing";
import StableWorkspace from "./pages/StableWorkspace";
import InvitationEntry from "./pages/InvitationEntry";
import AuthConfirm from "./pages/AuthConfirm";
import Profile from "./pages/Profile";
import PublishedRacing from "./pages/PublishedRacing";
import PastPerformances from "./pages/PastPerformances";
import StartupLoader from "./components/StartupLoader";
import FAQ from "./pages/FAQ";
import Stables from "./pages/Stables";
import Administration from "./pages/Administration";
import { WorkspaceProvider, StableGate } from "./workspace";
import MfaChallenge from "./components/account/MfaChallenge";
import { canUse } from "./components/account/roles";
import StatusPage from "./components/status/StatusPage";
import Legal from "./pages/Legal";
import NotMe from "./pages/NotMe";
import Updates from "./pages/Updates";
import UpdatePost from "./pages/UpdatePost";
import UpdatesAdmin from "./pages/admin/UpdatesAdmin";
import { UpdatesProvider } from "./components/updates/UpdatesContext";
import AccountSecurity from "./pages/account/AccountSecurity";
import AccountPreferences from "./pages/account/AccountPreferences";
import { isAppPath } from "./appPaths";
import { Link } from "react-router-dom";

function PPLoginRedirect() {
  const { pathname: oldPathname, search } = useLocation();
  const pathname = canonicalPPPath(oldPathname);
  return (
    <Navigate
      to="/login"
      replace
      state={{
        destination: isPPDestination(pathname + search)
          ? pathname + search
          : "/pps",
        intent: "view past performances",
      }}
    />
  );
}

/** Signed out: known app pages go to log in; anything else is a real "not found". */
function SignedOutFallback() {
  const { pathname } = useLocation();
  return isAppPath(pathname) ? (
    <Navigate to="/login" replace />
  ) : (
    <StatusPage kind="not-found" standalone />
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <StartupLoader />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="/stables" element={<InvitationEntry kind="stable" />} />
        <Route
          path="/messages"
          element={<InvitationEntry kind="conversation" />}
        />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/terms" element={<Legal kind="terms" />} />
        <Route path="/privacy" element={<Legal kind="privacy" />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/updates/:slug" element={<UpdatePost />} />
        <Route path="/bulletin" element={<Navigate to="/updates" replace />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/auth/not-me" element={<NotMe />} />
        <Route path="/pps/*" element={<PPLoginRedirect />} />
        <Route path="*" element={<SignedOutFallback />} />
      </Routes>
    );
  }

  // 2-step login is on and not yet passed: nothing else opens until the code is entered.
  if (user.mfaPending) return <MfaChallenge />;

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Login />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/terms" element={<Legal kind="terms" />} />
      <Route path="/privacy" element={<Legal kind="privacy" />} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      <Route path="/auth/not-me" element={<NotMe />} />
      <Route
        element={
          <WorkspaceProvider key={user.id}>
            <CartProvider key={user.id} accountId={user.id}>
              <UpdatesProvider>
                <Layout />
              </UpdatesProvider>
            </CartProvider>
          </WorkspaceProvider>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pps" element={<PastPerformances />} />
        <Route path="/pps/compare" element={<PastPerformances />} />
        <Route path="/pps/by-track" element={<PastPerformances />} />
        <Route path="/pps/day-passes" element={<PastPerformances />} />
        <Route path="/pps/store" element={<PastPerformances />} />
        <Route path="/pps/cart" element={<PastPerformances />} />
        <Route path="/pps/:productId" element={<PastPerformances />} />
        <Route path="/pps/:productId/:view" element={<PastPerformances />} />
        <Route path="/account" element={<Profile />} />
        <Route path="/account/security" element={<AccountSecurity />} />
        <Route path="/account/preferences" element={<AccountPreferences />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/updates/:slug" element={<UpdatePost />} />
        <Route path="/bulletin" element={<Navigate to="/updates" replace />} />
        <Route
          path="/racing-records/racecards"
          element={<PublishedRacing title="Racecards" kinds={["racecards"]} />}
        />
        <Route
          path="/racing-records/results"
          element={<PublishedRacing title="Results" kinds={["results"]} />}
        />
        <Route
          path="/racing-records/workouts"
          element={<PublishedRacing title="Workouts" kinds={["workouts"]} />}
        />
        <Route
          path="/racing-records/horses"
          element={<PublishedRacing title="Horses" kinds={["horses"]} />}
        />
        <Route
          path="/racing-records/jockeys"
          element={<PublishedRacing title="Jockeys" kinds={["jockeys"]} />}
        />
        <Route
          path="/racing-records/trainers"
          element={<PublishedRacing title="Trainers" kinds={["trainers"]} />}
        />
        <Route
          path="/racing-records/stakes"
          element={<PublishedRacing title="Stakes" kinds={["stakes"]} />}
        />
        <Route
          path="/racing-records/notes"
          element={<PublishedRacing title="Racing notes" kinds={["notes"]} />}
        />
        <Route path="/messages" element={<Messages />} />
        <Route
          path="/team-messages"
          element={
            <StableGate>
              <Messages mode="team" />
            </StableGate>
          }
        />
        <Route path="/my-racing" element={<MyRacing />} />
        <Route path="/workspace" element={<StableWorkspace />} />
        <Route
          path="/inventory"
          element={
            <StableGate>
              <Inventory />
            </StableGate>
          }
        />
        <Route
          path="/tracker"
          element={
            <StableGate>
              <HorseTracker />
            </StableGate>
          }
        />
        <Route
          path="/entries"
          element={<PublishedRacing title="Racecards" kinds={["racecards"]} />}
        />
        <Route
          path="/results"
          element={<PublishedRacing title="Results" kinds={["results"]} />}
        />
        <Route
          path="/workouts"
          element={<PublishedRacing title="Workouts" kinds={["workouts"]} />}
        />
        <Route
          path="/speed-figures"
          element={<PublishedRacing title="Speed figures" kinds={["horses"]} />}
        />
        <Route
          path="/statistics"
          element={
            <PublishedRacing
              title="Statistics"
              kinds={["horses", "jockeys", "trainers"]}
            />
          }
        />
        <Route
          path="/stakes"
          element={<PublishedRacing title="Stakes" kinds={["stakes"]} />}
        />
        <Route
          path="/virtual-stable"
          element={<Navigate to="/my-racing" replace />}
        />
        <Route path="/stables" element={<Stables />} />
        {canUse(user, "admin") && (
          <>
            <Route path="/admin/updates" element={<UpdatesAdmin />} />
            <Route path="/admin/updates/:id" element={<UpdatesAdmin />} />
          </>
        )}
        <Route
          path="/administration"
          element={
            canUse(user, "admin") ? (
              <Administration />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/betting"
          element={
            <StatusPage
              kind="unavailable"
              title="Wagering isn't available"
              message="Wagering, deposits and payments are not connected. No real-money bets can be placed on Stayblz."
              actions={
                <Link className="btn btn-primary status-primary" to="/entries">
                  Explore racecards
                </Link>
              }
            />
          }
        />
        <Route path="*" element={<StatusPage kind="not-found" />} />
      </Route>
    </Routes>
  );
}
