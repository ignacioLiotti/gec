# Uptime Monitoring Guide

1. **Expose the health endpoint**
   - Deploy the new public route `GET /api/health`.
   - Optional: set `HEALTHCHECK_TOKEN` and pass it either as the header `x-health-token` or the query param `?token=...`.

2. **Configure monitors**
   - UptimeRobot/Pingdom: point to `https://app.yourdomain.com/api/health?token=XYZ`.
   - Alert on non-200 responses or latency spikes. The JSON payload includes `timestamp`, `uptimeSeconds`, `host`, and `version` for quick debugging.

3. **Escalation workflow**
   - When the monitor fires, jump into Sentry (error tracking), Upstash (rate limit saturation), and Supabase (database health).
   - Record incidents + postmortems; link them from `docs/runbooks/`.

4. **Local testing**
   - Run `npm run dev` and `curl -i http://localhost:3000/api/health`.
   - If `HEALTHCHECK_TOKEN` is set locally, include `-H "x-health-token: <token>"`.
