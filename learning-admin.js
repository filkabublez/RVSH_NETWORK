let currentUser = null;
let currentCategory = 'history'; // Категория по умолчанию

document.addEventListener('DOMContentLoaded', async () => {
    // Получаем данные текущего пользователя
    await getCurrentUser();
    
    // Проверяем права администратора
    if (!currentUser || !isAdmin(currentUser.rank)) {
        // Если нет прав, перенаправляем на страницу обучения
        window.location.href = '/learning.html';
        return;
    }
    
    // Загружаем материалы для текущей категории
    loadMaterials(currentCategory);
    
    // Обработчик формы добавления материала
    document.getElementById('newMaterialForm').addEventListener('submit', addNewMaterial);
    
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
        const materialsList = document.getElementById('materialsList');
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
                <button class="material-delete" data-id="${material.id}">×</button>
            `;
            
            materialsList.appendChild(materialDiv);
            
            // Добавляем обработчик для кнопки удаления
            materialDiv.querySelector('.material-delete').addEventListener('click', () => {
                if (confirm('Вы уверены, что хотите удалить этот материал?')) {
                    deleteMaterial(material.id);
                }
            });
        });
    } catch (error) {
        console.error('Ошибка загрузки материалов:', error);
        document.getElementById('materialsList').innerHTML = 
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

async function addNewMaterial(e) {
    e.preventDefault();
    
    const title = document.getElementById('materialTitle').value;
    const category = document.getElementById('materialCategory').value;
    const type = document.getElementById('materialType').value;
    const content = document.getElementById('materialContent').value;
    
    console.log('Отправляем данные:', { title, category, type, content }); // Добавим логирование
    
    try {
        const response = await fetch('/api/learning/materials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                title,
                category,
                type,
                content
            })
        });
        
        // Добавим проверку на тип ответа
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            // Если ответ не JSON, выводим текст ответа для отладки
            const text = await response.text();
            console.error('Сервер вернул не JSON:', text);
            throw new Error('Сервер вернул неверный формат ответа');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка добавления материала');
        }
        
        const result = await response.json();
        console.log('Материал добавлен:', result);
        
        // Сбрасываем форму
        document.getElementById('newMaterialForm').reset();
        
        // Обновляем список материалов, если добавленный материал относится к текущей категории
        if (category === currentCategory) {
            loadMaterials(currentCategory);
        }
        
        // Показываем уведомление
        alert('Материал успешно добавлен!');
    } catch (error) {
        console.error('Ошибка добавления материала:', error);
        alert(error.message);
    }
}

async function deleteMaterial(id) {
    try {
        const response = await fetch(`/api/learning/materials/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка удаления материала');
        }
        
        // Обновляем список материалов
        loadMaterials(currentCategory);
        
        // Показываем уведомление
        alert('Материал успешно удален!');
    } catch (error) {
        console.error('Ошибка удаления материала:', error);
        alert(error.message);
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