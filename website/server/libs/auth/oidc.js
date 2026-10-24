import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import nconf from 'nconf';
import passport from 'passport';
import { BadRequest, NotAuthorized } from '../errors';
import { model as User } from '../../models/user';

const OIDC_ISSUER = (nconf.get('OIDC_ISSUER') || '').replace(/\/$/, '');
const OIDC_CLIENT_ID = nconf.get('OIDC_CLIENT_ID');
const OIDC_CLIENT_SECRET = nconf.get('OIDC_CLIENT_SECRET');
const SESSION_SECRET = nconf.get('SESSION_SECRET');
const REDIRECT_URI = `${nconf.get('BASE_URL')}/api/v4/user/auth/oidc/callback`;
const LOGIN_TIMEOUT = 5 * 60 * 1000; // a login flow has to complete within this time
const APP_CODE_AUDIENCE = 'habitica-android-oidc';
const ID_TOKEN_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'];

// Name for the login button, only set when the client is completely configured
export const OIDC_NAME = OIDC_ISSUER && OIDC_CLIENT_ID && OIDC_CLIENT_SECRET
  ? nconf.get('OIDC_NAME') || 'SSO' : undefined;

const sha256 = value => createHash('sha256').update(value).digest('base64url');

async function fetchJson (url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new NotAuthorized(`The OpenID Connect provider responded with ${res.status}`);
  return res.json();
}

let discovery;
// OpenID Connect Discovery 1.0 §4.3: the document must be issued by the configured issuer
function getDiscovery () {
  if (!discovery) {
    discovery = fetchJson(`${OIDC_ISSUER}/.well-known/openid-configuration`).then(doc => {
      if (doc.issuer.replace(/\/$/, '') !== OIDC_ISSUER) throw new Error('OIDC_ISSUER does not match the issuer of the discovery document');
      return { ...doc, jwks: jwksClient({ jwksUri: doc.jwks_uri }) };
    }).catch(err => {
      discovery = null;
      throw err;
    });
  }
  return discovery;
}

// loginSocial resolves the profile through passport, the controller puts it into authResponse
passport.use('oidc', { userProfile: (profile, done) => done(null, profile) });

export async function oidcAuthorizeUrl (req) {
  const [state, nonce, verifier] = Array.from({ length: 3 }, () => randomBytes(32).toString('base64url'));
  // The app receives its credentials bound to a PKCE challenge of its own (RFC 8252 §8.1)
  let app;
  if (req.query.platform === 'android') {
    app = { challenge: req.query.code_challenge, state: req.query.state };
    if (!/^[\w-]{43,128}$/.test(app.challenge) || typeof app.state !== 'string' || !/^[\w-]{1,128}$/.test(app.state)) {
      throw new BadRequest('code_challenge and state are required');
    }
  }
  req.session.oidc = {
    state, nonce, verifier, app, started: Date.now(),
  };
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OIDC_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: sha256(verifier),
    code_challenge_method: 'S256',
  });
  return `${(await getDiscovery()).authorization_endpoint}?${params}`;
}

// Exchanges the code and validates the ID token (OpenID Connect Core 1.0 §3.1.3.7)
export async function oidcProfile (req) {
  const {
    state, nonce, verifier, started,
  } = req.session.oidc || {};
  req.session.oidc = null;
  if (!state || state !== req.query.state || Date.now() - started > LOGIN_TIMEOUT) throw new NotAuthorized('Invalid or expired login state');
  if (!req.query.code) throw new NotAuthorized(`Login failed at the OpenID Connect provider: ${req.query.error}`);

  const {
    issuer, token_endpoint: tokenEndpoint, userinfo_endpoint: userinfoEndpoint, jwks,
    token_endpoint_auth_methods_supported: authMethods = ['client_secret_basic'],
  } = await getDiscovery();
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code: req.query.code, redirect_uri: REDIRECT_URI, code_verifier: verifier,
  });
  const headers = {};
  if (authMethods.includes('client_secret_post')) {
    body.set('client_id', OIDC_CLIENT_ID);
    body.set('client_secret', OIDC_CLIENT_SECRET);
  } else { // the default method of RFC 6749 §2.3.1
    headers.Authorization = `Basic ${Buffer.from(`${encodeURIComponent(OIDC_CLIENT_ID)}:${encodeURIComponent(OIDC_CLIENT_SECRET)}`).toString('base64')}`;
  }
  const tokens = await fetchJson(tokenEndpoint, { method: 'POST', body, headers });

  const { header } = jwt.decode(tokens.id_token || '', { complete: true }) || {};
  if (!header) throw new NotAuthorized('No ID token received');
  let claims;
  try {
    const key = (await jwks.getSigningKey(header.kid)).getPublicKey();
    claims = jwt.verify(tokens.id_token, key, {
      algorithms: ID_TOKEN_ALGORITHMS, issuer, audience: OIDC_CLIENT_ID, nonce, clockTolerance: 60,
    });
  } catch (err) {
    throw new NotAuthorized(`Invalid ID token: ${err.message}`);
  }
  if (claims.azp && claims.azp !== OIDC_CLIENT_ID) throw new NotAuthorized('Invalid ID token: wrong authorized party');

  // Userinfo only completes the ID token and has to be about the same subject (Core §5.3.2)
  const userinfo = await fetchJson(userinfoEndpoint, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  if (userinfo.sub !== claims.sub) throw new NotAuthorized('The userinfo subject does not match the ID token');
  const {
    sub, email, email_verified: emailVerified, preferred_username: username, name,
  } = { ...userinfo, ...claims };

  // Only an email the provider has verified may match an existing account (Core §5.1)
  const emails = typeof email === 'string' && emailVerified === true ? [{ value: email }] : [];
  // and never one that is already linked to another identity of the provider
  if (emails.length && await User.exists({ 'auth.local.email': email.toLowerCase(), 'auth.oidc.id': { $exists: true, $ne: sub } })) {
    throw new NotAuthorized('The email address belongs to an account linked to a different login');
  }
  return {
    id: sub, emails, name, username,
  };
}

// Where to send the browser after the login, the app gets a short-lived code instead of credentials
export function oidcRedirectUrl (user, app) {
  const newUser = user.newUser || false;
  if (!app) return `/static/oidc-redirect#id=${user._id}&key=${user.apiToken}&newUser=${newUser}`;
  const code = jwt.sign({ challenge: app.challenge, newUser }, SESSION_SECRET, {
    subject: String(user._id), audience: APP_CODE_AUDIENCE, expiresIn: '1m',
  });
  return `habitica://oidc?${new URLSearchParams({ code, state: app.state })}`;
}

// Redeems the code of the app for its user, which requires the PKCE verifier (RFC 7636 §4.6)
export async function oidcAppUser (req) {
  const { code, code_verifier: verifier } = req.body;
  let payload;
  try {
    payload = jwt.verify(code, SESSION_SECRET, { audience: APP_CODE_AUDIENCE });
  } catch (err) {
    throw new NotAuthorized('Invalid or expired code');
  }
  if (typeof verifier !== 'string' || sha256(verifier) !== payload.challenge) throw new NotAuthorized('Invalid code verifier');
  const user = await User.findById(payload.sub, { _id: 1, apiToken: 1, auth: 1 }).exec();
  if (!user) throw new NotAuthorized();
  user.newUser = payload.newUser;
  return user;
}
