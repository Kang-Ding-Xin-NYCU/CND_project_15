FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY app.js ./
COPY styles.css ./

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('node:http'); const https = require('node:https'); const protocol = process.env.HTTPS === 'true' ? 'https' : 'http'; const port = process.env.PORT || process.env.FRONTEND_PORT || (protocol === 'https' ? '8443' : '8080'); const client = protocol === 'https' ? https : http; const req = client.get({ hostname: '127.0.0.1', port, path: '/', rejectUnauthorized: false, timeout: 3000 }, (res) => { res.resume(); process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1); }); req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', () => process.exit(1));"

CMD ["npm", "start"]
