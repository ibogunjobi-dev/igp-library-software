// ============================================================================
// PHASE 2 STUB — Founder/Chairman (FC) read-only dashboard.
//
// Architected, NOT built. Route and role guard are ready for ROLES.FC; no
// FC-facing view is implemented or exposed. See ROADMAP.md.
//
// Planned scope (Phase 2):
//   - Read-only dashboards and reports
//   - Catalogue search and holdings status
//   - No editing of any record
//
// Firm policy note: textbook-selection authority is reserved to the FC. This is
// a matter of firm policy; no system enforcement is required in Phase 1.
// ============================================================================

import { Link } from 'react-router-dom';
import { FIRM_NAME, FIRM_SUBLINE } from '../../lib/constants';

export default function FcDashboardStub() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>{FIRM_NAME}</h1>
        <div className="sub">{FIRM_SUBLINE}</div>
        <h2>Founder/Chairman dashboard</h2>
        <p className="muted text-small">
          The read-only Founder/Chairman dashboard is planned for Phase 2 and is
          not yet available.
        </p>
        <Link to="/" className="btn mt-2">Return to console</Link>
      </div>
    </div>
  );
}
