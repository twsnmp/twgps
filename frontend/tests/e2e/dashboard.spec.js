import { test, expect } from '@playwright/test';

test.describe('twgps Dashboard E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the fixed Wails dev server port
    await page.goto('/');
  });

  test('should load the dashboard and verify the header', async ({ page }) => {
    // Check if the logo contains the text 'twgps'
    const logoText = page.locator('.logo-area h1');
    await expect(logoText).toContainText('twgps');
  });

  test('should toggle languages successfully', async ({ page }) => {
    const langSelect = page.locator('.lang-select');
    
    // Switch to English
    await langSelect.selectOption('en');
    await expect(page.locator('h2').first()).toHaveText(/Position Matrix/i);

    // Switch to Japanese
    await langSelect.selectOption('ja');
    await expect(page.locator('h2').first()).toHaveText(/位置マトリクス/i);
  });

  test('should toggle theme between light and dark', async ({ page }) => {
    // By default, the root html element should have data-theme='dark'
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Click theme toggle button
    const themeBtn = page.locator('.theme-toggle');
    await themeBtn.click();

    // Verify it switches to light theme
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Click again to switch back to dark
    await themeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('should allow configuring and toggling the NTP server', async ({ page }) => {
    const ntpStatusText = page.locator('.ntp-status-box .status-text');
    const ntpPortInput = page.locator('#ntp-port');
    const ntpToggleBtn = page.locator('.ntp-panel .action-btn');

    // Verify initial state is Offline/Stopped
    await expect(ntpStatusText).toHaveText(/OFFLINE|オフライン/i);

    // Change NTP port to a custom test port (e.g. 10123 to avoid permission issues with low port 123)
    await ntpPortInput.fill('10123');
    await ntpPortInput.press('Tab');
    await expect(ntpPortInput).toHaveValue('10123');
    await page.waitForTimeout(200);

    // Toggle NTP server ON
    await ntpToggleBtn.click();

    // Verify state updates to Online (Wait a bit for backend processing if needed)
    await expect(ntpStatusText).toHaveText(/ONLINE|オンライン/i);
    await expect(ntpPortInput).toBeDisabled();

    // Toggle NTP server OFF
    await ntpToggleBtn.click();

    // Verify state updates back to Offline/停止中
    await expect(ntpStatusText).toHaveText(/OFFLINE|オフライン/i);
    await expect(ntpPortInput).toBeEnabled();
  });
});
