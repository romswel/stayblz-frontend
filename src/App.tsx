import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { canonicalPPPath } from "./components/pps/legacyRoutes";
import { isPPDestination } from "./components/pps/catalog";
import { useAuth } from "./auth";
import { CartProvider } from "./components/pps/CartContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
// Stayblz Chat is its own download, so the rest of the site stays light.
const Messages = lazy(() => import("./pages/Messages"));
const chatLoading = <p className="ws-loading" role="status" style={{ padding: 24 }}>Opening chat…</p>;
// Stayblz Paddock (video meetings) is its own download too.
const Paddock = lazy(() => import("./pages/Paddock"));
const GuestPaddock = lazy(() => import("./pages/Paddock").then((m) => ({ default: m.GuestPaddock })));
const paddockLoading = <p className="ws-loading" role="status" style={{ padding: 24 }}>Opening Stayblz Paddock…</p>;
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
import Marketplace from "./pages/Marketplace";
import StayblzTV from "./pages/StayblzTV";
import Subscription from "./pages/Subscription";
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
import RaceDays from "./pages/racing/RaceDays";
import RaceDayPage from "./pages/racing/RaceDayPage";
import RacePage from "./pages/racing/RacePage";
import { HorsePage, PersonPage } from "./pages/racing/ProfilePages";
import { LeadersPage, StakesPage, WorkoutsPage } from "./pages/racing/ListPages";
import RacingAdmin from "./pages/admin/RacingAdmin";
import RaceDayEditor from "./pages/admin/RaceDayEditor";
import AccountSecurity from "./pages/account/AccountSecurity";
import AccountPreferences from "./pages/account/AccountPreferences";
// Stayblz Community: Feeds, member profiles, horse profiles, and the member's own horses.
import Feeds from "./pages/Feeds";
import MemberProfile from "./pages/MemberProfile";
import HorseProfile from "./pages/HorseProfile";
import CommunityPost from "./pages/CommunityPost";
import MyHorses from "./pages/MyHorses";
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

/** Old "Manage Updates" links keep working. */
function OldUpdatesAdminLink() {
  const { id = "" } = useParams();
  return <Navigate to={`/updates/manage/${id}`} replace />;
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
        <Route path="/legal" element={<Legal kind="all" />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/updates/:slug" element={<UpdatePost />} />
        <Route path="/updates/manage/*" element={<Navigate to="/login" replace />} />
        <Route path="/bulletin" element={<Navigate to="/updates" replace />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/auth/not-me" element={<NotMe />} />
        <Route path="/pps/*" element={<PPLoginRedirect />} />
        {/* Meeting links work for guests: they ask to join with a name. */}
        <Route
          path="/paddock/:code"
          element={
            <Suspense fallback={paddockLoading}>
              <GuestPaddock />
            </Suspense>
          }
        />
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
      <Route path="/legal" element={<Legal kind="all" />} />
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
        <Route path="/account/horses" element={<MyHorses />} />
        <Route path="/community" element={<Feeds />} />
        <Route path="/community/people/:id" element={<MemberProfile />} />
        <Route path="/community/horses/:id" element={<HorseProfile />} />
        <Route path="/community/posts/:id" element={<CommunityPost />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/updates/:slug" element={<UpdatePost />} />
        {/* Admin tools for posts live inside Updates (one menu entry). The API checks the role again. */}
        <Route
          path="/updates/manage"
          element={canUse(user, "admin") ? <UpdatesAdmin /> : <StatusPage kind="not-found" />}
        />
        <Route
          path="/updates/manage/:id"
          element={canUse(user, "admin") ? <UpdatesAdmin /> : <StatusPage kind="not-found" />}
        />
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
        <Route
          path="/messages/:chatId?"
          element={
            <Suspense fallback={chatLoading}>
              <Messages />
            </Suspense>
          }
        />
        <Route
          path="/team-messages/:chatId?"
          element={
            <StableGate>
              <Suspense fallback={chatLoading}>
                <Messages mode="team" />
              </Suspense>
            </StableGate>
          }
        />
        <Route
          path="/paddock/:code?"
          element={
            <Suspense fallback={paddockLoading}>
              <Paddock />
            </Suspense>
          }
        />
        <Route path="/my-racing" element={<MyRacing />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/tv" element={<StayblzTV />} />
        <Route path="/subscription" element={<Subscription />} />
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
        <Route path="/entries" element={<RaceDays mode="entries" />} />
        <Route path="/results" element={<RaceDays mode="results" />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/stakes" element={<StakesPage />} />
        <Route path="/statistics" element={<LeadersPage />} />
        <Route
          path="/speed-figures"
          element={
            <StatusPage
              kind="unavailable"
              title="Speed figures aren't available yet"
              message="Stayblz doesn't publish its own speed figures yet. Official results, charts and leaders are available now."
              actions={
                <Link className="btn btn-primary status-primary" to="/results">
                  See results
                </Link>
              }
            />
          }
        />
        <Route path="/racing/days/:id" element={<RaceDayPage />} />
        <Route path="/racing/races/:id" element={<RacePage />} />
        <Route path="/racing/horses/:id" element={<HorsePage />} />
        <Route path="/racing/people/:id" element={<PersonPage />} />
        <Route
          path="/virtual-stable"
          element={<Navigate to="/my-racing" replace />}
        />
        <Route path="/stables" element={<Stables />} />
        {canUse(user, "admin") && (
          <>
            <Route path="/admin/updates" element={<Navigate to="/updates/manage" replace />} />
            <Route path="/admin/updates/:id" element={<OldUpdatesAdminLink />} />
            <Route path="/admin/racing" element={<RacingAdmin />} />
            <Route path="/admin/racing/days/:id" element={<RaceDayEditor />} />
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