/* G9 桌面 App 用的 service worker：只讓手機可以「安裝到主畫面」，不快取任何檔案（每次都抓最新版） */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
