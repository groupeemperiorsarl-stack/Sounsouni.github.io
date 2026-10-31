pg.evaluate("()=>gestionRefresh(true)"); nap(1.5)
pg.click("[data-action='toggle-role-menu']"); nap(0.8)
if pg.locator("[data-action='gx-create']").count():
    st["prompt"] = "EMPEROR"; pg.click("[data-action='gx-create']")
else:
    pg.locator("[data-action='gx-open']").first.click(force=True)
pg.wait_for_selector("#gx-root .gx-content", timeout=15000)
