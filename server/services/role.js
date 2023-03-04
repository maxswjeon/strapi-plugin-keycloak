"use strict";

module.exports = ({ strapi }) => ({
  SSO_TYPE_KEYCLOAK: "1",
  ssoRoles() {
    return [
      {
        oauth_type: this.SSO_TYPE_KEYCLOAK,
        name: "Keycloak",
      },
    ];
  },
  async keycloakRoles() {
    return await strapi.query("plugin::strapi-plugin-keycloak.roles").findOne({
      oauth_type: this.SSO_TYPE_KEYCLOAK,
    });
  },
  async find() {
    return await strapi
      .query("plugin::strapi-plugin-keycloak.roles")
      .findMany();
  },
  async update(roles) {
    const query = strapi.query("plugin::strapi-plugin-keycloak.roles");
    await Promise.all(
      roles.map((role) => {
        return query
          .findOne({ oauth_type: role["oauth_type"] })
          .then((ssoRole) => {
            if (ssoRole) {
              query.update({
                where: { oauth_type: role["oauth_type"] },
                data: { roles: role.role },
              });
            } else {
              query.create({
                data: {
                  oauth_type: role["oauth_type"],
                  roles: role.role,
                },
              });
            }
          });
      })
    );
  },
});
