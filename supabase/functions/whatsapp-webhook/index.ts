// WhatsApp bot webhook — Phase 2, step 1 (read-only queries).
//
// Env secrets (supabase secrets set ...):
//   WHATSAPP_VERIFY_TOKEN     — any string you choose; also pasted into Meta's dashboard
//   WHATSAPP_APP_SECRET       — App Secret from Meta's app dashboard (verifies X-Hub-Signature-256)
//   WHATSAPP_TOKEN            — permanent access token from Meta
//   WHATSAPP_PHONE_NUMBER_ID  — phone number id from Meta
//   ANTHROPIC_API_KEY         — for the intent layer
//
// Meta dashboard webhook URL: https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook

import Anthropic from 'npm:@anthropic-ai/sdk@0.86.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH_VERSION = 'v21.0';
const MAX_HISTORY_TURNS = 20;

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type WebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          type: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function adminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function sendWhatsAppText(toMsisdn: string, body: string): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toMsisdn,
        type: 'text',
        text: { body, preview_url: false },
      }),
    },
  );
  if (!res.ok) {
    console.error('whatsapp send failed', res.status, await res.text());
  }
}

// ─── Read-only shop tools (scoped to the linked business) ────────────────────

function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

type ToolResult = string;

async function dailyRevenue(businessId: string, args: { days?: number }): Promise<ToolResult> {
  const db = adminClient();
  const days = Math.min(Math.max(args.days ?? 1, 1), 31);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await db
    .from('sales_records')
    .select('sale_price, quantity_sold, payment_status, returned')
    .eq('user_id', businessId)
    .eq('returned', false)
    .gte('sold_at', since);
  if (error) return `Query failed: ${error.message}`;
  const total = (data ?? []).reduce((sum, s) => sum + Number(s.sale_price) * s.quantity_sold, 0);
  const count = data?.length ?? 0;
  const credits = (data ?? []).filter(s => s.payment_status === 'credit').length;
  return `${count} sale${count !== 1 ? 's' : ''} in the last ${days} day${days !== 1 ? 's' : ''}, total ${naira(total)}${credits ? ` (${credits} on credit)` : ''}.`;
}

async function stockCheck(businessId: string, args: { query?: string }): Promise<ToolResult> {
  const db = adminClient();
  let qb = db
    .from('inventory_items')
    .select('name, brand, category, price, mode, status, quantity')
    .eq('user_id', businessId)
    .eq('deleted', false)
    .limit(15);
  if (args.query) qb = qb.ilike('name', `%${args.query}%`);
  const { data, error } = await qb;
  if (error) return `Query failed: ${error.message}`;
  const inStock = (data ?? []).filter(i =>
    i.mode === 'serialized' ? i.status === 'in_stock' : i.quantity > 0
  );
  if (!inStock.length) return args.query ? `No in-stock items matching "${args.query}".` : 'No items in stock.';
  return inStock
    .map(i => `${i.brand} ${i.name} — ${naira(Number(i.price))} (${i.mode === 'serialized' ? '1 unit' : `${i.quantity} units`})`)
    .join('\n');
}

async function outstandingCredits(businessId: string): Promise<ToolResult> {
  const db = adminClient();
  const { data, error } = await db
    .from('credit_records')
    .select('customer_name, item_name, balance_owed, due_date')
    .eq('user_id', businessId)
    .gt('balance_owed', 0)
    .order('due_date', { ascending: true })
    .limit(15);
  if (error) return `Query failed: ${error.message}`;
  if (!data?.length) return 'No outstanding credit balances. 🎉';
  return data
    .map(c => `${c.customer_name} — ${c.item_name}: ${naira(Number(c.balance_owed))} (due ${new Date(c.due_date).toLocaleDateString('en-NG')})`)
    .join('\n');
}

// ─── Intent layer ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the VillageStock shop assistant on WhatsApp. The shopkeeper messages you in casual Nigerian English and you answer questions about their shop: revenue, stock, and customer credits.

