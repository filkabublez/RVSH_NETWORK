self.addEventListener('push', function(event) {
    const options = {
        body: event.data.text(),
        icon: '/images/logo.png',
        badge: '/images/badge.png',
        vibrate: [100, 50, 100]
    };
    
    event.waitUntil(
        self.registration.showNotification('RВШ Network', options)
    );
}); 