// Primary navigation. Phase 2 destinations are intentionally NOT linked here.
import { NavLink } from 'react-router-dom';

const NAV = [
  {
    label: 'Library',
    links: [
      { to: '/', end: true, text: 'Dashboard' },
      { to: '/catalogue', text: 'Catalogue' },
      { to: '/search', text: 'Search & filter' },
      { to: '/law-reports', text: 'Law reports' },
    ],
  },
  {
    label: 'Circulation',
    links: [
      { to: '/members', text: 'Members' },
      { to: '/loans', text: 'Loans' },
    ],
  },
  {
    label: 'Administration',
    links: [
      { to: '/import', text: 'Import holdings' },
      { to: '/reports', text: 'Reports' },
      { to: '/settings', text: 'Settings' },
    ],
  },
];

export default function Sidebar({ open, onNavigate }) {
  return (
    <nav className={`sidebar${open ? ' sidebar--open' : ''}`}>
      {NAV.map((group) => (
        <div key={group.label}>
          <div className="sidebar__group-label">{group.label}</div>
          {group.links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {l.text}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
