#!/usr/bin/env python3
"""Reusable dentalemon revenue-chain smoke test (Webwright CLI tool mode).

Crafted via Webwright /webwright:craft. Drives a fresh headless Firefox through
the dentalemon money flow: login -> /billing -> open the first PAYABLE invoice
(one whose status exposes "Record Payment": issued / partial / overdue) ->
record a cash payment with a run-unique receipt number -> verify the payment is
persisted (POST 201), the receipt appears in the invoice's payments list, the
balance drops by the paid amount, and the invoice still appears in /billing.

It records a small partial payment (default ₱1.00) so the same payable invoice
can be exercised repeatedly without being fully settled. Re-runnable against any
environment by overriding the flags.

# Parameters
| flag         | default                 | meaning                                          |
|--------------|-------------------------|--------------------------------------------------|
| --base-url   | http://localhost:3003   | app origin                                        |
| --email      | demo@dentalemon.com     | login email                                       |
| --password   | DemoClinic1!            | login password                                    |
| --pin        | 123456                  | 6-digit PIN                                       |
| --profile    | Dr. Maria Reyes         | PIN-select profile name                           |
| --amount     | 1.00                    | payment amount in pesos (partial, re-runnable)    |
| --method     | Cash                    | payment method button (Cash/Card/Bank Transfer)   |
| --receipt    | (auto: R-WW-<epoch>)    | receipt number (unique per run)                   |
| --out        | ./rc_run                | output dir (screenshots + log)                    |
| --headed     | (flag) off              | run with a visible browser                         |

Exit code 0 iff all 5 critical points pass.

Usage:
    python revenue_chain_smoke.py
    python revenue_chain_smoke.py --amount 2.50 --method Card
    python revenue_chain_smoke.py --base-url https://staging.example.com
"""
import argparse
import re
import time
import pathlib
import sys
from playwright.sync_api import sync_playwright


def _cents(text):
    """Parse the first '₱1,234.56' money token in *text* into integer cents."""
    m = re.search(r"₱\s*([\d,]+\.\d{2})", text)
    return None if not m else round(float(m.group(1).replace(",", "")) * 100)


def _balance_cents(detail_text):
    """Extract the invoice 'Balance: ₱x / ₱y' first amount (outstanding) in cents."""
    m = re.search(r"Balance[^₱]*₱\s*([\d,]+\.\d{2})", detail_text)
    return None if not m else round(float(m.group(1).replace(",", "")) * 100)


