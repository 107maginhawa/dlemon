#!/usr/bin/env python3
"""Reusable dentalemon PERSON-module (profile onboarding) smoke test.

Crafted via Webwright /webwright:craft. Drives a fresh headless Firefox through
the dentalemon person-module workflow — the ONLY FE surface for the base person
module — which is: brand-new email signup -> onboarding wizard -> create the
user's OWN Person profile (createPerson) -> profile is readable (getPerson 'me').

Because demo users already have a Person, the requireNoPerson guard would bounce
them off /onboarding, so this smoke ALWAYS signs up a brand-new run-unique email
user. After signup the better-auth-ui client parks an unverified user on
/verify-email (the requireEmailVerified router guard is active); the dev-only
endpoint POST /dev/verify-email (NODE_ENV!=production) marks the session user's
email verified so the onboarding guard passes — the documented E2E mechanism.

Critical points:
  CP1  signup -> reaches /onboarding "Step 1 of 2: Personal Information"
  CP2  fill name + pick DOB via the calendar popover -> Next -> "Step 2 of 2"
  CP3  "Skip for now" -> createPerson POST /persons returns 201 (own profile)
  CP4  GET /persons/me returns 200 (just-created profile is readable = coherence)
  CP5  RBAC/owner guard: re-navigating to /onboarding no longer lands on
       /onboarding (requireNoPerson redirects an already-onboarded user away)

# Parameters
| flag          | default                 | meaning                                       |
|---------------|-------------------------|-----------------------------------------------|
| --base-url    | http://localhost:3003   | app origin                                    |
| --api-url     | http://localhost:7213   | API origin (dev verify-email endpoint)        |
| --password    | SweepTest1!             | signup password (>=8 chars)                   |
| --first-name  | Smoke                   | profile first name                            |
| --last-name   | Person                  | profile last name (epoch suffix appended)     |
| --dob-year    | 1990                    | date-of-birth year (4-digit, in the past)     |
| --suffix      | (auto: epoch seconds)   | per-run uniquifier for email + last name      |
| --out         | ./person_run            | output dir (screenshots + log)                |
| --headed      | (flag) off              | run with a visible browser                    |

Exit code 0 iff all 5 critical points pass.

Usage:
    python person_smoke.py
    python person_smoke.py --first-name Maria --dob-year 1985
    python person_smoke.py --base-url https://staging.example.com
"""
import argparse
import re
import time
import pathlib
import sys
from playwright.sync_api import sync_playwright


