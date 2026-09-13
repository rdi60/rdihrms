import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '../icons';

export function PageHeader({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 6 }}>
        <div>
          <div className="kicker">{kicker}</div>
          <h1 style={{ fontSize: 28 }}>{title}</h1>
        </div>
        {action}
      </div>
      <div className="hr" style={{ margin: '16px 0 18px' }} />
    </>
  );
}

export function BackHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <>
      <button
        className="icon-btn"
        onClick={() => navigate(-1)}
        style={{ gap: 6, fontWeight: 600, fontSize: 14, padding: '10px 0 16px' }}
      >
        <span style={{ fontSize: 18, display: 'flex' }}>
          <ArrowLeftIcon />
        </span>
        Back
      </button>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{title}</h1>
      <div className="hr" style={{ margin: '14px 0 20px' }} />
    </>
  );
}
