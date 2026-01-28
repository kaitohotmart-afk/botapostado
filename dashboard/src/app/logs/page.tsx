'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Logs() {
    const [bets, setBets] = useState<any[]>([]);
    const [filteredBets, setFilteredBets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        admin: ''
    });

    useEffect(() => {
        async function fetchBets() {
            const { data, error } = await supabase
                .from('bets')
                .select(`
          *,
          jogador1:jogador1_id(nome),
          jogador2:jogador2_id(nome)
        `)
                .order('criado_em', { ascending: false });

            if (error) {
                console.error('Error fetching bets:', error);
            } else {
                setBets(data || []);
                setFilteredBets(data || []);
            }
            setLoading(false);
        }

        fetchBets();
    }, []);

    useEffect(() => {
        let result = bets;

        if (filters.search) {
            const search = filters.search.toLowerCase();
            result = result.filter((b: any) =>
                b.id.toLowerCase().includes(search) ||
                (b.jogador1?.nome || '').toLowerCase().includes(search) ||
                (b.jogador2?.nome || '').toLowerCase().includes(search)
            );
        }

        if (filters.status) {
            result = result.filter((b: any) => b.status === filters.status);
        }

        if (filters.admin) {
            result = result.filter((b: any) => b.criador_admin_id === filters.admin);
        }

        setFilteredBets(result);
    }, [filters, bets]);

    return (
        <div>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Logs de Apostas</h1>
                    <p style={{ color: '#9ca3af' }}>Histórico completo de todas as movimentações.</p>
                </div>
                <button className="nav-item" style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}>
                    <Download size={18} />
                    <span>Exportar CSV</span>
                </button>
            </header>

            <div className="filters-bar">
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder="Buscar por ID ou Jogador..."
                        className="filter-input"
                        style={{ width: '100%', paddingLeft: '40px' }}
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                </div>

                <select
                    className="filter-input"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                    <option value="">Todos os Status</option>
                    <option value="aguardando">Aguardando</option>
                    <option value="aceita">Aceita</option>
                    <option value="paga">Paga</option>
                    <option value="em_jogo">Em Jogo</option>
                    <option value="finalizada">Finalizada</option>
                    <option value="cancelada">Cancelada</option>
                </select>

                <select
                    className="filter-input"
                    value={filters.admin}
                    onChange={(e) => setFilters({ ...filters, admin: e.target.value })}
                >
                    <option value="">Todos os Admins</option>
                    {/* Unique admins from bets */}
                    {Array.from(new Set(bets.map((b: any) => b.criador_admin_id))).filter(Boolean).map((adminId: any) => (
                        <option key={adminId} value={adminId}>{adminId}</option>
                    ))}
                </select>
            </div>

            <div className="table-container">
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Carregando logs...</div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>ID da Aposta</th>
                                <th>Jogadores</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Admin</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBets.map((bet) => (
                                <tr key={bet.id}>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
                                        {bet.id.substring(0, 8)}...
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span>{bet.jogador1?.nome || 'Desconhecido'}</span>
                                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>vs</span>
                                            <span>{bet.jogador2?.nome || 'Desconhecido'}</span>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{bet.valor} MT</td>
                                    <td>
                                        <span className={`status-badge status-${bet.status}`}>
                                            {bet.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                        {bet.criador_admin_id || 'Sistema'}
                                    </td>
                                    <td>
                                        {format(new Date(bet.criado_em), "dd MMM, HH:mm", { locale: ptBR })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
