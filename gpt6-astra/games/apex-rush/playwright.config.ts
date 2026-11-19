import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',timeout:45000,expect:{timeout:15000},workers:1,retries:0,
  outputDir:'.qa/e2e',reporter:[['list']],
  // Per-action WebGL screenshots stall the software renderer while held keys keep driving.
  // Retain DOM/network traces; capture explicit visual evidence separately.
  use:{baseURL:'http://127.0.0.1:5174',trace:{mode:'retain-on-failure',screenshots:false,snapshots:true,sources:true},screenshot:'only-on-failure',launchOptions:{args:['--enable-unsafe-swiftshader']}},
  projects:[
    {name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}},
    {name:'webkit',use:{...devices['Desktop Safari'],viewport:{width:1366,height:960}}},
  ],
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5174',reuseExistingServer:true},
});
