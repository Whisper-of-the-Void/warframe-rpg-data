// scripts/updater.js
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');

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
            console.log('📡 URL:', this.memberlistUrl);
            
            const response = await fetch(this.memberlistUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Получаем данные как buffer и конвертируем из windows-1251 в utf-8
            const buffer = await response.buffer();
            const html = iconv.decode(buffer, 'win1251');
            
            console.log('✅ HTML получен, размер:', html.length, 'символов');
            console.log('🔤 Кодировка: windows-1251 -> utf-8');
            
            return this.extractPlayersFromHTML(html);
            
        } catch (error) {
            console.error('❌ Ошибка парсинга:', error);
            return null;
        }
    }

    extractPlayersFromHTML(html) {
        const players = {};
        
        try {
            const dom = new JSDOM(html);
            const doc = dom.window.document;

            // Точный селектор для вашего форума
            const userTable = doc.querySelector('.usertable table');
            
            if (!userTable) {
                console.error('❌ Таблица пользователей не найдена');
                // Попробуем найти любую таблицу с пользователями
                const tables = doc.querySelectorAll('table');
                console.log('📊 Все таблицы на странице:', tables.length);
                tables.forEach((table, index) => {
                    console.log(`Таблица ${index}:`, table.textContent.substring(0, 200));
                });
                return players;
            }

            console.log('✅ Найдена таблица пользователей с классом usertable');

            // Парсим строки таблицы (пропускаем заголовок thead)
            const rows = userTable.querySelectorAll('tbody tr');
            console.log('📋 Найдено строк пользователей:', rows.length);

            rows.forEach((row, index) => {
                try {
                    const cells = row.querySelectorAll('td');
                    
                    if (cells.length >= 6) {
                        // Извлекаем имя пользователя из ссылки
                        const usernameLink = cells[0].querySelector('.usersname a');
                        const username = usernameLink ? usernameLink.textContent.trim() : cells[0].textContent.trim();
                        
                        if (!username || username === '') return;
                        
                        console.log(`👤 Обрабатываем пользователя: ${username}`);
                        players[username] = this.createPlayerData(username, cells);
                        
                        // Логируем распарсенные данные для отладки
                        const player = players[username];
                        console.log(`   💰 Кредиты: ${player.bonuses.credits}`);
                        console.log(`   ⚡ Заражение: ${player.bonuses.infection}%`);
                        console.log(`   👁 Шёпот: ${player.bonuses.whisper}%`);
                        console.log(`   📝 Сообщений: ${player.forum_data.posts}`);
                    }
                } catch (cellError) {
                    console.error(`❌ Ошибка обработки строки ${index}:`, cellError);
                }
            });

            console.log(`✅ Успешно обработано пользователей: ${Object.keys(players).length}`);
            return players;
            
        } catch (error) {
            console.error('❌ Ошибка в extractPlayersFromHTML:', error);
            return players;
        }
    }

    createPlayerData(username, cells) {
        // Парсим бонусы из статуса (второй столбец)
        const statusText = cells[1].textContent.trim();
        const bonuses = this.parseBonusesFromStatus(statusText);
        
        // Парсим репутацию (третий столбец)
        const respectText = cells[2].textContent.trim();
        const reputation = this.parseReputation(respectText);
        
        // Парсим количество сообщений (четвертый столбец)
        const posts = parseInt(cells[3].textContent) || 0;
        
        // Дата регистрации (пятый столбец)
        const registered = cells[4].textContent.trim();
        
        // Последний визит (шестой столбец)
        const lastOnline = cells[5].textContent.trim();

        return {
            id: this.generateId(username),
            name: username,
            forum_data: {
                status: statusText,
                respect: respectText,
                positive_reputation: reputation.positive,
                negative_reputation: reputation.negative,
                net_reputation: reputation.net,
                posts: posts,
                registered: registered,
                last_online: lastOnline,
                days_since_registration: this.calculateDaysSinceRegistration(registered)
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
        console.log(`🔍 Парсим бонусы из статуса: "${status}"`);
        
        const creditsMatch = status.match(/💰([+-]?\d+)/);
        const infectionMatch = status.match(/⚡([+-]?\d+)%/);
        const whisperMatch = status.match(/👁([+-]?\d+)%/);

        const bonuses = {
            credits: creditsMatch ? parseInt(creditsMatch[1]) : 0,
            infection: infectionMatch ? parseInt(infectionMatch[1]) : 0,
            whisper: whisperMatch ? parseInt(whisperMatch[1]) : 0
        };

        console.log(`✅ Распарсенные бонусы:`, bonuses);
        return bonuses;
    }

    parseReputation(respectText) {
        console.log(`🔍 Парсим репутацию: "${respectText}"`);
        
        let positive = 0;
        
        // Убираем все пробелы и лишние символы
        const cleanText = respectText.trim();
        
        // Разные форматы, которые могут быть:
        // "+5", "5", "10", "+10" и т.д.
        
        if (cleanText.startsWith('+')) {
            // Формат: "+5" - берем все после плюса
            positive = parseInt(cleanText.substring(1)) || 0;
        } else {
            // Формат: "5" или "10" - парсим напрямую
            positive = parseInt(cleanText) || 0;
        }
        
        // Убеждаемся, что репутация не отрицательная
        positive = Math.max(0, positive);
        
        const reputation = {
            positive_reputation: positive,
            negative_reputation: 0,
            net_reputation: positive
        };
        
        console.log(`✅ Распарсенная репутация:`, reputation);
        return reputation;
    }

    calculateDaysSinceRegistration(registeredDate) {
        if (!registeredDate || registeredDate === 'Неизвестно') return 0;
        
        try {
            const regDate = new Date(registeredDate);
            const today = new Date();
            return Math.floor((today - regDate) / (1000 * 60 * 60 * 24));
        } catch (error) {
            console.error('❌ Ошибка расчета даты для:', registeredDate);
            return 0;
        }
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
        
        // Выводим итоговый список
        console.log('📋 Итоговый список пользователей:');
        Object.keys(players).forEach(username => {
            const player = players[username];
            console.log(`   - ${username}: 💰${player.game_stats.credits} ⚡${player.game_stats.infection.total}% 👁${player.game_stats.whisper.total}%`);
        });
    } else {
        console.log('❌ Не удалось получить данные игроков');
        // Создаем тестовые данные для проверки
        const dataPath = path.join(__dirname, '../data/players.json');
        const testData = {
            players: {
                "TestUser": {
                    id: "testuser",
                    name: "TestUser",
                    forum_data: {
                        status: "💰+100 ⚡+50% 👁+25%",
                        respect: "+5 -2",
                        positive_reputation: 5,
                        negative_reputation: 2,
                        net_reputation: 3,
                        posts: 10,
                        registered: "2025-01-01",
                        last_online: "Сегодня",
                        days_since_registration: 19
                    },
                    bonuses: { credits: 100, infection: 50, whisper: 25 },
                    game_stats: {
                        credits: 1100,
                        infection: { base: 0, bonus: 50, total: 50 },
                        whisper: { base: 0, bonus: 25, total: 25 }
                    },
                    last_updated: new Date().toISOString()
                }
            },
            last_updated: new Date().toISOString(),
            version: "1.0.0"
        };
        fs.writeFileSync(dataPath, JSON.stringify(testData, null, 2));
        console.log('📁 Создан тестовый файл players.json');
    }
}

// Запускаем скрипт
main().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});
// Добавляем в scripts/updater.js
const UserPostsParser = require('./user-posts-parser');

