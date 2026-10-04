// PushEngage web push service worker.
//
// PushEngage's SDK loads its own worker logic from this URL, so the file must
// sit at the site root (scope '/'). It is a thin shim: set the app id, then
// pull in the vendor worker, which handles push/notificationclick events and
// only intercepts its own CDN requests (it never hijacks the SPA).
var PUSHENGAGE_APP_ID = '23a65358-7d1f-4b0b-beff-de8b48f9689f';
importScripts('https://clientcdn.pushengage.com/sdks/service-worker.js');
