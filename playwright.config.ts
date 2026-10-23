import {defineConfig} from '@playwright/test';
const externalURL=process.env.E2E_BASE_URL;
export default defineConfig({testDir:'./e2e',fullyParallel:false,use:{baseURL:externalURL||'http://127.0.0.1:5173',headless:true,launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}},reporter:'list',webServer:externalURL?undefined:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:true}});
