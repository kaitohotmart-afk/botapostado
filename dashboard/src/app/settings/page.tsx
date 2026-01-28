'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
    const [settings, setSettings] = useState({
        taxa_aposta: 10,
        valor_minimo: 50,
        whatsapp_admin: '',
        manutencao: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        const { data, error } = await supabase
            .from('configuracoes')
            .select('*')
            .single();

        if (error) {
            console.error('Error fetching settings:', error);
            // Fallback for demo
            setSettings({
                taxa_aposta: 10,
                valor_minimo: 50,
                whatsapp_admin: '+258 84 000 0000',
                manutencao: false
            });
        } else {
            setSettings(data);
        }
        setLoading(false);
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('configuracoes')
                .upsert([settings]);

            if (error) throw error;
            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Carregando configurações...</div>;

    return (
        <div>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Configurações do Sistema</h1>
                <p style={{ color: '#9ca3af' }}>Ajuste os parâmetros globais do bot de apostas.</p>
            </header>

            <div className="stat-card" style={{ maxWidth: '800px' }}>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {message && (
                        <div className={`status-badge status-${message.type === 'success' ? 'finalizada' : 'cancelada'}`} style={{ padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {message.text}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div className="input-group">
                            <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Taxa de Aposta (%)</label>
                            <input
                                type="number"
                                className="filter-input"
                                style={{ width: '100%' }}
                                value={settings.taxa_aposta}
                                onChange={(e) => setSettings({ ...settings, taxa_aposta: Number(e.target.value) })}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>Percentual descontado de cada aposta para o admin.</p>
                        </div>

                        <div className="input-group">
                            <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Valor Mínimo (MT)</label>
                            <input
                                type="number"
                                className="filter-input"
                                style={{ width: '100%' }}
                                value={settings.valor_minimo}
                                onChange={(e) => setSettings({ ...settings, valor_minimo: Number(e.target.value) })}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>Valor mínimo permitido para criar uma aposta.</p>
                        </div>
                    </div>

                    <div className="input-group">
                        <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>WhatsApp do Admin</label>
                        <input
                            type="text"
                            className="filter-input"
                            style={{ width: '100%' }}
                            value={settings.whatsapp_admin}
                            onChange={(e) => setSettings({ ...settings, whatsapp_admin: e.target.value })}
                            placeholder="+258..."
                        />
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>Número exibido para suporte e depósitos.</p>
                    </div>

                    <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontWeight: 600, display: 'block' }}>Modo de Manutenção</label>
                            <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Se ativado, o bot não aceitará novas apostas.</p>
                        </div>
                        <input
                            type="checkbox"
                            style={{ width: '24px', height: '24px', cursor: 'pointer' }}
                            checked={settings.manutencao}
                            onChange={(e) => setSettings({ ...settings, manutencao: e.target.checked })}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            type="submit"
                            className="nav-item"
                            style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', padding: '0.75rem 2rem' }}
                            disabled={saving}
                        >
                            <Save size={18} />
                            <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={fetchSettings}
                            className="nav-item"
                            style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
                        >
                            <RefreshCw size={18} />
                            <span>Resetar</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
