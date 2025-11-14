// scripts/herocard-integration.js
class HeroCardIntegration {
    constructor() {
        this.dataUrl = 'https://whisper-of-the-void.github.io/warframe-rpg-data/data/players.json';
        this.playersData = null;
        this.autoRefreshInterval = null;
        this.cacheTime = 2 * 60 * 1000; // 2 минуты кэш вместо 5
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
            console.log('📦 Полные данные:', data);
            
            if (data && data.players && typeof data.players === 'object') {
                this.playersData = data.players;
                console.log('✅ Данные игроков загружены:', Object.keys(this.playersData).length);
                console.log('📊 Доступные игроки:', Object.keys(this.playersData));
                
                if (this.playersData['Void']) {
                    console.log('🔍 Данные Void:', this.playersData['Void']);
                }
            } else {
                throw new Error('Invalid data structure - missing players object');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            if (!this.playersData) this.playersData = {};
        }
    }

    processHeroCards() {
        console.log('🔍 Быстрый поиск карточек...');
        
        // Используем более быстрый селектор
        const heroCards = document.querySelectorAll('.herocard');
        console.log(`🎯 Найдено карточек: ${heroCards.length}`);

        if (heroCards.length === 0) {
            console.log('⚠️ Карточки не найдены, возможно страница еще не готова');
            // Попробуем найти через 1 секунду
            setTimeout(() => this.processHeroCards(), 1000);
            return;
        }

        let processedCount = 0;
        
        // Используем классический цикл for для скорости
        for (let i = 0; i < heroCards.length; i++) {
            const card = heroCards[i];
            const playerName = this.findPlayerNameForCard(card);
            
            if (playerName && this.playersData[playerName]) {
                this.fillHeroCard(card, this.playersData[playerName], playerName);
                processedCount++;
            } else if (playerName) {
                this.showPlayerNotFound(card, playerName);
                processedCount++;
            }
        }

        console.log(`✅ Быстро обработано: ${processedCount}/${heroCards.length}`);
    }

    findPlayerNameForCard(card) {
        // Самый быстрый способ - идти от карточки к автору
        const post = card.closest('.post');
        if (!post) return null;

        // Прямой поиск автора в посте - самый быстрый путь
        const authorElement = post.querySelector('.pa-author a');
        return authorElement ? authorElement.textContent.trim() : null;
    }

    fillHeroCard(container, playerData, playerName) {
        // Создаем HTML напрямую для скорости
        const reputation = playerData.forum_data?.positive_reputation || 0;
        const posts = playerData.forum_data?.posts || 0;
        const credits = playerData.game_stats?.credits || 0;
        const infection = playerData.game_stats?.infection?.total || 0;
        const whisper = playerData.game_stats?.whisper?.total || 0;
        const bonuses = playerData.bonuses || {};
        const onForum = playerData.forum_data?.days_since_registration || 'Неизвестно';
        const lastSeen = playerData.forum_data?.last_online || 'Неизвестно';
        const lastUpdated = playerData.last_updated || new Date().toISOString();

        // Быстрое создание HTML без шаблонных строк
        const html = [
            '<div class="warframe-herocard">',
            '<div class="herocard-header">',
            '<h3 class="herocard-title">🎮 ' + playerName + '</h3>',
            '<div class="herocard-badges">',
            '<span class="badge reputation">⭐ ' + reputation + '</span>',
            '<span class="badge posts">📊 ' + posts + '</span>',
            '</div></div>',
            '<div class="herocard-stats">',
            '<div class="stat-row"><span class="stat-label">💰 Кредиты:</span><span class="stat-value credits">' + credits.toLocaleString() + '</span></div>',
            '<div class="stat-row"><span class="stat-label">⚡ Заражение:</span><span class="stat-value infection" style="color:' + this.getInfectionColor(infection) + '">' + infection + '% ' + this.getInfectionIcon(infection) + '</span></div>',
            '<div class="stat-row"><span class="stat-label">👁 Шёпот:</span><span class="stat-value whisper" style="color:' + this.getWhisperColor(whisper) + '">' + whisper + '% ' + this.getWhisperIcon(whisper) + '</span></div>',
            '</div>',
            '<div class="herocard-meta">',
            '<div class="meta-item"><span class="meta-label">📅 На форуме:</span><span class="meta-value">' + onForum + ' дн.</span></div>',
            '<div class="meta-item"><span class="meta-label">🕐 Был:</span><span class="meta-value">' + lastSeen + '</span></div>',
            '</div>',
            '<div class="herocard-bonuses">' + this.renderBonuses(bonuses) + '</div>',
            '<div class="herocard-footer"><small>Обновлено: ' + new Date(lastUpdated).toLocaleTimeString() + '</small></div>',
            '</div>'
        ].join('');

        container.innerHTML = html;
    }

