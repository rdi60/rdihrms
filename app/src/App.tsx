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
import { AdminStaff } from './pages/AdminStaff';
import { AddStaff } from './pages/AddStaff';
import { StaffLeaveBalances } from './pages/StaffLeaveBalances';
import { BulkAddStaff } from './pages/BulkAddStaff';
import { BulkLeaveBalances } from './pages/BulkLeaveBalances';
import { BulkHolidays } from './pages/BulkHolidays';
import { BulkStaffDates } from './pages/BulkStaffDates';
import { BulkStaffPhotos } from './pages/BulkStaffPhotos';
import { PayrollReport } from './pages/PayrollReport';
import { PunchReport } from './pages/PunchReport';
import { ChangePassword } from './pages/ChangePassword';

function ManagerRoute({ children }: { children: ReactElement }) {
  const { profile } = useAuth();
  const allowed = profile?.role === 'manager' || profile?.role === 'admin';
  return allowed ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }: { children: ReactElement }) {
  const { profile } = useAuth();
  return profile?.role === 'admin' ? children : <Navigate to="/" replace />;
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
            <AdminRoute>
              <Departments />
            </AdminRoute>
          }
        />
        <Route
          path="profile/departments/:id"
          element={
            <AdminRoute>
              <DepartmentDetail />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff"
          element={
            <AdminRoute>
              <AdminStaff />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff/new"
          element={
            <AdminRoute>
              <AddStaff />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff/:id/balances"
          element={
            <AdminRoute>
              <StaffLeaveBalances />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff/bulk"
          element={
            <AdminRoute>
              <BulkAddStaff />
            </AdminRoute>
          }
        />
        <Route
          path="profile/leave-balances/bulk"
          element={
            <AdminRoute>
              <BulkLeaveBalances />
            </AdminRoute>
          }
        />
        <Route
          path="profile/holidays/bulk"
          element={
            <AdminRoute>
              <BulkHolidays />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff-dates/bulk"
          element={
            <AdminRoute>
              <BulkStaffDates />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff-photos/bulk"
          element={
            <AdminRoute>
              <BulkStaffPhotos />
            </AdminRoute>
          }
        />
        <Route
          path="profile/payroll-report"
          element={
            <AdminRoute>
              <PayrollReport />
            </AdminRoute>
          }
        />
        <Route
          path="profile/punch-report"
          element={
            <AdminRoute>
              <PunchReport />
            </AdminRoute>
          }
        />
        <Route path="profile/change-password" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
