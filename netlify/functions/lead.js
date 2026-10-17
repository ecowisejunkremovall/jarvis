/* EcoWise lead forwarder — Netlify Function
   ONE-WAY: the website sends a new lead here; this function forwards it to ONE Base44 endpoint
   (a backend function that can only CREATE a "WebLead" record). Nothing is ever read back.
   Env vars: BASE44_LEAD_URL  e.g. https://ecowisejunkremovall.base44.app/functions/receiveWebLead
             BASE44_LEAD_SECRET  long random string (same value as the WEB_LEAD_SECRET secret in Base44)
             ALLOWED_ORIGINS (optional) */
const hits = new Map(), LIMIT = 5, WINDOW_MS = 10 * 60 * 1000;
const resp = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, ' ').trim().slice(0, n);

async function forward(p) {
  const url = process.env.BASE44_LEAD_URL, secret = process.env.BASE44_LEAD_SECRET;
  if (!url || !secret) return { ok: false, skipped: true };
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-ecowise-secret': secret }, body: JSON.stringify(p) });
    if (!r.ok) console.error('base44 lead status', r.status);
    return { ok: r.ok, status: r.status };
  } catch (e) { console.error('base44 lead failed', e.name); return { ok: false, error: e.name }; }
  finally { clearTimeout(t); }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.check)
    return resp(200, { function: 'lead ok', base44UrlSet: !!process.env.BASE44_LEAD_URL, base44SecretSet: !!process.env.BASE44_LEAD_SECRET });
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Method not allowed' });
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean), origin = event.headers.origin || event.headers.Origin || '';
  if (allowed.length && origin && !allowed.includes(origin)) return resp(403, { error: 'Forbidden' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return resp(400, { error: 'Bad request' }); }
  if (b.hp) return resp(400, { error: 'Bad request' });
  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'anon').split(',')[0].trim(), now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return resp(429, { error: 'busy' });
  recent.push(now); hits.set(ip, recent);
  const phone = String(b.phone || '').replace(/\D/g, '').slice(-10), name = txt(b.name, 60);
  if (b.consent !== true) return resp(400, { error: 'consent required' });
  if (name.length < 2 || phone.length !== 10) return resp(400, { error: 'invalid lead' });
  const out = await forward({
    name, phone, source: txt(b.source, 30) || 'website', summary: txt(b.summary, 500), city: txt(b.city, 30), size: txt(b.size, 30),
    low: Math.max(0, Math.min(100000, Number(b.low) || 0)), high: Math.max(0, Math.min(100000, Number(b.high) || 0)), lang: txt(b.lang, 5), transcript: txt(b.transcript, 3000)
  });
  return resp(200, { ok: true, forwarded: !!out.ok });
};
exports._forward = forward;
