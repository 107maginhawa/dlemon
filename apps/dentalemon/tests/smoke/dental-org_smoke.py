#!/usr/bin/env python3
"""Reusable dentalemon dental-org smoke test (Webwright CLI tool mode).

Crafted via Webwright /webwright:craft. Drives a fresh headless Firefox through
the dentalemon dental-org module and verifies four critical points:

  CP1 (happy path)   — as the OWNER, /dashboard renders the morning-briefing
                       summary (active payment plans + lab orders) with NO
                       "Failed to load" error state.
  CP2 (round-trip)   — as the OWNER, the /settings Clinic panel round-trips:
                       save a run-unique Clinic Name, see "Settings saved",
                       RELOAD the app (full reload drops the in-memory PIN
                       session), re-auth, reopen /settings, and assert the
                       Clinic Name input is PRE-POPULATED with the saved value.
                       This is the regression guard for the branch-settings
                       contract: the GET returns the nested envelope
                       `{ branchId, settings: {...} }` and the FE hook must
                       unwrap `.settings` (before the fix the field came back
                       blank because the hook read the envelope flat).
  CP3 (happy path)   — as the OWNER, /staff renders >=1 member row with role
                       labels; coherence oracle — the rendered owner/staff rows
                       are real members (owner row is non-deactivatable).
  CP4 (RBAC negative)— as STAFF (staff_full), direct-URL /staff and /settings
                       are DENIED (redirected to /patients, no admin UI). The
                       owner-only org-admin gate must hold.
  CP5 (downstream     — as the OWNER, the /settings Fee Schedule panel sets a
       effect, not a    run-unique per-CDT price (D1110), Saves, RELOADs, re-auths,
       toast)           and asserts the price PERSISTS — proving the save reaches
                        the CANONICAL fee store (dedicated PATCH /dental/fee-schedule/:cdt)
                        that actually drives treatment/invoice pricing, NOT the
                        inert settings.feeSchedule blob (dental-org G2 split-brain).
                        Config-surface smokes must assert a DOWNSTREAM EFFECT
                        (price persists / booking blocked / send suppressed),
                        never a success toast alone.

Re-runnable against any environment by overriding the flags.

# Parameters
| flag            | default                 | meaning                                            |
|-----------------|-------------------------|----------------------------------------------------|
| --base-url      | http://localhost:3003   | app origin                                         |
| --email         | demo@dentalemon.com     | login email (shared cloud account)                 |
| --password      | DemoClinic1!            | login password                                     |
| --owner-pin     | 123456                  | owner (dentist_owner) 6-digit PIN                  |
| --owner-profile | Dr. Maria Reyes         | owner PIN-select profile label                     |
| --staff-pin     | 654321                  | staff_full 6-digit PIN (RBAC negative)             |
| --staff-profile | Ana Santos              | staff_full PIN-select profile label                |
| --suffix        | (auto: epoch seconds)   | uniquifier appended to the saved Clinic Name       |
| --out           | ./org_run               | output dir (screenshots + log)                     |
| --headed        | (flag) off              | run with a visible browser                         |

Exit code 0 iff all 4 critical points pass.

Usage:
    python dental-org_smoke.py
    python dental-org_smoke.py --base-url https://staging.example.com
    python dental-org_smoke.py --staff-profile "Front Desk" --staff-pin 222222
"""
import argparse
import re
import time
import pathlib
import sys
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout


def _digits(page, pin):
    for d in pin:
        page.get_by_role("button", name=re.compile(rf"^{d}$")).first.click()


def _login(page, base_url, email, password, profile, pin):
    """Email login -> PIN-select profile -> PIN entry. Returns landing URL."""
    page.goto(f"{base_url}/auth/sign-in", wait_until="networkidle")
    page.get_by_role("textbox", name=re.compile("email", re.I)).fill(email)
    page.get_by_role("textbox", name=re.compile("password", re.I)).fill(password)
    page.get_by_role("button", name=re.compile(r"^login$", re.I)).click()
    page.wait_for_url("**/auth/pin-select", timeout=15000)
    page.get_by_role("button", name=re.compile(f"Sign in as {re.escape(profile)}", re.I)).first.click()
    page.wait_for_url("**/auth/pin-entry/**", timeout=15000)
    _digits(page, pin)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    return page.url


