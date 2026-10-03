import {chromium, expect} from '@playwright/test';
import fs from 'node:fs';
const base=process.env.STUDIO_URL||'http://localhost:4317';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  const response=await page.goto(base+'/dashboard');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading',{name:'Good morning, Alex.'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Cart',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/current-dashboard.png',fullPage:true});
  await page.getByRole('button',{name:'Code Studio',exact:true}).click();
  await expect(page).toHaveURL(/\/code\/atlas$/);
  await expect(page.frameLocator('iframe[title="Code Studio workspace"]').getByRole('heading',{name:'Build something worth sharing.'})).toBeVisible();
  await page.screenshot({path:'test-results/code-studio-login.png',fullPage:true});
  expect(errors).toEqual([]);
  fs.writeFileSync('test-results/live-smoke.json',JSON.stringify({base,dashboard:'PASS',cart:'PASS',codeStudioRoute:'PASS',directWorkspaceScreen:'PASS',uncaughtErrors:errors},null,2));
  console.log('PASS live dashboard, cart, Code Studio navigation, direct workspace screen; no uncaught errors');
} finally { await browser.close(); }
