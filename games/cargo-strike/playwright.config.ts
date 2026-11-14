import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',timeout:90000,expect:{timeout:20000},workers:1,retries:0,
  outputDir:'.qa/e2e',reporter:[['list']],
  use:{baseURL:'http://127.0.0.1:5175',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-unsafe-swiftshader']}},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:960}}},{name:'mobile-chromium',use:{...devices['Pixel 7'],viewport:{width:844,height:390}}}],
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5175',reuseExistingServer:true}
});
