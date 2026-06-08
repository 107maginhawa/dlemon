#!/usr/bin/env python3
"""Reusable dentalemon dental-patient smoke test (Webwright CLI tool mode).

Crafted via Webwright /webwright:craft. Drives a fresh headless Firefox through
the broader dental-patient surface (beyond patient_registration_smoke.py):

  CP1  single-consent registration (V-PAT-004) -> POST /dental/patients == 201
  CP2  consent-required guard -> inline error + NO 201 on the blocked submit
  CP3  search + standalone profile view + visit-count coherence (stat == rows)
  CP4  follow-up-note append-only history + the min-5-char submit guard
  CP5  patient-export regression guard -> GET /dental/patients/export == 200 with
       a non-empty patients[] carrying displayName (proves the `data`->`patients`
       shape fix AND the missing-`branchId` fix; export used to 400 / be empty)

Drives AS the front-desk staff persona (the registration/search/profile owner).

Known limitation (reported, not asserted): the demo PIN-select does not re-scope
the backend identity to the selected non-owner profile (Ana Santos staff_full has
a NULL membership.person_id in the seed), so the session authorizes as the owner
regardless of PIN. The owner-only export RBAC negative (EM-PAT-001) is therefore
pinned at the backend-unit layer, not here; CP5 verifies the export now works.

# Parameters
| flag             | default                 | meaning                                  |
|------------------|-------------------------|------------------------------------------|
| --base-url       | http://localhost:3003   | app origin                               |
| --email          | demo@dentalemon.com     | login email                              |
| --password       | DemoClinic1!            | login password                           |
| --owner-pin      | 123456                  | owner 6-digit PIN (Dr. Maria Reyes)      |
| --owner-profile  | Dr. Maria Reyes         | owner PIN-select profile label           |
| --staff-pin      | 654321                  | front-desk 6-digit PIN (Ana Santos)      |
| --staff-profile  | Ana Santos              | front-desk PIN-select profile label      |
| --out            | ./dp_run                | output dir (screenshots + log)           |
| --suffix         | (auto: epoch seconds)   | uniquifier appended to the new patient   |
| --headed         | (flag) off              | run with a visible browser               |

Exit code 0 iff all 5 critical points pass.

Usage:
    python final_script.py
    python final_script.py --staff-profile "Ana Santos" --staff-pin 654321
    python final_script.py --base-url https://staging.example.com
"""
import argparse
import re
import time
import pathlib
import sys
from playwright.sync_api import sync_playwright