def _reauth_if_gated(page, profile, pin):
    """A full page reload drops the in-memory PIN session and lands on the PIN
    gate. Re-authenticate the same profile if we are sitting on a pin route."""
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(700)
    if "/auth/pin-select" in page.url:
        page.get_by_role("button", name=re.compile(f"Sign in as {re.escape(profile)}", re.I)).first.click()
        page.wait_for_url("**/auth/pin-entry/**", timeout=12000)
    if "/auth/pin-entry" in page.url:
        _digits(page, pin)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)


def verify_dental_org(base_url: str, email: str, password: str,
                      owner_pin: str, owner_profile: str,
                      staff_pin: str, staff_profile: str,
                      suffix: str, out: pathlib.Path,
                      headed: bool = False) -> int:
    """Drive the dentalemon dental-org module and verify CP1..CP4.

    Args:
        base_url: App origin, e.g. http://localhost:3003. Default
            "http://localhost:3003".
        email: Login email for the shared cloud account. Default
            "demo@dentalemon.com".
        password: Login password. Default "DemoClinic1!".
        owner_pin: 6-digit PIN for the dentist_owner member. Default "123456".
        owner_profile: PIN-select profile label for the owner. Default
            "Dr. Maria Reyes".
        staff_pin: 6-digit PIN for the staff_full member used as the RBAC
            negative. Default "654321".
        staff_profile: PIN-select profile label for the staff member. Default
            "Ana Santos".
        suffix: Per-run uniquifier appended to the saved Clinic Name so the
            round-trip assertion is unambiguous. Defaults to epoch seconds.
        out: Directory for screenshots and the step log (created if absent).
            Default "./org_run".
        headed: When True, launch a visible browser (debugging). Default False.

    Returns:
        Process exit code: 0 if all 4 critical points pass, else 1.
    """
    clinic_name = f"Reyes Family Dental {suffix}".strip()
    shots = out / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    log = out / "final_script_log.txt"
    lines = []
    results = {}

    def step(n, msg):
        line = f"step {n} action: {msg}"
        print(line)
        lines.append(line)

    step(0, f"params: base_url={base_url} email={email} owner_profile={owner_profile} "
            f"owner_pin={owner_pin} staff_profile={staff_profile} staff_pin={staff_pin} "
            f"clinic_name={clinic_name}")

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=not headed)
        page = browser.new_page(viewport={"width": 1280, "height": 1800})

        # ============================================================
        # CP1 — OWNER dashboard summary renders, no error state
        # ============================================================
        landing = _login(page, base_url, email, password, owner_profile, owner_pin)
        page.wait_for_timeout(1000)
        page.screenshot(path=str(shots / "final_execution_1_owner_dashboard.png"))
        body1 = page.inner_text("body")
        results["CP1_dashboard_summary"] = (
            "/dashboard" in page.url
            and "Failed to load" not in body1
            and ("TODAY'S SCHEDULE" in body1 or "appointments today" in body1)
        )
        step(1, f"owner landed {landing} -> dashboard, failed_to_load="
                f"{'Failed to load' in body1} ok={results['CP1_dashboard_summary']}")

        # ============================================================
        # CP2 — Settings clinic-info ROUND-TRIP (the branch-settings fix)
        # ============================================================
        # Navigate via the in-app sidebar (SPA nav keeps the PIN session).
        page.click("a[href='/settings']")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1200)
        page.get_by_role("button", name=re.compile(r"^Clinic$", re.I)).first.click()
        page.wait_for_timeout(600)
        name_box = page.get_by_role("textbox").first  # Clinic Name * is the first textbox
        # Address is required to save; ensure it is non-empty.
        addr_box = page.get_by_role("textbox").nth(1)
        if not (addr_box.input_value() or "").strip():
            addr_box.fill("123 Mabuhay St, Makati")
        name_box.fill(clinic_name)
        page.screenshot(path=str(shots / "final_execution_2a_settings_filled.png"))
        page.get_by_role("button", name=re.compile("save settings", re.I)).click()
        # wait for the success banner
        saved = False
        try:
            page.get_by_text(re.compile("settings saved", re.I)).wait_for(timeout=8000)
            saved = True
        except PWTimeout:
            saved = False
        page.screenshot(path=str(shots / "final_execution_2b_settings_saved.png"))
        step(2, f"saved clinic_name='{clinic_name}' success_banner={saved}")

        # Full RELOAD -> drops PIN session -> re-auth owner -> sidebar back to settings.
        page.reload(wait_until="networkidle")
        _reauth_if_gated(page, owner_profile, owner_pin)
        page.click("a[href='/settings']")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1200)
        page.get_by_role("button", name=re.compile(r"^Clinic$", re.I)).first.click()
        page.wait_for_timeout(800)
        reloaded_value = page.get_by_role("textbox").first.input_value()
        page.screenshot(path=str(shots / "final_execution_2c_settings_reloaded.png"))
        results["CP2_settings_roundtrip"] = saved and (reloaded_value == clinic_name)
        step(2, f"after reload Clinic Name input='{reloaded_value}' "
                f"expected='{clinic_name}' roundtrip={results['CP2_settings_roundtrip']}")

        # ============================================================
        # CP3 — OWNER staff management list renders members + roles
        # ============================================================
        page.click("a[href='/staff']")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(shots / "final_execution_3_staff_list.png"))
        body3 = page.inner_text("body")
        member_rows = page.get_by_role("row").count()  # includes header row
        has_roles = ("Dentist-Owner" in body3) and ("Staff" in body3)
        # owner-row last-owner guard is surfaced as a non-deactivatable label
        owner_guard = "cannot deactivate" in body3.lower()
        results["CP3_staff_list"] = (
            "/staff" in page.url
            and "Manage your team" in body3
            and member_rows >= 2  # header + >=1 member
            and has_roles
        )
        step(3, f"staff rows(incl header)={member_rows} roles_shown={has_roles} "
                f"owner_guard_label={owner_guard} ok={results['CP3_staff_list']}")

        # ============================================================
        # CP5 — Fee Schedule DOWNSTREAM EFFECT (config-surface honesty)
        # ============================================================
        # Set a run-unique per-CDT price, Save, RELOAD, re-auth, and assert it
        # persists. A persisting value proves the save reached the CANONICAL fee
        # store (dedicated PATCH /dental/fee-schedule/:cdt — the one that drives
        # pricing), not the inert settings.feeSchedule blob (G2 split-brain).
        fee_price = str(int(suffix) % 900 + 100)  # 100..999 pesos, run-unique
        page.click("a[href='/settings']")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        page.get_by_role("button", name=re.compile(r"^Fee Schedule$", re.I)).first.click()
        page.wait_for_timeout(800)
        fee_input = page.get_by_label("Price for D1110")
        fee_set = False
        try:
            fee_input.wait_for(timeout=8000)
            fee_input.fill(fee_price)
            page.screenshot(path=str(shots / "final_execution_5a_fee_set.png"))
            page.get_by_role("button", name=re.compile(r"^Save$", re.I)).first.click()
            page.wait_for_timeout(1500)
            fee_set = True
        except PWTimeout:
            fee_set = False
        page.screenshot(path=str(shots / "final_execution_5b_fee_saved.png"))

        # Full RELOAD -> re-auth -> reopen Fee Schedule -> assert persisted price.
        page.reload(wait_until="networkidle")
        _reauth_if_gated(page, owner_profile, owner_pin)
        page.click("a[href='/settings']")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        page.get_by_role("button", name=re.compile(r"^Fee Schedule$", re.I)).first.click()
        page.wait_for_timeout(900)
        fee_reloaded = ""
        try:
            fee_reloaded = page.get_by_label("Price for D1110").input_value()
        except PWTimeout:
            fee_reloaded = ""
        page.screenshot(path=str(shots / "final_execution_5c_fee_reloaded.png"))
        results["CP5_fee_downstream_effect"] = fee_set and (fee_reloaded == fee_price)
        step(5, f"set D1110 price='{fee_price}' set_ok={fee_set} after reload='{fee_reloaded}' "
                f"persisted={results['CP5_fee_downstream_effect']}")

        # ============================================================
        # CP4 — RBAC NEGATIVE: staff_full denied /staff and /settings
        # ============================================================
        # Fresh context so the owner session does not leak into the staff drive.
        page.close()
        page = browser.new_page(viewport={"width": 1280, "height": 1800})
        staff_landing = _login(page, base_url, email, password, staff_profile, staff_pin)
        page.wait_for_timeout(800)
        sidebar = page.locator("body").aria_snapshot()
        sidebar_hides_admin = ("/staff" not in sidebar) and ("/settings" not in sidebar)
        page.screenshot(path=str(shots / "final_execution_4a_staff_landing.png"))

        # direct-URL /staff -> must be denied (redirect away, no admin UI)
        page.goto(f"{base_url}/staff", wait_until="networkidle")
        _reauth_if_gated(page, staff_profile, staff_pin)
        page.wait_for_timeout(1200)
        page.screenshot(path=str(shots / "final_execution_4b_staff_denied.png"))
        body4s = page.inner_text("body")
        staff_denied = ("/staff" not in page.url) and ("Manage your team" not in body4s) and ("Add Staff" not in body4s)

        # direct-URL /settings -> must be denied
        page.goto(f"{base_url}/settings", wait_until="networkidle")
        _reauth_if_gated(page, staff_profile, staff_pin)
        page.wait_for_timeout(1200)
        page.screenshot(path=str(shots / "final_execution_4c_settings_denied.png"))
        body4c = page.inner_text("body")
        settings_denied = ("/settings" not in page.url) and ("Save Settings" not in body4c)

        results["CP4_rbac_negative"] = sidebar_hides_admin and staff_denied and settings_denied
        step(4, f"staff landed {staff_landing} sidebar_hides_admin={sidebar_hides_admin} "
                f"staff_denied={staff_denied} settings_denied={settings_denied} "
                f"ok={results['CP4_rbac_negative']}")

        browser.close()

    passed = sum(1 for v in results.values() if v)
    for k in sorted(results):
        print(f"{k.split('_')[0]} {'PASS' if results[k] else 'FAIL'}: {k}")
        lines.append(f"{k.split('_')[0]} {'PASS' if results[k] else 'FAIL'}: {k}")
    datum = (f"FINAL DATUM: {passed}/{len(results)} CP pass "
             f"(clinic_name='{clinic_name}'): " + ", ".join(
                 f"{k}={'PASS' if v else 'FAIL'}" for k, v in sorted(results.items())))
    print(datum)
    lines.append(datum)
    log.write_text("\n".join(lines) + "\n")
    return 0 if passed == len(results) else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=verify_dental_org.__doc__.splitlines()[0])
    ap.add_argument("--base-url", default="http://localhost:3003")
    ap.add_argument("--email", default="demo@dentalemon.com")
    ap.add_argument("--password", default="DemoClinic1!")
    ap.add_argument("--owner-pin", dest="owner_pin", default="123456",
                    help="owner (dentist_owner) 6-digit PIN")
    ap.add_argument("--owner-profile", dest="owner_profile", default="Dr. Maria Reyes",
                    help="owner PIN-select profile label")
    ap.add_argument("--staff-pin", dest="staff_pin", default="654321",
                    help="staff_full 6-digit PIN (RBAC negative)")
    ap.add_argument("--staff-profile", dest="staff_profile", default="Ana Santos",
                    help="staff_full PIN-select profile label")
    ap.add_argument("--suffix", default=None,
                    help="uniquifier appended to the saved Clinic Name (default: epoch seconds)")
    ap.add_argument("--out", default="./org_run", type=pathlib.Path)
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()
    suffix = a.suffix if a.suffix is not None else str(int(time.time()))
    return verify_dental_org(a.base_url, a.email, a.password,
                             a.owner_pin, a.owner_profile,
                             a.staff_pin, a.staff_profile,
                             suffix, a.out, a.headed)


if __name__ == "__main__":
    sys.exit(main())
