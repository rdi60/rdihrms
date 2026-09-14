import { Outlet, useLocation } from 'react-router-dom';
import { TabBar } from './TabBar';

const TOP_LEVEL = ['/', '/history', '/leave', '/team', '/profile'];

export function AppShell() {
  const location = useLocation();
  const showTabBar = TOP_LEVEL.includes(location.pathname);

  return (
    <div className="app-viewport">
      <div className="app-shell">
        <div className="app-watermark" aria-hidden="true">
          <img src="/logo.png" alt="" />
        </div>
        <div className="app-scroll">
          <div className="app-page">
            <Outlet />
          </div>
        </div>
        {showTabBar && <TabBar />}
      </div>
    </div>
  );
}
