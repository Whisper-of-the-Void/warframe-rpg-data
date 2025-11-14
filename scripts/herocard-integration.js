// scripts/herocard-integration.js
class HeroCardIntegration {
    constructor() {
        this.dataUrl = 'https://whisper-of-the-void.github.io/warframe-rpg-data/data/players.json';
        this.playersData = null;
        this.autoRefreshInterval = null;
    }

    async init() {
        try {
            console.log('🎮 Инициализация HeroCard системы...');
            await this.loadPlayersData();
            this.processHeroCards();
            this.startAutoRefresh();
        } catch (error) {
            console.error('❌ Ошибка инициализации HeroCard:', error);
        }
    }

    async loadPlayersData() {
        try {
            const response = await fetch(this.dataUrl + '?t=' + Date.now());
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            if (data && data.players && typeof data.players === 'object') {
                this.playersData = data.players; // ← ИЗМЕНЕНИЕ ЗДЕСЬ: берем data.players
                console.log('✅ Данные игроков загружены:', Object.keys(this.playersData).length);
                console.log('📊 Доступные игроки:', Object.keys(this.playersData));
            } else {
                throw new Error('Invalid data structure - missing players object');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            if (!this.playersData) this.playersData = {};
        }
    }

    processHeroCards() {
        console.log('🔍 Поиск постов для обработки...');
        
        // Ищем все посты на странице
        const posts = document.querySelectorAll('.post');
        console.log(`📝 Найдено постов: ${posts.length}`);

        let processedCount = 0;
        
        posts.forEach(post => {
            const playerName = this.findPlayerNameForPost(post);
            
            if (playerName) {
                console.log(`👤 Найден автор поста: "${playerName}"`);
                
                // Ищем контейнер для карточки героя
                const heroCardContainer = post.querySelector('.herocard');
                
                if (heroCardContainer) {
                    // ИЗМЕНЕНИЕ: this.playersData уже содержит объект players
                    if (this.playersData[playerName]) {
                        this.fillHeroCard(heroCardContainer, this.playersData[playerName], playerName);
                        processedCount++;
                    } else {
                        console.log(`❌ Данные не найдены для: "${playerName}"`);
                        console.log(`📋 Доступные игроки:`, Object.keys(this.playersData));
                        this.showPlayerNotFound(heroCardContainer, playerName);
                    }
                } else {
                    console.log('❌ Контейнер .herocard не найден в посте');
                }
            }
        });

        console.log(`✅ Обработано карточек: ${processedCount}`);
    }

    findPlayerNameForPost(post) {
        // Способ 1: Ищем в блоке автора
        const authorElement = post.querySelector('.pa-author a');
        if (authorElement) {
            const name = authorElement.textContent.trim();
            if (this.isValidPlayerName(name)) {
                return name;
            }
        }
        
        // Способ 2: Ищем в заголовке поста
        const headerAuthor = post.querySelector('h3 a[href^="javascript:to("]');
        if (headerAuthor) {
            const name = headerAuthor.textContent.trim();
            if (this.isValidPlayerName(name)) {
                return name;
            }
        }
        
        return null;
    }

    isValidPlayerName(name) {
        return name && 
               name.length > 1 && 
               name.length < 50 &&
               !name.includes('@') && 
               !name.includes('Автор') &&
               !name.includes('Имя') &&
               !name.match(/^\d+$/) &&
               name !== 'Зарегистрирован' &&
               name !== 'Последний визит';
    }

    fillHeroCard(container, playerData, playerName) {
        console.log(`🎨 Заполняем карточку для: ${playerName}`, playerData);
        container.innerHTML = this.createHeroCardHTML(playerData, playerName);
    }

    createHeroCardHTML(player, playerName) {
        // Безопасное извлечение данных
        const reputation = player.forum_data?.positive_reputation || 0;
        const posts = player.forum_data?.posts || 0;
        const credits = player.game_stats?.credits || 0;
        const infection = player.game_stats?.infection?.total || 0;
        const whisper = player.game_stats?.whisper?.total || 0;
        const bonuses = player.bonuses || {};
        const onForum = player.forum_data?.days_since_registration || 'Неизвестно';
        const lastSeen = player.forum_data?.last_online || 'Неизвестно';
        const lastUpdated = player.last_updated || new Date().toISOString();

        // Определяем цвета и иконки
        const infectionColor = this.getInfectionColor(infection);
        const whisperColor = this.getWhisperColor(whisper);
        const infectionIcon = this.getInfectionIcon(infection);
        const whisperIcon = this.getWhisperIcon(whisper);

        return `
            <div class="warframe-herocard">
                <div class="herocard-header">
                    <h3 class="herocard-title">🎮 ${playerName}</h3>
                    <div class="herocard-badges">
                        <span class="badge reputation">⭐ ${reputation}</span>
                        <span class="badge posts">📊 ${posts}</span>
                    </div>
                </div>
                
                <div class="herocard-stats">
                    <div class="stat-row">
                        <span class="stat-label">💰 Кредиты:</span>
                        <span class="stat-value credits">${credits.toLocaleString()}</span>
                    </div>
                    
                    <div class="stat-row">
                        <span class="stat-label">⚡ Заражение:</span>
                        <span class="stat-value infection" style="color: ${infectionColor}">
                            ${infection}% ${infectionIcon}
                        </span>
                    </div>
                    
                    <div class="stat-row">
                        <span class="stat-label">👁 Шёпот:</span>
                        <span class="stat-value whisper" style="color: ${whisperColor}">
                            ${whisper}% ${whisperIcon}
                        </span>
                    </div>
                </div>
                
                <div class="herocard-meta">
                    <div class="meta-item">
                        <span class="meta-label">📅 На форуме:</span>
                        <span class="meta-value">${onForum} дн.</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">🕐 Был:</span>
                        <span class="meta-value">${lastSeen}</span>
                    </div>
                </div>
                
                <div class="herocard-bonuses">
                    ${this.renderBonuses(bonuses)}
                </div>
                
                <div class="herocard-footer">
                    <small>Обновлено: ${new Date(lastUpdated).toLocaleTimeString()}</small>
                </div>
            </div>
        `;
    }

    renderBonuses(bonuses) {
        if (!bonuses || (bonuses.credits === 0 && bonuses.infection === 0 && bonuses.whisper === 0)) {
            return '<div class="bonus-item"><small>Нет активных бонусов</small></div>';
        }
        
        const bonusEntries = [];
        if (bonuses.credits) {
            bonusEntries.push(`<div class="bonus-item"><small>Бонус кредитов: ${bonuses.credits > 0 ? '+' : ''}${bonuses.credits}</small></div>`);
        }
        if (bonuses.infection) {
            bonusEntries.push(`<div class="bonus-item"><small>Бонус заражения: ${bonuses.infection > 0 ? '+' : ''}${bonuses.infection}%</small></div>`);
        }
        if (bonuses.whisper) {
            bonusEntries.push(`<div class="bonus-item"><small>Бонус шёпота: ${bonuses.whisper > 0 ? '+' : ''}${bonuses.whisper}%</small></div>`);
        }
        
        return bonusEntries.join('');
    }

    showPlayerNotFound(container, playerName) {
        container.innerHTML = `
            <div class="warframe-herocard">
                <div class="herocard-header">
                    <h3 class="herocard-title">🎮 ${playerName}</h3>
                    <div class="herocard-badges">
                        <span class="badge reputation">❌ Не в игре</span>
                    </div>
                </div>
                <div class="herocard-stats">
                    <div class="stat-row">
                        <span class="stat-label">Статус:</span>
                        <span class="stat-value">Данные не найдены</span>
                    </div>
                </div>
                <div class="herocard-footer">
                    <small>Проверьте наличие игрока в системе RPG</small>
                </div>
            </div>
        `;
    }

    getInfectionColor(level) {
        if (level < 25) return '#4CAF50';
        if (level < 50) return '#FF9800';
        if (level < 75) return '#F44336';
        return '#9C27B0';
    }

    getWhisperColor(level) {
        if (level < 0) return '#2196F3';
        if (level < 25) return '#4CAF50';
        if (level < 50) return '#FF9800';
        return '#F44336';
    }

    getInfectionIcon(level) {
        if (level >= 75) return '🔴';
        if (level >= 50) return '🟠';
        if (level >= 25) return '🟡';
        return '🟢';
    }

    getWhisperIcon(level) {
        if (level < 0) return '🔵';
        if (level >= 50) return '🔴';
        if (level >= 25) return '🟠';
        return '🟢';
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        this.autoRefreshInterval = setInterval(() => {
            console.log('🔄 Автообновление карточек героев...');
            this.loadPlayersData()
                .then(() => {
                    this.processHeroCards();
                    console.log('✅ Карточки героев обновлены');
                })
                .catch(error => {
                    console.error('❌ Ошибка автообновления:', error);
                    this.processHeroCards();
                });
        }, 5 * 60 * 1000);

        console.log('✅ Автообновление карточек запущено (каждые 5 минут)');
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('⏹️ Автообновление остановлено');
        }
    }

