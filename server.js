const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const WebSocket = require('ws');
const webpush = require('web-push');
const config = require('./server/config');

const app = express();
const port = 3000;

// Создаем HTTP сервер
const server = require('http').createServer(app);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(cookieParser());

// Настройка CORS
app.use(cors({
    origin: true, // Разрешаем все источники
    credentials: true
}));

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'server', 'database.db'));

// Проверка подключения к базе данных
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
    if (err) {
        console.error('Ошибка при проверке базы данных:', err);
        process.exit(1);
    }
    if (!row) {
        console.error('Таблица users не найдена. Пожалуйста, запустите node server/init-db.js');
        process.exit(1);
    }
    console.log('Успешное подключение к базе данных');
});

// Добавляем столбец category в таблицу learning_materials, если его нет
db.run(`
    PRAGMA table_info(learning_materials)
`, [], (err, rows) => {
    if (err) {
        console.error('Ошибка при получении информации о таблице:', err);
        return;
    }
    
    // Проверяем, есть ли столбец category
    const hasCategory = rows && rows.some(row => row.name === 'category');
    
    if (!hasCategory) {
        console.log('Добавляем столбец category в таблицу learning_materials');
        
        db.run(`
            ALTER TABLE learning_materials ADD COLUMN category TEXT DEFAULT 'history'
        `, [], (err) => {
            if (err) {
                console.error('Ошибка при добавлении столбца category:', err);
                return;
            }
            
            console.log('Столбец category успешно добавлен');
        });
    }
});

// Basic authentication middleware
const authenticateUser = (req, res, next) => {
    const userEmail = req.cookies.userEmail;
    
    // Добавим логирование для отладки
    console.log('Проверка аутентификации для:', req.path, 'Email:', userEmail);
    
    if (!userEmail) {
        console.error('Неавторизованный доступ к:', req.path);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Проверяем существование пользователя в базе
    db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) {
            console.error('Ошибка при проверке пользователя:', err);
            return res.status(500).json({ error: 'Ошибка сервера при проверке аутентификации' });
        }
        
        if (!user) {
            console.error('Пользователь не найден в базе:', userEmail);
            return res.status(401).json({ error: 'Пользователь не найден' });
        }
        
        // Пользователь аутентифицирован
        next();
    });
};

// Проверка на админа
const isAdmin = (rank) => {
    return ['ПШ', 'СШ', 'Руководитель'].includes(rank);
};

// Настройка VAPID для push-уведомлений
webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey
);

// WebSocket сервер
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // Рассылаем сообщение всем подключенным клиентам
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

// Routes
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('Попытка входа:', { username, password });
    
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', 
        [username, password], 
        (err, user) => {
            if (err) {
                console.error('Ошибка БД:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!user) {
                console.log('Пользователь не найден');
                return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
            }
            
            console.log('Успешный вход:', user);
            
            res.cookie('userEmail', user.email, { 
                httpOnly: true,
                secure: false, // Изменено для локальной разработки
                sameSite: 'lax'  // Изменено для лучшей совместимости
            });
            
            res.json({ 
                success: true,
                user: {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    rank: user.rank
                }
            });
        }
    );
});

app.get('/api/user/profile', authenticateUser, (req, res) => {
    const userEmail = req.cookies.userEmail;
    
    db.get('SELECT * FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        res.json({
            firstName: user.firstName,
            lastName: user.lastName,
            rank: user.rank,
            rating: user.rating,
            goals: JSON.parse(user.goals),
            isAdmin: isAdmin(user.rank)
        });
    });
});

// API для событий
app.get('/api/events', authenticateUser, (req, res) => {
    db.all('SELECT * FROM events ORDER BY date', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/events', authenticateUser, (req, res) => {
    const { title, date, description } = req.body;
    const userEmail = req.cookies.userEmail;

    // Проверяем права пользователя
    db.get('SELECT rank FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Ошибка проверки прав' });
        }

        if (!isAdmin(user.rank)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Создаем событие
        db.run(
            'INSERT INTO events (title, date, description, created_by) VALUES (?, ?, ?, (SELECT id FROM users WHERE email = ?))',
            [title, date, description, userEmail],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID });
            }
        );
    });
});

