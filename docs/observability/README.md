# Observability

The API service exposes a Prometheus-compatible scrape endpoint at `GET /metrics`.

## What's exported

- `http_request_duration_seconds` — latency histogram with `method`, `route`,
  `status_code` labels and buckets at 5ms, 10ms, 25ms, 50ms, 100ms, 250ms,
  500ms, 1s, 2.5s.
- `db_pool_size`, `db_pool_idle`, `db_pool_waiting` — connection pool gauges.
  Hosts may update these from their `pg`/`postgres` pool stats.
- `queue_depth{queue="..."}` — pending background jobs (pg-boss).
- `process_*` and `nodejs_*` — default Node.js collectors (CPU, heap, GC,
  event loop lag, file descriptors).

## Authentication

`/metrics` requires a static bearer token. Set `METRICS_TOKEN` in the API
service environment. If unset or mismatched, the endpoint returns `401`.

```bash
export METRICS_TOKEN="$(openssl rand -hex 32)"
```

Scrape with:

```bash
curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:7213/metrics
```

## Prometheus config

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: dentalemon-api
    metrics_path: /metrics
    scheme: http
    authorization:
      type: Bearer
      credentials: ${METRICS_TOKEN}
    static_configs:
      - targets:
          - api:7213
        labels:
          service: api-ts
          env: production
```

## Suggested alerts (PromQL sketches)

- p95 latency over 500ms for 5m:
  `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 0.5`
- 5xx error rate over 1%:
  `sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])) / sum(rate(http_request_duration_seconds_count[5m])) > 0.01`
- DB pool saturation:
  `db_pool_waiting > 0`

## Dashboards

Grafana dashboards are not committed. Use the metric names above with the
standard Prometheus/Node exporter dashboards as a starting point.
