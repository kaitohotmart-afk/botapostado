'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  Users,
  DollarSign,
  Gamepad2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalBet: 0,
    totalPaid: 0,
    totalFees: 0,
    activeBets: 0,
    mostPlayed: 'x1'
  });

  useEffect(() => {
    async function fetchStats() {
      const { data: bets, error } = await supabase
        .from('bets')
        .select('*');

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      const totalBet = bets.reduce((acc: number, bet: any) => acc + (Number(bet.valor) * 2), 0);
      const totalPaid = bets.filter((b: any) => b.status === 'finalizada').reduce((acc: number, bet: any) => acc + Number(bet.valor_pago), 0);
      const totalFees = bets.filter((b: any) => b.status === 'finalizada').reduce((acc: number, bet: any) => acc + Number(bet.taxa), 0);
      const activeBets = bets.filter((b: any) => !['finalizada', 'cancelada'].includes(b.status)).length;

      // Calculate most played modality
      const modalities = bets.reduce((acc: any, bet: any) => {
        acc[bet.modo] = (acc[bet.modo] || 0) + 1;
        return acc;
      }, {});
      const mostPlayed = Object.keys(modalities).reduce((a: string, b: string) => modalities[a] > modalities[b] ? a : b, 'x1');

      setStats({
        totalBet,
        totalPaid,
        totalFees,
        activeBets,
        mostPlayed: mostPlayed.toUpperCase()
      });
    }

    fetchStats();
  }, []);

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Visão Geral</h1>
        <p style={{ color: '#9ca3af' }}>Bem-vindo ao painel de controle administrativo.</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Apostado</div>
          <div className="stat-value">{stats.totalBet.toLocaleString()} MT</div>
          <div className="stat-trend trend-up">
            <ArrowUpRight size={14} /> +12% em relação a ontem
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Pago (Vencedores)</div>
          <div className="stat-value">{stats.totalPaid.toLocaleString()} MT</div>
          <div className="stat-trend trend-up">
            <ArrowUpRight size={14} /> +8% em relação a ontem
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Lucro (Taxas)</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {stats.totalFees.toLocaleString()} MT
          </div>
          <div className="stat-trend trend-up">
            <ArrowUpRight size={14} /> +15% em relação a ontem
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Apostas Ativas</div>
          <div className="stat-value">{stats.activeBets}</div>
          <div className="stat-trend">
            Status em tempo real
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="stat-card" style={{ minHeight: '300px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Faturamento Recente</h3>
          <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
            {/* Simple CSS bar chart placeholder */}
            {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${h}%`,
                background: 'var(--accent)',
                borderRadius: '4px 4px 0 0',
                opacity: 0.7 + (i * 0.05)
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', color: '#9ca3af', fontSize: '0.75rem' }}>
            <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
          </div>
        </div>

        <div className="stat-card">
          <h3 style={{ marginBottom: '1rem' }}>Modalidade Popular</h3>
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <Gamepad2 size={48} color="var(--accent)" style={{ marginBottom: '1rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.mostPlayed}</div>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Mais jogada esta semana</p>
          </div>
        </div>
      </div>
    </div>
  );
}