// Получение списка всех пользователей (только для админов)
app.get('/api/users', authenticateUser, (req, res) => {
    const userEmail = req.cookies.userEmail;
    
    // Проверяем права пользователя
    db.get('SELECT rank FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!isAdmin(user.rank)) {
            return res.status(403).json({ error: 'Недостаточно прав для просмотра пользователей' });
        }
        
        // Получаем список пользователей
        db.all(`
            SELECT id, firstName, lastName, rank, email
            FROM users
            ORDER BY firstName, lastName
        `, [], (err, users) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(users);
        });
    });
});

// Получение данных конкретного пользователя
app.get('/api/users/:id', authenticateUser, (req, res) => {
    const userEmail = req.cookies.userEmail;
    const userId = req.params.id;
    
    // Проверяем права доступа
    db.get('SELECT rank FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err || !user || !isAdmin(user.rank)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        
        // Получаем данные пользователя
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            res.json(user);
        });
    });
});

// Обновление данных пользователя
app.put('/api/users/:id', authenticateUser, (req, res) => {
    const userEmail = req.cookies.userEmail;
    const userId = req.params.id;
    const { rating, goals } = req.body;
    
    // Проверяем права доступа
    db.get('SELECT rank FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err || !user || !isAdmin(user.rank)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        
        // Обновляем данные пользователя
        db.run(
            'UPDATE users SET rating = ?, goals = ? WHERE id = ?',
            [rating, JSON.stringify(goals), userId],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true });
            }
        );
    });
});

// API для отправки сообщений в общий чат
app.post('/api/chat/messages', authenticateUser, (req, res) => {
    const { message } = req.body;
    const userEmail = req.cookies.userEmail;
    
    db.get('SELECT id, firstName, lastName FROM users WHERE email = ?', 
        [userEmail], 
        (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            // Получаем текущее время в формате ISO
            const now = new Date().toISOString();
            
            // Сохраняем сообщение в базе данных
            db.run('INSERT INTO chat_messages (user_id, message, timestamp) VALUES (?, ?, datetime(?))',
                [user.id, message, now],
                function(err) {
                    if (err) {
                        console.error('Ошибка сохранения сообщения:', err);
                        return res.status(500).json({ error: 'Ошибка сохранения сообщения' });
                    }
                    
                    const messageId = this.lastID;
                    
                    // Получаем сохраненное сообщение с правильным временем
                    db.get('SELECT datetime(timestamp, "localtime") as timestamp FROM chat_messages WHERE id = ?',
                        [messageId],
                        (err, row) => {
                            if (err) {
                                console.error('Ошибка получения времени сообщения:', err);
                            }
                            
                            const timestamp = row ? row.timestamp : now;
                            
                            // Отправляем сообщение через WebSocket
                            const messageData = {
                                type: 'message',
                                message: {
                                    id: messageId,
                                    text: message,
                                    timestamp: timestamp,
                                    userName: `${user.firstName} ${user.lastName}`,
                                    isOwn: false
                                }
                            };
                            
                            wss.clients.forEach(client => {
                                if (client.readyState === WebSocket.OPEN) {
                                    client.send(JSON.stringify(messageData));
                                }
                            });
                            
                            // Отправляем уведомление всем подписанным пользователям
                            sendNotificationToAll(`${user.firstName} ${user.lastName}: ${message}`);
                            
                            res.json({ 
                                success: true,
                                messageId: messageId,
                                timestamp: timestamp
                            });
                        }
                    );
                }
            );
        }
    );
});

// API для получения сообщений общего чата
app.get('/api/chat/messages', authenticateUser, (req, res) => {
    console.log('Запрос на получение сообщений');
    const userEmail = req.cookies.userEmail;
    
    // Получаем ID текущего пользователя
    db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, currentUser) => {
        if (err) {
            console.error('Ошибка получения пользователя:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!currentUser) {
            console.error('Пользователь не найден:', userEmail);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        console.log('Текущий пользователь:', currentUser);
        
        // Проверяем существование таблицы
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'", (err, table) => {
            if (err) {
                console.error('Ошибка проверки таблицы:', err);
                return res.status(500).json({ error: 'Ошибка проверки таблицы' });
            }
            
            if (!table) {
                console.error('Таблица chat_messages не существует');
                return res.status(500).json({ error: 'Таблица сообщений не существует' });
            }
            
            // Получаем последние 50 сообщений из общего чата
            db.all(`
                SELECT cm.id, cm.message, datetime(cm.timestamp, 'localtime') as timestamp, 
                       u.firstName, u.lastName, u.id as userId
                FROM chat_messages cm
                JOIN users u ON cm.user_id = u.id
                ORDER BY cm.timestamp ASC
                LIMIT 50
            `, [], (err, messages) => {
                if (err) {
                    console.error('Ошибка загрузки сообщений:', err);
                    return res.status(500).json({ error: 'Ошибка загрузки сообщений' });
                }
                
                console.log('Загружено сообщений:', messages.length);
                
                // Форматируем сообщения для клиента
                const formattedMessages = messages.map(msg => ({
                    id: msg.id,
                    text: msg.message,
                    timestamp: msg.timestamp,
                    userName: `${msg.firstName} ${msg.lastName}`,
                    isOwn: msg.userId === currentUser.id
                }));
                
                res.json(formattedMessages);
            });
        });
    });
});

