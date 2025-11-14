// scripts/updater.js
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Импортируем конфигурацию разделов
const { GAME_SECTIONS, FLOOD_SECTIONS } = require('./config/forum_sections.js');

class ForumParser {
    constructor() {
        this.memberlistUrl = 'https://warframe.f-rpg.me/userlist.php';
        this.gameSections = GAME_SECTIONS;
        this.floodSections = FLOOD_SECTIONS;
    }

    async parseMembersList() {
        try {
            console.log('🔍 Начинаем парсинг списка пользователей...');
            console.log('📡 URL:', this.memberlistUrl);
            
            const response = await fetch(this.memberlistUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            console.log('✅ HTML получен, размер:', html.length, 'символов');
            return this.extractPlayersFromHTML(html);
            
        } catch (error) {
            console.error('❌ Ошибка парсинга:', error);
            return null;
        }
    }

    extractPlayersFromHTML(html) {
        const players = {};
        
        try {
            // Используем JSDOM вместо DOMParser
            const dom = new JSDOM(html);
            const doc = dom.window.document;

            const tables = doc.querySelectorAll('table');
            console.log('📊 Найдено таблиц:', tables.length);

            let membersTable = null;
            
            // Ищем таблицу с пользователями - адаптируем под вашу структуру
            tables.forEach((table, index) => {
                const tableText = table.textContent;
                console.log(`Таблица ${index}:`, tableText.substring(0, 100));
                
                // Пробуем разные варианты заголовков
                if (tableText.includes('Имя') || 
                    tableText.includes('Пользователь') ||
                    tableText.includes('Участник')) {
                    membersTable = table;
                    console.log(`✅ Возможно, найдена таблица пользователей #${index}`);
                }
            });

            if (!membersTable && tables.length > 0) {
                // Берем первую таблицу как запасной вариант
                membersTable = tables[0];
                console.log('🔄 Используем первую таблицу как запасной вариант');
            }

            if (!membersTable) {
                console.error('❌ Таблица пользователей не найдена');
                return players;
            }

            // Парсим строки таблицы
            const rows = membersTable.querySelectorAll('tr');
            console.log('📋 Найдено строк:', rows.length);

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const cells = row.querySelectorAll('td, th');
                
                if (cells.length >= 2) {
                    try {
                        const username = cells[0].textContent.trim();
                        
                        // Пропускаем пустые строки или заголовки
                        if (!username || username === '' || 
                            username === 'Имя' || username === 'Пользователь' ||
                            username.includes('@') || username.includes('mail')) continue;
                        
                        console.log(`👤 Найден пользователь: ${username}`);
                        players[username] = this.createPlayerData(username, cells);
                        
                    } catch (cellError) {
                        console.error('❌ Ошибка обработки строки:', cellError);
                    }
                }
            }

            console.log(`✅ Успешно обработано пользователей: ${Object.keys(players).length}`);
            return players;
            
        } catch (error) {
            console.error('❌ Ошибка в extractPlayersFromHTML:', error);
            return players;
        }
    }

    createPlayerData(username, cells) {
        // Для начала используем базовые данные
        const bonuses = this.parseBonusesFromStatus('');
        
        return {
            id: this.generateId(username),
            name: username,
            forum_data: {
                status: cells[1]?.textContent?.trim() || '',
                respect: '+0 -0',
                posts: 0,
                registered: 'Неизвестно',
                last_online: 'Неизвестно',
                days_since_registration: 0
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
}

// Основная функция
async function main() {
    console.log('🚀 Запуск обновления данных...');
    
    const parser = new ForumParser();
    const players = await parser.parseMembersList();
    
    if (players && Object.keys(players).length > 0) {
        const dataPath = path.join(__dirname, '../data/players.json');
        
        // Сохраняем данные
        const dataToSave = {
            players: players,
            last_updated: new Date().toISOString(),
            version: "1.0.0",
            stats: {
                total_players: Object.keys(players).length,
                parsed_at: new Date().toISOString()
            }
        };
        
        fs.writeFileSync(dataPath, JSON.stringify(dataToSave, null, 2));
        console.log('✅ Данные успешно сохранены в players.json');
        
        // Выводим список обработанных пользователей
        console.log('📋 Обработанные пользователи:');
        Object.keys(players).forEach(username => {
            console.log(`   - ${username}`);
        });
    } else {
        console.log('❌ Не удалось получить данные игроков');
        // Создаем пустой файл для тестирования
        const dataPath = path.join(__dirname, '../data/players.json');
        const emptyData = {
            players: {},
            last_updated: new Date().toISOString(),
            version: "1.0.0",
            stats: {
                total_players: 0,
                parsed_at: new Date().toISOString()
            }
        };
        fs.writeFileSync(dataPath, JSON.stringify(emptyData, null, 2));
        console.log('📁 Создан пустой файл players.json для тестирования');
    }
}

// Запускаем скрипт
main().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});
