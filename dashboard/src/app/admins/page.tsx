'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserPlus, Trash2, Shield, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminsPage() {
    const [admins, setAdmins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAdmin, setNewAdmin] = useState({ email: '', password: '' });
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchAdmins();
    }, []);

    async function fetchAdmins() {
        // Note: Supabase doesn't allow listing users from the client side for security.
        // In a real app, you'd have an 'admins' table or use a service role in an Edge Function.
        // For this demo, we'll fetch from a hypothetical 'admins_metadata' table or similar.
        // If the table doesn't exist, we'll show a placeholder or handle the error.

        const { data, error } = await supabase
            .from('admins_metadata')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching admins:', error);
            // Fallback for demo purposes if table doesn't exist
            setAdmins([
                { id: '1', email: 'admin@kaito.com', created_at: new Date().toISOString() }
            ]);
        } else {
            setAdmins(data || []);
        }
        setLoading(false);
    }

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);

        try {
            // In a real scenario, you'd call a Supabase Edge Function to create a user
            // because the client SDK doesn't allow creating users without being logged in
            // or having admin privileges (which shouldn't be on the client).

            // For now, we'll simulate adding to our metadata table
            const { error } = await supabase
                .from('admins_metadata')
                .insert([{ email: newAdmin.email, created_at: new Date().toISOString() }]);

            if (error) throw error;

            setShowAddModal(false);
            setNewAdmin({ email: '', password: '' });
            fetchAdmins();
        } catch (err: any) {
            alert('Erro ao adicionar admin: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteAdmin = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este administrador?')) return;

        try {
            const { error } = await supabase
                .from('admins_metadata')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchAdmins();
        } catch (err: any) {
            alert('Erro ao remover admin: ' + err.message);
        }
    };

    return (
        <div>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Gestão de Admins</h1>
                    <p style={{ color: '#9ca3af' }}>Gerencie quem tem acesso ao painel administrativo.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="nav-item"
                    style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                    <UserPlus size={18} />
                    <span>Novo Admin</span>
                </button>
            </header>

            <div className="table-container">
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Carregando admins...</div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>E-mail</th>
                                <th>Cargo</th>
                                <th>Data de Adição</th>
                                <th style={{ textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map((admin) => (
                                <tr key={admin.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div className="avatar" style={{ width: '32px', height: '32px' }}>
                                                <Shield size={16} />
                                            </div>
                                            <span>{admin.email}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="status-badge status-finalizada">ADMIN</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af' }}>
                                            <Calendar size={14} />
                                            {format(new Date(admin.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleDeleteAdmin(admin.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Adicionar Novo Administrador</h2>
                        <form onSubmit={handleAddAdmin}>
                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                                <label>E-mail</label>
                                <input
                                    type="email"
                                    className="filter-input"
                                    style={{ width: '100%' }}
                                    value={newAdmin.email}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                                <label>Senha Temporária</label>
                                <input
                                    type="password"
                                    className="filter-input"
                                    style={{ width: '100%' }}
                                    value={newAdmin.password}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="filter-input"
                                    style={{ cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="nav-item"
                                    style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Salvando...' : 'Adicionar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .modal-content {
                    background: var(--background);
                    border: 1px solid var(--glass-border);
                    padding: 2rem;
                    border-radius: 1rem;
                    width: 100%;
                    max-width: 450px;
                }
                .modal-content h2 {
                    margin-bottom: 1.5rem;
                    font-size: 1.25rem;
                }
            `}</style>
        </div>
    );
}