// Добавим новый маршрут для подписки на уведомления
app.post('/api/notifications/subscribe', authenticateUser, (req, res) => {
    const subscription = req.body;
    const userEmail = req.cookies.userEmail;

    // Сохраняем подписку в базе данных
    db.run(
        'INSERT OR REPLACE INTO push_subscriptions (user_email, subscription) VALUES (?, ?)',
        [userEmail, JSON.stringify(subscription)],
        (err) => {
            if (err) {
                console.error('Ошибка сохранения подписки:', err);
                return res.status(500).json({ error: 'Ошибка сохранения подписки' });
            }
            res.json({ success: true });
        }
    );
});

// Функция для отправки уведомлений
async function sendNotification(subscription, payload) {
    try {
        await webpush.sendNotification(subscription, payload);
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
    }
}

// Функция для отправки уведомлений всем подписчикам
async function sendNotificationToAll(message) {
    db.all('SELECT subscription FROM push_subscriptions', [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения подписок:', err);
            return;
        }

        rows.forEach(row => {
            const subscription = JSON.parse(row.subscription);
            sendNotification(subscription, message);
        });
    });
}

// API для получения групп пользователя
app.get('/api/chat/groups', authenticateUser, (req, res) => {
    const userEmail = req.cookies.userEmail;
    
    db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(`
            SELECT g.id, g.name, g.description, g.created_at, e.title as eventTitle
            FROM groups g
            LEFT JOIN events e ON g.event_id = e.id
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ?
            ORDER BY g.created_at DESC
        `, [user.id], (err, groups) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(groups);
        });
    });
});

// API для получения сообщений группы
app.get('/api/chat/groups/:groupId/messages', authenticateUser, (req, res) => {
    const groupId = req.params.groupId;
    const userEmail = req.cookies.userEmail;
    
    // Проверяем, является ли пользователь участником группы
    db.get(`
        SELECT 1 FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND u.email = ?
    `, [groupId, userEmail], (err, membership) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!membership) {
            return res.status(403).json({ error: 'Вы не являетесь участником этой группы' });
        }
        
        // Получаем сообщения группы
        db.all(`
            SELECT gm.id, gm.message, gm.timestamp, u.firstName, u.lastName, u.id as userId
            FROM group_messages gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
            ORDER BY gm.timestamp DESC
            LIMIT 50
        `, [groupId], (err, messages) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, currentUser) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // Отмечаем собственные сообщения
                const formattedMessages = messages.map(msg => ({
                    id: msg.id,
                    text: msg.message,
                    timestamp: msg.timestamp,
                    userName: `${msg.firstName} ${msg.lastName}`,
                    isOwn: msg.userId === currentUser.id
                }));
                
                res.json(formattedMessages.reverse());
            });
        });
    });
});

// API для создания группы
app.post('/api/chat/groups', authenticateUser, (req, res) => {
    const { name, description, eventId, members } = req.body;
    const userEmail = req.cookies.userEmail;
    
    // Проверяем права пользователя
    db.get('SELECT id, rank FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!isAdmin(user.rank)) {
            return res.status(403).json({ error: 'Недостаточно прав для создания группы' });
        }
        
        // Создаем группу
        db.run(`
            INSERT INTO groups (name, description, created_by, event_id)
            VALUES (?, ?, ?, ?)
        `, [name, description, user.id, eventId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            const groupId = this.lastID;
            
            // Добавляем создателя как участника группы
            db.run(`
                INSERT INTO group_members (group_id, user_id)
                VALUES (?, ?)
            `, [groupId, user.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // Если есть дополнительные участники, добавляем их
                if (members && members.length > 0) {
                    const stmt = db.prepare(`
                        INSERT OR IGNORE INTO group_members (group_id, user_id)
                        VALUES (?, ?)
                    `);
                    
                    members.forEach(memberId => {
                        if (memberId !== user.id) { // Пропускаем создателя, он уже добавлен
                            stmt.run(groupId, memberId);
                        }
                    });
                    
                    stmt.finalize();
                }
                
                res.json({ 
                    success: true, 
                    groupId: groupId,
                    message: 'Группа успешно создана'
                });
            });
        });
    });
});

