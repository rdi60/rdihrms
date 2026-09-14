import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPayslipDownloadUrl, listMyPayslips } from '../api/directory';
import { BackHeader } from '../components/PageHeader';
import { DownloadIcon } from '../icons';
import type { Payslip } from '../types';

export function Payslips() {
  const { profile } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  useEffect(() => {
    if (!profile) return;
    listMyPayslips(profile.id).then(setPayslips);
  }, [profile]);

  const download = async (p: Payslip) => {
    const url = await getPayslipDownloadUrl(p.file_path);
    window.open(url, '_blank');
  };

  return (
    <>
      <BackHeader title="Payslips" />
      {payslips.length > 0 && (
        <div className="card">
          {payslips.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i === payslips.length - 1 ? 'none' : '1px solid var(--color-divider)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.period_label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                  Net pay ₹{p.net_pay.toLocaleString('en-IN')}
                </div>
              </div>
              <button className="btn btn-secondary" style={{ gap: 5, fontSize: 11, padding: '7px 11px', boxShadow: 'none' }} onClick={() => download(p)}>
                <DownloadIcon /> PDF
              </button>
            </div>
          ))}
        </div>
      )}
      {payslips.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>
          No payslips on file yet.
        </div>
      )}
    </>
  );
}
