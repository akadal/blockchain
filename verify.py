from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # Click on the Smart Contracts tab in the sidebar
    page.locator('a[data-tab="contracts"]').click()
    page.wait_for_timeout(1000)

    page.locator('button.contract-select-btn[data-template="token"]').click()
    page.wait_for_timeout(1000)

    page.screenshot(path="/tmp/screenshot_token.png")
    page.wait_for_timeout(1000)

    page.locator('a[data-tab="defi"]').click()
    page.wait_for_timeout(1000)
    page.screenshot(path="/tmp/screenshot_defi.png")
    page.wait_for_timeout(1000)

    page.locator('a[data-tab="dao"]').click()
    page.wait_for_timeout(1000)
    page.screenshot(path="/tmp/screenshot_dao.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
