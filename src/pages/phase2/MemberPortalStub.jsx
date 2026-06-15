// ============================================================================
// PHASE 2 STUB — Member self-service portal.
//
// Architected, NOT built. This route exists so the structure and role guard
// are ready; no member-facing feature is implemented or exposed. See ROADMAP.md.
//
// Planned scope (Phase 2):
//   - Member login linked via members.linkedAuthUid
//   - View own current loans and full borrowing history
//   - See number of books currently held
//   - Search the catalogue
//   - Submit a loan request ("apply for loan") -> Librarian approves -> loan
// ============================================================================

import { Link } from 'react-router-dom';
import { FIRM_NAME, FIRM_SUBLINE } from '../../lib/constants';

export default function MemberPortalStub() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>{FIRM_NAME}</h1>
        <div className="sub">{FIRM_SUBLINE}</div>
        <h2>Member portal</h2>
        <p className="muted text-small">
          The member self-service portal is planned for Phase 2 and is not yet
          available. Members do not currently hold accounts; the Librarian
          maintains all member records and loans.
        </p>
        <Link to="/" className="btn mt-2">Return to console</Link>
      </div>
    </div>
  );
}
