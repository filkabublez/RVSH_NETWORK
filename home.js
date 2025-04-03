function handleImageError(img) {
    console.error(`Ошибка загрузки изображения: ${img.src}`);
    if (img.id === 'userPhoto') {
        img.src = 'images/default-avatar.png';
    }
}

async function loadUserData() {
    try {
        const response = await fetch('/api/user/profile', {
            credentials: 'include' // Для отправки cookies
        });

        if (response.ok) {
            const userData = await response.json();
            updateUserInterface(userData);
        } else {
            if (response.status === 401) {
                window.location.href = 'index.html';
            } else {
                throw new Error('Ошибка загрузки данных пользователя');
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Не удалось загрузить данные пользователя');
    }
}

// Загружаем данные при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/user/profile', {
            credentials: 'include'
        });

        if (!response.ok) {
            window.location.href = '/';
            return;
        }

        const userData = await response.json();
        
        // Отображаем информацию о пользователе
        document.getElementById('userName').textContent = 
            `${userData.firstName} ${userData.lastName}`;
        document.getElementById('userRank').textContent = userData.rank;
        document.getElementById('userRating').textContent = userData.rating;
        document.getElementById('userTask').textContent = userData.currentTask;
        
        if (userData.photoUrl) {
            const userPhoto = document.getElementById('userPhoto');
            userPhoto.src = userData.photoUrl;
            userPhoto.onerror = () => handleImageError(userPhoto);
        }

        // Проверяем права администратора
        const isAdmin = ['ПШ', 'СШ', 'Руководитель'].includes(userData.rank);
        const adminButton = document.getElementById('adminPanelBtn');
        
        if (isAdmin) {
            adminButton.style.display = 'block';
            adminButton.addEventListener('click', () => {
                window.location.href = '/admin.html';
            });
        }

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        alert('Ошибка при загрузке данных');
    }

    // Обработчик выхода
    document.getElementById('logoutBtn').addEventListener('click', () => {
        document.cookie = 'userEmail=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.href = '/';
    });
});

// Добавляем функцию для обновления интерфейса
function updateUserInterface(userData) {
    document.getElementById('userName').textContent = `${userData.lastName} ${userData.firstName}`;
    document.getElementById('userRank').textContent = userData.rank;
    document.getElementById('userRating').textContent = userData.rating;
    document.getElementById('userTask').textContent = userData.currentTask;
    
    if (userData.photoUrl) {
        const userPhoto = document.getElementById('userPhoto');
        userPhoto.src = userData.photoUrl;
        userPhoto.onerror = () => handleImageError(userPhoto);
    }
}

// Добавляем функцию показа ошибок
function showError(message) {
    // Можно реализовать всплывающее уведомление об ошибке
    alert(message);
} 