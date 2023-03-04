module.exports = [
  {
    method: "GET",
    path: "/keycloak",
    handler: "keycloak.signIn",
    config: {
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/keycloak/callback",
    handler: "keycloak.signInCallback",
    config: {
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/sso-roles",
    handler: "role.find",
  },
  {
    method: "PUT",
    path: "/sso-roles",
    handler: "role.update",
  },
];
