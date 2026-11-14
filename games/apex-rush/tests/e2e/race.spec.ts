import { test,expect,type Page } from '@playwright/test';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
const snapshot=(page: Page)=>page.evaluate(()=>(window as any).__apexSnapshot());
async function ready(page: Page){await page.goto('/');await expect(page.locator('#loading')).toBeHidden();}
async function start(page: Page){await page.locator('#start').click();await expect(page.locator('body')).toHaveAttribute('data-phase','racing');}
test('three real environments, cars, settings and guide remain usable',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  for(let i=0;i<3;i++){
    await page.locator(`[data-track="${i}"]`).click();await expect(page.locator(`[data-track="${i}"]`)).toHaveAttribute('aria-pressed','true');
    await page.locator('#next-car').click();await page.screenshot({path:info.outputPath(`track-${i}.png`),fullPage:true});
  }
  await page.locator('#help').click();await expect(page.getByRole('dialog')).toBeVisible();await page.locator('#close-help').click();
  await page.locator('[data-mode="time"]').click();await expect(page.locator('#difficulty')).toBeDisabled();
  await page.reload();await expect(page.locator('[data-mode="time"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('drive, drift, mini boost, nitro, reset and pause through keyboard',async({page},info)=>{
  test.skip(info.project.name.startsWith('mobile'),'Desktop keyboard workflow');
  // Control browser time, not race state: OS/GPU delays must not lengthen a held steering key.
  // The standalone test separately exercises an entire race at natural wall-clock speed.
  await page.clock.install({time:new Date('2026-11-13T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-13T00:00:01Z'));
  await ready(page);
  await page.locator('#quality').click();await expect(page.locator('#quality')).toContainText('流畅');
  await page.locator('[data-mode="time"]').click();await page.locator('#start').click();await page.clock.runFor(3200);
  await expect(page.locator('body')).toHaveAttribute('data-phase','racing');
  await page.keyboard.down('KeyW');await page.clock.runFor(1300);expect((await snapshot(page)).speed).toBeGreaterThan(25);
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyA');await page.clock.runFor(600);
  expect((await snapshot(page)).drift).toBeGreaterThan(.5);
  expect((await snapshot(page)).charge).toBeGreaterThan(8);await page.keyboard.up('KeyA');await page.keyboard.up('ShiftLeft');
  await page.clock.runFor(50);expect((await snapshot(page)).boost).toBeGreaterThan(0);
  await page.clock.runFor(700);expect((await snapshot(page)).boost).toBe(0);
  await page.keyboard.press('Space');await page.clock.runFor(50);expect((await snapshot(page)).nitro).toBe(0);
  await page.keyboard.press('KeyR');expect(Math.abs((await snapshot(page)).d)).toBeLessThan(.2);
  await page.keyboard.press('Escape');await expect(page.locator('body')).toHaveAttribute('data-phase','paused');const paused=await snapshot(page);await page.clock.runFor(200);expect((await snapshot(page)).elapsed).toBe(paused.elapsed);
  await page.locator('#resume').click();await expect(page.locator('body')).toHaveAttribute('data-phase','racing');
  await page.keyboard.press('KeyP');await page.locator('#back-lobby').click();await expect(page.locator('#lobby')).toBeVisible();
});
test('touch steering releases on pointer cancellation and paused races restart cleanly',async({page},info)=>{
  test.skip(!info.project.name.startsWith('mobile'),'Touch workflow');await ready(page);await start(page);
  await expect.poll(async()=>(await snapshot(page)).speed).toBeGreaterThan(20);
  const button=page.locator('[data-control="left"]');
  const box=await button.boundingBox();const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box!.x+box!.width/2,y:box!.y+box!.height/2}]});await page.waitForTimeout(200);
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(button).not.toHaveClass(/held/);
  await page.locator('#pause').click();await page.locator('#restart').click();await expect(page.locator('body')).toHaveAttribute('data-phase','countdown');
  await expect(page.locator('#race-message')).toBeEmpty();
  await page.screenshot({path:info.outputPath('touch-race.png')});
});
test('focus loss safely pauses and a fresh countdown cannot move the car',async({page})=>{
  await ready(page);await page.locator('#start').click();const before=await snapshot(page);await page.keyboard.down('KeyW');await page.waitForTimeout(150);expect((await snapshot(page)).s).toBe(before.s);
  await page.evaluate(()=>dispatchEvent(new Event('blur')));await expect(page.locator('body')).toHaveAttribute('data-phase','paused');
  await page.locator('#resume').click();await expect(page.locator('body')).toHaveAttribute('data-phase','countdown');
});
test('temporary artifacts cannot hot reload an active race',async({page},info)=>{
  test.skip(info.project.name!=='chromium','Development watcher is independent of browser engine');
  await ready(page);await start(page);
  const origin=await page.evaluate(()=>performance.timeOrigin);
  const filename='.qa/temporary-watch-probe.html';await mkdir('.qa',{recursive:true});
  try {
    await writeFile(filename,'<!doctype html><title>Isolated development watcher probe</title>');
    await page.waitForTimeout(600);
    expect(await page.evaluate(()=>performance.timeOrigin)).toBe(origin);
    await expect(page.locator('body')).toHaveAttribute('data-phase','racing');
  } finally {await unlink(filename);}
});
