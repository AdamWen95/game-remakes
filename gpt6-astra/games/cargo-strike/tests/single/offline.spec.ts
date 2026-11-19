import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

test('offline artifact runs a real AI match through the final scoreboard',async({page},info)=>{
  const errors:string[]=[],network:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.resolve('release/cargo-strike.html')).href);
  await expect(page.locator('#loading')).toBeHidden();expect(await page.evaluate(()=>typeof (window as any).__cargoTest)).toBe('undefined');
  expect(await page.locator('script[src],link[rel=stylesheet]').count()).toBe(0);
  await page.locator('#settings-open').click();await page.locator('#quality').selectOption('balanced');await page.locator('#settings-close').click();
  await page.locator('#target').selectOption('10');await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','playing');
  await expect(page.locator('body')).toHaveAttribute('data-phase','finished',{timeout:210000});
  await expect(page.locator('.result-summary')).toBeVisible();
  const blue=Number(await page.locator('#blue-score').textContent()),red=Number(await page.locator('#red-score').textContent());expect(blue+red).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('offline-result.png')});
  await page.locator('#result-lobby').click();await expect(page.locator('body')).toHaveAttribute('data-phase','lobby');
  await page.locator('#start').click();await expect(page.locator('#blue-score')).toHaveText('00');await expect(page.locator('#red-score')).toHaveText('00');
  expect(errors).toEqual([]);expect(network).toEqual([]);
});
