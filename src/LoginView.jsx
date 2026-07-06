import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Usuario vacio + esta contraseña = alias de la cuenta admin@estadoresult.local
// (login real de Supabase Auth, no un bypass — pedido explicito, ver sesion 2026-07-03).
const SA_PASSWORD = 'EstadoResult@2';
export const SA_EMAIL = 'admin@estadoresult.local';

// Mismo dominio con el que UsersView arma el email al crear un usuario (ej: "vendedor1" -> vendedor1@DOMINIO).
// Si lo que se tipea no tiene "@", se asume alias y se completa con este dominio.
const DOMINIO = 'estadoresult.local';

const LoginView = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        if (!errorMsg) return;
        const t = setTimeout(() => setErrorMsg(null), 4000);
        return () => clearTimeout(t);
    }, [errorMsg]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const input = email.trim();
        let loginEmail = input || (password === SA_PASSWORD ? SA_EMAIL : '');
        if (loginEmail && !loginEmail.includes('@')) {
            loginEmail = `${loginEmail.toLowerCase().replace(/\s+/g, '.')}@${DOMINIO}`;
        }
        if (!loginEmail) {
            setErrorMsg('Ingresá tu usuario.');
            return;
        }
        setLoading(true);
        setErrorMsg(null);
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) {
            setErrorMsg(error.message === 'Invalid login credentials'
                ? 'Usuario o contraseña incorrectos.' : error.message);
            setLoading(false);
        }
        // Si es exito no hace falta setLoading(false): AuthGate desmonta este componente.
    };

    return (
        <div className="fixed inset-0 z-[110] flex justify-center items-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-blue-500/30 w-full max-w-md animate-fade-in">
                <div className="p-6 border-b border-blue-500/20 bg-blue-500/5">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Iniciar sesión</h3>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Acceso restringido</p>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuario</label>
                        <input type="text" autoFocus value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="alias o email"
                            className="w-full bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 outline-none transition" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contraseña</label>
                        <input type="password" required value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 outline-none transition" />
                    </div>
                    {errorMsg && (
                        <div className="text-xs font-semibold px-3 py-2 rounded-lg border bg-red-500/10 border-red-500/25 text-red-400">
                            ✗ {errorMsg}
                        </div>
                    )}
                    <button type="submit" disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-900/40 transition disabled:opacity-50">
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginView;
