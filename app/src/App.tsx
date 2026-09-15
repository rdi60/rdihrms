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
import { MarkWeeklyOff } from './pages/MarkWeeklyOff';
import { ChangePassword } from './pages/ChangePassword';
import { AdminAccess } from './pages/AdminAccess';
import type { AdminPermission } from './types';

function ManagerRoute({ children }: { children: ReactElement }) {
  const { profile } = useAuth();
  const allowed = profile?.role === 'manager' || profile?.role === 'admin' || profile?.role === 'super_admin';
  return allowed ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children, require }: { children: ReactElement; require?: AdminPermission }) {
  const { profile, hasAdminAccess } = useAuth();
  if (profile?.role === 'super_admin') return children;
  if (profile?.role !== 'admin') return <Navigate to="/" replace />;
  if (require && !hasAdminAccess(require)) return <Navigate to="/" replace />;
  return children;
}

function SuperAdminRoute({ children }: { children: ReactElement }) {
  const { profile } = useAuth();
  return profile?.role === 'super_admin' ? children : <Navigate to="/" replace />;
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
        <Route
          path="team/weekly-off"
          element={
            <ManagerRoute>
              <MarkWeeklyOff />
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
            <AdminRoute require="departments_holidays">
              <Departments />
            </AdminRoute>
          }
        />
        <Route
          path="profile/departments/:id"
          element={
            <AdminRoute require="departments_holidays">
              <DepartmentDetail />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff"
          element={
            <AdminRoute require="staff">
              <AdminStaff />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff/new"
          element={
            <AdminRoute require="staff">
              <AddStaff />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff/:id/balances"
          element={
            <AdminRoute require="leave_attendance">
              <StaffLeaveBalances />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff/bulk"
          element={
            <AdminRoute require="staff">
              <BulkAddStaff />
            </AdminRoute>
          }
        />
        <Route
          path="profile/leave-balances/bulk"
          element={
            <AdminRoute require="leave_attendance">
              <BulkLeaveBalances />
            </AdminRoute>
          }
        />
        <Route
          path="profile/holidays/bulk"
          element={
            <AdminRoute require="departments_holidays">
              <BulkHolidays />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff-dates/bulk"
          element={
            <AdminRoute require="staff">
              <BulkStaffDates />
            </AdminRoute>
          }
        />
        <Route
          path="profile/staff-photos/bulk"
          element={
            <AdminRoute require="staff">
              <BulkStaffPhotos />
            </AdminRoute>
          }
        />
        <Route
          path="profile/payroll-report"
          element={
            <AdminRoute require="payroll_reports">
              <PayrollReport />
            </AdminRoute>
          }
        />
        <Route
          path="profile/punch-report"
          element={
            <AdminRoute require="payroll_reports">
              <PunchReport />
            </AdminRoute>
          }
        />
        <Route
          path="profile/admin-access"
          element={
            <SuperAdminRoute>
              <AdminAccess />
            </SuperAdminRoute>
          }
        />
        <Route path="profile/change-password" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
