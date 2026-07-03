// Edge Function: administracion de usuarios (Supabase Auth) desde la app.
// verify_jwt del deploy NO alcanza solo: la anon key publica tambien es un JWT
// valido firmado por el proyecto, asi que igual hay que confirmar con GoTrue
// que el token pertenece a un usuario logueado real (auth.getUser), no a un
// visitante anonimo con la anon key del bundle JS.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization') || ''
        const token = authHeader.replace('Bearer ', '')
        if (!token) throw new Error('No autorizado.')

        const supabaseAuthCheck = createClient(
            Deno.env.get('SUPABASE_URL'),
            Deno.env.get('SUPABASE_ANON_KEY'),
        )
        const { data: authData, error: authError } = await supabaseAuthCheck.auth.getUser(token)
        if (authError || !authData?.user) throw new Error('No autorizado.')

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL'),
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        )

        const { action, email, password, id } = await req.json()

        if (action === 'list') {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers()
            if (error) throw error
            const users = data.users
                .map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }))
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            return new Response(JSON.stringify({ users }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (action === 'create') {
            if (!email || !password) throw new Error('Falta usuario o contraseña.')
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email, password, email_confirm: true,
            })
            if (error) throw error
            return new Response(JSON.stringify({ user: { id: data.user.id, email: data.user.email } }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (action === 'delete') {
            if (!id) throw new Error('Falta el id de usuario.')
            const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers()
            if (listError) throw listError
            if (list.users.length <= 1) throw new Error('No se puede borrar el último usuario del sistema.')
            const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
            if (error) throw error
            return new Response(JSON.stringify({ ok: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        throw new Error('Acción inválida.')
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
