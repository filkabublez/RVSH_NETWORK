let currentUser = null;
let currentCategory = 'history'; // Категория по умолчанию

document.addEventListener('DOMContentLoaded', async () => {
    // Получаем данные текущего пользователя
    await getCurrentUser();
    
    // Загружаем материалы для текущей категории
    loadMaterials(currentCategory);
    
    // Загружаем прогресс
    loadProgress();
    
    // Проверяем права администратора
    if (currentUser && isAdmin(currentUser.rank)) {
        document.getElementById('adminPanelBtn').style.display = 'block';
        // Добавляем ссылку на страницу управления обучением
        const navMenu = document.querySelector('.nav-menu');
        const learningAdminLink = document.createElement('a');
        learningAdminLink.href = '/learning-admin.html';
        learningAdminLink.className = 'nav-link admin-link';
        learningAdminLink.textContent = 'Управление обучением';
        navMenu.appendChild(learningAdminLink);
    }
    
    // Обработчик выхода
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Обработчик перехода в админ-панель
    document.getElementById('adminPanelBtn').addEventListener('click', () => {
        window.location.href = '/admin.html';
    });
    
    // Обработчики вкладок категорий
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.dataset.category;
            changeCategory(category);
        });
    });
});

function changeCategory(category) {
    // Обновляем активную вкладку
    document.querySelectorAll('.tab-btn').forEach(tab => {
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Обновляем активную категорию
    document.querySelectorAll('.materials-category').forEach(cat => {
        if (cat.id === `${category}-materials`) {
            cat.classList.add('active');
        } else {
            cat.classList.remove('active');
        }
    });
    
    // Загружаем материалы для выбранной категории
    currentCategory = category;
    loadMaterials(category);
}

async function getCurrentUser() {
    try {
        const response = await fetch('/api/user/profile', {
            credentials: 'include'
        });
        
        if (response.ok) {
            currentUser = await response.json();
            console.log('Текущий пользователь:', currentUser);
        } else {
            console.error('Ошибка получения данных пользователя');
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        window.location.href = '/index.html';
    }
}

async function loadMaterials(category) {
    try {
        const response = await fetch(`/api/learning/materials?category=${category}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки материалов');
        }
        
        const materials = await response.json();
        const materialsList = document.querySelector(`#${category}-materials .materials-list`);
        materialsList.innerHTML = '';
        
        if (materials.length === 0) {
            materialsList.innerHTML = '<div class="loading">Нет доступных материалов</div>';
            return;
        }
        
        materials.forEach(material => {
            const materialDiv = document.createElement('div');
            materialDiv.className = `material-item ${material.completed ? 'completed' : ''}`;
            materialDiv.dataset.id = material.id;
            
            // Форматируем содержимое в зависимости от типа
            let formattedContent = material.content;
            if (material.type === 'video') {
                formattedContent = `<a href="${material.content}" target="_blank">Смотреть видео</a>`;
            }
            
            materialDiv.innerHTML = `
                <div class="material-header">
                    <span class="material-title">${material.title}</span>
                    <span class="material-type ${material.type}">${getTypeLabel(material.type)}</span>
                </div>
                <div class="material-content">${formattedContent}</div>
                <div class="material-actions">
                    <button class="complete-btn" ${material.completed ? 'disabled' : ''}>
                        ${material.completed ? 'Выполнено' : 'Отметить как выполненное'}
                    </button>
                </div>
            `;
            
            materialsList.appendChild(materialDiv);
            
            // Добавляем обработчик для кнопки "Выполнено"
            if (!material.completed) {
                materialDiv.querySelector('.complete-btn').addEventListener('click', () => {
                    completeMaterial(material.id);
                });
            }
        });
    } catch (error) {
        console.error('Ошибка загрузки материалов:', error);
        document.querySelector(`#${category}-materials .materials-list`).innerHTML = 
            '<div class="loading">Ошибка загрузки материалов</div>';
    }
}

function getTypeLabel(type) {
    switch (type) {
        case 'text': return 'Текст';
        case 'video': return 'Видео';
        case 'task': return 'Задание';
        default: return type;
    }
}

async function completeMaterial(materialId) {
    try {
        const response = await fetch(`/api/learning/complete/${materialId}`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка отметки материала');
        }
        
        const result = await response.json();
        console.log('Материал отмечен:', result);
        
        // Обновляем интерфейс
        loadMaterials(currentCategory);
        loadProgress();
        
        // Показываем уведомление
        alert(`Материал отмечен как выполненный! Вы получили ${result.points} очков.`);
    } catch (error) {
        console.error('Ошибка отметки материала:', error);
        alert('Не удалось отметить материал как выполненный');
    }
}

async function loadProgress() {
    try {
        const response = await fetch('/api/learning/progress', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки прогресса');
        }
        
        const progress = await response.json();
        const progressInfo = document.getElementById('progressInfo');
        
        console.log('Данные прогресса:', progress); // Добавим логирование для отладки
        
        progressInfo.innerHTML = `
            <div class="progress-card">
                <div class="progress-name">${progress.firstName} ${progress.lastName}</div>
                <div class="progress-stats">
                    <div class="stat-item">
                        <span class="stat-value">${progress.completed_count || 0}</span>
                        <span class="stat-label">Выполнено</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${progress.total_points || 0}</span>
                        <span class="stat-label">Очков</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${progress.rating}</span>
                        <span class="stat-label">Рейтинг</span>
                    </div>
                </div>
                
                <div class="level-progress">
                    <div class="level-number">Уровень ${progress.level || 0}</div>
                    <div class="level-info">
                        <span>Опыт: ${Math.round(progress.currentLevelXP || 0)}/${progress.nextLevelXP || 100}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.xpProgress || 0}%"></div>
                    </div>
                    <div class="xp-info">
                        Всего опыта: <span class="xp-value">${Math.round(progress.totalXP || 0)}</span>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки прогресса:', error);
        document.getElementById('progressInfo').innerHTML = 
            '<div class="loading">Ошибка загрузки прогресса</div>';
    }
}

function logout() {
    document.cookie = 'userEmail=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/index.html';
}

// Функция проверки прав администратора
function isAdmin(rank) {
    return ['ПШ', 'СШ', 'Руководитель'].includes(rank);
} 