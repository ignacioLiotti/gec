# Load Testing Baseline

1. **Install k6 locally**  
   - macOS: `brew install k6`  
   - Windows: `choco install k6`  
   - Linux: follow https://k6.io/docs/getting-started/installation

2. **Set environment**  
   ```bash
   export BASE_URL="https://app.yourdomain.com"
   export HEALTHCHECK_TOKEN="..."
   ```

3. **Run the smoke test**  
   ```bash
   k6 run loadtest/health-smoke.js
   ```
   Default profile: 10 virtual users for 1 minute with thresholds `p95 < 500ms` and `<1%` errors.

4. **Interpreting results**  
   - `http_req_duration`: watch p95/p99 trends and compare against historical runs.
   - `http_req_failed`: should remain near zero; spikes indicate outages.
   - Export to JSON/InfluxDB if you need longitudinal dashboards.

5. **Extending coverage**  
   - Duplicate the script and hit authenticated workflows (obra CRUD, certificates) using service tokens.
   - Use staged execution (`stages` option) to find breakpoints.
