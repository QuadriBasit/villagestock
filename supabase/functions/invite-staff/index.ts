import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  business_id?: string;
  email?: string;
  role?: 'manager' | 'staff';
  display_name?: string;
  /** If set, invitee is limited to these shop_locations ids; omit or null = all branches. */
  allowed_location_ids?: string[] | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!serviceKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const jwt = authHeader.slice(7);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const businessId = (body.business_id ?? '').trim();
  const role = body.role;
  const displayName = (body.display_name ?? '').trim();
  const rawLocIds = body.allowed_location_ids;
  const allowedLocationIds =
    Array.isArray(rawLocIds) && rawLocIds.length > 0
      ? rawLocIds.map((id) => String(id).trim()).filter(Boolean)
      : null;

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email is required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (!businessId) {
    return new Response(JSON.stringify({ error: 'business_id is required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (role !== 'staff' && role !== 'manager') {
    return new Response(JSON.stringify({ error: 'role must be staff or manager' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (!displayName) {
    return new Response(JSON.stringify({ error: 'Name on receipts is required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: memberRow, error: memErr } = await admin
    .from('business_members')
    .select('role')
    .eq('business_id', businessId)
    .eq('member_user_id', authData.user.id)
    .maybeSingle();

  if (memErr || !memberRow || !['owner', 'manager'].includes(memberRow.role as string)) {
    return new Response(JSON.stringify({ error: 'Only shop owners or managers can send invites' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: inviterRow, error: inviterErr } = await admin
    .from('business_members')
    .select('allowed_location_ids')
    .eq('business_id', businessId)
    .eq('member_user_id', authData.user.id)
    .maybeSingle();

  if (inviterErr) {
    return new Response(JSON.stringify({ error: inviterErr.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const inviterScope = (inviterRow?.allowed_location_ids ?? null) as string[] | null;
  const inviterRestricted = inviterScope && inviterScope.length > 0;

  if (inviterRestricted) {
    if (!allowedLocationIds || allowedLocationIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Choose at least one branch for this invite (you manage specific branches only).',
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    const allowedSet = new Set(inviterScope);
    for (const id of allowedLocationIds) {
      if (!allowedSet.has(id)) {
        return new Response(JSON.stringify({ error: 'You cannot assign branches outside your own access.' }), {
          status: 403,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }
  }

  if (allowedLocationIds && allowedLocationIds.length > 0) {
    const { data: locRows, error: locErr } = await admin
      .from('shop_locations')
      .select('id')
      .eq('business_id', businessId)
      .in('id', allowedLocationIds);
    if (locErr) {
      return new Response(JSON.stringify({ error: locErr.message }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!locRows || locRows.length !== allowedLocationIds.length) {
      return new Response(JSON.stringify({ error: 'One or more branch ids are invalid for this shop.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  }

  if (email === (authData.user.email ?? '').trim().toLowerCase()) {
    return new Response(JSON.stringify({ error: 'You cannot invite your own email' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const siteUrl =
    Deno.env.get('INVITE_PUBLIC_SITE_URL') ??
    Deno.env.get('PUBLIC_SITE_URL') ??
    'http://localhost:5174';
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/auth`;

  const token = crypto.randomUUID();

  const { error: insErr } = await admin.from('staff_invites').insert({
    business_id: businessId,
    email,
    role,
    display_name: displayName,
    allowed_location_ids: allowedLocationIds,
    invited_by: authData.user.id,
    token,
    expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
  });

  if (insErr) {
    return new Response(
      JSON.stringify({
        error:
          insErr.code === '23505'
            ? 'An open invite already exists for this email. Wait until they accept or ask support to clear it.'
            : insErr.message,
      }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { staff_invite_token: token },
  });

  if (inviteErr) {
    await admin.from('staff_invites').delete().eq('token', token);
    const msg = inviteErr.message ?? 'Invite failed';
    const lower = msg.toLowerCase();
    const hint =
      lower.includes('already') || lower.includes('registered')
        ? ' This email may already have an account — use “Add existing teammate” in Settings instead.'
        : '';
    return new Response(JSON.stringify({ error: msg + hint }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
