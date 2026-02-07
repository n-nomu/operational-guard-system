'use client';

import { useState, useCallback } from 'react';
import { PinLogin } from '@/components/pin-login';
import { Dashboard } from '@/components/dashboard';
import type { Session } from '@/lib/types';

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);

  const handleLogin = useCallback((newSession: Session) => {
    setSession(newSession);
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
  }, []);

  if (!session) {
    return <PinLogin onLogin={handleLogin} />;
  }

  return <Dashboard session={session} onLogout={handleLogout} />;
}
