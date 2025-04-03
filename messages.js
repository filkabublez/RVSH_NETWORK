let currentChat = 'general';
let socket;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Получаем данные текущего пользователя
    await getCurrentUser();
    
    // Инициализация WebSocket
    initializeWebSocket();
    
    // Загружаем сообщения общего чата
    loadGeneralChat();
    
    // Проверяем права администратора
    if (currentUser && currentUser.isAdmin) {
        document.getElementById('createGroupBtn').style.display = 'block';
    }
    
    // Обработчики вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Обработчик формы сообщений
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    
    // Обработчик создания группы
    document.getElementById('createGroupBtn').addEventListener('click', showCreateGroupModal);
    
    // Обработчик выхода
    document.getElementById('logoutBtn').addEventListener('click', logout);
});

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

function initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onopen = () => {
        console.log('WebSocket соединение установлено');
    };
    
    socket.onmessage = (event) => {
        console.log('Получено сообщение через WebSocket:', event.data);
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                // Добавляем сообщение в чат, если оно не от текущего пользователя
                const isOwn = currentUser && 
                    data.message.userName.includes(currentUser.firstName) && 
                    data.message.userName.includes(currentUser.lastName);
                
                if (!isOwn) {
                    addMessageToChat({
                        ...data.message,
                        isOwn: false
                    });
                }
            } else if (data.type === 'group_message' && data.groupId === currentChat) {
                // Добавляем сообщение в группу, если это текущая группа
                addMessageToChat({
                    ...data.message,
                    isOwn: false
                });
            }
        } catch (error) {
            console.error('Ошибка обработки сообщения WebSocket:', error);
        }
    };
    
    socket.onerror = (error) => {
        console.error('Ошибка WebSocket:', error);
    };
    
    socket.onclose = () => {
        console.log('WebSocket соединение закрыто');
        // Пытаемся переподключиться через 5 секунд
        setTimeout(initializeWebSocket, 5000);
    };
}

async function loadGeneralChat() {
    try {
        const response = await fetch('/api/chat/messages', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка загрузки сообщений');
        }
        
        const messages = await response.json();
        console.log('Загружены сообщения:', messages);
        
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            chatMessages.innerHTML = '<p class="no-messages">Нет сообщений</p>';
        } else {
            messages.forEach(msg => addMessageToChat(msg));
        }
        
        // Прокручиваем к последнему сообщению
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
        document.getElementById('chatMessages').innerHTML = 
            '<p class="error-message">Ошибка загрузки сообщений</p>';
    }
}