class EnhancedUpdater {
    constructor() {
        this.userPostsParser = new UserPostsParser();
    }

    async updateAllPlayersWithPosts(players) {
        console.log('📊 Начинаем анализ постов всех игроков...');
        
        const updatedPlayers = { ...players };
        let processed = 0;

        for (const [username, playerData] of Object.entries(players)) {
            try {
                console.log(`\n🔍 Анализируем посты игрока: ${username}`);
                
                // Получаем user_id из данных игрока (должен быть добавлен при парсинге)
                const userId = playerData.forum_data?.user_id;
                
                if (userId) {
                    const postStats = await this.userPostsParser.parseAllUserPosts(userId, username);
                    
                    // Обновляем данные игрока
                    updatedPlayers[username].forum_data.post_stats = postStats;
                    
                    // Генерируем бонусы на основе активности
                    this.updatePlayerBonuses(updatedPlayers[username], postStats);
                    
                    console.log(`✅ Обновлена статистика для ${username}`);
                } else {
                    console.log(`⚠️ Нет user_id для ${username}, пропускаем`);
                }
                
                processed++;
                
                // Задержка между обработкой игроков
                if (processed < Object.keys(players).length) {
                    await this.delay(1000); // 1 секунда между игроками
                }
                
            } catch (error) {
                console.error(`❌ Ошибка обновления ${username}:`, error);
            }
        }

        console.log(`\n🎉 Анализ постов завершен! Обработано игроков: ${processed}`);
        return updatedPlayers;
    }

    updatePlayerBonuses(player, postStats) {
        // Базовые бонусы остаются
        const baseBonuses = player.bonuses || { credits: 0, infection: 0, whisper: 0 };
        
        // Бонусы за активность
        const activityBonuses = this.calculateActivityBonuses(postStats);
        
        // Объединяем бонусы
        player.bonuses = {
            credits: baseBonuses.credits + activityBonuses.credits,
            infection: baseBonuses.infection + activityBonuses.infection,
            whisper: baseBonuses.whisper + activityBonuses.whisper,
            activity: activityBonuses
        };

        // Обновляем игровую статистику
        if (player.game_stats) {
            player.game_stats.credits = 1000 + player.bonuses.credits;
            player.game_stats.infection.total = Math.max(0, Math.min(100, player.bonuses.infection));
            player.game_stats.whisper.total = Math.max(-100, Math.min(100, player.bonuses.whisper));
        }
    }

    calculateActivityBonuses(postStats) {
        const activityScore = postStats.post_activity_score;
        
        return {
            credits: Math.floor(activityScore * 5), // 5 кредитов за каждое очко активности
            infection: Math.min(postStats.game_posts * 0.5, 20), // 0.5% за каждый игровой пост, макс 20%
            whisper: Math.min(Object.keys(postStats.post_distribution).length * 2, 15) // 2% за каждый тип раздела
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Добавляем вызов в основной процесс обновления
async function mainUpdateProcess() {
    const updater = new EnhancedUpdater();
    
    // Получаем текущих игроков
    const currentPlayers = await getCurrentPlayers(); // Ваш существующий метод
    
    // Обновляем статистику постов
    const updatedPlayers = await updater.updateAllPlayersWithPosts(currentPlayers);
    
    // Сохраняем обновленные данные
    await savePlayersData(updatedPlayers); // Ваш существующий метод
}
