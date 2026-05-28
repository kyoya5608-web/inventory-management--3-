@echo off
npm run build
start "Inventory Management" cmd /k "npm run start"
