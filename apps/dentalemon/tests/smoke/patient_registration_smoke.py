#!/usr/bin/env python3
"""Reusable dentalemon patient-registration smoke test (Webwright CLI tool mode).

Crafted via Webwright /webwright:craft. Drives a fresh headless Firefox through
the dentalemon patient-registration flow (login -> /patients -> "+ New Patient"
modal -> fill name/DOB/gender/consent -> submit) and verifies the new patient is
persisted, appears in the branch patient list, and is findable by FULL NAME via
the search box. Re-runnable against any environment by overriding the flags.

# Parameters
| flag          | default                 | meaning                                       |
|---------------|-------------------------|-----------------------------------------------|
| --base-url    | http://localhost:3003   | app origin                                    |
| --email       | demo@dentalemon.com     | login email                                   |
| --password    | DemoClinic1!            | login password                                |
| --pin         | 123456                  | 6-digit PIN                                   |
| --profile     | Dr. Maria Reyes         | PIN-select profile name                       |
| --first-name  | Webwright               | new patient first name                        |
| --last-name   | Smoketest               | new patient last name (search spans both)     |
| --suffix      | (auto: epoch seconds)   | uniquifier appended to last name per run      |
| --dob         | 1990-05-15              | date of birth (yyyy-mm-dd)                    |
| --gender      | Female                  | gender option label                           |
| --out         | ./pr_run                | output dir (screenshots + log)                |
| --headed      | (flag) off              | run with a visible browser                    |

Exit code 0 iff all 4 critical points pass.

Usage:
    python patient_registration_smoke.py
    python patient_registration_smoke.py --first-name Juan --last-name Cruz
    python patient_registration_smoke.py --base-url https://staging.example.com
"""
import argparse
import re
import time
import pathlib
import sys
from playwright.sync_api import sync_playwright