def smoke_dental_patient(base_url: str, email: str, password: str,
                         owner_pin: str, owner_profile: str,
                         staff_pin: str, staff_profile: str,
                         suffix: str, out: pathlib.Path,
                         headed: bool = False) -> int:
    """Drive the dentalemon dental-patient module end-to-end and verify 5 CPs.

    Args:
        base_url: App origin, e.g. http://localhost:3003. Default
            "http://localhost:3003".
        email: Login email shared by the demo profiles. Default
            "demo@dentalemon.com".
        password: Login password. Default "DemoClinic1!".
        owner_pin: 6-digit numeric PIN for the dentist_owner profile (used for the
            export CP, which is owner-scoped). Default "123456".
        owner_profile: Display name of the owner PIN-select profile. Default
            "Dr. Maria Reyes".
        staff_pin: 6-digit numeric PIN for the front-desk staff_full profile (the
            registration/search/profile/follow-up owner). Default "654321".
        staff_profile: Display name of the staff PIN-select profile. Default
            "Ana Santos".
        suffix: Per-run uniquifier appended to the new patient's name so each run
            creates a distinct, verifiable record. Defaults to epoch seconds.
        out: Directory for screenshots and the step log (created if absent).
            Default "./dp_run".
        headed: When True, launch a visible browser (debugging). Default False.

    Returns:
        Process exit code: 0 if all 5 critical points pass, else 1.
    """
    new_name = f"Workflow Verify {suffix}".strip()
    shots = out / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    log = out / "final_script_log.txt"
    lines = []
    results = {}
    # network observers
    create_201 = {"n": 0}
    export_resp = {"status": None, "body": None}

    def step(n, msg):
        line = f"step {n} action: {msg}"
        print(line)
        lines.append(line)

    def do_login(page, profile, pin):
        page.goto(f"{base_url}/auth/sign-in", wait_until="networkidle")
        page.get_by_role("textbox", name=re.compile("email", re.I)).fill(email)
        page.get_by_role("textbox", name=re.compile("password", re.I)).fill(password)
        page.get_by_role("button", name=re.compile(r"^login$", re.I)).click()
        page.wait_for_url("**/auth/pin-select", timeout=15000)
        page.get_by_role("button", name=re.compile(re.escape(profile), re.I)).first.click()
        page.wait_for_url("**/auth/pin-entry/**", timeout=15000)
        for d in pin:
            page.get_by_role("button", name=re.compile(rf"^{d}$")).first.click()
        # staff_full lands on /patients, owner on /dashboard — accept either.
        page.wait_for_url(re.compile(r"/(dashboard|patients)"), timeout=15000)
        page.wait_for_load_state("networkidle")

    def goto_patients(page):
        if "/patients" not in page.url:
            page.click("a[href='/patients']")
            page.wait_for_load_state("networkidle")
        page.wait_for_timeout(900)

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=not headed)
        page = browser.new_page(viewport={"width": 1280, "height": 1800})

        def on_resp(r):
            req = r.request
            if r.url.endswith("/dental/patients") and req.method == "POST" and r.status == 201:
                create_201["n"] += 1
            if "/dental/patients/export" in r.url and r.status == 200:
                export_resp["status"] = r.status
                try:
                    export_resp["body"] = r.json()
                except Exception:
                    export_resp["body"] = "(non-json)"
        page.on("response", on_resp)

        step(0, f"params: base_url={base_url} email={email} "
                f"staff_profile={staff_profile} staff_pin={staff_pin} "
                f"owner_profile={owner_profile} owner_pin={owner_pin} "
                f"new_patient={new_name!r}")

        # ================= front-desk staff session =================
        do_login(page, staff_profile, staff_pin)
        goto_patients(page)

        # ---- CP1: single-consent registration -> POST 201 ----
        page.locator("[data-testid=register-patient-btn]").click()
        page.wait_for_timeout(700)
        dlg = page.get_by_role("dialog")
        dlg.get_by_role("textbox", name=re.compile("full name", re.I)).fill(new_name)
        dlg.get_by_role("textbox", name=re.compile("date of birth", re.I)).fill("1992-03-14")
        dlg.get_by_role("combobox", name=re.compile("gender", re.I)).select_option(label="Female")
        page.locator("[data-testid=consent-checkbox]").check()
        if page.locator("[data-testid=consent-channel-sms]").count():
            page.locator("[data-testid=consent-channel-sms]").check()
        page.screenshot(path=str(shots / "final_execution_1_register_form.png"))
        before_201 = create_201["n"]
        dlg.get_by_role("button", name=re.compile("register patient", re.I)).click()
        # Wait for the registration modal to close (success path closes it) and the
        # POST 201 to settle, so the CP2 baseline is clean (avoids a late-201 race).
        page.get_by_role("dialog").wait_for(state="hidden", timeout=8000)
        page.wait_for_timeout(1200)
        results["CP1_register_201"] = create_201["n"] == before_201 + 1
        step(1, f"register single-consent patient -> POST201 count delta="
                f"{create_201['n'] - before_201} pass={results['CP1_register_201']}")

        # ---- CP2: consent-required guard ----
        # Reload /patients first so CP2 gets a pristine, freshly-mounted modal
        # (the modal resets consentGiven to false on mount; a fast re-open right
        # after CP1 can otherwise race the close/re-render and carry state over).
        page.reload(wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        reg_btn = page.locator("[data-testid=register-patient-btn]")
        reg_btn.wait_for(state="visible", timeout=15000)
        reg_btn.click()
        # Assert the dialog is actually open before filling.
        dlg = page.get_by_role("dialog")
        dlg.wait_for(state="visible", timeout=8000)
        page.wait_for_timeout(400)
        dlg.get_by_role("textbox", name=re.compile("full name", re.I)).fill("No Consent Person")
        dlg.get_by_role("textbox", name=re.compile("date of birth", re.I)).fill("1990-01-01")
        # Guard precondition: the consent checkbox MUST be unchecked for this CP.
        consent_box = page.locator("[data-testid=consent-checkbox]")
        if consent_box.is_checked():
            consent_box.uncheck()
        before_201 = create_201["n"]
        dlg.get_by_role("button", name=re.compile("register patient", re.I)).click()
        page.wait_for_timeout(1200)
        # The client-side guard keeps the dialog OPEN and shows an inline error.
        page.screenshot(path=str(shots / "final_execution_2_consent_guard.png"))
        dialog_still_open = page.get_by_role("dialog").count() >= 1
        dlg_text = page.get_by_role("dialog").first.inner_text().lower() if dialog_still_open else ""
        consent_err = "consent is required" in dlg_text
        no_extra_post = create_201["n"] == before_201
        results["CP2_consent_guard"] = consent_err and no_extra_post and dialog_still_open
        step(2, f"consent-required guard: error_shown={consent_err} dialog_open={dialog_still_open} "
                f"no_201_on_blocked_submit={no_extra_post} pass={results['CP2_consent_guard']}")
        # close the modal
        try:
            page.get_by_role("dialog").get_by_role(
                "button", name=re.compile(r"^cancel$", re.I)).click()
            page.get_by_role("dialog").wait_for(state="hidden", timeout=5000)
        except Exception:
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

        # ---- CP3: search + profile + visit-count coherence ----
        sb = page.locator("input[placeholder*='earch' i]").first
        sb.fill(new_name)
        page.wait_for_timeout(1500)
        row_present = page.get_by_role("button", name=re.compile("view profile", re.I)).count() >= 1
        suffix_visible = suffix in page.inner_text("body")
        page.screenshot(path=str(shots / "final_execution_3a_search.png"))
        page.get_by_role("button", name=re.compile("view profile", re.I)).first.click()
        page.wait_for_timeout(1500)
        on_profile = "/patients/" in page.url
        name_present = page.locator("[data-testid=profile-name]").count() >= 1
        stat = page.locator("[data-testid=stat-visit-count]")
        stat_text = stat.inner_text().replace("\n", " ") if stat.count() else ""
        m = re.search(r"(\d+)", stat_text)
        stat_n = int(m.group(1)) if m else -1
        # Coherence: for a brand-new patient the stat reads 0 AND the empty state
        # ("No visits recorded yet.") is shown — stat count == rendered visit rows.
        empty_state = page.locator("[data-testid=no-visits-message]").count() >= 1
        coherent = (stat_n == 0 and empty_state)
        page.screenshot(path=str(shots / "final_execution_3b_profile.png"))
        results["CP3_search_profile_coherence"] = (
            row_present and suffix_visible and on_profile and name_present
            and coherent)
        step(3, f"search+profile: row={row_present} suffix={suffix_visible} "
                f"on_profile={on_profile} name={name_present} stat_visits={stat_n} "
                f"empty_state={empty_state} coherent={coherent} "
                f"pass={results['CP3_search_profile_coherence']}")

        # ---- CP4: follow-up append-only + min-5 guard ----
        page.locator("[data-testid=tab-followup]").click()
        page.wait_for_timeout(900)
        before_notes = page.locator("[data-testid^=note-item-]").count()
        ni = page.locator("[data-testid=note-input]")
        ni.fill("abc")  # 3 chars -> must stay disabled
        page.wait_for_timeout(350)
        disabled_short = page.locator("[data-testid=note-submit]").is_disabled()
        note_text = f"Smoke note {suffix} sensitivity upper-left"
        ni.fill(note_text)
        page.wait_for_timeout(350)
        enabled_full = not page.locator("[data-testid=note-submit]").is_disabled()
        page.locator("[data-testid=note-submit]").click()
        page.wait_for_timeout(1800)
        after_notes = page.locator("[data-testid^=note-item-]").count()
        note_visible = note_text in page.inner_text("body")
        page.screenshot(path=str(shots / "final_execution_4_followup.png"))
        results["CP4_followup_appendonly"] = (
            disabled_short and enabled_full
            and after_notes == before_notes + 1 and note_visible)
        step(4, f"follow-up: disabled@3={disabled_short} enabled@full={enabled_full} "
                f"notes {before_notes}->{after_notes} visible={note_visible} "
                f"pass={results['CP4_followup_appendonly']}")

        browser.close()

        # ================= owner session (export CP) =================
        # Export is owner-scoped (EM-PAT-001); the demo session authorizes as the
        # owner anyway, so we drive the owner profile explicitly for clarity.
        browser = p.firefox.launch(headless=not headed)
        page = browser.new_page(viewport={"width": 1280, "height": 1800})
        page.on("response", on_resp)
        do_login(page, owner_profile, owner_pin)
        goto_patients(page)
        page.get_by_role("button", name=re.compile(r"^export$", re.I)).first.click()
        page.wait_for_timeout(2800)
        page.screenshot(path=str(shots / "final_execution_5_export.png"))
        body = export_resp["body"]
        pats = body.get("patients") if isinstance(body, dict) else None
        rows_ok = isinstance(pats, list) and len(pats) >= 1
        displayname_ok = rows_ok and bool(pats[0].get("displayName"))
        results["CP5_export_shape_and_branchid"] = (
            export_resp["status"] == 200 and rows_ok and displayname_ok)
        step(5, f"export: status={export_resp['status']} "
                f"patients={len(pats) if isinstance(pats, list) else None} "
                f"first_displayName={(pats[0].get('displayName') if rows_ok else None)!r} "
                f"pass={results['CP5_export_shape_and_branchid']}")
        browser.close()

    passed = sum(1 for v in results.values() if v)
    for i, (k, v) in enumerate(sorted(results.items()), start=1):
        print(f"CP{i} {'PASS' if v else 'FAIL'}: {k}")
    datum = (f"FINAL DATUM: {passed}/{len(results)} CP pass "
             f"(new_patient='{new_name}'): " + ", ".join(
                 f"{k}={'PASS' if v else 'FAIL'}" for k, v in sorted(results.items())))
    print(datum)
    lines.append(datum)
    log.write_text("\n".join(lines) + "\n")
    return 0 if passed == len(results) else 1


def main() -> int:
    ap = argparse.ArgumentParser(
        description=smoke_dental_patient.__doc__.splitlines()[0])
    ap.add_argument("--base-url", dest="base_url", default="http://localhost:3003",
                    help="App origin, e.g. http://localhost:3003.")
    ap.add_argument("--email", default="demo@dentalemon.com",
                    help="Login email shared by the demo profiles.")
    ap.add_argument("--password", default="DemoClinic1!",
                    help="Login password.")
    ap.add_argument("--owner-pin", dest="owner_pin", default="123456",
                    help="6-digit PIN for the dentist_owner profile (export CP).")
    ap.add_argument("--owner-profile", dest="owner_profile", default="Dr. Maria Reyes",
                    help="Owner PIN-select profile label.")
    ap.add_argument("--staff-pin", dest="staff_pin", default="654321",
                    help="6-digit PIN for the front-desk staff_full profile.")
    ap.add_argument("--staff-profile", dest="staff_profile", default="Ana Santos",
                    help="Front-desk PIN-select profile label.")
    ap.add_argument("--out", default=pathlib.Path("./dp_run"), type=pathlib.Path,
                    help="Output dir for screenshots + the step log.")
    ap.add_argument("--suffix", default=None,
                    help="Uniquifier appended to the new patient (default: epoch seconds).")
    ap.add_argument("--headed", action="store_true",
                    help="Run with a visible browser (debugging).")
    a = ap.parse_args()
    suffix = a.suffix if a.suffix is not None else str(int(time.time()))
    return smoke_dental_patient(
        a.base_url, a.email, a.password, a.owner_pin, a.owner_profile,
        a.staff_pin, a.staff_profile, suffix, a.out, a.headed)


if __name__ == "__main__":
    sys.exit(main())
