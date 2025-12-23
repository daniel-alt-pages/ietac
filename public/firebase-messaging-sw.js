// Firebase Messaging Service Worker
// Configurado para portal-sg-2 (BD Secundaria)

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Configuración de Firebase - PROYECTO SECUNDARIO (portal-sg-2)
// La VAPID key es de este proyecto
firebase.initializeApp({
    apiKey: "AIzaSyC80Qn9kM3jgLfnTkwtUQEYqPIPAS_MK_I",
    authDomain: "portal-sg-2.firebaseapp.com",
    projectId: "portal-sg-2",
    storageBucket: "portal-sg-2.firebasestorage.app",
    messagingSenderId: "459838365046",
    appId: "1:459838365046:web:84b20a6175a32a27d3ee57"
});

const messaging = firebase.messaging();

// Manejar notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notificación recibida en segundo plano:', payload);

    const notificationTitle = payload.notification?.title || 'SeamosGenios';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: payload.data?.tag || 'default',
        data: payload.data,
        actions: payload.data?.actions ? JSON.parse(payload.data.actions) : [],
        requireInteraction: payload.data?.priority === 'high',
        vibrate: [200, 100, 200]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clic en notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notificación clickeada:', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || 'https://seamosgenios-portal.web.app';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Si ya hay una ventana abierta, enfocarla
            for (const client of windowClients) {
                if (client.url.includes('seamosgenios-portal') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