def register_patient(base_url: str, email: str, password: str, pin: str,
                     profile: str, first_name: str, last_name: str, suffix: str,
                     dob: str, gender: str, out: pathlib.Path,
                     headed: bool = False) -> int:
    """Register a new patient via the modal and verify it across list + search.

    Args:
        base_url: App origin, e.g. http://localhost:3003.
        email: Login email.
        password: Login password.
        pin: 6-digit numeric PIN for the chosen profile.
        profile: Display name of the PIN-select profile to sign in as.
        first_name: New patient's first name (search matches this field).
        last_name: New patient's last name; ``suffix`` is appended for uniqueness.
        suffix: Per-run uniquifier appended to ``last_name`` so each run creates a
            distinct, verifiable patient. Defaults to epoch seconds.
        dob: Date of birth as yyyy-mm-dd (HTML date input).
        gender: Gender <select> option label (Male/Female/Other/Prefer not to say).
        out: Directory for screenshots and the step log (created if absent).
        headed: When True, launch a visible browser (debugging).

    Returns:
        Process exit code: 0 if all critical points pass, else 1.
    """
    full_last = f"{last_name} {suffix}".strip()
    full_name = f"{first_name} {full_last}".strip()
    shots = out / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    log = out / "final_script_log.txt"
    lines = []
    post_status = {"v": None}
    results = {}

    def step(n, msg):
        line = f"step {n} action: {msg}"
        print(line); lines.append(line)

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=not headed)
        page = browser.new_page(viewport={"width": 1280, "height": 1800})

        def on_resp(r):
            if "/dental/patients" in r.url and r.request.method == "POST":
                post_status["v"] = r.status
        page.on("response", on_resp)

        step(0, f"params: base_url={base_url} email={email} profile={profile} "
                f"first_name={first_name} last_name={full_last} dob={dob} gender={gender}")

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

        # ---- /patients ----
        page.click("a[href='/patients']")
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(800)

        # CP1: open the registration modal
        page.get_by_role("button", name=re.compile("new patient", re.I)).first.click()
        page.wait_for_timeout(700)
        dlg = page.get_by_role("dialog")
        results["CP1_modal_open"] = dlg.count() >= 1 and bool(
            re.search(r"register", dlg.first.inner_text(), re.I))
        page.screenshot(path=str(shots / "final_execution_1_modal_open.png"))
        step(1, f"registration modal open={results['CP1_modal_open']}")

        # CP2: fill + submit -> POST 201
        dlg.get_by_role("textbox", name=re.compile("full name", re.I)).fill(full_name)
        dlg.get_by_role("textbox", name=re.compile("date of birth", re.I)).fill(dob)
        dlg.get_by_role("combobox", name=re.compile("gender", re.I)).select_option(label=gender)
        dlg.get_by_role("checkbox", name=re.compile("provided consent", re.I)).check()
        page.screenshot(path=str(shots / "final_execution_2_form_filled.png"))
        dlg.get_by_role("button", name=re.compile("register patient", re.I)).click()
        page.wait_for_timeout(2500)
        results["CP2_post_201"] = post_status["v"] == 201
        step(2, f"submit -> POST status={post_status['v']}")

        # CP3: new patient appears in the branch list (search by first name token,
        # which the list reliably matches, and confirm a row renders)
        sb = page.locator("input[placeholder*='earch' i]").first
        sb.fill(first_name)
        page.wait_for_timeout(1500)
        page.screenshot(path=str(shots / "final_execution_3_list_after_create.png"))
        body3 = page.inner_text("body")
        rows3 = page.get_by_role("button", name=re.compile("view profile", re.I)).count()
        # The row card renders the last-name header in UPPERCASE, so assert on the
        # run-unique numeric suffix (never case-transformed) plus a visible row.
        results["CP3_in_list"] = rows3 >= 1 and (suffix in body3)
        step(3, f"first-name search rows={rows3} suffix_visible={suffix in body3} "
                f"in_list={results['CP3_in_list']}")

        # CP4: FULL-NAME search finds the new patient (regression guard for the
        # firstName||' '||lastName search fix). A row must remain after typing
        # the entire "first last" string.
        sb.fill("")
        sb.fill(full_name)
        page.wait_for_timeout(1700)
        page.screenshot(path=str(shots / "final_execution_4_fullname_search.png"))
        rows = page.get_by_role("button", name=re.compile("view profile", re.I)).count()
        body4 = page.inner_text("body")
        results["CP4_fullname_search"] = rows >= 1 and (suffix in body4)
        step(4, f"full-name search '{full_name}' rows={rows} suffix_visible={suffix in body4} "
                f"found={results['CP4_fullname_search']}")

        browser.close()

    passed = sum(1 for v in results.values() if v)
    datum = (f"FINAL DATUM: {passed}/{len(results)} CP pass "
             f"(patient='{full_name}'): " + ", ".join(
                 f"{k}={'PASS' if v else 'FAIL'}" for k, v in sorted(results.items())))
    print(datum); lines.append(datum)
    log.write_text("\n".join(lines) + "\n")
    return 0 if passed == len(results) else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="dentalemon patient-registration smoke test")
    ap.add_argument("--base-url", default="http://localhost:3003")
    ap.add_argument("--email", default="demo@dentalemon.com")
    ap.add_argument("--password", default="DemoClinic1!")
    ap.add_argument("--pin", default="123456")
    ap.add_argument("--profile", default="Dr. Maria Reyes")
    ap.add_argument("--first-name", dest="first_name", default="Webwright")
    ap.add_argument("--last-name", dest="last_name", default="Smoketest")
    ap.add_argument("--suffix", default=None,
                    help="uniquifier appended to last name (default: epoch seconds)")
    ap.add_argument("--dob", default="1990-05-15")
    ap.add_argument("--gender", default="Female")
    ap.add_argument("--out", default="./pr_run", type=pathlib.Path)
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()
    suffix = a.suffix if a.suffix is not None else str(int(time.time()))
    return register_patient(a.base_url, a.email, a.password, a.pin, a.profile,
                            a.first_name, a.last_name, suffix, a.dob, a.gender,
                            a.out, a.headed)


if __name__ == "__main__":
    sys.exit(main())
