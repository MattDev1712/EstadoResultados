import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import LoginView from './LoginView';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const SplashLoading = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-page)]">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
    </div>
);

export const AuthGate = ({ children }) => {
    // undefined = resolviendo getSession, null = sin sesion, objeto = logueado
    const [session, setSession] = useState(undefined);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    }, []);

    if (session === undefined) return <SplashLoading />;
    if (!session) return <LoginView />;

    const signOut = () => supabase.auth.signOut();

    return (
        <AuthContext.Provider value={{ session, user: session.user, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
