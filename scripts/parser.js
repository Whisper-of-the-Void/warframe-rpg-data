// scripts/parser.js
const { GAME_SECTIONS, FLOOD_SECTIONS } = require('../config/forum_sections.js');

class ForumParser {
    constructor() {
        this.memberlistUrl = 'https://warframe.f-rpg.me/userlist.php';
        this.gameSections = GAME_SECTIONS;
        this.floodSections = FLOOD_SECTIONS;
    }

    async parseMembersList() {
        try {
            console.log('🔍 Начинаем парсинг списка пользователей...');
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
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        console.log('📄 Загружено HTML:', html.length, 'символов');

        // Адаптируйте этот селектор под структуру вашего форума
        const tables = doc.querySelectorAll('table');
        console.log('📊 Найдено таблиц:', tables.length);

        let membersTable = null;
        
        // Ищем таблицу с пользователями
        tables.forEach((table, index) => {
            const tableText = table.textContent;
            // Ищем таблицу с заголовками пользователей
            if (tableText.includes('Имя') && 
                tableText.includes('Сообщений') && 
                tableText.includes('Зарегистрирован')) {
                membersTable = table;
                console.log(`✅ Найдена таблица пользователей #${index}`);
            }
        });

        if (!membersTable) {
            console.error('❌ Таблица пользователей не найдена');
            return players;
        }

        // Парсим строки таблицы (пропускаем заголовок)
        const rows = membersTable.querySelectorAll('tr');
        console.log('📋 Найдено строк:', rows.length);

        // Пропускаем первую строку (заголовки)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td');
            
            if (cells.length >= 4) { // Минимум 4 колонки: Имя, Статус, Сообщений, Зарегистрирован
                try {
                    const username = cells[0].textContent.trim();
                    
                    // Пропускаем пустые строки или системные записи
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

    createPlayerData(username, cells) {
        // Парсим бонусы из статуса (адаптируйте под ваш формат)
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
        // Ваш формат: "💰+200 ⚡+23% 👁-12%"
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
            // Адаптируйте под формат даты на вашем форуме
            const regDate = new Date(registeredDate);
            const today = new Date();
            return Math.floor((today - regDate) / (1000 * 60 * 60 * 24));
        } catch (error) {
            console.error('❌ Ошибка расчета даты для:', registeredDate);
            return 0;
        }
    }
}

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForumParser;
}
