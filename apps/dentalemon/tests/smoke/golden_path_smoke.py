#!/usr/bin/env python3
"""Reusable dentalemon golden-path smoke test (Webwright CLI tool mode).

Crafted via Webwright /webwright:craft. Drives a fresh headless Firefox through
the dentalemon golden path and reports a pass/fail per critical point, writing
screenshots + a step log into an output dir. Re-runnable against any
environment by overriding the flags; defaults target the local demo stack.

# Parameters
| flag         | default                      | meaning                                  |
|--------------|------------------------------|------------------------------------------|
| --base-url   | http://localhost:3001        | app origin                               |
| --email      | demo@dentalemon.com          | login email                              |
| --password   | DemoClinic1!                 | login password                           |
| --pin        | 123456                       | 6-digit PIN                              |
| --profile    | Dr. Maria Reyes              | PIN-select profile name                  |
| --out        | ./gp_run                     | output dir (screenshots + log)           |
| --headed     | (flag) off                   | run with a visible browser               |

Exit code 0 iff all 9 critical points pass.

Usage:
    python golden_path_smoke.py
    python golden_path_smoke.py --base-url https://staging.example.com --email qa@x.com
"""
import argparse
import re
import pathlib
import sys
from playwright.sync_api import sync_playwright


def run_golden_path(base_url: str, email: str, password: str, pin: str,
                    profile: str, out: pathlib.Path, headed: bool = False) -> int:
    """Drive the dentalemon golden path and verify 9 critical points.

    Args:
        base_url: App origin, e.g. http://localhost:3001.
        email: Login email.
        password: Login password.
        pin: 6-digit numeric PIN for the chosen profile.
        profile: Display name of the PIN-select profile to sign in as.
        out: Directory for screenshots and the step log (created if absent).
        headed: When True, launch a visible browser (debugging).

    Returns:
        Process exit code: 0 if all critical points pass, else 1.
    """
    shots = out / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    log = out / "smoke_log.txt"
    lines, console = [], []
    results = {}

    def step(n, msg):
        line = f"step {n} action: {msg}"
        print(line); lines.append(line)

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=not headed)
        page = browser.new_page(viewport={"width": 1280, "height": 1800})
        page.on("console", lambda m: console.append(m.text))

        def nav(href):
            page.click(f"a[href='{href}']")
            page.wait_for_load_state("networkidle"); page.wait_for_timeout(900)

        step(0, f"params: base_url={base_url} email={email} profile={profile}")

        # CP1 login
        page.goto(f"{base_url}/auth/sign-in", wait_until="networkidle")
        page.get_by_role("textbox", name=re.compile("email", re.I)).fill(email)
        page.get_by_role("textbox", name=re.compile("password", re.I)).fill(password)
        page.get_by_role("button", name=re.compile(r"^login$", re.I)).click()
        page.wait_for_url("**/auth/pin-select", timeout=15000)
        page.get_by_role("button", name=re.compile(re.escape(profile), re.I)).first.click()
        page.wait_for_url("**/auth/pin-entry/**", timeout=15000)
        for d in pin:
            page.get_by_role("button", name=re.compile(rf"^{d}$")).first.click()
        page.wait_for_url("**/dashboard", timeout=15000)
        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(shots / "01_dashboard.png"))
        results["CP1_login"] = "/dashboard" in page.url
        body = page.inner_text("body")
        results["CP2_dashboard_metrics"] = bool(re.search(r"appointments today", body, re.I)) and bool(re.search(r"₱[\d,]+", body))
        step(1, f"login+dashboard ok={results['CP1_login']} metrics={results['CP2_dashboard_metrics']}")

        # CP3 patients
        nav("/patients")
        n = page.get_by_role("button", name=re.compile("view profile", re.I)).count()
        results["CP3_patient_list"] = n >= 10
        page.screenshot(path=str(shots / "02_patients.png"))
        step(2, f"patients view-profile buttons={n}")

        # CP4 + CP9 profile / console 404
        console.clear()
        page.get_by_role("button", name=re.compile("view profile", re.I)).first.click()
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(1000)
        results["CP4_profile_visits"] = bool(re.search(r"visit", page.inner_text("body"), re.I))
        page.screenshot(path=str(shots / "03_profile.png"))
        errs = [t for t in console if "404" in t or "Failed to load resource" in t]
        results["CP9_no_404_console"] = len(errs) == 0
        step(3, f"profile visits={results['CP4_profile_visits']} console_404={len(errs)}")

        # CP6 calendar side-by-side
        nav("/calendar")
        two = page.locator('[data-appt-cols="2"]')
        boxes = []
        for i in range(two.count()):
            b = two.nth(i).bounding_box(); c = two.nth(i).get_attribute("data-appt-col")
            if b: boxes.append((c, round(b["x"], 1), round(b["x"] + b["width"], 1), round(b["y"], 1)))
        sbs = any(a is not b and abs(a[3] - b[3]) < 5 and a[0] != b[0]
                  and (min(a, b, key=lambda z: z[1])[2] <= max(a, b, key=lambda z: z[1])[1] + 2)
                  for a in boxes for b in boxes)
        results["CP6_calendar_columns"] = two.count() >= 2 and sbs
        page.screenshot(path=str(shots / "04_calendar.png"))
        step(4, f"calendar 2col={two.count()} side_by_side={sbs}")

        # CP7 billing
        nav("/billing")
        bb = page.inner_text("body")
        results["CP7_billing"] = len(re.findall(r"INV-", bb)) >= 1 and bool(re.search(r"₱[\d,]+", bb))
        page.screenshot(path=str(shots / "05_billing.png"))
        step(5, f"billing invoices={len(re.findall(r'INV-', bb))}")

        # CP8 revenue report
        nav("/reports")
        rb = page.inner_text("body")
        results["CP8_revenue"] = all(bool(re.search(x, rb, re.I)) for x in [r"Total Billed", r"Collected", r"₱[1-9][\d,]*"])
        page.screenshot(path=str(shots / "06_revenue.png"))
        step(6, f"revenue populated={results['CP8_revenue']}")

        # CP5 workspace (last — nav dead-end)
        nav("/patients")
        page.get_by_role("button", name=re.compile("open patient record", re.I)).first.click()
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(1300)
        teeth = len(re.findall(r"\b(1[1-8]|2[1-8]|3[1-8]|4[1-8])\b", page.inner_text("body")))
        results["CP5_tooth_chart"] = teeth >= 16
        page.screenshot(path=str(shots / "07_toothchart.png"))
        step(7, f"workspace tooth labels={teeth}")

        browser.close()

    passed = sum(1 for v in results.values() if v)
    datum = f"FINAL DATUM: {passed}/{len(results)} CP pass: " + ", ".join(
        f"{k}={'PASS' if v else 'FAIL'}" for k, v in sorted(results.items()))
    print(datum); lines.append(datum)
    log.write_text("\n".join(lines) + "\n")
    return 0 if passed == len(results) else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="dentalemon golden-path smoke test")
    ap.add_argument("--base-url", default="http://localhost:3001")
    ap.add_argument("--email", default="demo@dentalemon.com")
    ap.add_argument("--password", default="DemoClinic1!")
    ap.add_argument("--pin", default="123456")
    ap.add_argument("--profile", default="Dr. Maria Reyes")
    ap.add_argument("--out", default="./gp_run", type=pathlib.Path)
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()
    return run_golden_path(a.base_url, a.email, a.password, a.pin, a.profile, a.out, a.headed)


if __name__ == "__main__":
    sys.exit(main())
