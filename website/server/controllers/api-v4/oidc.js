import { NotFound } from '../../libs/errors';
import {
  OIDC_NAME, oidcAppUser, oidcAuthorizeUrl, oidcProfile, oidcRedirectUrl,
} from '../../libs/auth/oidc';
import { loginSocial } from '../../libs/auth/social';
import { loginRes } from '../../libs/auth/utils';
import { model as User } from '../../models/user';

const api = {};

// Name of the OpenID Connect provider for the login button, empty if not configured
api.oidcConfig = {
  method: 'GET',
  url: '/user/auth/oidc/config',
  async handler (req, res) {
    res.respond(200, { name: OIDC_NAME });
  },
};

// Starts the login, `platform=android` with `code_challenge` and `state` returns a code to the app
api.oidcLogin = {
  method: 'GET',
  url: '/user/auth/oidc',
  async handler (req, res) {
    if (!OIDC_NAME) throw new NotFound();
    res.redirect(await oidcAuthorizeUrl(req));
  },
};

// Called by the OpenID Connect provider
api.oidcCallback = {
  method: 'GET',
  url: '/user/auth/oidc/callback',
  async handler (req, res) {
    const { app } = req.session.oidc || {};
    const profile = await oidcProfile(req);
    req.body.network = 'oidc';
    req.body.authResponse = { access_token: profile };
    if (profile.username) req.body.username = profile.username;
    res.locals.oidcRedirect = user => oidcRedirectUrl(user, app);
    // Links the provider to the account signed in on the website instead of logging in
    if (!app && req.session.userId) {
      res.locals.user = await User.findOne({ _id: req.session.userId, 'auth.oidc.id': null }).exec();
    }
    await loginSocial(req, res);
  },
};

// Called by the app with the code from habitica://oidc and its PKCE verifier
api.oidcAppToken = {
  method: 'POST',
  url: '/user/auth/oidc/token',
  async handler (req, res) {
    loginRes(await oidcAppUser(req), req, res);
  },
};

export default api;