Rules:
- Keep replies short and WhatsApp-friendly (plain text, ₦ amounts, no markdown headers).
- Use the tools for real data; never invent numbers.
- If asked to record or change anything (record a sale, add stock, take a return), explain that write actions are coming soon and suggest using the app for now.
- Money is Nigerian Naira.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'daily_revenue',
    description: 'Total sales revenue for the shop over the last N days (default 1 = today).',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'How many days back, 1-31. Use 1 for today, 7 for the week.' },
      },
    },
  },
  {
    name: 'stock_check',
    description: 'List in-stock items, optionally filtered by a search term.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Optional item name to search for, e.g. "iphone" or "earpiece".' },
      },
    },
  },
  {
    name: 'outstanding_credits',
    description: 'List customers who still owe money (open credit balances), earliest due first.',
    input_schema: { type: 'object' as const, properties: {} },
  },
];

async function runAssistant(
  businessId: string,
  history: ChatTurn[]
): Promise<{ reply: string; history: ChatTurn[] }> {
  const anthropic = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY') });
  const messages: Anthropic.MessageParam[] = history.map(t => ({
    role: t.role,
    content: t.content,
  }));
  const nextHistory = [...history];

  for (let hop = 0; hop < 3; hop++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    if (!toolUses.length) {
      const reply = textBlock?.text?.trim() || '🙏 Sorry, I did not catch that.';
      nextHistory.push({ role: 'assistant', content: reply });
      return { reply, history: nextHistory };
    }

    messages.push({ role: 'assistant', content: response.content });
    nextHistory.push({
      role: 'assistant',
      content: textBlock?.text ?? toolUses.map(t => `[checking ${t.name}]`).join(' '),
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tool of toolUses) {
      let result: ToolResult;
      try {
        if (tool.name === 'daily_revenue') {
          result = await dailyRevenue(businessId, (tool.input ?? {}) as { days?: number });
        } else if (tool.name === 'stock_check') {
          result = await stockCheck(businessId, (tool.input ?? {}) as { query?: string });
        } else if (tool.name === 'outstanding_credits') {
          result = await outstandingCredits(businessId);
        } else {
          result = `Unknown tool: ${tool.name}`;
        }
      } catch (e) {
        result = `Tool error: ${e instanceof Error ? e.message : 'unknown'}`;
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tool.id,
        content: result,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  const reply = 'Let me try that again in a moment 🙏';
  nextHistory.push({ role: 'assistant', content: reply });
  return { reply, history: nextHistory };
}

function trimHistory(history: ChatTurn[]): ChatTurn[] {
  return history.slice(-MAX_HISTORY_TURNS);
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

/** Verify Meta's X-Hub-Signature-256 header: HMAC-SHA256 of the raw body, hex-encoded. */
async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!appSecret) {
    console.error('WHATSAPP_APP_SECRET not configured — rejecting webhook (fail closed)');
    return false;
  }
  if (!header?.startsWith('sha256=')) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const provided = header.slice('sha256='.length);
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

async function handleMessage(fromMsisdn: string, text: string): Promise<void> {
  const db = adminClient();

  const { data: link } = await db
    .from('whatsapp_links')
    .select('business_id, verified')
    .eq('phone_msisdn', fromMsisdn)
    .maybeSingle();

  if (!link?.verified) {
    await sendWhatsAppText(
      fromMsisdn,
      '👋 This is the VillageStock assistant. To link this WhatsApp to your shop, open the VillageStock app → Settings → Link WhatsApp and send me the 6-digit code.'
    );
    return;
  }

  const { data: session } = await db
    .from('whatsapp_sessions')
    .select('messages')
    .eq('phone_msisdn', fromMsisdn)
    .maybeSingle();

  const history = ((session?.messages ?? []) as ChatTurn[]);
  history.push({ role: 'user', content: text });

  const { reply, history: nextHistory } = await runAssistant(link.business_id, history);

  await db
    .from('whatsapp_sessions')
    .upsert(
      { phone_msisdn: fromMsisdn, messages: trimHistory(nextHistory), updated_at: new Date().toISOString() },
      { onConflict: 'phone_msisdn' }
    );

  await sendWhatsAppText(fromMsisdn, reply);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Meta webhook verification handshake
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  if (!(await verifySignature(rawBody, req.headers.get('x-hub-signature-256')))) {
    return new Response('Invalid signature', { status: 403 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Process async and always ack fast — Meta retries on non-2xx.
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (message.type === 'text' && message.text?.body) {
          handleMessage(message.from, message.text.body.trim()).catch(e =>
            console.error('handleMessage failed', e)
          );
        }
      }
    }
  }

  return new Response('ok', { status: 200 });
});
