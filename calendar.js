let currentDate = new Date();
let events = []; // Будет заполняться данными с сервера

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Обновляем заголовок
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay() || 7; // Преобразуем 0 (воскресенье) в 7
    
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    // Добавляем пустые ячейки в начале
    for (let i = 1; i < startingDay; i++) {
        calendarGrid.appendChild(createDayElement(''));
    }
    
    // Добавляем дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = createDayElement(day);
        const currentDateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // Проверяем, есть ли события в этот день
        if (events.some(event => event.date.startsWith(currentDateStr))) {
            dayElement.classList.add('has-event');
        }
        
        // Отмечаем текущий день
        if (isToday(year, month, day)) {
            dayElement.classList.add('today');
        }
        
        dayElement.addEventListener('click', () => showEvents(currentDateStr));
        calendarGrid.appendChild(dayElement);
    }
}

function createDayElement(content) {
    const div = document.createElement('div');
    div.className = 'calendar-day';
    div.textContent = content;
    return div;
}

function isToday(year, month, day) {
    const today = new Date();
    return today.getFullYear() === year && 
           today.getMonth() === month && 
           today.getDate() === day;
}

function showEvents(dateStr) {
    const dayEvents = events.filter(event => event.date.startsWith(dateStr));
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '';
    
    if (dayEvents.length === 0) {
        eventsList.innerHTML = '<p>Нет событий на этот день</p>';
        return;
    }
    
    dayEvents.forEach(event => {
        const eventElement = document.createElement('div');
        eventElement.className = 'event-item';
        eventElement.innerHTML = `
            <h4>${event.title}</h4>
            <p>${event.time} - ${event.description}</p>
        `;
        eventsList.appendChild(eventElement);
    });
}

function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

// Загрузка событий с сервера
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        if (response.ok) {
            events = await response.json();
            renderCalendar();
        }
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
    }
}

// Инициализация календаря
document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
}); 