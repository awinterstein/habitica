import { NotFound } from '../../libs/errors';
import {
  OIDC_NAME, oidcAccessToken, oidcAuthorizeUrl, oidcUserinfo,
} from '../../libs/auth/oidc';
import { loginSocial } from '../../libs/auth/social';
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

// Starts the login, `platform=android` returns the credentials to the app
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
    const { android } = req.session.oidc || {};
    const accessToken = await oidcAccessToken(req);
    req.body.network = 'oidc';
    req.body.authResponse = { access_token: accessToken };
    req.body.username = (await oidcUserinfo(accessToken)).preferred_username;
    res.locals.oidcTarget = android ? 'habitica://oidc' : '/static/oidc-redirect';
    // Links the provider to the account signed in on the website instead of logging in
    if (!android && req.session.userId) {
      res.locals.user = await User.findOne({ _id: req.session.userId, 'auth.oidc.id': null }).exec();
    }
    await loginSocial(req, res);
  },
};

export default api;
