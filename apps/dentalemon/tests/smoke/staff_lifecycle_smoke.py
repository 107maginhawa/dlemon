#!/usr/bin/env python3
"""Reusable dentalemon staff create/deactivate smoke test (Webwright CLI tool mode).

Crafted via Webwright /webwright:craft. Drives a fresh headless Firefox through
the owner-only staff lifecycle: login -> /staff -> "+ Add Staff" -> fill
name/role/PIN -> create -> assert the member appears -> deactivate that same
member -> assert it is removed from the active list. Creating then deactivating
the same run-unique member keeps the flow net-neutral and re-runnable.

# Parameters
| flag         | default                 | meaning                                            |
|--------------|-------------------------|----------------------------------------------------|
| --base-url   | http://localhost:3003   | app origin                                          |
| --email      | demo@dentalemon.com     | login email                                         |
| --password   | DemoClinic1!            | login password                                      |
| --pin        | 123456                  | owner login PIN                                     |
| --profile    | Dr. Maria Reyes         | PIN-select profile (must be dentist_owner)          |
| --staff-name | (auto: WW Staff <epoch>)| display name of the staff member to create          |
| --role       | Staff - Scheduling      | role button label in the Add Staff form             |
| --staff-pin  | 246810                  | 6-digit PIN assigned to the new member              |
| --out        | ./staff_run             | output dir (screenshots + log)                      |
| --headed     | (flag) off              | run with a visible browser                          |

Exit code 0 iff all 3 critical points pass.

Usage:
    python staff_lifecycle_smoke.py
    python staff_lifecycle_smoke.py --role "Associate Dentist" --staff-pin 135790
    python staff_lifecycle_smoke.py --base-url https://staging.example.com
"""
import argparse
import re
import time
import pathlib
import sys
from playwright.sync_api import sync_playwright


