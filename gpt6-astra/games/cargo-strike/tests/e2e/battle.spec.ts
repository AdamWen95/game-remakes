import {test,expect} from '@playwright/test';

test('lobby, loadout, controls, combat, reload, pause and touch input',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?qa');await expect(page.locator('#loading')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#settings-open').click();await page.locator('#quality').selectOption('balanced');await page.locator('#settings-close').click();
  await page.locator('[data-mode="practice"]').click();await page.locator('[data-weapon="ak"]').click();
  await expect(page.locator('[data-weapon="ak"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#start').click();await expect(page.locator('body')).toHaveAttribute('data-phase','playing');
  await expect(page.locator('#current-weapon')).toHaveText('AK-47');
  if(info.project.name.startsWith('mobile')) {
    await expect(page.locator('#touch-fire')).toBeVisible();
    const cdp=await page.context().newCDPSession(page),rect=(await page.locator('#touch-fire').boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:1}]});
    await expect.poll(()=>page.locator('#ammo').textContent()).not.toBe('30');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    await page.locator('#touch-reload').click();
  } else {
    await page.mouse.down();
    await expect(page.locator('#blue-score')).toHaveText('01');await page.mouse.up();
    await page.keyboard.press('KeyR');
  }
  await expect(page.locator('#reload-indicator')).toBeVisible();await expect(page.locator('#ammo')).toHaveText('30');
  if(info.project.name.startsWith('mobile')) {
    const cdp=await page.context().newCDPSession(page),rect=(await page.locator('#move-pad').boundingBox())!;
    const before=await page.evaluate(()=>(window as any).__cargoTest.snapshot().position.x);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2+30,y:rect.y+rect.height/2,id:2}]});
    await expect.poll(()=>page.evaluate(()=>(window as any).__cargoTest.snapshot().position.x)).toBeGreaterThan(before+.4);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const oldYaw=await page.evaluate(()=>(window as any).__cargoTest.match.player.yaw);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:530,y:130,id:3}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:560,y:135,id:3}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    expect(await page.evaluate(()=>(window as any).__cargoTest.match.player.yaw)).not.toBe(oldYaw);
  }
  if(!info.project.name.startsWith('mobile')) {
    await page.keyboard.press('Digit2');await expect(page.locator('#current-weapon')).toHaveText('M9');
    const old=await page.evaluate(()=>(window as any).__cargoTest.snapshot().position.x);
    await page.keyboard.down('KeyD');await page.waitForTimeout(650);await page.keyboard.up('KeyD');
    expect(await page.evaluate(()=>(window as any).__cargoTest.snapshot().position.x)).toBeGreaterThan(old+1);
  }
  // Pointer lock intercepts coordinate clicks; Escape is the normal desktop way to leave it.
  if(info.project.name.startsWith('mobile'))await page.locator('#pause').click();else await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toContainText('战斗已暂停');
  const time=await page.evaluate(()=>(window as any).__cargoTest.snapshot().elapsed);await page.waitForTimeout(300);
  expect(await page.evaluate(()=>(window as any).__cargoTest.snapshot().elapsed)).toBe(time);
  await page.locator('#resume').click();await expect(page.locator('body')).toHaveAttribute('data-phase','playing');
  await page.screenshot({path:info.outputPath('battle.png')});expect(errors).toEqual([]);
});

test('sniper scope and paused settings work',async({page},info)=>{
  await page.goto('/?qa');await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-mode="practice"]').click();await page.locator('[data-weapon="awp"]').click();await page.locator('#start').click();
  if(info.project.name.startsWith('mobile'))await page.locator('#touch-aim').click();else await page.mouse.down({button:'right'});
  await expect(page.locator('#scope')).toBeVisible();await page.screenshot({path:info.outputPath('scope.png')});
  if(info.project.name.startsWith('mobile')){await page.locator('#touch-aim').click();await page.locator('#pause').click();}else{await page.mouse.up({button:'right'});await page.keyboard.press('Escape');}
  await page.locator('#pause-settings').click();await page.locator('#quality').selectOption('balanced');await page.locator('#settings-close').click();
  await expect(page.getByRole('dialog')).toContainText('战斗已暂停');await page.locator('#leave').click();await expect(page.locator('body')).toHaveAttribute('data-phase','lobby');
});
