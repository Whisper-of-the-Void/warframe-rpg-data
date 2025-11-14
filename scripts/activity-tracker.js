// scripts/activity-tracker.js
const { 
    isGameSection, 
    isFloodSection, 
    getSectionType, 
    getSectionWeight 
} = require('../config/forum_sections');

class ActivityTracker {
    constructor() {
        this.baseUrl = 'https://warframe.f-rpg.me';
    }

    // Основной метод анализа активности пользователя
    async analyzeUserActivity(username, existingData = {}) {
        try {
            console.log(`🔍 Анализируем активность пользователя: ${username}`);
            
            const activityData = {
                total_posts: 0,
                game_posts: 0,
                flood_posts: 0,
                technical_posts: 0,
                post_activity_score: 0,
                post_distribution: {},
                last_activity: new Date().toISOString(),
                activity_trend: 'stable'
            };

            // Получаем посты пользователя с информацией о разделе
            const userPosts = await this.fetchUserPosts(username);
            
            for (const post of userPosts) {
                await this.analyzePost(post, activityData);
            }

            // Рассчитываем технические посты
            activityData.technical_posts = activityData.total_posts - 
                                         activityData.game_posts - 
                                         activityData.flood_posts;

            // Рассчитываем общий счет активности
            activityData.post_activity_score = this.calculateActivityScore(activityData);
            activityData.activity_trend = this.determineActivityTrend(activityData, existingData);

            console.log(`📊 Статистика активности для ${username}:`, {
                total: activityData.total_posts,
                game: activityData.game_posts,
                flood: activityData.flood_posts,
                technical: activityData.technical_posts,
                score: activityData.post_activity_score
            });

            return activityData;

        } catch (error) {
            console.error(`❌ Ошибка анализа активности для ${username}:`, error);
            return this.getDefaultActivityData();
        }
    }

    async fetchUserPosts(username) {
        // В реальной реализации здесь будет парсинг страницы с постами пользователя
        // с извлечением ID раздела для каждого поста
        
        // Имитация данных для демонстрации
        return [
            {
                id: 1,
                section_id: 7,    // Игровой раздел (roleplay)
                section_name: 'Ролевые игры',
                title: 'Персонаж Void',
                content: 'Описание персонажа...',
                timestamp: new Date('2025-11-14T10:00:00Z'),
                wordCount: 150
            },
            {
                id: 2,
                section_id: 9,    // Флудовый раздел (offtopic)
                section_name: 'Оффтоп',
                title: 'Привет всем!',
                content: 'Просто общаюсь...',
                timestamp: new Date('2025-11-13T15:30:00Z'),
                wordCount: 50
            },
            {
                id: 3,
                section_id: 5,    // Технический раздел (не в конфиге)
                section_name: 'Техподдержка',
                title: 'Проблема с форумом',
                content: 'У меня не работает...',
                timestamp: new Date('2025-11-12T09:15:00Z'),
                wordCount: 80
            },
            {
                id: 4,
                section_id: 10,   // Флудовый раздел (evenings)
                section_name: 'Вечеринки',
                title: 'Вечерняя тусовка',
                content: 'Давайте пообщаемся...',
                timestamp: new Date('2025-11-11T20:00:00Z'),
                wordCount: 120
            }
        ];
    }

    analyzePost(post, activityData) {
        activityData.total_posts++;
        
        const sectionId = post.section_id;
        const sectionType = getSectionType(sectionId);
        const sectionWeight = getSectionWeight(sectionId);

        // Определяем тип поста по ID раздела
        if (isGameSection(sectionId)) {
            activityData.game_posts++;
        } else if (isFloodSection(sectionId)) {
            activityData.flood_posts++;
        }
        // Технические посты считаем в конце

        // Обновляем распределение по типам
        if (!activityData.post_distribution[sectionType]) {
            activityData.post_distribution[sectionType] = 0;
        }
        activityData.post_distribution[sectionType]++;

        // Добавляем к общему счету с учетом веса раздела
        const postScore = this.calculatePostScore(post, sectionWeight);
        activityData.post_activity_score += postScore;

        // Обновляем последнюю активность
        const postDate = new Date(post.timestamp);
        const currentLastActivity = new Date(activityData.last_activity);
        if (postDate > currentLastActivity) {
            activityData.last_activity = post.timestamp;
        }
    }

