// OneSignal web push service worker (v16).
//
// OneSignal's SDK loads its worker logic from this URL, so the file must sit at
// the site root (scope '/'). It is the official thin shim: it pulls in the
// vendor worker, which handles push/notificationclick events.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
