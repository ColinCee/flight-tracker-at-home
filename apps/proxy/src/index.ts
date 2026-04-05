/**
 * OpenSky API Proxy — Cloudflare Worker
 *
 * Proxies requests from the Render backend to OpenSky, handling OAuth2
 * authentication. This avoids OpenSky's hyperscaler IP blocking since
 * Cloudflare Workers run on edge CDN IPs.
 *
 * Secrets (set via `wrangler secret put`):
 *   OPENSKY_CLIENT_ID     — OAuth2 client ID
 *   OPENSKY_CLIENT_SECRET — OAuth2 client secret
 *   PROXY_KEY             — shared secret the backend sends in X-Proxy-Key
 */

interface Env {
  OPENSKY_CLIENT_ID?: string;
  OPENSKY_CLIENT_SECRET?: string;
  PROXY_KEY: string;
}

const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OPENSKY_BASE = 'https://opensky-network.org';
const TOKEN_REFRESH_MARGIN_S = 60;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(env: Env): Promise<string | null> {
  if (!env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) return null;
  if (cachedToken && Date.now() / 1000 < tokenExpiresAt) return cachedToken;

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.OPENSKY_CLIENT_ID,
      client_secret: env.OPENSKY_CLIENT_SECRET,
    }),
  });

  if (!resp.ok) {
    console.error('Token fetch failed:', resp.status, await resp.text());
    return null;
  }

  const data = (await resp.json()) as {
    access_token: string;
    expires_in?: number;
  };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() / 1000 + (data.expires_in ?? 300) - TOKEN_REFRESH_MARGIN_S;
  return cachedToken;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Validate proxy key
    if (request.headers.get('X-Proxy-Key') !== env.PROXY_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Map the incoming path to OpenSky
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, OPENSKY_BASE);

    // Build headers — add Bearer token if we have credentials
    const headers = new Headers();
    const token = await getToken(env);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const resp = await fetch(target.toString(), { headers });

    // Relay response, preserving status + rate-limit headers
    const relayHeaders = new Headers(resp.headers);
    relayHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(resp.body, {
      status: resp.status,
      headers: relayHeaders,
    });
  },
} satisfies ExportedHandler<Env>;
