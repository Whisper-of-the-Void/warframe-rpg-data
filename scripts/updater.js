// scripts/updater.js
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Импортируем конфигурацию разделов
const { GAME_SECTIONS, FLOOD_SECTIONS } = require('./config/forum_sections.js');

class ForumParser {
    constructor() {
        this.memberlistUrl = 'https://rusff.me/memberlist.php';
        this.gameSections = GAME_SECTIONS;
        this.floodSections = FLOOD_SECTIONS;
    }

    async parseMembersList() {
        try {
            console.log('🔍 Начинаем парсинг списка пользователей...');
            
            // Используем node-fetch вместо браузерного fetch
            const response = await fetch(this.memberlistUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            return this.extractPlayersFromHTML(html);
            
        } catch (error) {
            console.error('❌ Ошибка парсинга:', error);
            return null;
        }
    }

    extractPlayersFromHTML(html) {
        const players = {};
        
        // Используем JSDOM вместо браузерного DOM
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        console.log('📄 Загружено HTML:', html.length, 'символов');

        const tables = doc.querySelectorAll('table');
        console.log('📊 Найдено таблиц:', tables.length);

        let membersTable = null;
        
        // Ищем таблицу с пользователями
        tables.forEach((table, index) => {
            const tableText = table.textContent;
            if (tableText.includes('Имя') && 
                tableText.includes('Сообщений') && 
                tableText.includes('Зарегистрирован')) {
                membersTable = table;
                console.log(`✅ Найдена таблица пользователей #${index}`);
            }
        });

        if (!membersTable) {
            console.error('❌ Таблица пользователей не найдена');
            // Попробуем найти по другому шаблону
            return this.alternativeParse(doc);
        }

        const rows = membersTable.querySelectorAll('tr');
        console.log('📋 Найдено строк:', rows.length);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td');
            
            if (cells.length >= 4) {
                try {
                    const username = cells[0].textContent.trim();
                    
                    if (!username || username === '' || username === 'Имя') continue;
                    
                    players[username] = this.createPlayerData(username, cells);
                    console.log(`👤 Обработан пользователь: ${username}`);
                    
                } catch (cellError) {
                    console.error('❌ Ошибка обработки строки:', cellError);
                }
            }
        }

        console.log(`✅ Успешно обработано пользователей: ${Object.keys(players).length}`);
        return players;
    }

    // Альтернативный метод парсинга, если первый не сработал
    alternativeParse(doc) {
        const players = {};
        console.log('🔄 Пробуем альтернативный парсинг...');
        
        // Ищем все ссылки с именами пользователей
        const userLinks = doc.querySelectorAll('a[href*="member.php"]');
        console.log('🔗 Найдено пользовательских ссылок:', userLinks.length);
        
        userLinks.forEach(link => {
            const username = link.textContent.trim();
            if (username && username !== '' && !username.includes('@')) {
                players[username] = {
                    id: this.generateId(username),
                    name: username,
                    forum_data: {
                        status: '',
                        respect: '+0 -0',
                        posts: 0,
                        registered: 'Неизвестно',
                        last_online: 'Неизвестно',
                        days_since_registration: 0
                    },
                    bonuses: { credits: 0, infection: 0, whisper: 0 },
                    game_stats: {
                        credits: 1000,
                        infection: { base: 0, bonus: 0, total: 0 },
                        whisper: { base: 0, bonus: 0, total: 0 }
                    },
                    last_updated: new Date().toISOString()
                };
            }
        });
        
        return players;
    }

    createPlayerData(username, cells) {
        const bonuses = this.parseBonusesFromStatus(cells[1]?.textContent?.trim() || '');
        
        return {
            id: this.generateId(username),
            name: username,
            forum_data: {
                status: cells[1]?.textContent?.trim() || '',
                respect: cells[2]?.textContent?.trim() || '+0 -0',
                posts: parseInt(cells[3]?.textContent) || 0,
                registered: cells[4]?.textContent?.trim() || 'Неизвестно',
                last_online: cells[5]?.textContent?.trim() || 'Неизвестно',
                days_since_registration: this.calculateDaysSinceRegistration(cells[4]?.textContent?.trim())
            },
            bonuses: bonuses,
            game_stats: {
                credits: 1000 + bonuses.credits,
                infection: { 
                    base: 0, 
                    bonus: bonuses.infection, 
                    total: Math.max(0, Math.min(100, bonuses.infection)) 
                },
                whisper: { 
                    base: 0, 
                    bonus: bonuses.whisper, 
                    total: Math.max(0, Math.min(100, bonuses.whisper)) 
                }
            },
            activity: {
                posts_per_day: 0,
                activity_level: "new",
                activity_score: 0
            },
            last_updated: new Date().toISOString()
        };
    }

    parseBonusesFromStatus(status) {
        const creditsMatch = status.match(/💰([+-]?\d+)/);
        const infectionMatch = status.match(/⚡([+-]?\d+)%/);
        const whisperMatch = status.match(/👁([+-]?\d+)%/);

        return {
            credits: creditsMatch ? parseInt(creditsMatch[1]) : 0,
            infection: infectionMatch ? parseInt(infectionMatch[1]) : 0,
            whisper: whisperMatch ? parseInt(whisperMatch[1]) : 0
        };
    }

    generateId(username) {
        return username.toLowerCase()
            .replace(/[^a-z0-9а-яё]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    calculateDaysSinceRegistration(registeredDate) {
        if (!registeredDate || registeredDate === 'Неизвестно') return 0;
        
        try {
            // Пытаемся разобрать дату в формате "2025-10-21"
            const regDate = new Date(registeredDate);
            const today = new Date();
            return Math.floor((today - regDate) / (1000 * 60 * 60 * 24));
        } catch (error) {
            console.error('❌ Ошибка расчета даты для:', registeredDate);
            return 0;
        }
    }
}

// Основная функция
async function updatePlayerData() {
    const parser = new ForumParser();
    const players = await parser.parseMembersList();
    
    if (players) {
        const dataPath = path.join(__dirname, '../data/players.json');
        let existingData = { players: {} };
        
        // Читаем существующие данные, если файл есть
        if (fs.existsSync(dataPath)) {
            existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        }
        
        // Объединяем данные
        const updatedPlayers = { ...existingData.players, ...players };
        
        const updatedData = {
            players: updatedPlayers,
            last_updated: new Date().toISOString(),
            version: existingData.version || "1.0.0"
        };
        
        fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
        console.log('✅ Данные игроков обновлены!');
    } else {
        console.log('❌ Не удалось получить данные игроков');
    }
}

// Запуск
updatePlayerData();
