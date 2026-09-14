import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  listLeaveBalances,
  listMyLeaveRequests,
  listPendingApprovals,
  submitLeaveRequest,
} from '../api/leave';
import { formatShortDate } from '../lib/dates';
import { CheckIcon, PlusIcon, XIcon } from '../icons';
import type { LeaveBalance, LeaveDuration, LeaveRequest, LeaveStatus, LeaveTypeCode } from '../types';

const LEAVE_TYPES: LeaveTypeCode[] = ['SL', 'CL', 'EL', 'Permission'];
const BALANCE_TOTALS: Record<LeaveTypeCode, number> = { SL: 12, CL: 12, EL: 15, Permission: 4 };

function tagStyle(status: LeaveStatus) {
  if (status === 'approved') return { bg: '#f8f4f4', color: '#444141' };
  if (status === 'pending') return { bg: 'var(--color-accent-100)', color: 'var(--color-accent-800)' };
  return { bg: 'var(--color-accent-200)', color: 'var(--color-accent-700)' };
}

export function Leave() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';
  const [view, setView] = useState<'mine' | 'approvals'>('mine');
  const [showForm, setShowForm] = useState(false);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [approvals, setApprovals] = useState<LeaveRequest[]>([]);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const [leaveType, setLeaveType] = useState<LeaveTypeCode>('SL');
  const [duration, setDuration] = useState<LeaveDuration>('full');
  const [halfSession, setHalfSession] = useState<'morning' | 'afternoon'>('morning');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [permFrom, setPermFrom] = useState('');
  const [permTo, setPermTo] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    const [b, m] = await Promise.all([listLeaveBalances(profile.id), listMyLeaveRequests(profile.id)]);
    setBalances(b);
    setMine(m);
    if (isManager) setApprovals(await listPendingApprovals());
  }, [profile, isManager]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  const balanceFor = (code: LeaveTypeCode) => {
    const row = balances.find((b) => b.leave_type_code === code);
    const total = row?.total || BALANCE_TOTALS[code];
    const used = row?.used ?? 0;
    return { avail: Math.max(total - used, 0), total };
  };

  const resetForm = () => {
    setLeaveType('SL'); setDuration('full'); setHalfSession('morning');
    setStart(''); setEnd(''); setPermFrom(''); setPermTo(''); setReason('');
  };

  const onSubmit = async () => {
    if (!start) return;
    if (leaveType === 'Permission') {
      if (!permFrom || !permTo) return;
      await submitLeaveRequest({
        profileId: profile.id, leaveType, duration: 'permission', halfSession: null,
        startDate: start, endDate: start, permissionFrom: permFrom, permissionTo: permTo, reason,
      });
    } else if (duration === 'half') {
      await submitLeaveRequest({
        profileId: profile.id, leaveType, duration: 'half', halfSession,
        startDate: start, endDate: start, permissionFrom: null, permissionTo: null, reason,
      });
    } else {
      if (!end) return;
      await submitLeaveRequest({
        profileId: profile.id, leaveType, duration: 'full', halfSession: null,
        startDate: start, endDate: end, permissionFrom: null, permissionTo: null, reason,
      });
    }
    resetForm();
    setShowForm(false);
    await load();
  };

  const onApprove = async (id: string) => {
    setApprovalError(null);
    try {
      await approveLeaveRequest(id);
      await load();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Could not approve this request.');
    }
  };

  const onReject = async (id: string) => {
    setApprovalError(null);
    try {
      await rejectLeaveRequest(id);
      await load();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Could not reject this request.');
    }
  };

  const pendingCount = approvals.length;
  const isPermission = leaveType === 'Permission';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 6 }}>
        <div>
          <div className="kicker">Time off</div>
          <h1 style={{ fontSize: 28 }}>Leave</h1>
        </div>
        <button className="icon-btn" onClick={() => setShowForm(true)} style={{ gap: 5, color: 'var(--color-accent-700)', fontWeight: 800, fontSize: 13 }}>
          <span style={{ fontSize: 16, display: 'flex' }}><PlusIcon /></span>New
        </button>
      </div>
      <div className="hr" style={{ margin: '16px 0 18px' }} />

      <div className="section-label" style={{ marginBottom: 8 }}>Balance</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, background: 'var(--color-divider)', marginBottom: 18 }}>
        {LEAVE_TYPES.map((code) => {
          const { avail, total } = balanceFor(code);
          return (
            <div key={code} style={{ background: 'var(--color-surface)', padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-accent-700)', marginBottom: 4 }}>
                {code === 'Permission' ? 'Perm.' : code}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {avail}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-neutral-700)' }}>/{total}</span>
              </div>
            </div>
          );
        })}
      </div>

      {isManager && (
        <div className="seg" style={{ marginBottom: 18 }}>
          <button className="seg-opt" data-active={view === 'mine'} onClick={() => setView('mine')}>My requests</button>
          <button className="seg-opt" data-active={view === 'approvals'} onClick={() => setView('approvals')}>Approvals ({pendingCount})</button>
        </div>
      )}

      {showForm && (
        <div style={{ background: 'var(--color-surface)', padding: 18, marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>New request</div>
          <div className="seg" style={{ marginBottom: 14 }}>
            {LEAVE_TYPES.map((t) => (
              <button key={t} className="seg-opt" data-active={leaveType === t} onClick={() => { setLeaveType(t); setDuration('full'); }}>
                {t}
              </button>
            ))}
          </div>

          {!isPermission && (
            <div className="seg" style={{ marginBottom: 12 }}>
              <button className="seg-opt" data-active={duration === 'full'} onClick={() => setDuration('full')}>Full day</button>
              <button className="seg-opt" data-active={duration === 'half'} onClick={() => setDuration('half')}>Half day</button>
            </div>
          )}

          {!isPermission && duration === 'full' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Start</label>
                <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>End</label>
                <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          )}

          {!isPermission && duration === 'half' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Date</label>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ marginBottom: 10 }} />
              <div className="seg">
                <button className="seg-opt" data-active={halfSession === 'morning'} onClick={() => setHalfSession('morning')}>Morning</button>
                <button className="seg-opt" data-active={halfSession === 'afternoon'} onClick={() => setHalfSession('afternoon')}>Afternoon</button>
              </div>
            </div>
          )}

          {isPermission && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Date</label>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>From</label>
                  <input className="input" type="time" value={permFrom} onChange={(e) => setPermFrom(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>To</label>
                  <input className="input" type="time" value={permTo} onChange={(e) => setPermTo(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Reason</label>
          <textarea className="input" placeholder="Brief reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'flex-start', padding: '11px 14px' }} onClick={onSubmit}>Submit</button>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }} style={{ padding: '11px 14px' }}>Cancel</button>
          </div>
        </div>
      )}

      {(!isManager || view === 'mine') && mine.map((r) => {
        const tag = tagStyle(r.status);
        return (
          <div key={r.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--color-divider)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{r.leave_type_code} leave</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                {formatShortDate(r.start_date)} – {formatShortDate(r.end_date)}
              </div>
            </div>
            <span className="tag" style={{ background: tag.bg, color: tag.color }}>{r.status}</span>
          </div>
        );
      })}

      {isManager && view === 'approvals' && (
        <>
          {approvalError && (
            <div style={{ padding: '10px 12px', marginBottom: 12, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', fontSize: 13 }}>
              {approvalError}
            </div>
          )}
          {approvals.map((p) => {
            const iAlreadyApproved = p.first_approved_by === profile.id;
            return (
              <div key={p.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--color-divider)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.profiles?.full_name}</div>
                  <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{p.leave_type_code}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 2 }}>
                  {formatShortDate(p.start_date)} – {formatShortDate(p.end_date)}
                </div>
                <div style={{ fontSize: 13, marginBottom: 10 }}>{p.reason}</div>
                {p.first_approved_by && (
                  <div style={{ fontSize: 11, color: 'var(--color-accent-700)', fontWeight: 600, marginBottom: 10 }}>
                    {iAlreadyApproved ? 'You approved this — waiting for a second manager.' : 'Approved by one manager — needs a second approval.'}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn"
                    disabled={iAlreadyApproved}
                    style={{ flex: 1, background: '#201e1d', color: 'var(--color-bg)', fontSize: 12, padding: '8px 10px' }}
                    onClick={() => onApprove(p.id)}
                  >
                    <CheckIcon /> Approve
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12, padding: '8px 10px' }} onClick={() => onReject(p.id)}>
                    <XIcon /> Reject
                  </button>
                </div>
              </div>
            );
          })}
          {approvals.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>No pending requests.</div>
          )}
        </>
      )}
    </>
  );
}
