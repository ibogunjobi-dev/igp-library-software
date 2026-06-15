// ============================================================================
// Route guard. Phase 1: requires an authenticated admin (the Librarian).
//
// The `allow` prop accepts a list of roles so that Phase 2 can mount fc /
// member areas behind the same guard without changes here. Defaults to admin.
// ============================================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../lib/constants';
import Spinner from './Spinner';

export default function ProtectedRoute({ children, allow = [ROLES.ADMIN] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <Spinner center />;
  if (!user) return <Navigate to="/login" replace />;

  // Authenticated but unauthorised (e.g. no role assigned yet).
  if (!allow.includes(role)) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Access restricted</h1>
          <p className="muted text-small">
            This account is not authorised for the Librarian console. Contact the
            system administrator to be granted the required role.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
