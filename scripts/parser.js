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
        
        console.log('📄 Загружено HTML:', html.length, 'символов');

        // Используем регулярные выражения для парсинга таблицы
        // Ищем строки таблицы с данными пользователей
        const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
        const rows = html.match(rowRegex) || [];
        
        console.log('📋 Найдено строк в таблице:', rows.length);

        let processedCount = 0;
        
        for (const row of rows) {
            try {
                // Ищем ячейки с данными
                const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                const cells = [];
                let match;
                
                while ((match = cellRegex.exec(row)) !== null) {
                    cells.push(match[1]);
                }
                
                if (cells.length >= 6) { // Ожидаем как минимум 6 ячеек
                    const username = this.extractUsername(cells[0]);
                    
                    if (username && this.isValidPlayerName(username)) {
                        const playerData = this.createPlayerData(username, cells);
                        if (playerData) {
                            players[username] = playerData;
                            processedCount++;
                            console.log(`👤 Обработан пользователь: ${username}`);
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка обработки строки:', error);
                continue;
            }
        }

        console.log(`✅ Успешно обработано пользователей: ${processedCount}`);
        return players;
    }

    extractUsername(cellHtml) {
        // Извлекаем имя пользователя из ссылки
        const linkMatch = cellHtml.match(/<a[^>]*>([^<]+)<\/a>/i);
        if (linkMatch) {
            return linkMatch[1].trim();
        }
        
        // Если нет ссылки, извлекаем чистый текст
        const text = cellHtml.replace(/<[^>]*>/g, '').trim();
        return text || null;
    }

    createPlayerData(username, cells) {
        try {
            // Парсим статус из второй ячейки (индекс 1)
            const statusText = this.cleanHtml(cells[1]);
            const bonuses = this.parseBonusesFromStatus(statusText);
            
            // Парсим репутацию из третьей ячейки (индекс 2)
            const respectText = this.cleanHtml(cells[2]);
            const positiveReputation = this.parsePositiveReputation(respectText);
            
            // Парсим количество сообщений (индекс 3)
            const postsText = this.cleanHtml(cells[3]);
            const posts = parseInt(postsText.replace(/\D/g, '')) || 0;
            
            // Даты регистрации и последнего визита (индексы 4 и 5)
            const registered = this.cleanHtml(cells[4]) || 'Неизвестно';
            const lastOnline = this.cleanHtml(cells[5]) || 'Неизвестно';

            // Рассчитываем заражение и шепот на основе бонусов
            const infectionTotal = Math.max(0, Math.min(100, bonuses.infection));
            const whisperTotal = Math.max(-100, Math.min(100, bonuses.whisper));

            return {
                id: this.generateId(username),
                name: username,
                forum_data: {
                    status: statusText,
                    positive_reputation: positiveReputation,
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
                        total: infectionTotal 
                    },
                    whisper: { 
                        base: 0, 
                        bonus: bonuses.whisper, 
                        total: whisperTotal 
                    }
                },
                activity: {
                    posts_per_day: this.calculatePostsPerDay(posts, registered),
                    activity_level: this.calculateActivityLevel(posts, registered),
                    activity_score: 0
                },
                last_updated: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Ошибка создания данных для ${username}:`, error);
            return null;
        }
    }

    parseBonusesFromStatus(status) {
        if (!status) {
            return { credits: 0, infection: 0, whisper: 0 };
        }

        console.log(`🔍 Парсим статус: "${status}"`);

        // Ищем кредиты: 💰+200 или 💰200
        const creditsMatch = status.match(/💰\s*([+-]?\d+)/);
        // Ищем заражение: ⚡+23% или ⚡23%
        const infectionMatch = status.match(/⚡\s*([+-]?\d+)%/);
        // Ищем шепот: 👁+12% или 👁-12% или 👁12%
        const whisperMatch = status.match(/👁\s*([+-]?\d+)%/);

        const credits = creditsMatch ? parseInt(creditsMatch[1]) : 0;
        const infection = infectionMatch ? parseInt(infectionMatch[1]) : 0;
        const whisper = whisperMatch ? parseInt(whisperMatch[1]) : 0;

        console.log(`📊 Распарсенные бонусы: credits=${credits}, infection=${infection}, whisper=${whisper}`);

        return {
            credits: credits,
            infection: infection,
            whisper: whisper
        };
    }

    parsePositiveReputation(respectText) {
        if (!respectText) return 0;
        
        // Формат может быть: "+10 -2" или "10" или "+10"
        const positiveMatch = respectText.match(/\+(\d+)/);
        if (positiveMatch) {
            return parseInt(positiveMatch[1]);
        }
        
        // Если нет плюса, пробуем извлечь первое число
        const numberMatch = respectText.match(/(\d+)/);
        return numberMatch ? parseInt(numberMatch[1]) : 0;
    }

    cleanHtml(html) {
        if (!html) return '';
        // Удаляем HTML теги и лишние пробелы
        return html.replace(/<[^>]*>/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
    }

    isValidPlayerName(name) {
        return name && 
               name.length > 1 && 
               name.length < 50 &&
               !name.includes('@') && 
               !name.includes('Автор') &&
               !name.includes('Имя') &&
               !name.match(/^\d+$/) && // Не только цифры
               name !== 'Зарегистрирован' &&
               name !== 'Последний визит';
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
            // Пробуем разные форматы дат
            let regDate;
            
            // Формат: DD.MM.YYYY
            const parts = registeredDate.split('.');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2]);
                regDate = new Date(year, month, day);
            } else {
                // Пробуем стандартный парсинг
                regDate = new Date(registeredDate);
            }
            
            if (isNaN(regDate.getTime())) {
                return 0;
            }
            
            const today = new Date();
            const diffTime = today - regDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            return Math.max(0, diffDays);
        } catch (error) {
            console.error('❌ Ошибка расчета даты для:', registeredDate);
            return 0;
        }
    }

    calculatePostsPerDay(posts, registeredDate) {
        const days = this.calculateDaysSinceRegistration(registeredDate);
        if (days === 0) return posts;
        return parseFloat((posts / days).toFixed(2));
    }

    calculateActivityLevel(posts, registeredDate) {
        const postsPerDay = this.calculatePostsPerDay(posts, registeredDate);
        
        if (postsPerDay >= 5) return "very_high";
        if (postsPerDay >= 2) return "high";
        if (postsPerDay >= 0.5) return "medium";
        if (postsPerDay >= 0.1) return "low";
        return "very_low";
    }

    // Дополнительный метод для отладки парсинга статуса
    debugStatusParsing(status) {
        console.log('=== ДЕБАГ ПАРСИНГА СТАТУСА ===');
        console.log('Исходный статус:', status);
        
        const creditsMatch = status.match(/💰\s*([+-]?\d+)/);
        const infectionMatch = status.match(/⚡\s*([+-]?\d+)%/);
        const whisperMatch = status.match(/👁\s*([+-]?\d+)%/);
        
        console.log('Найдены кредиты:', creditsMatch);
        console.log('Найдено заражение:', infectionMatch);
        console.log('Найден шепот:', whisperMatch);
        console.log('============================');
    }
}

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForumParser;
}

// Для использования в браузере
if (typeof window !== 'undefined') {
    window.ForumParser = ForumParser;
}
