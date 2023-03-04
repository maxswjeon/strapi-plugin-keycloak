"use strict";
const axios = require("axios");
const { v4 } = require("uuid");
const openId = require("openid-client");
const NodeCache = require("node-cache");
const { getService } = require("@strapi/admin/server/utils");

const nodeCache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

const configValidation = async () => {
  const config = strapi.config.get("plugin.strapi-plugin-keycloak");
  if (
    config["KEYCLOAK_SERVER_URL"] &&
    config["KEYCLOAK_REALM"] &&
    config["KEYCLOAK_CLIENT_ID"] &&
    config["KEYCLOAK_CLIENT_SECRET"] &&
    config["KEYCLOAK_REDIRECT_URL"]
  ) {
    const { data: openidConfig } = await axios.get(
      `${config["KEYCLOAK_SERVER_URL"]}/realms/${config["KEYCLOAK_REALM"]}/.well-known/openid-configuration`
    );

    config["KEYCLOAK_AUTHORIZATION_ENDPOINT"] =
      openidConfig["authorization_endpoint"];
    config["KEYCLOAK_TOKEN_ENDPOINT"] = openidConfig["token_endpoint"];
    config["KEYCLOAK_USERINFO_ENDPOINT"] = openidConfig["userinfo_endpoint"];

    return config;
  }
  throw new Error(
    "KEYCLOAK_SERVER_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET are required"
  );
};

/**
 * Common constants
 */
const OAUTH_GRANT_TYPE = "authorization_code";
const OAUTH_SCOPE = encodeURIComponent("openid profile email");
const OAUTH_RESPONSE_TYPE = "code";
const OATH_CODE_CHALLENGE_METHOD = "S256";

async function signIn(ctx) {
  const config = await configValidation();

  const redirectUri = encodeURIComponent(config["KEYCLOAK_REDIRECT_URL"]);
  const endpoint = config["KEYCLOAK_AUTHORIZATION_ENDPOINT"];
  const codeVerifier = openId.generators.codeVerifier();
  const nonce = openId.generators.nonce();
  const codeChallenge = openId.generators.codeChallenge(codeVerifier);
  const state = openId.generators.state();

  // Store Code Verifier with key is State
  nodeCache.set(`sso:${state}`, codeVerifier, 5 * 60); // 1 min

  const url = `${endpoint}?client_id=${config["KEYCLOAK_CLIENT_ID"]}&redirect_uri=${redirectUri}&scope=${OAUTH_SCOPE}&response_type=${OAUTH_RESPONSE_TYPE}&code_challenge_method=${OATH_CODE_CHALLENGE_METHOD}&code_challenge=${codeChallenge}&nonce=${nonce}&state=${state}`;

  console.log(url);

  ctx.set("Location", url);
  return ctx.send({}, 302);
}

async function signInCallback(ctx) {
  const config = await configValidation();
  const tokenService = getService("token");
  const userService = getService("user");
  const oauthService = strapi.plugin("strapi-plugin-keycloak").service("oauth");
  const roleService = strapi.plugin("strapi-plugin-keycloak").service("role");

  if (!ctx.query.code) {
    return ctx.send(oauthService.renderSignUpError("code Not Found"));
  }

  const codeVerifier = nodeCache.take(`sso:${ctx.query.state}`);
  if (!codeVerifier) {
    return ctx.send(oauthService.renderSignUpError("code verifier Not Found"));
  }

  const params = new URLSearchParams();
  params.append("code", ctx.query.code);
  params.append("client_id", config["KEYCLOAK_CLIENT_ID"]);
  params.append("client_secret", config["KEYCLOAK_CLIENT_SECRET"]);
  params.append("redirect_uri", config["KEYCLOAK_REDIRECT_URL"]);
  params.append("grant_type", OAUTH_GRANT_TYPE);
  params.append("code_verifier", codeVerifier);

  try {
    const tokenEndpoint = config["KEYCLOAK_TOKEN_ENDPOINT"];
    const userInfoEndpoint = config["KEYCLOAK_USERINFO_ENDPOINT"];

    const response = await axios.post(tokenEndpoint, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const userResponse = await axios.get(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${response.data.access_token}`,
      },
    });
    if (!userResponse.data) {
      throw new Error("User not found.");
    }

    const dbUser = await userService.findOneByEmail(userResponse.data.email);
    let activateUser;
    let jwtToken;

    if (dbUser) {
      activateUser = dbUser;
      jwtToken = await tokenService.createJwtToken(dbUser);
    } else {
      const keycloakRoles = await roleService.keycloakRoles();
      const roles = keycloakRoles?.["roles"]
        ? keycloakRoles["roles"].map((role) => ({
            id: role,
          }))
        : [];

      const defaultLocale = oauthService.localeFindByHeader(
        ctx.request.headers
      );
      activateUser = await oauthService.createUser(
        userResponse.data.email,
        userResponse.data.given_name,
        userResponse.data.family_name,
        defaultLocale,
        roles
      );
      jwtToken = await tokenService.createJwtToken(activateUser);

      // Trigger webhook
      await oauthService.triggerWebHook(activateUser);
    }
    const nonce = v4();
    const html = oauthService.renderSignUpSuccess(
      jwtToken,
      activateUser,
      nonce
    );
    ctx.set("Content-Security-Policy", `script-src 'nonce-${nonce}'`);
    ctx.send(html);
  } catch (e) {
    console.error(e);
    ctx.send(oauthService.renderSignUpError(e.message));
  }
}

module.exports = {
  signIn,
  signInCallback,
};