def run_staff_lifecycle(base_url: str, email: str, password: str, pin: str,
                        profile: str, staff_name: str, role: str, staff_pin: str,
                        out: pathlib.Path, headed: bool = False) -> int:
    """Create then deactivate a staff member and verify both transitions.

    Args:
        base_url: App origin, e.g. http://localhost:3003.
        email: Login email.
        password: Login password.
        pin: 6-digit numeric login PIN for the chosen profile.
        profile: PIN-select profile to sign in as; must be a dentist_owner since
            the staff module is owner-only.
        staff_name: Display name of the staff member to create (run-unique).
        role: Role button label in the Add Staff form (e.g. "Staff - Scheduling",
            "Associate Dentist", "Staff - Full Operations").
        staff_pin: 6-digit PIN assigned to the new member (also confirmed).
        out: Directory for screenshots and the step log (created if absent).
        headed: When True, launch a visible browser (debugging).

    Returns:
        Process exit code: 0 if all critical points pass, else 1.
    """
    shots = out / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    log = out / "final_script_log.txt"
    lines = []
    create_status = {"v": None}
    delete_status = {"v": None}
    results = {}

    def step(n, msg):
        line = f"step {n} action: {msg}"
        print(line); lines.append(line)

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=not headed)
        page = browser.new_page(viewport={"width": 1280, "height": 1800})
        page.on("dialog", lambda d: d.accept())  # deactivate uses confirm()

        def on_resp(r):
            if "/dental/org/members" in r.url:
                if r.request.method == "POST" and "/members?" in r.url:
                    create_status["v"] = r.status
                if r.request.method == "DELETE":
                    delete_status["v"] = r.status
        page.on("response", on_resp)

        step(0, f"params: base_url={base_url} email={email} profile={profile} "
                f"staff_name={staff_name} role={role} staff_pin={staff_pin}")

        # ---- login ----
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

        # ---- /staff (owner-only) ----
        page.click("a[href='/staff']")
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(1000)

        # CP1: owner sees the staff module + Add Staff (not access-denied)
        denied = page.locator("[data-testid='staff-access-denied']").count() > 0
        add_btn = page.get_by_role("button", name=re.compile("add staff", re.I))
        results["CP1_owner_access"] = (not denied) and add_btn.count() >= 1
        page.screenshot(path=str(shots / "final_execution_1_staff_list.png"))
        step(1, f"staff module access denied={denied} add_staff_btn={add_btn.count()}")

        # CP2: create a staff member -> POST 201 + appears in list
        add_btn.first.click()
        page.wait_for_timeout(700)
        dlg = page.get_by_role("dialog")
        dlg.get_by_role("textbox", name=re.compile("display name", re.I)).fill(staff_name)
        dlg.get_by_role("button", name=re.compile(re.escape(role), re.I)).first.click()
        dlg.get_by_role("textbox", name=re.compile(r"^PIN", re.I)).fill(staff_pin)
        dlg.get_by_role("textbox", name=re.compile("confirm pin", re.I)).fill(staff_pin)
        page.screenshot(path=str(shots / "final_execution_2_add_form.png"))
        dlg.get_by_role("button", name=re.compile("create staff member", re.I)).click()
        page.wait_for_timeout(2500)
        in_list_after_create = staff_name in page.inner_text("body")
        results["CP2_created"] = create_status["v"] == 201 and in_list_after_create
        page.screenshot(path=str(shots / "final_execution_3_after_create.png"))
        step(2, f"create -> POST status={create_status['v']} in_list={in_list_after_create}")

        # CP3: deactivate the created member -> DELETE 204 + removed from list
        card = page.locator(
            f"xpath=//*[contains(text(),{_xpath_str(staff_name)})]"
            f"/ancestor::*[.//button[contains(.,'Deactivate')]][1]")
        if card.count():
            card.first.get_by_role("button", name=re.compile("deactivate", re.I)).first.click()
        page.wait_for_timeout(2500)
        removed = staff_name not in page.inner_text("body")
        results["CP3_deactivated"] = delete_status["v"] == 204 and removed
        page.screenshot(path=str(shots / "final_execution_4_after_deactivate.png"))
        step(3, f"deactivate -> DELETE status={delete_status['v']} removed_from_list={removed}")

        browser.close()

    passed = sum(1 for v in results.values() if v)
    datum = (f"FINAL DATUM: {passed}/{len(results)} CP pass "
             f"(staff='{staff_name}' role='{role}'): " + ", ".join(
                 f"{k}={'PASS' if v else 'FAIL'}" for k, v in sorted(results.items())))
    print(datum); lines.append(datum)
    log.write_text("\n".join(lines) + "\n")
    return 0 if passed == len(results) else 1


def _xpath_str(s: str) -> str:
    """Quote *s* safely for an XPath string literal (handles embedded quotes)."""
    if "'" not in s:
        return f"'{s}'"
    if '"' not in s:
        return f'"{s}"'
    parts = s.split("'")
    return "concat(" + ", \"'\", ".join(f"'{p}'" for p in parts) + ")"


def main() -> int:
    ap = argparse.ArgumentParser(description="dentalemon staff create/deactivate smoke test")
    ap.add_argument("--base-url", default="http://localhost:3003")
    ap.add_argument("--email", default="demo@dentalemon.com")
    ap.add_argument("--password", default="DemoClinic1!")
    ap.add_argument("--pin", default="123456")
    ap.add_argument("--profile", default="Dr. Maria Reyes")
    ap.add_argument("--staff-name", dest="staff_name", default=None,
                    help="display name to create (default: WW Staff <epoch>)")
    ap.add_argument("--role", default="Staff - Scheduling",
                    help="role button label (Staff - Scheduling / Associate Dentist / Staff - Full Operations)")
    ap.add_argument("--staff-pin", dest="staff_pin", default="246810")
    ap.add_argument("--out", default="./staff_run", type=pathlib.Path)
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()
    staff_name = a.staff_name if a.staff_name is not None else f"WW Staff {int(time.time())}"
    return run_staff_lifecycle(a.base_url, a.email, a.password, a.pin, a.profile,
                               staff_name, a.role, a.staff_pin, a.out, a.headed)


if __name__ == "__main__":
    sys.exit(main())
