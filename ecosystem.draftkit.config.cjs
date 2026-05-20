module.exports = {
  apps: [
    {
      name: "draftkit-web",
      cwd: "/home/apple/DARKBLUE-DRAFTKIT-PROJECT/draftkit-web",
      script: "node_modules/vite/bin/vite.js",
      args: "preview --host 127.0.0.1 --port 3003 --strictPort",
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "draftkit-app-api",
      cwd: "/home/apple/DARKBLUE-DRAFTKIT-PROJECT/draftkit-api",
      script: "server.js",
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: "3005",
        TRUST_PROXY_HOPS: "1",
        ALLOWED_ORIGINS: "https://draft.anythingavenue.com",
        PASSWORD_RESET_BASE_URL: "https://draft.anythingavenue.com",
        VALUATION_API_BASE: "http://127.0.0.1:3006",
      },
    },
  ],
};
