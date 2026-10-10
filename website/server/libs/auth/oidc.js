import { createHash, randomBytes } from 'crypto';
import nconf from 'nconf';
import passport from 'passport';
import { NotAuthorized } from '../errors';

const OIDC_ISSUER = nconf.get('OIDC_ISSUER');
const OIDC_CLIENT_ID = nconf.get('OIDC_CLIENT_ID');
const REDIRECT_URI = `${nconf.get('BASE_URL')}/api/v4/user/auth/oidc/callback`;

export const OIDC_NAME = OIDC_ISSUER && (nconf.get('OIDC_NAME') || 'SSO');

const getDiscovery = () => fetch(`${OIDC_ISSUER}/.well-known/openid-configuration`).then(res => res.json());

export const oidcUserinfo = accessToken => getDiscovery()
  .then(discovery => fetch(discovery.userinfo_endpoint, { headers: { Authorization: `Bearer ${accessToken}` } }))
  .then(res => res.json());

// Profile lookup used by loginSocial, as for the other social networks
passport.use('oidc', {
  userProfile (accessToken, done) {
    oidcUserinfo(accessToken).then(({ sub, email, name }) => done(null, {
      id: sub, emails: [{ value: email }], name,
    }), done);
  },
});

export async function oidcAuthorizeUrl (req) {
  const [state, verifier] = Array.from({ length: 2 }, () => randomBytes(32).toString('base64url'));
  req.session.oidc = { state, verifier, android: req.query.platform === 'android' };
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OIDC_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  });
  return `${(await getDiscovery()).authorization_endpoint}?${params}`;
}

export async function oidcAccessToken (req) {
  const { state, verifier } = req.session.oidc || {};
  req.session.oidc = null;
  if (!state || state !== req.query.state) throw new NotAuthorized();

  const { access_token: accessToken, error } = await fetch((await getDiscovery()).token_endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      client_id: OIDC_CLIENT_ID,
      client_secret: nconf.get('OIDC_CLIENT_SECRET'),
    }),
  }).then(res => res.json());
  if (!accessToken) throw new NotAuthorized(error);
  return accessToken;
}
