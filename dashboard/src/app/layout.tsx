'use client';

import type { Metadata } from "next";
import "./globals.css";
import { LayoutDashboard, History, Users, Settings, LogOut, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
      if (!session && !isLoginPage) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [isLoginPage, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <html lang="pt">
        <body className="loading-screen">
          <div className="loader"></div>
        </body>
      </html>
    );
  }

  if (isLoginPage) {
    return (
      <html lang="pt">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="pt">
      <body>
        <div className="dashboard-container">
          <aside className="sidebar">
            <div className="logo">KAITO FF</div>

            <div className="user-profile">
              <div className="avatar">
                <User size={20} />
              </div>
              <div className="user-info">
                <span className="user-name">{user?.email?.split('@')[0] || 'Admin'}</span>
                <span className="user-role">Administrador</span>
              </div>
            </div>

            <nav className="nav-links">
              <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>
              <Link href="/logs" className={`nav-item ${pathname === '/logs' ? 'active' : ''}`}>
                <History size={20} />
                <span>Logs de Apostas</span>
              </Link>
              <Link href="/admins" className={`nav-item ${pathname === '/admins' ? 'active' : ''}`}>
                <Users size={20} />
                <span>Gestão Admins</span>
              </Link>
              <Link href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
                <Settings size={20} />
                <span>Configurações</span>
              </Link>
            </nav>

            <div style={{ marginTop: 'auto' }}>
              <button onClick={handleLogout} className="nav-item logout-btn" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
                <LogOut size={20} />
                <span>Sair</span>
              </button>
            </div>
          </aside>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
