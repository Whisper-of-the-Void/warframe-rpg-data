// scripts/updater.js
const https = require('https');
const fs = require('fs');
const path = require('path');

class WarframeUpdater {
    constructor() {
        this.baseUrl = 'https://warframe.f-rpg.me';
        this.playersFile = path.join(__dirname, '../data/players.json');
        this.playersData = { players: {}, last_updated: new Date().toISOString() };
        
        // Конфигурация разделов форума для классификации постов
        this.forumSections = {
            game: [1, 2, 3],      // Игровые разделы
            flood: [4, 5, 6],     // Флудовые разделы  
            technical: [7, 8]     // Технические разделы
        };
        
        this.loadExistingData();
    }

    loadExistingData() {
        try {
            if (fs.existsSync(this.playersFile)) {
                const data = fs.readFileSync(this.playersFile, 'utf8');
                this.playersData = JSON.parse(data);
                console.log('✅ Загружены существующие данные');
            }
        } catch (error) {
            console.log('⚠️ Не удалось загрузить существующие данные, начинаем с чистого листа');
        }
    }

    async fetchPage(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    // Конвертируем из windows-1251 в utf-8
                    const buffer = Buffer.from(data, 'binary');
                    const text = buffer.toString('utf-8');
                    resolve(text);
                });
                
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    parseUserStats(html) {
        const players = {};
        
        // Регулярные выражения для парсинга
        const userBlockRegex = /<tr class="row">[\s\S]*?<\/tr>/g;
        const nameRegex = /<a href="memberlist\.php\?mode=viewprofile&amp;u=(\d+)"[^>]*>([^<]+)<\/a>/;
        const statusRegex = /<td[^>]*>([^<]*(?:💰|⚡|👁)[^<]*)<\/td>/;
        const postsRegex = /<td[^>]*>(\d+)<\/td>/;
        const reputationRegex = /<span[^>]*>(\d+)<\/span>/;
        
        const matches = html.match(userBlockRegex) || [];
        
        matches.forEach((block) => {
            const nameMatch = block.match(nameRegex);
            const statusMatch = block.match(statusRegex);
            const postsMatch = block.match(postsRegex);
            const reputationMatch = block.match(reputationRegex);
            
            if (nameMatch && statusMatch) {
                const userId = parseInt(nameMatch[1]);
                const userName = nameMatch[2].trim();
                const statusText = statusMatch[1];
                const posts = postsMatch ? parseInt(postsMatch[1]) : 0;
                const reputation = reputationMatch ? parseInt(reputationMatch[1]) : 0;
                
                // Парсим бонусы из статуса
                const bonuses = this.parseBonuses(statusText);
                
                players[userName] = {
                    forum_data: {
                        user_id: userId,
                        status: statusText,
                        posts: posts,
                        positive_reputation: reputation,
                        last_online: this.extractLastOnline(block),
                        days_since_registration: this.extractDaysRegistered(block)
                    },
                    game_stats: {
                        credits: bonuses.credits || 0,
                        infection: { total: bonuses.infection || 0 },
                        whisper: { total: bonuses.whisper || 0 }
                    },
                    bonuses: bonuses,
                    last_updated: new Date().toISOString()
                };
            }
        });
        
        return players;
    }

    parseBonuses(statusText) {
        const bonuses = {};
        
        // Парсим кредиты
        const creditsMatch = statusText.match(/💰\s*\+?(\d+)/);
        if (creditsMatch) bonuses.credits = parseInt(creditsMatch[1]);
        
        // Парсим заражение
        const infectionMatch = statusText.match(/⚡\s*\+?(\d+)%/);
        if (infectionMatch) bonuses.infection = parseInt(infectionMatch[1]);
        
        // Парсим шёпот
        const whisperMatch = statusText.match(/👁\s*\+?(\d+)%/);
        if (whisperMatch) bonuses.whisper = parseInt(whisperMatch[1]);
        
        return bonuses;
    }

    extractLastOnline(html) {
        const lastOnlineRegex = /Был:\s*<span[^>]*>([^<]+)<\/span>/;
        const match = html.match(lastOnlineRegex);
        return match ? match[1].trim() : 'Неизвестно';
    }

    extractDaysRegistered(html) {
        const daysRegex = /На форуме:\s*<span[^>]*>(\d+)/;
        const match = html.match(daysRegex);
        return match ? parseInt(match[1]) : 'Неизвестно';
    }

    async analyzeUserPosts(userId, userName) {
        try {
            console.log(`📊 Анализ постов пользователя: ${userName} (ID: ${userId})`);
            
            let allPosts = [];
            let currentPage = 0;
            let hasMorePages = true;
            
            // Собираем посты со всех страниц
            while (hasMorePages && currentPage < 10) { // ограничение на 10 страниц для безопасности
                const start = currentPage * 20;
                const url = `${this.baseUrl}/search.php?action=show_user_posts&user_id=${userId}&start=${start}`;
                console.log(`📄 Загрузка страницы ${currentPage + 1}: ${url}`);
                
                const html = await this.fetchPage(url);
                const posts = this.parsePostsFromPage(html, userId);
                
                if (posts.length === 0) {
                    hasMorePages = false;
                } else {
                    allPosts = allPosts.concat(posts);
                    currentPage++;
                    
                    // Задержка между страницами чтобы не перегружать сервер
                    await this.delay(1000);
                }
            }
            
            // Анализируем собранные посты
            return this.analyzePostStats(allPosts);
            
        } catch (error) {
            console.error(`❌ Ошибка анализа постов для ${userName}:`, error);
            return null;
        }
    }

    parsePostsFromPage(html, userId) {
        const posts = [];
        
        // Регулярное выражение для поиска постов
        const postRegex = /<div class="post"[^>]*data-user-id="(\d+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
        
        let match;
        while ((match = postRegex.exec(html)) !== null) {
            const postUserId = parseInt(match[1]);
            
            // Проверяем что пост принадлежит нужному пользователю
            if (postUserId === userId) {
                const postContent = match[0];
                const forumId = this.extractForumId(postContent);
                
                posts.push({
                    forum_id: forumId,
                    content: postContent,
                    section_type: this.classifyPost(forumId)
                });
            }
        }
        
        return posts;
    }

    extractForumId(postHtml) {
        // Ищем ссылку на форум в заголовке поста
        const forumLinkRegex = /viewforum\.php\?id=(\d+)/;
        const match = postHtml.match(forumLinkRegex);
        return match ? parseInt(match[1]) : null;
    }

    classifyPost(forumId) {
        if (this.forumSections.game.includes(forumId)) return 'game';
        if (this.forumSections.flood.includes(forumId)) return 'flood'; 
        if (this.forumSections.technical.includes(forumId)) return 'technical';
        return 'unknown';
    }

    analyzePostStats(posts) {
        const stats = {
            total_posts: posts.length,
            game_posts: 0,
            flood_posts: 0,
            technical_posts: 0,
            unknown_posts: 0,
            post_activity_score: 0,
            activity_trend: 'stable'
        };
        
        // Считаем посты по категориям
        posts.forEach(post => {
            switch (post.section_type) {
                case 'game': stats.game_posts++; break;
                case 'flood': stats.flood_posts++; break;
                case 'technical': stats.technical_posts++; break;
                default: stats.unknown_posts++; break;
            }
        });
        
        // Рассчитываем рейтинг активности (игровые посты имеют больший вес)
        if (stats.total_posts > 0) {
            const gameRatio = stats.game_posts / stats.total_posts;
            const techRatio = stats.technical_posts / stats.total_posts;
            const floodRatio = stats.flood_posts / stats.total_posts;
            
            // Формула: игровые посты x2, технические x1.5, флудовые x0.5
            stats.post_activity_score = Math.round(
                (gameRatio * 2 + techRatio * 1.5 + floodRatio * 0.5) * 100
            );
        }
        
        // Определяем тренд активности (упрощенная логика)
        if (stats.total_posts > 20) stats.activity_trend = 'increasing';
        else if (stats.total_posts > 5) stats.activity_trend = 'stable';
        else stats.activity_trend = 'decreasing';
        
        console.log(`📈 Статистика постов: ${stats.game_posts} игр., ${stats.flood_posts} флуд., ${stats.technical_posts} техн.`);
        
        return stats;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async updateAllUsersPostStats() {
        console.log('🔄 Начинаем анализ постов всех пользователей...');
        
        const users = Object.keys(this.playersData.players);
        let processed = 0;
        
        for (const userName of users) {
            const userData = this.playersData.players[userName];
            
            if (userData.forum_data && userData.forum_data.user_id) {
                // Проверяем, не анализировали ли мы уже посты этого пользователя
                if (!userData.forum_data.post_stats) {
                    const postStats = await this.analyzeUserPosts(
                        userData.forum_data.user_id, 
                        userName
                    );
                    
                    if (postStats) {
                        userData.forum_data.post_stats = postStats;
                        userData.last_updated = new Date().toISOString();
                        processed++;
                    }
                    
                    // Задержка между пользователями
                    await this.delay(2000);
                }
            }
        }
        
        console.log(`✅ Проанализированы посты ${processed} пользователей`);
        return processed;
    }

    async updateData() {
        try {
            console.log('🎮 Запуск обновления данных Warframe RPG...');
            
            // Загружаем основную страницу с пользователями
            const html = await this.fetchPage(`${this.baseUrl}/memberlist.php?mode=team&team_id=1`);
            const newPlayers = this.parseUserStats(html);
            
            // Обновляем данные существующих пользователей и добавляем новых
            Object.keys(newPlayers).forEach(userName => {
                if (this.playersData.players[userName]) {
                    // Обновляем существующие данные
                    this.playersData.players[userName] = {
                        ...this.playersData.players[userName],
                        ...newPlayers[userName],
                        last_updated: new Date().toISOString()
                    };
                } else {
                    // Добавляем нового пользователя
                    this.playersData.players[userName] = newPlayers[userName];
                }
            });
            
            console.log(`✅ Основные данные обновлены: ${Object.keys(this.playersData.players).length} пользователей`);
            
            // Запускаем анализ постов (можно отключить если долго работает)
            console.log('⏳ Переходим к анализу постов...');
            await this.updateAllUsersPostStats();
            
            // Сохраняем обновленные данные
            this.playersData.last_updated = new Date().toISOString();
            this.saveData();
            
            console.log('🎉 Все данные успешно обновлены и сохранены!');
            
        } catch (error) {
            console.error('❌ Критическая ошибка при обновлении:', error);
        }
    }

    saveData() {
        try {
            const dir = path.dirname(this.playersFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.playersFile, JSON.stringify(this.playersData, null, 2), 'utf8');
            console.log('💾 Данные сохранены в:', this.playersFile);
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
        }
    }
}

// Запуск обновления
if (require.main === module) {
    const updater = new WarframeUpdater();
    updater.updateData();
}

module.exports = WarframeUpdater;
