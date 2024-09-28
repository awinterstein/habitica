# Container stage for building server and web component of Habitica
FROM node:20 AS build

ARG CI=true
ARG NODE_ENV=production

RUN git config --global url."https://".insteadOf git://

WORKDIR /usr/src/habitica

# Install main packages
COPY ["package.json", "package-lock.json", "./"]
RUN npm pkg set scripts.postinstall="echo \"Skipping postinstall\"" && npm install

# Install client packages
COPY ["website/client/package.json", "website/client/package-lock.json", "./website/client/"]
RUN cd website/client/ && npm pkg set scripts.postinstall="echo \"Skipping postinstall\"" && npm install

# Make the source code available in the container
COPY . /usr/src/habitica

# Create configuration file (some values are needed for the client build already)
RUN echo '{\n\
    "BASE_URL": "http://localhost:3000",\n\
    "CRON_SAFE_MODE": "false",\n\
    "CRON_SEMI_SAFE_MODE": "false",\n\
    "DISABLE_REQUEST_LOGGING": "true",\n\
    "EMAIL_SERVER_AUTH_PASSWORD": "",\n\
    "EMAIL_SERVER_AUTH_USER": "",\n\
    "EMAIL_SERVER_URL": null,\n\
    "ENABLE_CONSOLE_LOGS_IN_PROD": "true",\n\
    "ENABLE_CONSOLE_LOGS_IN_TEST": "false",\n\
    "FLAG_REPORT_EMAIL": "",\n\
    "IGNORE_REDIRECT": "true",\n\
    "INVITE_ONLY": "false",\n\
    "MAINTENANCE_MODE": "false",\n\
    "MONGODB_POOL_SIZE": "10",\n\
    "NODE_ENV": "production",\n\
    "PATH": "bin:node_modules/.bin:/usr/local/bin:/usr/bin:/bin",\n\
    "PORT": 3000,\n\
    "PUSH_CONFIGS_APN_ENABLED": "false",\n\
    "SESSION_SECRET": "YOUR SECRET HERE",\n\
    "SESSION_SECRET_IV": "12345678912345678912345678912345",\n\
    "SESSION_SECRET_KEY": "1234567891234567891234567891234567891234567891234567891234567891",\n\
    "TRUSTED_DOMAINS": "",\n\
    "WEB_CONCURRENCY": 1,\n\
    "ENABLE_STACKDRIVER_TRACING": "false",\n\
    "BLOCKED_IPS": "",\n\
    "LOG_AMPLITUDE_EVENTS": "false",\n\
    "RATE_LIMITER_ENABLED": "false",\n\
    "CONTENT_SWITCHOVER_TIME_OFFSET": 8\n\
}' > /usr/src/habitica/config.json

# Build the server and web components
RUN ./node_modules/.bin/gulp build:prod
RUN npm run client:build



# Container for providing the build server component of Habitica
FROM node:20 AS server

ENV NODE_ENV=production

COPY --from=build /usr/src/habitica/node_modules /var/lib/habitica/node_modules

COPY --from=build /usr/src/habitica/i18n_cache/ /var/lib/habitica/i18n_cache/
COPY --from=build /usr/src/habitica/content_cache/ /var/lib/habitica/content_cache/

COPY --from=build /usr/src/habitica/website/ /var/lib/habitica/website/

COPY --from=build /usr/src/habitica/package.json /var/lib/habitica/package.json
COPY --from=build /usr/src/habitica/config.json /var/lib/habitica/config.json

CMD ["node", "/var/lib/habitica/website/transpiled-babel/index.js"]



# Container for providing the build web component of Habitica
FROM caddy AS client

COPY --from=build /usr/src/habitica/website/client/dist /var/www

RUN echo -e ":80 {\n\
	@backend not {\n\
		path /static/audio/\n\
		path /static/css/\n\
		path /static/emails/\n\
		path /static/icons/\n\
		path /static/img/\n\
		path /static/js/\n\
		path /static/merch/\n\
		path /static/npc/\n\
		path /static/presskit/\n\
		path /index.html\n\
	}\n\
\n\
	root * /var/www\n\
	reverse_proxy @backend server:3000\n\
	file_server\n\
}" > /etc/caddy/Caddyfile