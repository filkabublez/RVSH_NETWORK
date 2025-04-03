// Проверяем права доступа
async function checkAdminAccess() {
    try {
        const response = await fetch('/api/user/profile', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            window.location.href = 'index.html';
            return;
        }

        const userData = await response.json();
        if (!userData.isAdmin) {
            window.location.href = 'home.html';
        }
    } catch (error) {
        console.error('Ошибка проверки прав:', error);
        window.location.href = 'index.html';
    }
}

// Загрузка списка пользователей
async function loadUsers() {
    try {
        const response = await fetch('/api/users', {
            credentials: 'include'
        });
        const users = await response.json();
        
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        users.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.innerHTML = `
                <div class="user-info">
                    <h4>${user.lastName} ${user.firstName}</h4>
                    <p>Ранг: ${user.rank}</p>
                    <p>Рейтинг: ${user.rating}</p>
                </div>
                <div class="user-actions">
                    <button class="admin-button edit-button" onclick="editUser(${user.id})">
                        Редактировать
                    </button>
                </div>
            `;
            usersList.appendChild(userCard);
        });
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
    }
}

// Редактирование пользователя
function editUser(userId) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('userEditForm').style.display = 'block';
    
    // Загружаем данные пользователя
    fetch(`/api/users/${userId}`, {
        credentials: 'include'
    })
    .then(response => response.json())
    .then(user => {
        document.getElementById('editRating').value = user.rating;
        
        // Отображаем задачи
        const tasksList = document.getElementById('tasksList');
        tasksList.innerHTML = '';
        
        JSON.parse(user.goals).forEach((task, index) => {
            addTaskField(task);
        });
    });
}

// Добавление поля для новой задачи
function addTaskField(value = '') {
    const tasksList = document.getElementById('tasksList');
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.innerHTML = `
        <input type="text" class="task-input" value="${value}">
        <button type="button" class="remove-task" onclick="removeTask(this)">×</button>
    `;
    tasksList.appendChild(taskItem);
}

// Удаление задачи
function removeTask(button) {
    button.parentElement.remove();
}

// Отмена редактирования
function cancelEdit() {
    document.getElementById('userEditForm').style.display = 'none';
    document.getElementById('editUserForm').reset();
}

// Сохранение изменений пользователя
document.getElementById('editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const rating = document.getElementById('editRating').value;
    const tasks = Array.from(document.querySelectorAll('.task-input')).map(input => input.value);
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                rating,
                goals: tasks
            })
        });
        
        if (response.ok) {
            cancelEdit();
            loadUsers();
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
    }
});

// Создание события
document.getElementById('addEventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('eventTitle').value;
    const date = document.getElementById('eventDate').value;
    const description = document.getElementById('eventDescription').value;
    
    try {
        const response = await fetch('/api/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                title,
                date,
                description
            })
        });
        
        if (response.ok) {
            document.getElementById('addEventForm').reset();
            alert('Событие создано успешно');
        }
    } catch (error) {
        console.error('Ошибка создания события:', error);
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Проверяем права доступа
        const response = await fetch('/api/user/profile', {
            credentials: 'include'
        });

        if (!response.ok) {
            window.location.href = '/';
            return;
        }

        const userData = await response.json();
        
        // Проверяем права администратора
        if (!['ПШ', 'СШ', 'Руководитель'].includes(userData.rank)) {
            alert('Доступ запрещён');
            window.location.href = '/home.html';
            return;
        }

        // Загружаем список пользователей
        const usersResponse = await fetch('/api/users', {
            credentials: 'include'
        });
        const users = await usersResponse.json();

        // Отображаем список пользователей
        const usersList = document.getElementById('usersList');
        users.forEach(user => {
            const userRow = document.createElement('div');
            userRow.className = 'user-row';
            userRow.innerHTML = `
                <div>${user.firstName} ${user.lastName}</div>
                <div>${user.rank}</div>
                <div>${user.rating}</div>
                <div class="user-actions">
                    <button onclick="showUserDetails(${user.id})" class="admin-button secondary">
                        Посмотреть
                    </button>
                </div>
            `;
            usersList.appendChild(userRow);
        });

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных');
    }
});

// Функция для отображения деталей пользователя
async function showUserDetails(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`, {
            credentials: 'include'
        });
        const user = await response.json();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>${user.firstName} ${user.lastName}</h2>
                <p><strong>Звание:</strong> ${user.rank}</p>
                <p><strong>Рейтинг:</strong> ${user.rating}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Текущие задачи:</strong></p>
                <ul>
                    ${JSON.parse(user.goals).map(goal => `<li>${goal}</li>`).join('')}
                </ul>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        // Закрытие модального окна
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => {
            modal.remove();
        };

        // Закрытие по клику вне окна
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        };

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных пользователя');
    }
} 