'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Terminal } from 'lucide-react';
import { PinForm } from '@/components/pin-form';
import { UNAUTHORIZED_EVENT } from './api-client';

// The dashboard bundle is only downloaded after a successful login.
const AdminDashboard = dynamic(() => import('./dashboard').then((m) => m.AdminDashboard), {
  ssr: false,
  loading: () => (
    <div className="py-24 text-center monofont text-xs uppercase tracking-[0.3em] text-signal">loading console…</div>
  ),
});

export function AdminShell({ initialAuthenticated }: { initialAuthenticated: boolean }) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [notice, setNotice] = useState<string | null>(null);

  const onUnauthorized = useCallback(() => {
    setAuthenticated((was) => {
      if (was) setNotice('Your session expired or was signed out. Please log in again.');
      return false;
    });
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [onUnauthorized]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setNotice('Signed out.');
    setAuthenticated(false);
  };

  return (
    <div className="grid-cross min-h-screen">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-signal">
          <Terminal className="h-5 w-5" />
          <span className="monofont text-sm">/home</span>
        </Link>
        <span className="monofont text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {authenticated ? 'session: active' : 'session: none'}
        </span>
      </header>

      <main id="main-content" tabIndex={-1} className="px-4 pb-16 sm:px-8">
        {authenticated ? (
          <AdminDashboard onLogout={logout} />
        ) : (
          <div className="flex min-h-[70vh] items-center justify-center">
            <PinForm
              notice={notice}
              onSuccess={() => {
                setNotice(null);
                setAuthenticated(true);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
