// Stand-in for the Rajan Dental logo mark until the real file is added at
// /public/logo.png — swap this component's contents for an <img> then.

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 100" width={size} height={size} fill="none" style={{ flex: 'none' }}>
      <path
        d="M60 6 C40 6 8 34 0 46 C16 62 30 66 40 66 C40 78 44 88 50 96 L54 96 C50 84 48 74 48 66 C52 66 56 65 60 63 C64 65 68 66 72 66 C72 74 70 84 66 96 L70 96 C76 88 80 78 80 66 C90 66 104 62 120 46 C112 34 80 6 60 6 Z"
        fill="var(--color-accent)"
      />
    </svg>
  );
}

export function Brandbar({ size = 26 }: { size?: number }) {
  return (
    <div className="brandbar">
      <LogoMark size={size} />
      <div className="word">
        RAJAN <span>DENTAL</span>
      </div>
    </div>
  );
}
