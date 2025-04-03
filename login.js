document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log('Отправка формы:', { username, password });

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Важно для работы с куки
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('Ответ сервера:', data);

        if (response.ok) {
            // Если вход успешен, перенаправляем на главную
            window.location.href = '/home.html';
        } else {
            // Если ошибка - показываем сообщение
            alert(data.error || 'Ошибка при входе');
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка при входе');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Проверяем загрузку стилей
    const styles = document.styleSheets;
    if (styles.length === 0) {
        console.error('Стили не загружены!');
    } else {
        console.log('Стили загружены успешно');
    }
}); 