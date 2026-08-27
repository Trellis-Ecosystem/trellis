import { expect, test } from '@playwright/test';
import { installFreighterMock } from './freighter-mock';

/**
 * Full user journey (#143): deploy the contract to a local devnet (done by
 * tests/e2e/run.sh before this runs), create an agreement through the real
 * UI with a mocked Freighter wallet, and confirm it reads back correctly on
 * the status page — the same on-chain data the CLI would report.
 */
test('create an agreement via the UI and see it on the status page', async ({ page }) => {
  const payerAddress = process.env.E2E_PAYER_ADDRESS;
  const payerSecret = process.env.E2E_PAYER_SECRET;
  const payeeAddress = process.env.E2E_PAYEE_ADDRESS;
  const resolverAddress = process.env.E2E_RESOLVER_ADDRESS;
  const tokenAddress = process.env.E2E_TOKEN_ADDRESS;
  const rpcUrl = process.env.E2E_RPC_URL;
  const networkPassphrase = process.env.E2E_NETWORK_PASSPHRASE;

  for (const [name, value] of Object.entries({
    payerAddress, payerSecret, payeeAddress, resolverAddress, tokenAddress, rpcUrl, networkPassphrase,
  })) {
    expect(value, `E2E env var for ${name} must be set — see tests/e2e/run.sh`).toBeTruthy();
  }

  await installFreighterMock(page, {
    address: payerAddress!,
    secret: payerSecret!,
    networkPassphrase: networkPassphrase!,
    rpcUrl: rpcUrl!,
  });

  // Agreement ID unique to this run so repeat runs against the same
  // container never collide with a prior run's on-chain state.
  const agreementId = Date.now().toString(16).padStart(64, '0');
  const milestoneAmount = '1000';

  await page.goto('/');
  await page.getByRole('button', { name: 'Connect Wallet' }).click();
  await expect(page.getByText(payerAddress!.slice(0, 4))).toBeVisible({ timeout: 15_000 });

  await page.goto('/create');
  await page.getByLabel('Agreement ID (hex)').fill(agreementId);
  await page.getByLabel('Payee Address').fill(payeeAddress!);
  await page.getByLabel('Token Contract Address').fill(tokenAddress!);
  await page.getByLabel('Dispute Resolver Address').fill(resolverAddress!);
  await page.getByPlaceholder('Amount (smallest token unit)').fill(milestoneAmount);

  await page.getByRole('button', { name: 'Create Agreement' }).click();

  // Submission builds, simulates, signs (via the mock), and submits a real
  // transaction to the local devnet, then polls for confirmation — allow
  // enough time for that round trip before the redirect happens.
  await expect(page).toHaveURL(new RegExp(`/agreement/${agreementId}$`), { timeout: 30_000 });

  // The desktop table and mobile card both render in the DOM (CSS toggles
  // which is visible, not React), so anything that appears in both — like
  // the milestone amount/status — needs `.first()` to stay in strict mode.
  await expect(page.getByText('Agreement Details')).toBeVisible();
  await expect(page.getByText(payerAddress!, { exact: false })).toBeVisible();
  await expect(page.getByText(payeeAddress!, { exact: false })).toBeVisible();
  await expect(page.getByText(milestoneAmount).first()).toBeVisible();
  await expect(page.getByText('Pending').first()).toBeVisible();
});