// API для отправки сообщения в группу
app.post('/api/chat/groups/:groupId/messages', authenticateUser, (req, res) => {
    const groupId = req.params.groupId;
    const { message } = req.body;
    const userEmail = req.cookies.userEmail;
    
    // Проверяем, является ли пользователь участником группы
    db.get(`
        SELECT u.id, u.firstName, u.lastName FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND u.email = ?
    `, [groupId, userEmail], (err, membership) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!membership) {
            return res.status(403).json({ error: 'Вы не являетесь участником этой группы' });
        }
        
        // Добавляем сообщение
        db.run(`
            INSERT INTO group_messages (group_id, user_id, message)
            VALUES (?, ?, ?)
        `, [groupId, membership.id, message], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Отправляем сообщение через WebSocket
            const messageData = {
                type: 'group_message',
                groupId: groupId,
                message: {
                    id: this.lastID,
                    text: message,
                    timestamp: new Date().toISOString(),
                    userName: `${membership.firstName} ${membership.lastName}`,
                    isOwn: false
                }
            };
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(messageData));
                }
            });
            
            // Отправляем уведомления участникам группы
            sendGroupNotification(groupId, `${membership.firstName} ${membership.lastName}: ${message}`);
            
            res.json({ success: true });
        });
    });
});

// API для добавления пользователя в группу
app.post('/api/chat/groups/:groupId/members', authenticateUser, (req, res) => {
    const groupId = req.params.groupId;
    const { userId } = req.body;
    const userEmail = req.cookies.userEmail;
    
    // Проверяем права пользователя
    db.get('SELECT rank FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!isAdmin(user.rank)) {
            return res.status(403).json({ error: 'Недостаточно прав для добавления участников' });
        }
        
        // Добавляем пользователя в группу
        db.run(`
            INSERT OR IGNORE INTO group_members (group_id, user_id)
            VALUES (?, ?)
        `, [groupId, userId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({ success: true });
        });
    });
});

// Функция для отправки уведомлений участникам группы
async function sendGroupNotification(groupId, message) {
    db.all(`
        SELECT u.email FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        JOIN push_subscriptions ps ON u.email = ps.user_email
        WHERE gm.group_id = ?
    `, [groupId], (err, members) => {
        if (err) {
            console.error('Ошибка получения участников группы:', err);
            return;
        }
        
        members.forEach(member => {
            db.get('SELECT subscription FROM push_subscriptions WHERE user_email = ?', 
                [member.email], (err, row) => {
                    if (err || !row) return;
                    
                    try {
                        const subscription = JSON.parse(row.subscription);
                        sendNotification(subscription, message);
                    } catch (error) {
                        console.error('Ошибка отправки уведомления:', error);
                    }
                }
            );
        });
    });
}

// API для получения учебных материалов
app.get('/api/learning/materials', authenticateUser, (req, res) => {
    const category = req.query.category || 'history'; // По умолчанию "История штаба"
    
    db.all(`
        SELECT lm.id, lm.title, lm.type, lm.content, lm.category, lm.created_at,
               CASE WHEN up.id IS NOT NULL THEN 1 ELSE 0 END as completed,
               COALESCE(up.points, 0) as points
        FROM learning_materials lm
        LEFT JOIN user_progress up ON lm.id = up.material_id AND up.user_id = (
            SELECT id FROM users WHERE email = ?
        )
        WHERE lm.category = ?
        ORDER BY lm.created_at ASC
    `, [req.cookies.userEmail, category], (err, materials) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(materials);
    });
});