def onboard_person(base_url: str, api_url: str, password: str, first_name: str,
                   last_name: str, dob_year: str, suffix: str,
                   out: pathlib.Path, headed: bool = False) -> int:
    """Drive the person-module onboarding workflow and verify it end-to-end.

    Signs up a brand-new run-unique user, verifies the email via the dev-only
    endpoint, completes the 2-step onboarding wizard (personal info + skip
    address), and asserts the Person profile is created (createPerson 201) and
    readable (getPerson 'me' 200), then asserts the already-onboarded user can
    no longer re-enter /onboarding (requireNoPerson owner guard).

    Args:
        base_url: App origin, e.g. http://localhost:3003.
        api_url: API origin used for the dev-only POST /dev/verify-email call,
            e.g. http://localhost:7213.
        password: Signup password; must be >= 8 chars.
        first_name: Profile first name entered in onboarding step 1.
        last_name: Profile last name; ``suffix`` is appended for uniqueness.
        dob_year: Date-of-birth year as a 4-digit string in the past (selected
            in the calendar popover's year dropdown), e.g. "1990".
        suffix: Per-run uniquifier appended to the email local-part and last
            name so each run signs up a distinct account. Defaults to epoch s.
        out: Directory for screenshots and the step log (created if absent).
        headed: When True, launch a visible browser (debugging).

    Returns:
        Process exit code: 0 if all critical points pass, else 1.
    """
    epoch = suffix
    email = f"person_smoke_{epoch}@example.com"
    name = f"{first_name} {epoch}"
    full_last = f"{last_name}{epoch}"
    shots = out / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    log = out / "final_script_log.txt"
    lines = []
    results = {}
    status = {"create": None, "me": None}

    def step(n, msg):
        line = f"step {n} action: {msg}"
        print(line); lines.append(line)

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=not headed)
        page = browser.new_page(viewport={"width": 1280, "height": 1800})

        def on_resp(r):
            if r.url.endswith("/persons") and r.request.method == "POST":
                status["create"] = r.status
            if "/persons/me" in r.url and r.request.method == "GET":
                status["me"] = r.status
        page.on("response", on_resp)

        step(0, f"params: base_url={base_url} api_url={api_url} email={email} "
                f"first_name={first_name} last_name={full_last} dob_year={dob_year}")

        # ---- CP1: signup -> onboarding ----
        page.goto(f"{base_url}/auth/sign-up", wait_until="networkidle")
        page.get_by_role("textbox", name=re.compile("^name$", re.I)).fill(name)
        page.get_by_role("textbox", name=re.compile("email", re.I)).fill(email)
        page.get_by_role("textbox", name=re.compile("password", re.I)).fill(password)
        page.get_by_role("button", name=re.compile("create an account", re.I)).click()
        page.wait_for_timeout(2800)
        # Dev-only email verification so the onboarding guard (requireEmailVerified)
        # lets the brand-new session through. Uses the browser's better-auth cookie.
        verify = page.evaluate(
            """async (api) => {
                const r = await fetch(api + '/dev/verify-email', {method:'POST', credentials:'include'});
                return r.status;
            }""", api_url)
        page.goto(f"{base_url}/onboarding", wait_until="networkidle")
        page.wait_for_timeout(1800)
        body1 = page.inner_text("body")
        results["CP1_reaches_onboarding"] = (
            page.url.rstrip("/").endswith("/onboarding")
            and "Step 1 of 2" in body1
            and "Personal Information" in body1)
        page.screenshot(path=str(shots / "final_execution_1_onboarding_step1.png"))
        step(1, f"signup->verify({verify})->onboarding url={page.url} "
                f"step1_visible={results['CP1_reaches_onboarding']}")

        # ---- CP2: step 1 personal info -> Next -> step 2 ----
        page.get_by_role("textbox", name=re.compile("first name", re.I)).fill(first_name)
        page.get_by_role("textbox", name=re.compile("last name", re.I)).fill(full_last)
        # Date of Birth: open the calendar popover, choose year + month, click a day.
        page.get_by_role("button", name=re.compile("date of birth", re.I)).click()
        page.wait_for_timeout(600)
        page.locator("select[aria-label='Choose the Year']").select_option(label=dob_year)
        page.wait_for_timeout(300)
        page.locator("select[aria-label='Choose the Month']").select_option(label="Jun")
        page.wait_for_timeout(400)
        page.get_by_role("button", name=re.compile(rf"June 15th, {dob_year}", re.I)).first.click()
        page.wait_for_timeout(400)
        # Gender is optional; set it to exercise the Select control.
        page.get_by_role("combobox", name=re.compile("gender", re.I)).click()
        page.wait_for_timeout(300)
        page.get_by_role("option", name=re.compile("^male$", re.I)).click()
        page.wait_for_timeout(300)
        page.screenshot(path=str(shots / "final_execution_2_step1_filled.png"))
        page.get_by_role("button", name=re.compile(r"^next$", re.I)).click()
        page.wait_for_timeout(1300)
        body2 = page.inner_text("body")
        results["CP2_advances_to_step2"] = "Step 2 of 2" in body2 and "Address" in body2
        page.screenshot(path=str(shots / "final_execution_3_step2_address.png"))
        step(2, f"step1 filled + DOB={dob_year}-06-15 -> Next -> "
                f"step2_visible={results['CP2_advances_to_step2']}")

        # ---- CP3: skip address -> createPerson 201 -> leaves onboarding ----
        page.get_by_role("button", name=re.compile("skip for now", re.I)).click()
        # The app navigates off /onboarding once the person is created (to /dashboard,
        # which for a membership-less user then forwards to /dental-onboarding).
        try:
            page.wait_for_url(lambda u: "/onboarding" not in u, timeout=15000)
        except Exception:
            pass
        page.wait_for_timeout(2500)
        results["CP3_create_201"] = status["create"] == 201 and "/onboarding" not in page.url
        page.screenshot(path=str(shots / "final_execution_4_after_create.png"))
        step(3, f"skip address -> POST /persons status={status['create']} "
                f"left_onboarding={'/onboarding' not in page.url} url={page.url}")

        # ---- CP4: getPerson 'me' 200 — the created profile is readable ----
        results["CP4_me_readable"] = status["me"] == 200
        step(4, f"GET /persons/me status={status['me']} readable={results['CP4_me_readable']}")

        # ---- CP5: RBAC / owner guard — cannot re-enter onboarding ----
        page.goto(f"{base_url}/onboarding", wait_until="networkidle")
        page.wait_for_timeout(1800)
        results["CP5_owner_guard_blocks_reentry"] = "/onboarding" not in page.url
        page.screenshot(path=str(shots / "final_execution_5_reentry_blocked.png"))
        step(5, f"re-navigate /onboarding -> url={page.url} "
                f"blocked={results['CP5_owner_guard_blocks_reentry']}")

        browser.close()

    passed = sum(1 for v in results.values() if v)
    for k in sorted(results):
        print(f"{k.split('_')[0]} {'PASS' if results[k] else 'FAIL'}: {k}")
    datum = (f"FINAL DATUM: {passed}/{len(results)} CP pass "
             f"(email={email}): " + ", ".join(
                 f"{k}={'PASS' if v else 'FAIL'}" for k, v in sorted(results.items())))
    print(datum); lines.append(datum)
    log.write_text("\n".join(lines) + "\n")
    return 0 if passed == len(results) else 1


def main() -> int:
    ap = argparse.ArgumentParser(
        description=onboard_person.__doc__.splitlines()[0])
    ap.add_argument("--base-url", default="http://localhost:3003",
                    help="App origin, e.g. http://localhost:3003.")
    ap.add_argument("--api-url", default="http://localhost:7213",
                    help="API origin for the dev POST /dev/verify-email call.")
    ap.add_argument("--password", default="SweepTest1!",
                    help="Signup password; must be >= 8 chars.")
    ap.add_argument("--first-name", dest="first_name", default="Smoke",
                    help="Profile first name entered in onboarding step 1.")
    ap.add_argument("--last-name", dest="last_name", default="Person",
                    help="Profile last name; suffix appended for uniqueness.")
    ap.add_argument("--dob-year", dest="dob_year", default="1990",
                    help="Date-of-birth year, 4-digit string in the past.")
    ap.add_argument("--suffix", default=None,
                    help="Per-run uniquifier for email + last name (default: epoch seconds).")
    ap.add_argument("--out", default="./person_run", type=pathlib.Path,
                    help="Output dir for screenshots + log.")
    ap.add_argument("--headed", action="store_true",
                    help="Run with a visible browser (debugging).")
    a = ap.parse_args()
    suffix = a.suffix if a.suffix is not None else str(int(time.time()))
    return onboard_person(a.base_url, a.api_url, a.password, a.first_name,
                          a.last_name, a.dob_year, suffix, a.out, a.headed)


if __name__ == "__main__":
    sys.exit(main())
