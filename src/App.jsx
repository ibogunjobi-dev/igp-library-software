// ============================================================================
// Route table.
//
// PHASE 1 routes are fully implemented behind the admin guard.
// PHASE 2 routes are STUBBED (mounted, but render a "not yet available" notice)
// so the structure exists without exposing any member/FC feature. The route
// paths and role-scoped guards are in place ready to switch on — see ROADMAP.md.
// ============================================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { ROLES } from './lib/constants';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CatalogueList from './pages/Catalogue/CatalogueList';
import BookForm from './pages/Catalogue/BookForm';
import BookDetail from './pages/Catalogue/BookDetail';
import SearchPage from './pages/Search';
import MemberList from './pages/Members/MemberList';
import MemberForm from './pages/Members/MemberForm';
import MemberDetail from './pages/Members/MemberDetail';
import LoanList from './pages/Loans/LoanList';
import IssueLoan from './pages/Loans/IssueLoan';
import ImportPage from './pages/Import/ImportPage';
import ReportsPage from './pages/Reports/ReportsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import NwlrPage from './pages/Nwlr/NwlrPage';
import LawReportsList from './pages/LawReports/LawReportsList';
import LawReportSeries from './pages/LawReports/LawReportSeries';

// Phase 2 stubs (architected, not built).
import MemberPortalStub from './pages/phase2/MemberPortalStub';
import FcDashboardStub from './pages/phase2/FcDashboardStub';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* --- Phase 1: Librarian (admin) console --- */}
      <Route
        element={
          <ProtectedRoute allow={[ROLES.ADMIN]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="catalogue" element={<CatalogueList />} />
        <Route path="catalogue/new" element={<BookForm />} />
        <Route path="catalogue/:id" element={<BookDetail />} />
        <Route path="catalogue/:id/edit" element={<BookForm />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="members" element={<MemberList />} />
        <Route path="members/new" element={<MemberForm />} />
        <Route path="members/:id" element={<MemberDetail />} />
        <Route path="members/:id/edit" element={<MemberForm />} />
        <Route path="loans" element={<LoanList />} />
        <Route path="loans/new" element={<IssueLoan />} />
        <Route path="law-reports" element={<LawReportsList />} />
        <Route path="law-reports/:id" element={<LawReportSeries />} />
        <Route path="nwlr" element={<NwlrPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* --- Phase 2 (STUBBED — do not enable features here yet) --- */}
      {/* Member self-service portal. Guard ready for ROLES.MEMBER. */}
      <Route
        path="/member/*"
        element={
          <ProtectedRoute allow={[ROLES.ADMIN]}>
            <MemberPortalStub />
          </ProtectedRoute>
        }
      />
      {/* Founder/Chairman read-only dashboard. Guard ready for ROLES.FC. */}
      <Route
        path="/fc/*"
        element={
          <ProtectedRoute allow={[ROLES.ADMIN]}>
            <FcDashboardStub />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
