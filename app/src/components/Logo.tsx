export function Brandbar({ height = 24 }: { height?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Rajan Dental"
      height={height}
      style={{ display: 'block', height, width: 'auto' }}
    />
  );
}

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Rajan Dental"
      style={{ display: 'block', height: size, width: 'auto' }}
    />
  );
}