// API для отметки материала как выполненного
app.post('/api/learning/complete/:materialId', authenticateUser, (req, res) => {
    const materialId = req.params.materialId;
    const userEmail = req.cookies.userEmail;
    
    db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Проверяем существование материала
        db.get('SELECT id FROM learning_materials WHERE id = ?', [materialId], (err, material) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (!material) {
                return res.status(404).json({ error: 'Материал не найден' });
            }
            
            // Отмечаем материал как выполненный (20 очков)
            db.run(`
                INSERT OR IGNORE INTO user_progress (user_id, material_id, points)
                VALUES (?, ?, 20)
            `, [user.id, materialId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                // Обновляем рейтинг пользователя
                db.run(`
                    UPDATE users SET rating = rating + 20 WHERE id = ?
                `, [user.id], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    res.json({ 
                        success: true, 
                        message: 'Материал отмечен как выполненный',
                        points: 20
                    });
                });
            });
        });
    });
});

// API для получения прогресса пользователя
app.get('/api/learning/progress', authenticateUser, (req, res) => {
    const userEmail = req.cookies.userEmail;
    
    db.get(`
        SELECT u.id, u.firstName, u.lastName, u.rating,
               COUNT(up.id) as completed_count,
               SUM(up.points) as total_points
        FROM users u
        LEFT JOIN user_progress up ON u.id = up.user_id
        WHERE u.email = ?
        GROUP BY u.id
    `, [userEmail], (err, progress) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!progress) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Рассчитываем уровень и опыт
        const xpPerLevel = 100;
        const xpPerTask = 20;
        
        // Если total_points равно null (нет выполненных заданий), устанавливаем его в 0
        const totalXP = (progress.total_points || 0) * (xpPerTask / 10); // Конвертируем очки в опыт
        const level = Math.floor(totalXP / xpPerLevel);
        const currentLevelXP = totalXP % xpPerLevel;
        const nextLevelXP = xpPerLevel;
        const xpProgress = (currentLevelXP / nextLevelXP) * 100;
        
        res.json({
            ...progress,
            level,
            currentLevelXP,
            nextLevelXP,
            xpProgress,
            totalXP
        });
    });
});

// API для добавления нового материала (только для админов)
app.post('/api/learning/materials', authenticateUser, (req, res) => {
    const { title, category, type, content } = req.body;
    const userEmail = req.cookies.userEmail;
    
    // Добавим логирование для отладки
    console.log('Получен запрос на добавление материала:', { title, category, type, userEmail });
    
    // Проверяем наличие всех необходимых полей
    if (!title || !category || !type || !content) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    
    // Проверяем права пользователя
    db.get('SELECT id, rank FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) {
            console.error('Ошибка при получении данных пользователя:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            console.error('Пользователь не найден:', userEmail);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        if (!isAdmin(user.rank)) {
            console.error('Недостаточно прав для пользователя:', userEmail, user.rank);
            return res.status(403).json({ error: 'Недостаточно прав для добавления материалов' });
        }
        
        // Добавляем материал
        db.run(`
            INSERT INTO learning_materials (title, category, type, content, created_by)
            VALUES (?, ?, ?, ?, ?)
        `, [title, category, type, content, user.id], function(err) {
            if (err) {
                console.error('Ошибка при добавлении материала:', err);
                return res.status(500).json({ error: err.message });
            }
            
            console.log('Материал успешно добавлен, ID:', this.lastID);
            
            res.json({ 
                success: true, 
                materialId: this.lastID,
                message: 'Материал успешно добавлен'
            });
        });
    });
});

// API для удаления материала (только для админов)
app.delete('/api/learning/materials/:id', authenticateUser, (req, res) => {
    const materialId = req.params.id;
    const userEmail = req.cookies.userEmail;
    
    // Проверяем права пользователя
    db.get('SELECT rank FROM users WHERE email = ?', [userEmail], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!isAdmin(user.rank)) {
            return res.status(403).json({ error: 'Недостаточно прав для удаления материалов' });
        }
        
        // Удаляем материал
        db.run('DELETE FROM learning_materials WHERE id = ?', [materialId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Материал не найден' });
            }
            
            // Удаляем связанные записи о прогрессе
            db.run('DELETE FROM user_progress WHERE material_id = ?', [materialId], (err) => {
                if (err) console.error('Ошибка удаления прогресса:', err);
                
                res.json({ 
                    success: true, 
                    message: 'Материал успешно удален'
                });
            });
        });
    });
});

// Изменяем запуск сервера
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 