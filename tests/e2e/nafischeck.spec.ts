import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    const mainRect = main?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      mainWidth: mainRect ? Math.ceil(mainRect.width) : 0,
      headerWidth: headerRect ? Math.ceil(headerRect.width) : 0,
    };
  });
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.mainWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.headerWidth).toBeLessThanOrEqual(dims.innerWidth);
}

function buildCompliant12Csv(): string {
  const rows = [
    'employee_id,full_name,nationality,role_tier,monthly_salary_aed,hire_date,registered_in_wps,registered_in_pension',
  ];
  for (let i = 1; i <= 12; i += 1) {
    rows.push(`EMP-30${i},Emirati Specialist ${i},AE,skilled,6500,2025-05-01,true,true`);
  }
  return rows.join('\n');
}

test.describe('NafisCheck — UAE MoHRE / Nafis Studio E2E', () => {
  test('defaults to AR RTL Sovereign Pearl, toggles EN LTR Abu Dhabi Night, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.locator('header')).toContainText('SQLite WAL');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sovereign-pearl');
    await expect(
      page.getByRole('img', { name: 'مخطط مقارنة نصاب التوطين والغرامة السنوية المحتملة' }),
    ).toBeVisible();
    await expect(page.locator('main')).toContainText('100/100');
    await expect(page.locator('main')).toContainText('ليست تابعة');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-ar-sovereign-pearl.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByRole('button', { name: 'English LTR' }).click();
    await page.getByRole('button', { name: 'Abu Dhabi Night' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'abu-dhabi-night');
    await expect(page.locator('main')).toContainText('NOT affiliated');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-en-abu-dhabi-night.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'abu-dhabi-night');

    expect(errors).toEqual([]);
  });

  test('evaluates 20-49 backfill grace & construction sub-6k penalty remediation, seals NAF-YYYY-0001 with BOM CSV & /r/:code', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedCode = `NAF-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('main')).toContainText('100/100');

    // Preset 2: Midsize Logistics (20-49 14-sector rule w/ 45-day resignation grace)
    await page
      .getByRole('button', { name: /شركة لوجستيات.*مهلة استبدال 45 يوماً/i })
      .click();
    await expect(page.locator('main')).toContainText('جاهزية مشروطة');
    await expect(page.locator('main')).toContainText('مهلة نشطة');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-20to49-backfill-conditional-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Preset 3: Construction 120 skilled -> 12 required vs 8 eligible (2 sub-6k excluded) -> AED 480,000 penalty -> remediate
    await page
      .getByRole('button', { name: /شركة مقاولات.*عجز 4 شواغر.*4,800 د\.إ/i })
      .click();
    await expect(page.locator('main')).toContainText('غير ممتثل / خطر غرامة');
    await expect(page.locator('main')).toContainText('480,000');

    // Replace CSV with 12 compliant Emiratis >= AED 6,500 + WPS + pension and tick missing controls
    await page.locator('textarea[dir="ltr"]').fill(buildCompliant12Csv());
    for (const id of ['NAF-CTRL-02', 'NAF-CTRL-05', 'NAF-CTRL-06']) {
      await page.locator(`label:has-text("${id}") input[type="checkbox"]`).check();
    }

    await expect(page.locator('main')).toContainText('جاهز / ممتثل');
    await expect(page.locator('main')).toContainText('100/100');
    await expect(page.locator('main')).toContainText('AED 0');

    // Seal atomically -> NAF-YYYY-0001
    await page.getByRole('button', { name: 'ختم الملف برمز NAF رسمي' }).click();
    await expect(page.locator('main')).toContainText(expectedCode);
    await expect(page.getByRole('button', { name: 'ختم الملف برمز NAF رسمي' })).toHaveCount(0);

    // Download UTF-8 BOM CSV & check EF BB BF prefix
    const dlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'تحميل CSV الآمن' }).click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toContain('.csv');
    const dlPath = await dl.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const bytes = fs.readFileSync(dlPath);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    }

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Public share route /r/:code
    await page.goto(`/r/${expectedCode}`);
    await expect(page.locator('body')).toContainText(`NafisCheck — ${expectedCode}`);
    await page.reload();
    await expect(page.locator('body')).toContainText(expectedCode);

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness in AR Sovereign Pearl and EN Abu Dhabi Night with zero overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(
      page.getByRole('img', { name: 'مخطط مقارنة نصاب التوطين والغرامة السنوية المحتملة' }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-ar-sovereign-pearl.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByRole('button', { name: 'English LTR' }).click();
    await page.getByRole('button', { name: 'Abu Dhabi Night' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'abu-dhabi-night');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-en-abu-dhabi-night.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
