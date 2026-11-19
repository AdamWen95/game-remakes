import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/single',timeout:370000,expect:{timeout:15000},workers:1,retries:0,
  outputDir:'.qa/single',reporter:[['list']],
  use:{offline:true,trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-unsafe-swiftshader']}},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:800}}}],
});
