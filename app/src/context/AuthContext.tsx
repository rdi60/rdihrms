import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AdminPermission, Profile } from '../types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasAdminAccess: (permission: AdminPermission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const DEACTIVATED_MESSAGE = 'This account has been deactivated. Contact your manager.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);

  // Loads the profile for a signed-in user; if their account has been
  // deactivated, signs them back out immediately instead of letting them
  // into the app. Returns an error message when that happens.
  const loadProfileOrSignOut = async (userId: string): Promise<string | null> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data && !data.is_active) {
      setProfile(null);
      await supabase.auth.signOut();
      return DEACTIVATED_MESSAGE;
    }
    setProfile(data);
    if (data?.role === 'admin' && !data.admin_full_access) {
      const { data: perms } = await supabase.from('admin_permissions').select('permission').eq('profile_id', userId);
      setAdminPermissions((perms ?? []).map((p) => p.permission as AdminPermission));
    } else {
      setAdminPermissions([]);
    }
    return null;
  };

  const hasAdminAccess = (permission: AdminPermission) => {
    if (!profile) return false;
    if (profile.role === 'super_admin') return true;
    if (profile.role !== 'admin') return false;
    return profile.admin_full_access || adminPermissions.includes(permission);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfileOrSignOut(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        loadProfileOrSignOut(next.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const deactivatedMessage = await loadProfileOrSignOut(data.session.user.id);
      if (deactivatedMessage) return deactivatedMessage;
    }
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session) await loadProfileOrSignOut(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut, refreshProfile, hasAdminAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
