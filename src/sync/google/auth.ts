// Browser-only Google OAuth using Google Identity Services (gsi/client),
// "token model". No backend, no PKCE on our end (GIS handles it).

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
].join(' ');

const TOKEN_KEY = 'hk-google-token';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
  email?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

export function getClientId(): string | null {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? null;
}

export function isConfigured(): boolean {
  return !!getClientId();
}

export function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    if (!t.accessToken || t.expiresAt < Date.now() + 30_000) return null;
    return t;
  } catch { return null; }
}

function saveToken(t: StoredToken) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

export function clearToken() {
  const t = loadToken();
  localStorage.removeItem(TOKEN_KEY);
  if (t?.accessToken && window.google?.accounts?.oauth2?.revoke) {
    try { window.google.accounts.oauth2.revoke(t.accessToken, () => undefined); } catch { /* ignore */ }
  }
}

let tokenClient: ReturnType<NonNullable<Window['google']>['accounts']['oauth2']['initTokenClient']> | null = null;

function ensureClient(clientId: string): Promise<NonNullable<typeof tokenClient>> {
  return new Promise((resolve, reject) => {
    const tryInit = () => {
      if (!window.google?.accounts?.oauth2) return false;
      if (!tokenClient) {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: () => undefined
        });
      }
      resolve(tokenClient);
      return true;
    };
    if (tryInit()) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries++;
      if (tryInit()) { window.clearInterval(id); }
      else if (tries > 50) { window.clearInterval(id); reject(new Error('Google Identity Services failed to load')); }
    }, 100);
  });
}

export async function signIn(opts: { silent?: boolean } = {}): Promise<StoredToken> {
  const clientId = getClientId();
  if (!clientId) throw new Error('Google OAuth client ID not configured');
  const client = await ensureClient(clientId);
  return new Promise<StoredToken>((resolve, reject) => {
    const handler = (resp: { access_token?: string; expires_in?: number; error?: string }) => {
      if (resp.error || !resp.access_token) { reject(new Error(resp.error ?? 'Sign-in failed')); return; }
      const t: StoredToken = {
        accessToken: resp.access_token,
        expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000
      };
      saveToken(t);
      resolve(t);
    };
    // Re-init each call so we can capture the per-call callback.
    const client2 = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: handler
    });
    void client; // silence unused
    client2.requestAccessToken({ prompt: opts.silent ? 'none' : '' });
  });
}

export async function getValidToken(): Promise<StoredToken> {
  const existing = loadToken();
  if (existing) return existing;
  return signIn({ silent: true }).catch(() => signIn({ silent: false }));
}
