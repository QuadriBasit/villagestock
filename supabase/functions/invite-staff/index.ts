import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  business_id?: string;
  email?: string;
  role?: 'manager' | 'staff';
  role_id?: string;
  display_name?: string;
  allowed_location_ids?: string[] | null;
  site_url?: string;
};

const CANONICAL_APP_ORIGIN = 'https://villagestock.online';

function parseHttpOrigin(raw?: string | null): string | null {
  if (!raw || !/^https?:\/\//i.test(raw.trim())) return null;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function isEmailExistsError(err: { message?: string; code?: string } | null): boolean {
  const code = (err?.code ?? '').toLowerCase();
  const msg = (err?.message ?? '').toLowerCase();
  return (
    code === 'email_exists' ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  );
}

/** Prefer the page they invited from. Never send localhost to production Auth. */
function resolveInviteSiteUrl(bodySiteUrl?: string): string {
  const fromClient = parseHttpOrigin(bodySiteUrl);
  if (fromClient && !isLocalhostOrigin(fromClient)) return fromClient;
  const fromEnv = parseHttpOrigin(
    Deno.env.get('INVITE_PUBLIC_SITE_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? ''
  );
  if (fromEnv && !isLocalhostOrigin(fromEnv)) return fromEnv;
  return CANONICAL_APP_ORIGIN;
}

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
  if (!displayName) {
    return new Response(JSON.stringify({ error: 'Name on receipts is required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: canInvite, error: permErr } = await admin.rpc('shop_member_has_permission', {
    p_business_id: businessId,
    p_member_id: authData.user.id,
    p_permission: 'manage_team',
  });
  if (permErr) {
    return new Response(JSON.stringify({ error: permErr.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (!canInvite) {
    return new Response(JSON.stringify({ error: 'You do not have permission to send invites' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let roleId = (body.role_id ?? '').trim();
  let role = body.role;

  if (roleId) {
    const { data: roleRow, error: roleErr } = await admin
      .from('shop_roles')
      .select('id, slug')
      .eq('id', roleId)
      .eq('business_id', businessId)
      .maybeSingle();
    if (roleErr || !roleRow) {
      return new Response(JSON.stringify({ error: 'Invalid role for this shop' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    role = (roleRow.slug as 'manager' | 'staff' | null) ?? 'member';
  } else if (role === 'staff' || role === 'manager') {
    const { data: roleRow, error: roleErr } = await admin
      .from('shop_roles')
      .select('id, slug')
      .eq('business_id', businessId)
      .eq('slug', role)
      .maybeSingle();
    if (roleErr || !roleRow) {
      return new Response(JSON.stringify({ error: 'Default role not found for this shop' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    roleId = roleRow.id as string;
  } else {
    return new Response(JSON.stringify({ error: 'role_id is required' }), {
      status: 400,
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

  const siteUrl = resolveInviteSiteUrl(body.site_url);
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/auth`;

  const token = crypto.randomUUID();

  const { error: insErr } = await admin.from('staff_invites').insert({
    business_id: businessId,
    email,
    role,
    role_id: roleId,
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

  // generateLink does not send SMTP. Auth invite emails fail because
  // Resend has not verified villagestock.online.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo,
      data: { staff_invite_token: token },
    },
  });

  let inviteUrl = linkData?.properties?.action_link ?? '';

  if (linkErr && isEmailExistsError(linkErr)) {
    const lookup = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    );
    const lookupJson = (await lookup.json()) as { users?: Array<{ id: string; user_metadata?: Record<string, unknown> }> };
    const existing = lookupJson.users?.find(Boolean);
    if (!existing) {
      await admin.from('staff_invites').delete().eq('token', token);
      return new Response(
        JSON.stringify({
          error:
            'This email already has a VillageStock account. Use “They already have a VillageStock account?” below and add them by email.',
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...(existing.user_metadata ?? {}), staff_invite_token: token },
    });
    const { data: magic, error: magicErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });
    if (magicErr || !magic?.properties?.action_link) {
      await admin.from('staff_invites').delete().eq('token', token);
      return new Response(
        JSON.stringify({
          error:
            'This email already has a VillageStock account. Use “They already have a VillageStock account?” below and add them by email.',
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    inviteUrl = magic.properties.action_link;
  } else if (linkErr || !inviteUrl) {
    await admin.from('staff_invites').delete().eq('token', token);
    return new Response(JSON.stringify({ error: linkErr?.message ?? 'Could not create an invite link.' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, invite_url: inviteUrl }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