    async forceRefresh() {
        console.log('🔄 Принудительное обновление карточек...');
        try {
            await this.loadPlayersData();
            this.processHeroCards();
            console.log('✅ Карточки принудительно обновлены');
        } catch (error) {
            console.error('❌ Ошибка принудительного обновления:', error);
        }
    }
}

// Стили для карточки
const heroCardStyles = `
    <style>
        .warframe-herocard {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            border-left: 6px solid #ff6b00;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            font-family: 'Arial', sans-serif;
            margin: 10px 0;
            position: relative;
        }
        
        .herocard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #444;
            padding-bottom: 10px;
        }
        
        .herocard-title {
            margin: 0;
            color: #ff6b00;
            font-size: 1.3em;
        }
        
        .herocard-badges {
            display: flex;
            gap: 8px;
        }
        
        .badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: bold;
        }
        
        .badge.reputation {
            background: #ffd700;
            color: #000;
        }
        
        .badge.posts {
            background: #2196F3;
            color: white;
        }
        
        .herocard-stats {
            margin-bottom: 15px;
        }
        
        .stat-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 8px 0;
            padding: 5px 0;
        }
        
        .stat-label {
            font-weight: bold;
            color: #ccc;
        }
        
        .stat-value {
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .stat-value.credits {
            color: gold;
        }
        
        .herocard-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 15px;
            padding-top: 10px;
            border-top: 1px solid #444;
        }
        
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        
        .meta-label {
            font-size: 0.8em;
            color: #888;
        }
        
        .meta-value {
            font-size: 0.9em;
            font-weight: bold;
        }
        
        .herocard-bonuses {
            background: rgba(255,107,0,0.1);
            padding: 10px;
            border-radius: 6px;
            border-left: 3px solid #ff6b00;
            margin-bottom: 10px;
        }
        
        .bonus-item {
            margin: 2px 0;
            font-size: 0.8em;
            color: #ccc;
        }
        
        .herocard-footer {
            text-align: center;
            padding-top: 10px;
            border-top: 1px solid #444;
            font-size: 0.7em;
            color: #666;
        }
        
        /* Анимация появления */
        .warframe-herocard {
            animation: cardAppear 0.5s ease-out;
        }
        
        @keyframes cardAppear {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
`;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем стили в head
    if (!document.querySelector('style[data-herocard]')) {
        document.head.insertAdjacentHTML('beforeend', heroCardStyles);
    }
    
    // Инициализируем интеграцию
    const heroCardSystem = new HeroCardIntegration();
    heroCardSystem.init();
    
    // Делаем систему доступной глобально для отладки
    window.heroCardSystem = heroCardSystem;
    
    console.log('🎮 Система HeroCard инициализирована');
});

// Обновляем при изменении страницы (для AJAX-навигации)
if (typeof window !== 'undefined') {
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            if (window.heroCardSystem) {
                setTimeout(() => window.heroCardSystem.forceRefresh(), 1000);
            }
        }
    }).observe(document, { subtree: true, childList: true });
}
