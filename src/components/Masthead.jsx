// Masthead shown on every page — firm name and sub-line, plus signed-in user.
// On small screens a hamburger button toggles the sidebar drawer.
import { FIRM_NAME, FIRM_SUBLINE } from '../lib/constants';
import { useAuth } from '../context/AuthContext';

export default function Masthead({ onMenuToggle, menuOpen }) {
  const { user, signOut } = useAuth();
  return (
    <header className="masthead">
      {user && (
        <button
          type="button"
          className="masthead__menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={!!menuOpen}
          onClick={onMenuToggle}
        >
          <span className="masthead__menu-bars" />
        </button>
      )}
      {/* Firm crest mark — cropped directly from the firm logo for exact fidelity. */}
      <img className="masthead__logo" src="/logo-crest.png" alt="Izy Global Partners LLP crest" />
      <div className="masthead__titles">
        <span className="masthead__firm">{FIRM_NAME}</span>
        <span className="masthead__sub">{FIRM_SUBLINE}</span>
      </div>
      <div className="masthead__spacer" />
      {user && (
        <div className="masthead__user">
          <div className="masthead__email">{user.email}</div>
          <button className="btn btn--ghost btn--sm" onClick={signOut} style={{ marginTop: 4 }}>
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
