// scripts/user-posts-parser.js
const { isGameSection, isFloodSection, getSectionType } = require('../config/forum_sections');

class UserPostsParser {
    constructor() {
        this.baseUrl = 'https://warframe.f-rpg.me';
    }

    // Основной метод для анализа всех постов пользователя
    async parseAllUserPosts(userId, username) {
        try {
            console.log(`🔍 Начинаем анализ постов пользователя: ${username} (ID: ${userId})`);
            
            const allPosts = [];
            let currentPage = 1;
            let hasMorePages = true;
            let totalPages = 1;

            while (hasMorePages) {
                console.log(`📄 Анализ страницы ${currentPage} для ${username}...`);
                
                const pageData = await this.parseUserPostsPage(userId, currentPage);
                
                if (pageData.posts.length > 0) {
                    allPosts.push(...pageData.posts);
                    console.log(`✅ Страница ${currentPage}: ${pageData.posts.length} постов`);
                }

                // Определяем общее количество страниц из первой страницы
                if (currentPage === 1 && pageData.totalPages) {
                    totalPages = pageData.totalPages;
                    console.log(`📊 Всего страниц для ${username}: ${totalPages}`);
                }

                // Проверяем, есть ли следующая страница
                hasMorePages = pageData.hasNextPage && currentPage < totalPages;
                currentPage++;

                // Небольшая задержка между запросами чтобы не нагружать сервер
                if (hasMorePages) {
                    await this.delay(500);
                }
            }

            console.log(`✅ Всего собрано постов для ${username}: ${allPosts.length}`);
            
            // Анализируем собранные посты
            return this.analyzePosts(allPosts);

        } catch (error) {
            console.error(`❌ Ошибка анализа постов для ${username}:`, error);
            return this.getDefaultStats();
        }
    }

