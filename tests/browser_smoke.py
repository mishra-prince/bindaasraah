"""Optional browser smoke on a developer computer: pip install playwright && playwright install chromium.
Start python server.py first, then python tests/browser_smoke.py.
Not run in creator's restricted environment due browser administrator policy.
"""
import asyncio
import os
from playwright.async_api import async_playwright

BASE=os.getenv('BR_TEST_URL','http://localhost:8765')

async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True)
    page=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    await page.goto(BASE)
    await page.locator('#routeCards .route-card').first.wait_for()
    assert await page.locator('#routeCards .route-card').count()==3
    await page.locator('.mobile-nav [data-page="assistance"]').click()
    await page.locator('#demoPlacesBtn').click()
    assert await page.locator('#placeCards .place-card').count()==5
    await page.locator('.mobile-nav [data-page="reports"]').click()
    await page.locator('#reportLocation').fill('Near main gate')
    await page.locator('#reportDescription').fill('Observed a non-working streetlight in the evening.')
    await page.locator('#saveReportBtn').click()
    assert await page.locator('#reportCards .report-item').count()>=1
    await page.locator('.mobile-nav [data-page="journey"]').click()
    await page.locator('#startTrip').click()
    assert await page.locator('#tripStatus').inner_text()=='In progress'
    await page.locator('#checkInBtn').click()
    await page.locator('#endTripBtn').click()
    assert await page.locator('#tripStatus').inner_text()=='Ended'
    if errors:raise Exception(str(errors))
    print('Browser smoke passed')
    await browser.close()

asyncio.run(main())
