// scripts/updater.js
import { JSDOM } from 'jsdom';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Импортируем конфигурацию разделов
import { GAME_SECTIONS, FLOOD_SECTIONS } from '../config/forum_sections.js';

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
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
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
        // Извлекаем user_id из ссылки на профиль
        const profileLink = cells[0].querySelector('a[href*="profile.php?id="]');
        const userId = profileLink ? this.extractUserId(profileLink.href) : null;

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
                user_id: userId, // ← ДОБАВЛЕН user_id
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

    extractUserId(url) {
        const match = url.match(/profile\.php\?id=(\d+)/);
        return match ? parseInt(match[1]) : null;
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
            positive: positive,
            negative: 0,
            net: positive
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

// Класс для анализа постов (должен быть в отдельном файле, но для простоты оставим здесь)
class UserPostsParser {
    constructor() {
        this.baseUrl = 'https://warframe.f-rpg.me';
    }

    async parseAllUserPosts(userId, username) {
        try {
            console.log(`🔍 Начинаем анализ постов пользователя: ${username} (ID: ${userId})`);
            
            // Временная заглушка - возвращаем тестовые данные
            // В реальной реализации здесь будет парсинг всех страниц
            return this.getMockPostStats(username);
            
        } catch (error) {
            console.error(`❌ Ошибка анализа постов для ${username}:`, error);
            return this.getDefaultPostStats();
        }
    }

    getMockPostStats(username) {
        // Временные тестовые данные
        const mockData = {
            'Void': { total_posts: 43, game_posts: 28, flood_posts: 10, technical_posts: 5, post_activity_score: 156.8 },
            'Negan': { total_posts: 3, game_posts: 1, flood_posts: 2, technical_posts: 0, post_activity_score: 24.5 },
            'PR-Cephalon': { total_posts: 1, game_posts: 0, flood_posts: 0, technical_posts: 1, post_activity_score: 5.2 }
        };

        const stats = mockData[username] || this.getDefaultPostStats();
        
        return {
            ...stats,
            post_distribution: {
                roleplay: stats.game_posts,
                offtopic: Math.floor(stats.flood_posts / 2),
                technical: stats.technical_posts
            },
            sections_activity: {
                1: { posts_count: stats.game_posts, section_name: 'Точка Сингулярности', section_type: 'roleplay' }
            },
            last_activity: new Date().toISOString(),
            activity_trend: 'stable',
            analyzed_at: new Date().toISOString()
        };
    }

    getDefaultPostStats() {
        return {
            total_posts: 0,
            game_posts: 0,
            flood_posts: 0,
            technical_posts: 0,
            post_activity_score: 0,
            post_distribution: {},
            sections_activity: {},
            last_activity: new Date().toISOString(),
            activity_trend: 'stable',
            analyzed_at: new Date().toISOString()
        };
    }
}

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
                
                // Получаем user_id из данных игрока
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
                    await this.delay(500); // 0.5 секунды между игроками
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

// Основная функция
async function main() {
    console.log('🚀 Запуск обновления данных...');
    
    const parser = new ForumParser();
    const players = await parser.parseMembersList();
    
    if (players && Object.keys(players).length > 0) {
        const dataPath = path.join(__dirname, '../data/players.json');
        
        // Обновляем статистику постов (опционально, можно включать/выключать)
        const updatePosts = process.argv.includes('--with-posts');
        
        let finalPlayers = players;
        
        if (updatePosts) {
            console.log('\n🔄 Обновление статистики постов...');
            const postsUpdater = new EnhancedUpdater();
            finalPlayers = await postsUpdater.updateAllPlayersWithPosts(players);
        } else {
            console.log('\n⏭️  Пропуск обновления статистики постов (используйте --with-posts для включения)');
        }
        
        // Сохраняем данные
        const dataToSave = {
            players: finalPlayers,
            last_updated: new Date().toISOString(),
            version: "1.0.0",
            stats: {
                total_players: Object.keys(finalPlayers).length,
                parsed_at: new Date().toISOString(),
                posts_analyzed: updatePosts
            }
        };
        
        fs.writeFileSync(dataPath, JSON.stringify(dataToSave, null, 2));
        console.log('✅ Данные успешно сохранены в players.json');
        
        // Выводим итоговый список
        console.log('\n📋 Итоговый список пользователей:');
        Object.keys(finalPlayers).forEach(username => {
            const player = finalPlayers[username];
            const postsInfo = updatePosts && player.forum_data.post_stats ? 
                ` | 🎮${player.forum_data.post_stats.game_posts} 💬${player.forum_data.post_stats.flood_posts} 🔧${player.forum_data.post_stats.technical_posts}` : '';
            console.log(`   - ${username}: 💰${player.game_stats.credits} ⚡${player.game_stats.infection.total}% 👁${player.game_stats.whisper.total}%${postsInfo}`);
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
                        user_id: 999,
                        status: "💰+100 ⚡+50% 👁+25%",
                        respect: "+5",
                        positive_reputation: 5,
                        negative_reputation: 0,
                        net_reputation: 5,
                        posts: 10,
                        registered: "2025-01-01",
                        last_online: "Сегодня",
                        days_since_registration: 19,
                        post_stats: {
                            total_posts: 10,
                            game_posts: 5,
                            flood_posts: 3,
                            technical_posts: 2,
                            post_activity_score: 45.5,
                            post_distribution: { roleplay: 5, offtopic: 2, technical: 2 },
                            last_activity: new Date().toISOString(),
                            activity_trend: "stable"
                        }
                    },
                    bonuses: { credits: 100, infection: 50, whisper: 25, activity: { credits: 25, infection: 2.5, whisper: 4 } },
                    game_stats: {
                        credits: 1125,
                        infection: { base: 0, bonus: 52.5, total: 52.5 },
                        whisper: { base: 0, bonus: 29, total: 29 }
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
