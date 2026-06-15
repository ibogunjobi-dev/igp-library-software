// Masthead shown on every page — firm name and sub-line, plus signed-in user.
import { FIRM_NAME, FIRM_SUBLINE } from '../lib/constants';
import { useAuth } from '../context/AuthContext';

export default function Masthead() {
  const { user, signOut } = useAuth();
  return (
    <header className="masthead">
      {/* Firm crest mark (two gold discs from the logo). */}
      <img className="masthead__logo" src="/logo-crest.svg" alt="Izy Global Partners LLP crest" />
      <div className="masthead__titles">
        <span className="masthead__firm">{FIRM_NAME}</span>
        <span className="masthead__sub">{FIRM_SUBLINE}</span>
      </div>
      <div className="masthead__spacer" />
      {user && (
        <div className="masthead__user">
          <div>{user.email}</div>
          <button className="btn btn--ghost btn--sm" onClick={signOut} style={{ marginTop: 4 }}>
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