def record_revenue(base_url: str, email: str, password: str, pin: str,
                   profile: str, amount: float, method: str, receipt: str,
                   out: pathlib.Path, headed: bool = False) -> int:
    """Record a cash payment on a payable invoice and verify the money flow.

    Args:
        base_url: App origin, e.g. http://localhost:3003.
        email: Login email.
        password: Login password.
        pin: 6-digit numeric PIN for the chosen profile.
        profile: Display name of the PIN-select profile to sign in as.
        amount: Payment amount in pesos; kept small (default 1.00) so the same
            invoice stays payable across repeated runs.
        method: Payment method button label (Cash / Card / Bank Transfer).
        receipt: Receipt number; defaults to a per-run unique R-WW-<epoch>.
        out: Directory for screenshots and the step log (created if absent).
        headed: When True, launch a visible browser (debugging).

    Returns:
        Process exit code: 0 if all critical points pass, else 1.
    """
    shots = out / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    log = out / "final_script_log.txt"
    lines = []
    post_status = {"v": None}
    results = {}
    amount_cents = round(amount * 100)

    def step(n, msg):
        line = f"step {n} action: {msg}"
        print(line); lines.append(line)

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=not headed)
        page = browser.new_page(viewport={"width": 1280, "height": 1800})

        def on_resp(r):
            if "/payments" in r.url and r.request.method == "POST":
                post_status["v"] = r.status
        page.on("response", on_resp)

        step(0, f"params: base_url={base_url} email={email} profile={profile} "
                f"amount={amount:.2f} method={method} receipt={receipt}")

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

        # ---- /billing ----
        page.click("a[href='/billing']")
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(1200)

        # CP1: invoice list loads with at least one invoice
        body = page.inner_text("body")
        results["CP1_billing_list"] = len(re.findall(r"INV-", body)) >= 1
        page.screenshot(path=str(shots / "final_execution_1_billing_list.png"))
        step(1, f"billing list invoices={len(re.findall(r'INV-', body))}")

        # CP2: open the first PAYABLE invoice (has a Record Payment button)
        rows = page.locator("text=/INV-/")
        detail_text = None
        inv_no = None
        for i in range(rows.count()):
            rows.nth(i).click(); page.wait_for_timeout(800)
            det = page.locator("[aria-label='Invoice Detail']")
            if det.count() and page.get_by_role(
                    "button", name=re.compile(r"^record payment$", re.I)).count():
                detail_text = det.first.inner_text()
                m = re.search(r"INV-\S+", detail_text)
                inv_no = m.group(0) if m else None
                break
            if det.count():
                page.locator("[aria-label='Invoice Detail'] [aria-label='Close']").first.click()
                page.wait_for_timeout(300)
        bal_before = _balance_cents(detail_text) if detail_text else None
        results["CP2_payable_invoice"] = detail_text is not None and bal_before is not None
        page.screenshot(path=str(shots / "final_execution_2_invoice_detail.png"))
        step(2, f"payable invoice={inv_no} balance_before_cents={bal_before}")

        # CP3: record a cash payment -> POST 201
        if results["CP2_payable_invoice"]:
            det = page.locator("[aria-label='Invoice Detail']")
            page.get_by_role("button", name=re.compile(r"^record payment$", re.I)).first.click()
            page.wait_for_timeout(500)
            page.locator("#pay-amount").fill(f"{amount:.2f}")
            det.get_by_role("button", name=re.compile(rf"^{re.escape(method)}$", re.I)).first.click()
            page.locator("#pay-receipt").fill(receipt)
            page.screenshot(path=str(shots / "final_execution_3_payment_form.png"))
            det.get_by_role("button", name=re.compile(r"^record$", re.I)).first.click()
            page.wait_for_timeout(2200)
        results["CP3_post_201"] = post_status["v"] == 201
        step(3, f"record cash payment -> POST status={post_status['v']}")

        # CP4: payment lands — receipt visible in payments list AND balance dropped
        detail_after = page.locator("[aria-label='Invoice Detail']")
        det_after_text = detail_after.first.inner_text() if detail_after.count() else ""
        bal_after = _balance_cents(det_after_text)
        receipt_visible = receipt in det_after_text
        dropped = (bal_before is not None and bal_after is not None
                   and bal_after == bal_before - amount_cents)
        results["CP4_payment_reflected"] = receipt_visible and dropped
        page.screenshot(path=str(shots / "final_execution_4_payment_recorded.png"))
        step(4, f"receipt_visible={receipt_visible} balance_after_cents={bal_after} "
                f"dropped_by_{amount_cents}={dropped}")

        # CP5: invoice still appears in /billing after closing the detail
        if detail_after.count():
            page.locator("[aria-label='Invoice Detail'] [aria-label='Close']").first.click()
            page.wait_for_timeout(800)
        list_body = page.inner_text("body")
        results["CP5_in_billing"] = bool(inv_no) and (inv_no in list_body)
        page.screenshot(path=str(shots / "final_execution_5_billing_after.png"))
        step(5, f"invoice {inv_no} present in /billing list={results['CP5_in_billing']}")

        browser.close()

    passed = sum(1 for v in results.values() if v)
    datum = (f"FINAL DATUM: {passed}/{len(results)} CP pass "
             f"(invoice={inv_no}, paid ₱{amount:.2f} {method}, receipt={receipt}): "
             + ", ".join(f"{k}={'PASS' if v else 'FAIL'}" for k, v in sorted(results.items())))
    print(datum); lines.append(datum)
    log.write_text("\n".join(lines) + "\n")
    return 0 if passed == len(results) else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="dentalemon revenue-chain smoke test")
    ap.add_argument("--base-url", default="http://localhost:3003")
    ap.add_argument("--email", default="demo@dentalemon.com")
    ap.add_argument("--password", default="DemoClinic1!")
    ap.add_argument("--pin", default="123456")
    ap.add_argument("--profile", default="Dr. Maria Reyes")
    ap.add_argument("--amount", default=1.00, type=float,
                    help="payment amount in pesos (partial, re-runnable)")
    ap.add_argument("--method", default="Cash",
                    help="payment method button (Cash/Card/Bank Transfer)")
    ap.add_argument("--receipt", default=None,
                    help="receipt number (default: R-WW-<epoch>)")
    ap.add_argument("--out", default="./rc_run", type=pathlib.Path)
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()
    receipt = a.receipt if a.receipt is not None else f"R-WW-{int(time.time())}"
    return record_revenue(a.base_url, a.email, a.password, a.pin, a.profile,
                          a.amount, a.method, receipt, a.out, a.headed)


if __name__ == "__main__":
    sys.exit(main())
