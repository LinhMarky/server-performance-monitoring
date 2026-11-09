FROM node:24.14.1-bookworm-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node backend/src ./src
COPY --chown=node:node frontend /app/frontend
COPY --chown=node:node scripts /app/scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=8s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(6500)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "src/server.js"]
