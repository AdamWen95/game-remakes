import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
test('standalone file completes a real two lap race offline and stores its record',async({page},info)=>{
  const errors:string[]=[],network:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.resolve('release/apex-rush.html')).href);
  await expect(page.locator('#loading')).toBeHidden();
  expect(await page.locator('script[src],link[rel=stylesheet]').count()).toBe(0);
  expect(await page.evaluate(()=>typeof (window as any).__apexSnapshot)).toBe('undefined');
  await page.locator('[data-mode="time"]').click();await page.locator('#auto').check();await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','racing');
  await page.screenshot({path:info.outputPath('offline-race.png')});
  // Production input only: automatic throttle follows the full course, with real barrier penalties.
  // The deterministic barrier-recovery unit case establishes a >3 minute completion time.
  // Keep a bounded six-minute allowance for software-rendered browsers; still require two real laps.
  await expect(page.locator('body')).toHaveAttribute('data-phase','finished',{timeout:350000});
  await expect(page.locator('.result-time')).toHaveText(/\d{2}:\d{2}\.\d{3}/);
  await expect(page.locator('.lap-times span')).toHaveCount(2);await page.screenshot({path:info.outputPath('offline-finish.png')});
  const result=await page.locator('.result-time').textContent();
  await page.locator('#result-lobby').click();await expect(page.locator('#best')).toContainText(result!);
  await page.reload();await expect(page.locator('#best')).toContainText(result!);
  expect(errors).toEqual([]);expect(network).toEqual([]);
});