function addMessageToChat(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isOwn ? 'own' : ''}`;
    
    // Форматируем время
    let formattedTime;
    try {
        // Пробуем распарсить дату
        const timestamp = new Date(message.timestamp);
        
        // Проверяем, валидная ли дата
        if (isNaN(timestamp.getTime())) {
            // Если дата невалидная, используем текущее время
            formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            console.warn('Невалидная дата:', message.timestamp);
        } else {
            formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    } catch (error) {
        console.error('Ошибка форматирования времени:', error);
        formattedTime = '??:??';
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-author">${message.userName}</span>
            <span class="message-time">${formattedTime}</span>
        </div>
        <div class="message-text">${message.text}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage(e) {
    e.preventDefault();
    
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    try {
        let url = '/api/chat/messages';
        let data = { message };
        
        // Если это сообщение в группу
        if (currentChat !== 'general') {
            url = `/api/chat/groups/${currentChat}/messages`;
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            // Добавляем свое сообщение в чат
            addMessageToChat({
                id: Date.now(), // временный ID
                text: message,
                timestamp: new Date().toISOString(),
                userName: `${currentUser.firstName} ${currentUser.lastName}`,
                isOwn: true
            });
            
            input.value = '';
        } else {
            const error = await response.json();
            console.error('Ошибка отправки сообщения:', error);
        }
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    
    if (tab === 'general') {
        document.getElementById('groupsList').style.display = 'none';
        loadGeneralChat();
        currentChat = 'general';
    } else {
        document.getElementById('groupsList').style.display = 'block';
        loadGroups();
        currentChat = 'groups';
    }
}

async function loadGroups() {
    try {
        const response = await fetch('/api/chat/groups', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки групп');
        }
        
        const groups = await response.json();
        const groupsContainer = document.getElementById('groupsContainer');
        groupsContainer.innerHTML = '';
        
        if (groups.length === 0) {
            groupsContainer.innerHTML = '<p class="no-groups">У вас нет групп</p>';
            return;
        }
        
        groups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'group-item';
            groupDiv.innerHTML = `
                <h4>${group.name}</h4>
                <p>${group.description}</p>
                ${group.eventTitle ? `<span class="event-badge">${group.eventTitle}</span>` : ''}
            `;
            
            groupDiv.addEventListener('click', () => loadGroupChat(group.id));
            groupsContainer.appendChild(groupDiv);
        });
    } catch (error) {
        console.error('Ошибка загрузки групп:', error);
    }
}

async function loadGroupChat(groupId) {
    currentChat = groupId;
    
    try {
        const response = await fetch(`/api/chat/groups/${groupId}/messages`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки сообщений группы');
        }
        
        const messages = await response.json();
        
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        messages.forEach(msg => addMessageToChat(msg));
        
        // Прокручиваем к последнему сообщению
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Ошибка загрузки сообщений группы:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки пользователей');
        }
        
        const users = await response.json();
        const membersContainer = document.getElementById('membersContainer');
        membersContainer.innerHTML = '';
        
        if (users.length === 0) {
            membersContainer.innerHTML = '<p class="loading-text">Нет доступных пользователей</p>';
            return;
        }
        
        users.forEach(user => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'member-item';
            
            // Не добавляем текущего пользователя в список (он будет добавлен автоматически)
            const isCurrentUser = currentUser && user.id === currentUser.id;
            
            memberDiv.innerHTML = `
                <input type="checkbox" class="member-checkbox" value="${user.id}" 
                    ${isCurrentUser ? 'checked disabled' : ''} id="user-${user.id}">
                <label for="user-${user.id}" class="member-info">
                    <span class="member-name">${user.firstName} ${user.lastName}</span>
                    <span class="member-rank">${user.rank}</span>
                </label>
            `;
            
            membersContainer.appendChild(memberDiv);
        });
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('membersContainer').innerHTML = 
            '<p class="loading-text">Ошибка загрузки пользователей</p>';
    }
}

function showCreateGroupModal() {
    const modal = document.getElementById('createGroupModal');
    modal.style.display = 'block';
    
    // Загружаем список мероприятий
    loadEvents();
    
    // Загружаем список пользователей
    loadUsers();
    
    // Обработчик закрытия модального окна
    document.querySelector('.close').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Обработчик клика вне модального окна
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Обработчик формы создания группы
    document.getElementById('createGroupForm').addEventListener('submit', createGroup);
}

async function loadEvents() {
    try {
        const response = await fetch('/api/events', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки мероприятий');
        }
        
        const events = await response.json();
        const eventSelect = document.getElementById('eventSelect');
        eventSelect.innerHTML = '<option value="">Выберите мероприятие</option>';
        
        events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.title;
            eventSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки мероприятий:', error);
    }
}

async function createGroup(e) {
    e.preventDefault();
    
    const name = document.getElementById('groupName').value;
    const description = document.getElementById('groupDescription').value;
    const eventId = document.getElementById('eventSelect').value;
    
    // Собираем выбранных участников
    const selectedMembers = [];
    document.querySelectorAll('.member-checkbox:checked').forEach(checkbox => {
        selectedMembers.push(parseInt(checkbox.value));
    });
    
    try {
        const response = await fetch('/api/chat/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                name,
                description,
                eventId: eventId || null,
                members: selectedMembers
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка создания группы');
        }
        
        const result = await response.json();
        
        // Закрываем модальное окно
        document.getElementById('createGroupModal').style.display = 'none';
        
        // Переключаемся на вкладку групп и обновляем список
        switchTab('groups');
        
        // Сбрасываем форму
        document.getElementById('createGroupForm').reset();
    } catch (error) {
        console.error('Ошибка создания группы:', error);
        alert(error.message);
    }
}

function logout() {
    document.cookie = 'userEmail=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/index.html';
} 