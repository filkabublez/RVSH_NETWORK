const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

// Создаем таблицы
db.serialize(() => {
    // Создаем таблицу пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        firstName TEXT,
        lastName TEXT,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT UNIQUE,
        rank TEXT,
        rating INTEGER,
        goals TEXT,
        photo_url TEXT
    )`);

    // Создаем таблицу событий
    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        title TEXT,
        date TEXT,
        description TEXT,
        created_by INTEGER,
        FOREIGN KEY(created_by) REFERENCES users(id)
    )`);

    // Добавляем тестовых пользователей
    const users = [
        ['Алдияр', 'Маткаримов', 'aldijar_m', 'rvsh2024ss', 'СШ', 1085, '["Организовать сбор", "Провести занятие"]'],
        ['Анна', 'Амбросович', 'anna_a', 'rvsh2024ps', 'ПШ', 990, '["Назначить задачи"]'],
        ['Светлана', 'Евгеньевна', 'svetlana_e', 'rvsh2024ruk', 'Руководитель', 550, '["Изучить материалы"]']
    ];

    // Подготавливаем запрос для вставки пользователей
    const insertUser = db.prepare(`
        INSERT OR REPLACE INTO users (firstName, lastName, username, password, rank, rating, goals, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Добавляем пользователей
    users.forEach(([firstName, lastName, username, password, rank, rating, goals]) => {
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@rvsh.ru`;
        insertUser.run(firstName, lastName, username, password, rank, rating, goals, email);
    });

    insertUser.finalize();

    // Добавляем таблицу для сообщений общего чата
    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Таблица групп
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY,
        name TEXT,
        description TEXT,
        created_by INTEGER,
        event_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id),
        FOREIGN KEY(event_id) REFERENCES events(id)
    )`);

    // Таблица сообщений в группах
    db.run(`CREATE TABLE IF NOT EXISTS group_messages (
        id INTEGER PRIMARY KEY,
        group_id INTEGER,
        user_id INTEGER,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES groups(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Таблица участников групп
    db.run(`CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER,
        user_id INTEGER,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(group_id, user_id),
        FOREIGN KEY(group_id) REFERENCES groups(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Добавляем таблицу для push-подписок
    db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY,
        user_email TEXT UNIQUE,
        subscription TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица материалов
    db.run(`CREATE TABLE IF NOT EXISTS learning_materials (
        id INTEGER PRIMARY KEY,
        title TEXT,
        type TEXT,
        content TEXT,
        category TEXT DEFAULT 'history',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id)
    )`);

    // Таблица прогресса пользователей
    db.run(`CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        material_id INTEGER,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        points INTEGER DEFAULT 10,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(material_id) REFERENCES learning_materials(id),
        UNIQUE(user_id, material_id)
    )`);

    // Добавим несколько материалов по разным категориям
    const materials = [
        // История штаба
        ['История создания РВШ', 'text', 'Российская выездная школа была создана в 1992 году группой энтузиастов...', 'history'],
        ['Структура Штаба', 'text', 'Штаб состоит из нескольких подразделений: административного, методического, инструкторского...', 'history'],
        ['Первые сборы РВШ', 'video', 'https://www.youtube.com/watch?v=example1', 'history'],
        ['Традиции РВШ', 'text', 'За годы существования в РВШ сложились особые традиции...', 'history'],
        ['Тест на знание истории РВШ', 'task', 'Ответьте на 10 вопросов о истории РВШ и отправьте результаты руководителю.', 'history']
    ];

    const insertMaterial = db.prepare(`
        INSERT OR IGNORE INTO learning_materials (title, type, content, category, created_by)
        VALUES (?, ?, ?, ?, 1)
    `);

    materials.forEach(([title, type, content, category]) => {
        insertMaterial.run(title, type, content, category);
    });

    insertMaterial.finalize();

    console.log('База данных успешно инициализирована');
});

db.close(); 