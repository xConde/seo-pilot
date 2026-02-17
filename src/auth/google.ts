import { readFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

export async function getGoogleAccessToken(
  serviceAccountPath: string,
  scopes: string[]
): Promise<string> {
  // Check cache
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) {
    return tokenCache.token;
  }

  // Read service account file
  const content = await readFile(serviceAccountPath, 'utf-8');
  const serviceAccount: ServiceAccount = JSON.parse(content);

  // Create JWT
  const iat = now;
  const exp = iat + 3600;

  const payload = {
    iss: serviceAccount.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
  };

  const token = jwt.sign(payload, serviceAccount.private_key, {
    algorithm: 'RS256',
  });

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get access token: ${response.status} ${errorText}`
    );
  }

  const data = await response.json() as TokenResponse;

  // Cache the token
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
  };

  return data.access_token;
}
