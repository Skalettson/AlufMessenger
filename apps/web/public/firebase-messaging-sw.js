/**
 * Firebase Cloud Messaging — service worker (background notifications).
 * Real project credentials must be injected at build/deploy time (e.g. from CI secrets).
 * Placeholders below intentionally do not identify any production project.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var notification = payload.notification || payload.data || {};
  var title = notification.title || 'Aluf Messenger';
  var body = notification.body || '';
  var icon = notification.icon || '/icon-192.png';

  return self.registration.showNotification(title, {
    body: body,
    icon: icon,
    badge: '/icon-72.png',
    data: payload.data || {},
  });
});