    calculatePostScore(post, sectionWeight) {
        const baseScore = sectionWeight;
        const lengthBonus = Math.min(post.wordCount / 100, 2); // Бонус за длину до 2x
        const recencyBonus = this.calculateRecencyBonus(post.timestamp);
        
        return baseScore * lengthBonus * recencyBonus;
    }

    calculateRecencyBonus(timestamp) {
        const postDate = new Date(timestamp);
        const now = new Date();
        const daysAgo = (now - postDate) / (1000 * 60 * 60 * 24);
        
        if (daysAgo <= 1) return 1.5;    // Посты за последние 24 часа
        if (daysAgo <= 7) return 1.2;    // Посты за последнюю неделю
        if (daysAgo <= 30) return 1.0;   // Посты за последний месяц
        return 0.5;                      // Старые посты
    }

    calculateActivityScore(activityData) {
        let score = 0;
        
        // Базовый счет за игровые посты (самые ценные)
        score += activityData.game_posts * 3;
        
        // Счет за флудовые посты (менее ценные)
        score += activityData.flood_posts * 1;
        
        // Технические посты дают минимальный счет
        score += activityData.technical_posts * 0.5;
        
        // Бонус за разнообразие активностей
        const uniqueActivityTypes = Object.keys(activityData.post_distribution).length;
        score += uniqueActivityTypes * 2;
        
        // Бонус за соотношение игровых постов
        const gameRatio = activityData.game_posts / Math.max(activityData.total_posts, 1);
        score += gameRatio * 15;
        
        return Math.round(score * 10) / 10;
    }

    determineActivityTrend(currentData, previousData) {
        if (!previousData.post_stats) return 'stable';
        
        const currentScore = currentData.post_activity_score;
        const previousScore = previousData.post_stats.post_activity_score || 0;
        
        if (currentScore > previousScore * 1.1) return 'increasing';
        if (currentScore < previousScore * 0.9) return 'decreasing';
        return 'stable';
    }

    getDefaultActivityData() {
        return {
            total_posts: 0,
            game_posts: 0,
            flood_posts: 0,
            technical_posts: 0,
            post_activity_score: 0,
            post_distribution: {},
            last_activity: new Date().toISOString(),
            activity_trend: 'stable'
        };
    }

    // Генерация игровых бонусов на основе активности
    generateActivityBonuses(activityData) {
        const bonuses = {
            credits: 0,
            infection: 0,
            whisper: 0
        };

        const activityScore = activityData.post_activity_score;
        
        // Бонусы кредитов за общую активность
        bonuses.credits = Math.floor(activityScore * 8);
        
        // Бонусы заражения за игровые посты
        if (activityData.game_posts > 0) {
            bonuses.infection = Math.min(activityData.game_posts * 0.8, 30);
        }
        
        // Бонусы шепота за разнообразие активностей
        const uniqueTypes = Object.keys(activityData.post_distribution).length;
        bonuses.whisper = Math.min(uniqueTypes * 3, 20);
        
        // Дополнительный бонус за высокое соотношение игровых постов
        const gameRatio = activityData.game_posts / Math.max(activityData.total_posts, 1);
        if (gameRatio > 0.5) {
            bonuses.credits += Math.floor(bonuses.credits * 0.2);
            bonuses.infection += 5;
        }
        
        return bonuses;
    }

    // Метод для получения статистики по разделам
    getSectionStatistics(activityData) {
        const stats = {
            game_sections: {},
            flood_sections: {},
            technical_count: activityData.technical_posts
        };

        // Группируем по типам разделов из конфига
        for (const [sectionType, count] of Object.entries(activityData.post_distribution)) {
            if (sectionType === 'roleplay') {
                stats.game_sections[sectionType] = count;
            } else if (['offtopic', 'evenings', 'diaries', 'contest'].includes(sectionType)) {
                stats.flood_sections[sectionType] = count;
            }
        }

        return stats;
    }
}

module.exports = ActivityTracker;