    renderBonuses(bonuses) {
        if (!bonuses || (bonuses.credits === 0 && bonuses.infection === 0 && bonuses.whisper === 0)) {
            return '<div class="bonus-item"><small>Нет активных бонусов</small></div>';
        }
        
        const bonusEntries = [];
        if (bonuses.credits) {
            bonusEntries.push('<div class="bonus-item"><small>Бонус кредитов: ' + (bonuses.credits > 0 ? '+' : '') + bonuses.credits + '</small></div>');
        }
        if (bonuses.infection) {
            bonusEntries.push('<div class="bonus-item"><small>Бонус заражения: ' + (bonuses.infection > 0 ? '+' : '') + bonuses.infection + '%</small></div>');
        }
        if (bonuses.whisper) {
            bonusEntries.push('<div class="bonus-item"><small>Бонус шёпота: ' + (bonuses.whisper > 0 ? '+' : '') + bonuses.whisper + '%</small></div>');
        }
        
        return bonusEntries.join('');
    }

    showPlayerNotFound(container, playerName) {
        container.innerHTML = [
            '<div class="warframe-herocard">',
            '<div class="herocard-header">',
            '<h3 class="herocard-title">🎮 ' + playerName + '</h3>',
            '<div class="herocard-badges">',
            '<span class="badge reputation">❌ Не в игре</span>',
            '</div></div>',
            '<div class="herocard-stats">',
            '<div class="stat-row"><span class="stat-label">Статус:</span><span class="stat-value">Данные не найдены</span></div>',
            '</div>',
            '<div class="herocard-footer"><small>Проверьте наличие игрока в системе RPG</small></div>',
            '</div>'
        ].join('');
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

        // Уменьшаем интервал до 2 минут
        this.autoRefreshInterval = setInterval(() => {
            console.log('🔄 Быстрое обновление карточек...');
            this.loadPlayersData()
                .then(() => {
                    this.processHeroCards();
                    console.log('✅ Карточки быстро обновлены');
                })
                .catch(error => {
                    console.error('❌ Ошибка обновления:', error);
                    this.processHeroCards();
                });
        }, this.cacheTime);

        console.log('✅ Быстрое автообновление запущено (каждые 2 минуты)');
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('⏹️ Автообновление остановлено');
        }
    }

    async forceRefresh() {
        console.log('🔄 Принудительное быстрое обновление...');
        try {
            await this.loadPlayersData();
            this.processHeroCards();
            console.log('✅ Карточки быстро обновлены');
        } catch (error) {
            console.error('❌ Ошибка обновления:', error);
        }
    }
}

// Стили для карточки (оставляем без изменений)
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
            animation: cardAppear 0.3s ease-out;
        }
        
        @keyframes cardAppear {
            from {
                opacity: 0;
                transform: translateY(5px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
`;

// Оптимизированная инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Быстро добавляем стили
    if (!document.querySelector('style[data-herocard]')) {
        const styleEl = document.createElement('style');
        styleEl.setAttribute('data-herocard', '');
        styleEl.textContent = heroCardStyles;
        document.head.appendChild(styleEl);
    }
    
    // Быстрая инициализация
    const heroCardSystem = new HeroCardIntegration();
    heroCardSystem.init();
    
    window.heroCardSystem = heroCardSystem;
    
    console.log('🎮 Система HeroCard быстро инициализирована');
});

// Оптимизированный наблюдатель для AJAX-навигации
if (typeof window !== 'undefined') {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            if (window.heroCardSystem) {
                // Быстрое обновление без задержки
                window.heroCardSystem.forceRefresh();
            }
        }
    });
    observer.observe(document, { subtree: true, childList: true });
}