    // Парсинг одной страницы с постами пользователя
    async parseUserPostsPage(userId, page = 1) {
        try {
            const url = `${this.baseUrl}/search.php?action=show_user_posts&user_id=${userId}&page=${page}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            return this.parsePostsFromHTML(html, page);

        } catch (error) {
            console.error(`❌ Ошибка загрузки страницы ${page} для пользователя ${userId}:`, error);
            return { posts: [], hasNextPage: false, totalPages: 1 };
        }
    }

    // Парсинг HTML страницы с постами
    parsePostsFromHTML(html, currentPage) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const posts = [];
        const postElements = doc.querySelectorAll('.post.altstyle');

        // Парсим каждый пост
        postElements.forEach(postElement => {
            const postData = this.parsePostElement(postElement);
            if (postData) {
                posts.push(postData);
            }
        });

        // Проверяем наличие следующей страницы
        const hasNextPage = this.checkNextPage(doc, currentPage);
        const totalPages = this.getTotalPages(doc);

        return {
            posts,
            hasNextPage,
            totalPages: totalPages || 1,
            currentPage
        };
    }

    // Парсим отдельный пост
    parsePostElement(postElement) {
        try {
            // Извлекаем ссылку на форум из заголовка
            const forumLink = postElement.querySelector('h3 a[href*="viewforum.php?id="]');
            if (!forumLink) return null;

            // Извлекаем ID форума из ссылки
            const forumId = this.extractForumId(forumLink.href);
            if (!forumId) return null;

            // Извлекаем дату поста
            const dateElement = postElement.querySelector('h3 a[href*="viewtopic.php"]');
            const dateText = dateElement ? dateElement.textContent.trim() : 'Неизвестно';

            return {
                forumId: parseInt(forumId),
                forumName: forumLink.textContent.trim(),
                date: dateText,
                timestamp: this.parseDate(dateText),
                url: forumLink.href
            };

        } catch (error) {
            console.error('❌ Ошибка парсинга поста:', error);
            return null;
        }
    }

    // Извлекаем ID форума из URL
    extractForumId(url) {
        const match = url.match(/viewforum\.php\?id=(\d+)/);
        return match ? match[1] : null;
    }

    // Парсим дату из текста
    parseDate(dateText) {
        // Обрабатываем разные форматы дат
        const now = new Date();
        
        if (dateText.includes('Сегодня')) {
            return now.toISOString();
        } else if (dateText.includes('Вчера')) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday.toISOString();
        } else {
            // Пытаемся распарсить обычную дату
            try {
                const date = new Date(dateText);
                return isNaN(date.getTime()) ? now.toISOString() : date.toISOString();
            } catch {
                return now.toISOString();
            }
        }
    }

    // Проверяем наличие следующей страницы
    checkNextPage(doc, currentPage) {
        // Ищем ссылку на следующую страницу
        const nextLink = doc.querySelector('a[href*="page=' + (currentPage + 1) + '"]');
        const paginationText = doc.querySelector('.pagination, .pages');
        
        if (nextLink) return true;
        if (paginationText && paginationText.textContent.includes((currentPage + 1).toString())) {
            return true;
        }
        
        return false;
    }

    // Получаем общее количество страниц
    getTotalPages(doc) {
        const pagination = doc.querySelector('.pagination, .pages');
        if (pagination) {
            const text = pagination.textContent;
            const match = text.match(/из\s*(\d+)/) || text.match(/(\d+)\s*страниц/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        return null;
    }

    // Анализируем все собранные посты
    analyzePosts(posts) {
        const stats = {
            total_posts: posts.length,
            game_posts: 0,
            flood_posts: 0,
            technical_posts: 0,
            post_activity_score: 0,
            post_distribution: {},
            sections_activity: {},
            last_activity: this.getLastActivity(posts),
            activity_trend: 'stable',
            analyzed_at: new Date().toISOString()
        };

        // Анализируем каждый пост
        posts.forEach(post => {
            const forumId = post.forumId;
            
            // Классифицируем пост
            if (isGameSection(forumId)) {
                stats.game_posts++;
            } else if (isFloodSection(forumId)) {
                stats.flood_posts++;
            } else {
                stats.technical_posts++;
            }

            // Распределение по типам разделов
            const sectionType = getSectionType(forumId);
            if (!stats.post_distribution[sectionType]) {
                stats.post_distribution[sectionType] = 0;
            }
            stats.post_distribution[sectionType]++;

            // Активность по разделам
            if (!stats.sections_activity[forumId]) {
                stats.sections_activity[forumId] = {
                    posts_count: 0,
                    section_name: post.forumName,
                    section_type: sectionType
                };
            }
            stats.sections_activity[forumId].posts_count++;
        });

        // Рассчитываем общий счет активности
        stats.post_activity_score = this.calculateActivityScore(stats);

        return stats;
    }

    // Получаем дату последней активности
    getLastActivity(posts) {
        if (posts.length === 0) return new Date().toISOString();
        
        // Сортируем посты по дате (новые сначала)
        const sortedPosts = [...posts].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        return sortedPosts[0].timestamp;
    }

    // Рассчитываем счет активности
    calculateActivityScore(stats) {
        let score = 0;
        
        // Базовый счет за игровые посты (самые ценные)
        score += stats.game_posts * 3;
        
        // Счет за флудовые посты (менее ценные)
        score += stats.flood_posts * 1;
        
        // Технические посты дают минимальный счет
        score += stats.technical_posts * 0.5;
        
        // Бонус за разнообразие активностей
        const uniqueActivityTypes = Object.keys(stats.post_distribution).length;
        score += uniqueActivityTypes * 2;
        
        // Бонус за соотношение игровых постов
        const gameRatio = stats.game_posts / Math.max(stats.total_posts, 1);
        score += gameRatio * 15;
        
        return Math.round(score * 10) / 10;
    }

    // Задержка между запросами
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Статистика по умолчанию
    getDefaultStats() {
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

module.exports = UserPostsParser;
