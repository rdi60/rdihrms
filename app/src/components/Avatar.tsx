import { getAvatarUrl } from '../api/admin';
import type { Profile } from '../types';

export function Avatar({
  profile, size, variant = 'tinted',
}: {
  profile: Pick<Profile, 'full_name' | 'avatar_path'>;
  size: number;
  variant?: 'tinted' | 'gradient';
}) {
  const url = getAvatarUrl(profile.avatar_path);
  const initials = profile.full_name.split(' ').map((p) => p[0]).join('');
  const isGradient = variant === 'gradient';
  const radius = isGradient ? 'var(--radius-md)' : 'var(--radius-sm)';

  if (url) {
    return (
      <img
        src={url}
        alt={profile.full_name}
        style={{ width: size, height: size, flex: 'none', borderRadius: radius, objectFit: 'cover' }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, flex: 'none',
        background: isGradient ? 'var(--color-accent-gradient)' : 'var(--color-surface-tint)',
        borderRadius: radius,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
        fontSize: Math.round(size * 0.36), color: isGradient ? '#fff7f2' : 'var(--color-accent-700)',
      }}
    >
      {initials}
    </div>
  );
}
