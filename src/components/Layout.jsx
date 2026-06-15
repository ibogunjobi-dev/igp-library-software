// Application shell: masthead + sidebar + routed content.
import { Outlet } from 'react-router-dom';
import Masthead from './Masthead';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <>
      <Masthead />
      <div className="shell">
        <Sidebar />
        <main className="content">
          <div className="content__inner">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
