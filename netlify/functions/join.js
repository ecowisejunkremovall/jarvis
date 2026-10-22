/* EcoWise Bin Solutions / Pet Waste sign-up bridge — Netlify Function
   The website pages (/bins, /pet-waste, /account) call this; it forwards ONLY the client actions to the EcoWise app
   (Base44 backend function "route-join"). The app itself stays private (manager login).
   No secrets needed: route-join only lets a client sign up, see/sign their own agreement (with their secret link), save a card
   through Stripe, and pause/cancel. */
const TARGET = 'https://ecowisejunkremovall.base44.app/functions/route-join';
const ALLOWED = new Set(['signup', 'get', 'sign', 'card_setup', 'card_confirm', 'pause', 'resume', 'cancel']);
const hits = new Map(), LIMIT = 30, WINDOW_MS = 10 * 60 * 1000;
const resp = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') return resp(200, { function: 'join ok' });
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Method not allowed' });
  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'anon').split(',')[0].trim(), now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return resp(429, { error: 'busy' });
  recent.push(now); hits.set(ip, recent);
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return resp(400, { error: 'bad_request' }); }
  if (b.hp) return resp(400, { error: 'bad_request' });
  if (!ALLOWED.has(b.action)) return resp(400, { error: 'bad_action' });
  if (String(event.body || '').length > 600000) return resp(413, { error: 'too_large' });
  b.site = 'web';
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(TARGET, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'user-agent': 'EcoWise-Website/1.0' }, body: JSON.stringify(b) });
    clearTimeout(t);
    const j = await r.json().catch(() => ({ error: 'bad_response' }));
    return resp(r.status, j);
  } catch (e) { return resp(502, { error: e.name === 'AbortError' ? 'timeout' : 'unavailable' }); }
};
