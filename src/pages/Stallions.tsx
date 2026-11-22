import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import PublicHeader from "../components/PublicHeader";
import StatusPage from "../components/status/StatusPage";
import ComparePage from "../components/stallions/ComparePage";
import Directory from "../components/stallions/Directory";
import ManagePage from "../components/stallions/ManagePage";
import MaresPage from "../components/stallions/MaresPage";
import MatingPage from "../components/stallions/MatingPage";
import RequestsPage from "../components/stallions/RequestsPage";
import StallionForm from "../components/stallions/StallionForm";
import StallionPage from "../components/stallions/StallionPage";
import "./landing.css";
import "../components/stallions/stallions.css";

/** Signed-out visitors who open an owner's or breeder's page log in first, then come straight back. */
function LoginFirst() {
  const { pathname, search } = useLocation();
  return <Navigate to="/login" replace state={{ destination: `${pathname}${search}` }} />;
}

/**
 * Stayblz Stallions (lazy). Signed in: inside the app layout. Signed out (`standalone`): the directory, stallion pages,
 * compare and the mating check open with the public header, so owners can share their stallion's link anywhere.
 */
export default function Stallions({ standalone = false }: { standalone?: boolean }) {
  const { user } = useAuth();
  const signedIn = !!user;
  const routes = (
    <Routes>
      <Route index element={<Directory signedIn={signedIn} />} />
      <Route path="mating" element={<MatingPage signedIn={signedIn} />} />
      <Route path="compare" element={<ComparePage signedIn={signedIn} />} />
      <Route path="manage" element={signedIn ? <ManagePage /> : <LoginFirst />} />
      <Route path="manage/:id" element={signedIn ? <StallionForm /> : <LoginFirst />} />
      <Route path="requests" element={signedIn ? <RequestsPage /> : <LoginFirst />} />
      <Route path="mares" element={signedIn ? <MaresPage /> : <LoginFirst />} />
      <Route path=":id" element={<StallionPage signedIn={signedIn} />} />
      <Route path="*" element={<StatusPage kind="not-found" />} />
    </Routes>
  );
  if (!standalone) return <div className="st-root">{routes}</div>;
  return (
    <div className="landing gx-layer gx-public st-root st-public">
      <PublicHeader />
      <main id="st-main" className="st-public-main">
        {routes}
      </main>
    </div>
  );
}
