// Edge Function: admin-create-staff
//
// Lets an admin create a new staff/manager login from inside the app,
// without ever putting the service_role key in the browser bundle. The
// service_role key only exists here, server-side, using the SUPABASE_URL
// and SUPABASE_SERVICE_ROLE_KEY env vars Supabase injects automatically
// into every Edge Function — nothing to configure.
//
// Deploy via the Supabase dashboard: Edge Functions -> Create a function
// named "admin-create-staff" -> paste this file's contents -> Deploy.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Verify the caller is a signed-in admin.
  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
  if (callerError || !callerData.user) {
    return json({ error: 'Invalid session' }, 401);
  }
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .single();
  if (callerProfile?.role !== 'admin') {
    return json({ error: 'Only admins can create staff accounts' }, 403);
  }

  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    employee_code?: string;
    role?: string;
    department_id?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { email, password, full_name, employee_code, role, department_id } = body;
  if (!email || !password || !full_name || !employee_code) {
    return json({ error: 'email, password, full_name, and employee_code are required' }, 400);
  }
  if (role !== 'staff' && role !== 'manager') {
    return json({ error: "role must be 'staff' or 'manager'" }, 400);
  }
  if (password.length < 6) {
    return json({ error: 'Password must be at least 6 characters' }, 400);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, employee_code },
  });
  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Could not create the account' }, 400);
  }

  if (department_id) {
    await admin.from('profiles').update({ department_id }).eq('id', created.user.id);
  }

  return json({ id: created.user.id, email: created.user.email });
});
