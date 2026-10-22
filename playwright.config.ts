import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',fullyParallel:false,use:{baseURL:'http://127.0.0.1:5173',headless:true,launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}},reporter:'list',webServer:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:true}});
