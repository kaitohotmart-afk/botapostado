'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            router.push('/');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo">KAITO FF</div>
                    <h1>Painel Admin</h1>
                    <p>Entre com suas credenciais para acessar o painel.</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="input-group">
                        <label htmlFor="email">E-mail</label>
                        <div className="input-wrapper">
                            <Mail size={18} className="input-icon" />
                            <input
                                id="email"
                                type="email"
                                placeholder="admin@exemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Senha</label>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Entrando...</span>
                            </>
                        ) : (
                            <span>Entrar no Painel</span>
                        )}
                    </button>
                </form>
            </div>

            <style jsx>{`
                .login-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    background: var(--background);
                    padding: 1rem;
                }
                .login-card {
                    width: 100%;
                    max-width: 400px;
                    background: var(--glass);
                    border: 1px solid var(--glass-border);
                    backdrop-filter: blur(10px);
                    padding: 2.5rem;
                    border-radius: 1.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .login-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .login-header h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0.5rem 0;
                }
                .login-header p {
                    color: #9ca3af;
                    font-size: 0.875rem;
                }
                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .error-message {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--danger);
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }
                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .input-group label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #d1d5db;
                }
                .input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-icon {
                    position: absolute;
                    left: 1rem;
                    color: #6b7280;
                }
                .input-wrapper input {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--glass-border);
                    color: white;
                    padding: 0.75rem 1rem 0.75rem 3rem;
                    border-radius: 0.75rem;
                    outline: none;
                    transition: all 0.2s;
                }
                .input-wrapper input:focus {
                    border-color: var(--accent);
                    background: rgba(255, 255, 255, 0.05);
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
                }
                .login-button {
                    background: var(--accent);
                    color: white;
                    border: none;
                    padding: 0.875rem;
                    border-radius: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    margin-top: 0.5rem;
                }
                .login-button:hover:not(:disabled) {
                    background: var(--accent-hover);
                    transform: translateY(-1px);
                }
                .login-button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
