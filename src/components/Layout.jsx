// Application shell: masthead + sidebar + routed content.
// The sidebar stays in view while content scrolls (sticky on desktop), and
// becomes a hamburger-triggered drawer on small screens.
import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Masthead from './Masthead';
import Sidebar from './Sidebar';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <>
      <Masthead onMenuToggle={() => setMenuOpen((o) => !o)} menuOpen={menuOpen} />
      <div className="shell">
        <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
        {menuOpen && <div className="sidebar-backdrop show" onClick={() => setMenuOpen(false)} />}
        <main className="content">
          <div className="content__inner">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
