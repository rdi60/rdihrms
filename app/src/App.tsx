import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { History } from './pages/History';
import { Leave } from './pages/Leave';
import { Team } from './pages/Team';
import { Profile } from './pages/Profile';
import { Notifications } from './pages/Notifications';
import { PublicHolidays } from './pages/PublicHolidays';
import { WorkAnniversaries } from './pages/WorkAnniversaries';
import { Birthdays } from './pages/Birthdays';
import { Payslips } from './pages/Payslips';
import { Departments } from './pages/Departments';
import { DepartmentDetail } from './pages/DepartmentDetail';

function ManagerRoute({ children }: { children: ReactElement }) {
  const { profile } = useAuth();
  return profile?.role === 'manager' ? children : <Navigate to="/" replace />;
}

export function App() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="history" element={<History />} />
        <Route path="leave" element={<Leave />} />
        <Route
          path="team"
          element={
            <ManagerRoute>
              <Team />
            </ManagerRoute>
          }
        />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile/holidays" element={<PublicHolidays />} />
        <Route path="profile/anniversaries" element={<WorkAnniversaries />} />
        <Route path="profile/birthdays" element={<Birthdays />} />
        <Route path="profile/payslips" element={<Payslips />} />
        <Route
          path="profile/departments"
          element={
            <ManagerRoute>
              <Departments />
            </ManagerRoute>
          }
        />
        <Route
          path="profile/departments/:id"
          element={
            <ManagerRoute>
              <DepartmentDetail />
            </ManagerRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
