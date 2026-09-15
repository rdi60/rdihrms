import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  listLeaveBalances,
  listLeaveTypes,
  listMyLeaveRequests,
  listPendingApprovals,
  submitLeaveRequest,
} from '../api/leave';
import {
  approveRegularizationRequest,
  listMyRegularizationRequests,
  listPendingRegularizationApprovals,
  rejectRegularizationRequest,
  submitRegularizationRequest,
} from '../api/regularization';
import { formatShortDate, formatTimeOfDay } from '../lib/dates';
import { CheckIcon, PlusIcon, XIcon } from '../icons';
import type {
  LeaveBalance, LeaveDuration, LeaveRequest, LeaveStatus, LeaveType, LeaveTypeCode,
  RegularizationRequest, RegularizationStatus,
} from '../types';

function tagStyle(status: LeaveStatus | RegularizationStatus) {
  if (status === 'approved') return { bg: 'var(--status-present-bg)', color: 'var(--status-present-text)' };
  if (status === 'pending') return { bg: 'var(--status-late-bg)', color: 'var(--status-late-text)' };
  return { bg: 'var(--status-absent-bg)', color: 'var(--status-absent-text)' };
}

export function Leave() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || profile?.role === 'super_admin';
  const [contentTab, setContentTab] = useState<'leave' | 'regularize'>('leave');

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveView, setLeaveView] = useState<'mine' | 'approvals'>('mine');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
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

  const [regView, setRegView] = useState<'mine' | 'approvals'>('mine');
  const [showRegForm, setShowRegForm] = useState(false);
  const [myReg, setMyReg] = useState<RegularizationRequest[]>([]);
  const [regApprovals, setRegApprovals] = useState<RegularizationRequest[]>([]);
  const [regError, setRegError] = useState<string | null>(null);
  const [regDate, setRegDate] = useState('');
  const [regClockIn, setRegClockIn] = useState('');
  const [regClockOut, setRegClockOut] = useState('');
  const [regReason, setRegReason] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    const [types, b, m] = await Promise.all([listLeaveTypes(), listLeaveBalances(profile.id), listMyLeaveRequests(profile.id)]);
    setLeaveTypes(types);
    setBalances(b);
    setMine(m);
    if (!types.some((t) => t.code === leaveType)) setLeaveType(types[0]?.code as LeaveTypeCode);
    const [reg] = await Promise.all([listMyRegularizationRequests(profile.id)]);
    setMyReg(reg);
    if (isManager) {
      setApprovals(await listPendingApprovals());
      setRegApprovals(await listPendingRegularizationApprovals());
    }
  }, [profile, isManager]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  const balanceFor = (code: LeaveTypeCode) => {
    const row = balances.find((b) => b.leave_type_code === code);
    const total = row?.total ?? 0;
    const used = row?.used ?? 0;
    return { avail: Math.max(total - used, 0), total };
  };

  const resetLeaveForm = () => {
    setLeaveType((leaveTypes[0]?.code as LeaveTypeCode) ?? 'SL'); setDuration('full'); setHalfSession('morning');
    setStart(''); setEnd(''); setPermFrom(''); setPermTo(''); setReason('');
  };

  const resetRegForm = () => {
    setRegDate(''); setRegClockIn(''); setRegClockOut(''); setRegReason('');
  };

  const onSubmitLeave = async () => {
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
    resetLeaveForm();
    setShowLeaveForm(false);
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

  const onSubmitReg = async () => {
    if (!regDate || (!regClockIn && !regClockOut)) return;
    await submitRegularizationRequest({
      profileId: profile.id, workDate: regDate,
      requestedClockIn: regClockIn || null, requestedClockOut: regClockOut || null, reason: regReason,
    });
    resetRegForm();
    setShowRegForm(false);
    await load();
  };

  const onApproveReg = async (id: string) => {
    setRegError(null);
    try {
      await approveRegularizationRequest(id);
      await load();
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Could not approve this request.');
    }
  };

  const onRejectReg = async (id: string) => {
    setRegError(null);
    try {
      await rejectRegularizationRequest(id);
      await load();
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Could not reject this request.');
    }
  };

  const pendingCount = approvals.length;
  const pendingRegCount = regApprovals.length;
  const isPermission = leaveType === 'Permission';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 6 }}>
        <div>
          <div className="kicker">Time off</div>
          <h1 style={{ fontSize: 28 }}>Leave</h1>
        </div>
        <button
          className="icon-btn"
          onClick={() => (contentTab === 'leave' ? setShowLeaveForm(true) : setShowRegForm(true))}
          style={{ gap: 5, color: 'var(--color-accent-700)', fontWeight: 800, fontSize: 13 }}
        >
          <span style={{ fontSize: 16, display: 'flex' }}><PlusIcon /></span>New
        </button>
      </div>
      <div className="hr" style={{ margin: '16px 0 18px' }} />

      <div className="seg" style={{ marginBottom: 18 }}>
        <button className="seg-opt" data-active={contentTab === 'leave'} onClick={() => setContentTab('leave')}>Leave</button>
        <button className="seg-opt" data-active={contentTab === 'regularize'} onClick={() => setContentTab('regularize')}>Punch fix</button>
      </div>

      {contentTab === 'leave' && (
        <>
          <div className="section-label" style={{ marginBottom: 8 }}>Balance</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}>
            {leaveTypes.map((t) => {
              const { avail, total } = balanceFor(t.code as LeaveTypeCode);
              const suffix = t.unit === 'hour' ? 'h' : '';
              return (
                <div key={t.code} className="card" style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-accent-700)', marginBottom: 4 }}>
                    {t.code}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>
                    {avail}{suffix}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-neutral-700)' }}>/{total}{suffix}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {isManager && (
            <div className="seg" style={{ marginBottom: 18 }}>
              <button className="seg-opt" data-active={leaveView === 'mine'} onClick={() => setLeaveView('mine')}>My requests</button>
              <button className="seg-opt" data-active={leaveView === 'approvals'} onClick={() => setLeaveView('approvals')}>Approvals ({pendingCount})</button>
            </div>
          )}

          {showLeaveForm && (
            <div className="card" style={{ padding: 18, marginBottom: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>New request</div>
              <div className="seg" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                {leaveTypes.map((t) => (
                  <button key={t.code} className="seg-opt" data-active={leaveType === t.code} onClick={() => { setLeaveType(t.code as LeaveTypeCode); setDuration('full'); }}>
                    {t.code}
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
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'flex-start', padding: '11px 14px' }} onClick={onSubmitLeave}>Submit</button>
                <button className="btn btn-secondary" onClick={() => { setShowLeaveForm(false); resetLeaveForm(); }} style={{ padding: '11px 14px' }}>Cancel</button>
              </div>
            </div>
          )}

          {(!isManager || leaveView === 'mine') && mine.map((r) => {
            const tag = tagStyle(r.status);
            return (
              <div key={r.id} className="card" style={{ padding: '13px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{r.leave_type_code} leave</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                    {formatShortDate(r.start_date)} – {formatShortDate(r.end_date)}
                  </div>
                </div>
                <span className="tag" style={{ background: tag.bg, color: tag.color }}>{r.status}</span>
              </div>
            );
          })}

          {isManager && leaveView === 'approvals' && (
            <>
              {approvalError && (
                <div className="card" style={{ padding: '10px 12px', marginBottom: 12, background: 'var(--status-late-bg)', color: 'var(--status-late-text)', fontSize: 13, boxShadow: 'none' }}>
                  {approvalError}
                </div>
              )}
              {approvals.map((p) => {
                const iAlreadyApproved = p.first_approved_by === profile.id;
                return (
                  <div key={p.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.profiles?.full_name}</div>
                      <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{p.leave_type_code}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 2 }}>
                      {formatShortDate(p.start_date)} – {formatShortDate(p.end_date)}
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 10 }}>{p.reason}</div>
                    {p.first_approved_by && (
                      <div style={{ fontSize: 11, color: 'var(--status-late-text)', fontWeight: 700, marginBottom: 10 }}>
                        {iAlreadyApproved ? 'You approved this — waiting for a second manager.' : 'Approved by one manager — needs a second approval.'}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn"
                        disabled={iAlreadyApproved}
                        style={{ flex: 1, background: 'var(--status-present-text)', color: '#fff', fontSize: 12, padding: '9px 10px', boxShadow: 'none' }}
                        onClick={() => onApprove(p.id)}
                      >
                        <CheckIcon /> Approve
                      </button>
                      <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12, padding: '9px 10px' }} onClick={() => onReject(p.id)}>
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
      )}

      {contentTab === 'regularize' && (
        <>
          {isManager && (
            <div className="seg" style={{ marginBottom: 18 }}>
              <button className="seg-opt" data-active={regView === 'mine'} onClick={() => setRegView('mine')}>My requests</button>
              <button className="seg-opt" data-active={regView === 'approvals'} onClick={() => setRegView('approvals')}>Approvals ({pendingRegCount})</button>
            </div>
          )}

          {showRegForm && (
            <div className="card" style={{ padding: 18, marginBottom: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Request a punch fix</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
                For a day you forgot to clock in or out. Leave a time blank if it isn't missing.
              </div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Date</label>
              <input className="input" type="date" value={regDate} onChange={(e) => setRegDate(e.target.value)} style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Clock in</label>
                  <input className="input" type="time" value={regClockIn} onChange={(e) => setRegClockIn(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Clock out</label>
                  <input className="input" type="time" value={regClockOut} onChange={(e) => setRegClockOut(e.target.value)} />
                </div>
              </div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Reason</label>
              <textarea className="input" placeholder="What happened" value={regReason} onChange={(e) => setRegReason(e.target.value)} style={{ marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'flex-start', padding: '11px 14px' }} onClick={onSubmitReg}>Submit</button>
                <button className="btn btn-secondary" onClick={() => { setShowRegForm(false); resetRegForm(); }} style={{ padding: '11px 14px' }}>Cancel</button>
              </div>
            </div>
          )}

          {(!isManager || regView === 'mine') && myReg.map((r) => {
            const tag = tagStyle(r.status);
            return (
              <div key={r.id} className="card" style={{ padding: '13px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{formatShortDate(r.work_date)}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                    {r.requested_clock_in ? `In ${formatTimeOfDay(r.requested_clock_in)}` : ''}
                    {r.requested_clock_in && r.requested_clock_out ? ' · ' : ''}
                    {r.requested_clock_out ? `Out ${formatTimeOfDay(r.requested_clock_out)}` : ''}
                  </div>
                </div>
                <span className="tag" style={{ background: tag.bg, color: tag.color }}>{r.status}</span>
              </div>
            );
          })}
          {(!isManager || regView === 'mine') && myReg.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>No punch fix requests yet.</div>
          )}

          {isManager && regView === 'approvals' && (
            <>
              {regError && (
                <div className="card" style={{ padding: '10px 12px', marginBottom: 12, background: 'var(--status-late-bg)', color: 'var(--status-late-text)', fontSize: 13, boxShadow: 'none' }}>
                  {regError}
                </div>
              )}
              {regApprovals.map((p) => (
                <div key={p.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.profiles?.full_name}</div>
                    <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{formatShortDate(p.work_date)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 2 }}>
                    {p.requested_clock_in ? `In ${formatTimeOfDay(p.requested_clock_in)}` : ''}
                    {p.requested_clock_in && p.requested_clock_out ? ' · ' : ''}
                    {p.requested_clock_out ? `Out ${formatTimeOfDay(p.requested_clock_out)}` : ''}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 10 }}>{p.reason}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn"
                      style={{ flex: 1, background: 'var(--status-present-text)', color: '#fff', fontSize: 12, padding: '9px 10px', boxShadow: 'none' }}
                      onClick={() => onApproveReg(p.id)}
                    >
                      <CheckIcon /> Approve
                    </button>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12, padding: '9px 10px' }} onClick={() => onRejectReg(p.id)}>
                      <XIcon /> Reject
                    </button>
                  </div>
                </div>
              ))}
              {regApprovals.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>No pending requests.</div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
