import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

const DOMINIO = 'estadoresult.local';
const PASS_DEFAULT = 'EstadoResult@2';

const UsersView = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [msg, setMsg] = useState(null); // { type: 'ok'|'error', text }
    const [nombre, setNombre] = useState('');
    const [password, setPassword] = useState(PASS_DEFAULT);

    useEffect(() => {
        if (!msg) return;
        const t = setTimeout(() => setMsg(null), 5000);
        return () => clearTimeout(t);
    }, [msg]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'list' } });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            setUsers(data.users || []);
        } catch (err) {
            setMsg({ type: 'error', text: 'No se pudo cargar la lista: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        const local = nombre.trim().toLowerCase().replace(/\s+/g, '.');
        if (!local) { setMsg({ type: 'error', text: 'Ingresá un nombre de usuario.' }); return; }
        if (!password || password.length < 6) { setMsg({ type: 'error', text: 'La contraseña necesita al menos 6 caracteres.' }); return; }
        const email = `${local}@${DOMINIO}`;
        setCreating(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-users', {
                body: { action: 'create', email, password },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            setMsg({ type: 'ok', text: `Usuario "${email}" creado. Compartile el usuario y la contraseña.` });
            setNombre('');
            setPassword(PASS_DEFAULT);
            fetchUsers();
        } catch (err) {
            setMsg({ type: 'error', text: 'Error al crear: ' + err.message });
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (u) => {
        if (!window.confirm(`¿Borrar el usuario "${u.email}"? No va a poder volver a entrar.`)) return;
        setDeletingId(u.id);
        try {
            const { data, error } = await supabase.functions.invoke('admin-users', {
                body: { action: 'delete', id: u.id },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            setMsg({ type: 'ok', text: `Usuario "${u.email}" borrado.` });
            fetchUsers();
        } catch (err) {
            setMsg({ type: 'error', text: 'Error al borrar: ' + err.message });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-700 bg-slate-900/50">
                    <h2 className="text-xl font-bold text-white mb-1">Nuevo Usuario</h2>
                    <p className="text-sm text-slate-400">Cualquier persona con este usuario y contraseña va a poder entrar al sistema con acceso completo.</p>
                </div>
                <form onSubmit={handleCreate} className="p-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuario</label>
                            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                                <input
                                    autoFocus
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    placeholder="ej: vendedor1"
                                    className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none"
                                />
                                <span className="pr-4 text-xs text-slate-500 font-mono whitespace-nowrap">@{DOMINIO}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contraseña</label>
                            <input
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none transition"
                            />
                            <p className="text-[9px] text-slate-500">Precargada con la contraseña por defecto. Se puede cambiar.</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        {msg && (
                            <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${msg.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
                                {msg.type === 'ok' ? '✓' : '✗'} {msg.text}
                            </span>
                        )}
                        <button
                            type="submit"
                            disabled={creating}
                            className="ml-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-900/40 transition disabled:opacity-50"
                        >
                            {creating ? 'Creando...' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Usuarios del Sistema</h2>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Acceso total — sin niveles de permiso</p>
                    </div>
                    <div className="bg-slate-900 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Total: {users.length}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 animate-pulse">
                        <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Cargando usuarios...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-900/80 text-[10px] text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-5">Usuario</th>
                                    <th className="px-6 py-5">Alta</th>
                                    <th className="px-6 py-5">Último ingreso</th>
                                    <th className="px-6 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{u.email}</span>
                                                {u.id === currentUser?.id && (
                                                    <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-500/10 border border-blue-500/25 px-1.5 py-0.5 rounded">Vos</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                                            {new Date(u.created_at).toLocaleDateString('es-AR')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '— nunca —'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(u)}
                                                disabled={deletingId === u.id}
                                                className="text-[10px] font-black uppercase tracking-wide text-red-400/80 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-500/25 transition disabled:opacity-40"
                                            >
                                                {deletingId === u.id ? 'Borrando...' : 'Borrar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500 text-xs">Sin usuarios.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UsersView;
