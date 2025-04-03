const VAPID_PUBLIC_KEY = 'BOM47Ki1gEYz0Nl7mqMBr1RnR7wJutEip1hQJgi9kok1GQmFyUVZb0BfGqOdClvCQhYbx8Jpw-nh5G1UeYJPpMA';

async function initializeNotifications() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
                
                // Отправляем подписку на сервер
                await fetch('/api/notifications/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(subscription)
                });
            }
        } catch (error) {
            console.error('Ошибка инициализации уведомлений:', error);
        }
    }
}

// Функция для конвертации VAPID ключа
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

document.addEventListener('DOMContentLoaded', initializeNotifications); 