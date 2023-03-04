# Strapi plugin strapi-plugin-keycloak

This plugin can provide single sign-on.

You will be able to log in to the administration screen using your Keycloak.

**This plugin is developed by one engineer.**
**If possible, consider using the Gold Plan features.**

# Easy to install

```shell
yarn add @codingbear/strapi-plugin-keycloak
```

or

```shell
npm i @codingbear/strapi-plugin-keycloak
```

# Requirements

- Strapi Version4
- **strapi-plugin-keycloak**
- Keycloak Instance

# Example Configuration

```javascript
// config/plugins.js
module.exports = ({ env }) => ({
  "strapi-plugin-keycloak": {
    enabled: true,
    config: {},
  },
});
```

# Support

- ✅ NodeJS <= 18.x
- Strapi 4.1.7 or higher
