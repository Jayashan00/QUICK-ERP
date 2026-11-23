#!/usr/bin/env python3
"""Adds (or updates) the Quick ERP site as ONE route in a Caddy server that is managed through its admin API.

Other websites on the server are never edited: the route has its own @id (the same pattern the Quicke platform
uses for its stores), every other site's response is recorded before and after, and the change is undone
automatically if any of them answers differently afterwards.

  python3 caddy-route.py vyroerp.com /var/www/vyroerp vyroerp-erp [http://localhost:2019]
  python3 caddy-route.py --remove vyroerp-erp [http://localhost:2019]
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

SERVER = "srv0"


def api(caddy, method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(caddy + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            text = response.read().decode()
            return response.status, (json.loads(text) if text.strip() else None)
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def build_route(domain, web, route_id):
    real_ip = {"request": {"set": {"X-Real-Ip": ["{http.request.remote.host}"]}}}
    return {
        "@id": route_id,
        "match": [{"host": [domain, "www." + domain]}],
        "terminal": True,
        "handle": [{
            "handler": "subroute",
            "routes": [
                # www.<domain> -> <domain>
                {"match": [{"host": ["www." + domain]}],
                 "handle": [{"handler": "static_response", "status_code": 308,
                             "headers": {"Location": ["https://" + domain + "{http.request.uri}"]}}],
                 "terminal": True},
                {"handle": [{"handler": "headers", "response": {"set": {
                    "X-Content-Type-Options": ["nosniff"],
                    "Referrer-Policy": ["strict-origin-when-cross-origin"]}}}]},
                # Website inquiry service (small bodies only).
                {"match": [{"path": ["/website-api/*"]}],
                 "handle": [{"handler": "request_body", "max_size": 16384},
                            {"handler": "reverse_proxy", "upstreams": [{"dial": "127.0.0.1:8011"}], "headers": real_ip}],
                 "terminal": True},
                # Backend API (uploads up to 20 MB). Visitor addresses come from Caddy, never from the visitor.
                {"match": [{"path": ["/api/*"]}],
                 "handle": [{"handler": "request_body", "max_size": 22020096},
                            {"handler": "reverse_proxy", "upstreams": [{"dial": "127.0.0.1:8000"}],
                             "headers": {"request": {"set": {
                                 "X-Real-Ip": ["{http.request.remote.host}"],
                                 "X-Forwarded-For": ["{http.request.remote.host}"]}}}}],
                 "terminal": True},
                # Built files have content-hashed names: cache them for a year.
                {"match": [{"path": ["/assets/*"]}],
                 "handle": [{"handler": "headers", "response": {"set": {
                     "Cache-Control": ["public, max-age=31536000, immutable"]}}},
                            {"handler": "file_server", "root": web}],
                 "terminal": True},
                # The frontend handles its own pages (/dashboard, /reset-password, /inquiry-admin, ...).
                {"match": [{"file": {"root": web, "try_files": ["{http.request.uri.path}", "/index.html"]}}],
                 "handle": [{"handler": "rewrite", "uri": "{http.matchers.file.relative}"}]},
                {"handle": [{"handler": "headers", "response": {"set": {"Cache-Control": ["no-cache"]}}},
                            {"handler": "file_server", "root": web}]},
            ],
        }],
    }


def other_hosts(routes, route_id):
    hosts = []
    for route in routes:
        if route.get("@id") == route_id:
            continue
        for match in route.get("match", []):
            hosts.extend(h for h in match.get("host", []) if "*" not in h)
    return sorted(set(hosts))


def status_of(host, path="/"):
    result = subprocess.run(
        ["curl", "-sk", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10",
         "--resolve", f"{host}:443:127.0.0.1", f"https://{host}{path}"],
        capture_output=True, text=True)
    return result.stdout.strip() or "000"


def snapshot(hosts):
    return {host: status_of(host) for host in hosts}


def changed_sites(before, hosts):
    changed = {}
    for host in hosts:
        now = status_of(host)
        if now != before[host]:
            time.sleep(2)
            now = status_of(host)  # one retry, so a slow site is not mistaken for a broken one
        if now != before[host]:
            changed[host] = (before[host], now)
    return changed


def remove(caddy, route_id):
    status, body = api(caddy, "DELETE", f"/id/{route_id}")
    print(f"Removed route {route_id}." if status == 200 else f"Route {route_id} was not removed: {status} {body}")
    return status == 200


def main():
    args = sys.argv[1:]
    if args and args[0] == "--remove":
        caddy = args[2] if len(args) > 2 else "http://localhost:2019"
        sys.exit(0 if remove(caddy, args[1]) else 1)
    if len(args) < 3:
        sys.exit(__doc__)
    domain, web, route_id = args[0], args[1], args[2]
    caddy = args[3] if len(args) > 3 else "http://localhost:2019"

    status, routes = api(caddy, "GET", f"/config/apps/http/servers/{SERVER}/routes")
    if status != 200 or not isinstance(routes, list):
        sys.exit(f"STOPPED: could not read Caddy routes ({status}).")
    hosts = other_hosts(routes, route_id)
    if domain in hosts or "www." + domain in hosts:
        sys.exit(f"STOPPED: {domain} is already served by another Caddy route.")
    print(f"Checking {len(hosts)} existing websites before the change ...")
    before = snapshot(hosts)

    route = build_route(domain, web, route_id)
    exists = api(caddy, "GET", f"/id/{route_id}")[0] == 200
    if exists:
        status, body = api(caddy, "PATCH", f"/id/{route_id}", route)
    else:
        status, body = api(caddy, "POST", f"/config/apps/http/servers/{SERVER}/routes", route)
    if status != 200:
        sys.exit(f"STOPPED: Caddy refused the route ({status}): {body}")
    print(("Updated" if exists else "Added") + f" route {route_id} for {domain}.")

    time.sleep(3)
    print(f"Checking the {len(hosts)} existing websites again ...")
    changed = changed_sites(before, hosts)
    if changed:
        for host, (old, new) in changed.items():
            print(f"  {host}: answered {old} before, {new} after")
        remove(caddy, route_id)
        sys.exit("STOPPED: an existing website changed, so the new route was removed again. Nothing else was touched.")
    print("All existing websites answer exactly as before.")

    health = "000"
    for _ in range(20):  # the certificate can take a little while
        health = status_of(domain, "/api/v1/health")
        if health == "200":
            break
        time.sleep(3)
    if health == "200":
        print(f"https://{domain} is live (backend health: OK).")
    else:
        print(f"The route is in place, but https://{domain} does not answer yet ({health}).")
        print("Usually the DNS record does not point to this server yet, or the certificate is still being issued.")
        print("Caddy keeps retrying by itself; check again in a few minutes.")


if __name__ == "__main__":
    main()
