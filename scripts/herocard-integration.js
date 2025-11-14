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
            this.startAutoRefresh(); // Автообновление каждые 5 минут
        } catch (error) {
            console.error('❌ Ошибка инициализации HeroCard:', error);
        }
    }

    async loadPlayersData() {
        try {
            const response = await fetch(this.dataUrl + '?t=' + Date.now());
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            // Проверяем структуру данных
            if (data && typeof data === 'object') {
                this.playersData = data;
                console.log('✅ Данные игроков загружены:', Object.keys(this.playersData).length);
            } else {
                throw new Error('Invalid data structure');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            // Сохраняем старые данные при ошибке
            if (!this.playersData) this.playersData = {};
            throw error;
        }
    }

    processHeroCards() {
        const heroCards = document.querySelectorAll('.herocard');
        console.log(`🎯 Найдено карточек героев: ${heroCards.length}`);

        let processedCount = 0;
        heroCards.forEach(card => {
            const playerName = this.findPlayerNameForCard(card);
            
            if (playerName && this.playersData[playerName]) {
                this.fillHeroCard(card, this.playersData[playerName], playerName);
                processedCount++;
            } else {
                this.showError(card, playerName);
            }
        });

        console.log(`✅ Обработано карточек: ${processedCount}/${heroCards.length}`);
    }

    findPlayerNameForCard(card) {
        // Основной способ: ищем в блоке pa-author
        let playerName = this.findAuthorInPost(card);
        
        if (playerName) return playerName;

        // Запасной способ: ищем в URL
        playerName = this.findPlayerInURL();
        
        return playerName;
    }

    findAuthorInPost(card) {
        // Поднимаемся до контейнера поста и ищем блок pa-author
        const postContainer = card.closest('.post');
        
        if (postContainer) {
            // Ищем блок с классом pa-author
            const authorElement = postContainer.querySelector('.pa-author a');
            if (authorElement) {
                const name = authorElement.textContent.trim();
                if (this.isValidPlayerName(name)) {
                    console.log(`👤 Найден автор поста: ${name}`);
                    return name;
                }
            }
            
            // Альтернативный поиск - в заголовке поста
            const headerAuthor = postContainer.querySelector('h3 a[href^="javascript:to("]');
            if (headerAuthor) {
                const name = headerAuthor.textContent.trim();
                if (this.isValidPlayerName(name)) {
                    console.log(`👤 Найден автор в заголовке: ${name}`);
                    return name;
                }
            }
        }
        
        return null;
    }

    findPlayerInURL() {
        // Если URL содержит параметр пользователя
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('user');
        if (userId) {
            // Можно попробовать найти пользователя по ID, но у нас имена
            return null;
        }
        return null;
    }

    isValidPlayerName(name) {
        return name && 
               name.length > 1 && 
               !name.includes(' ') && 
               !name.includes('@') && 
               !name.includes('Автор') &&
               !name.includes('Автор:');
    }

    fillHeroCard(card, playerData, playerName) {
        card.innerHTML = this.createHeroCardHTML(playerData, playerName);
        console.log(`✅ Заполнена карточка для: ${playerName}`);
    }

    createHeroCardHTML(player, playerName) {
        // Безопасное извлечение данных с значениями по умолчанию
        const reputation = player.forum_data?.positive_reputation || 0;
        const posts = player.forum_data?.posts || 0;
        const credits = player.game_stats?.credits || 0;
        const infection = player.game_stats?.infection?.total || 0;
        const whisper = player.game_stats?.whisper?.total || 0;
        const bonuses = player.bonuses || {};
        const onForum = player.forum_data?.days_since_registration || 'Неизвестно';
        const lastSeen = player.forum_data?.last_online || 'Неизвестно';
        const lastUpdated = player.last_updated || new Date().toISOString();

        // Определяем цвета для статусов
        const infectionColor = this.getInfectionColor(infection);
        const whisperColor = this.getWhisperColor(whisper);
        
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
                            ${infection}%
                            ${this.getInfectionIcon(infection)}
                        </span>
                    </div>
                    
                    <div class="stat-row">
                        <span class="stat-label">👁 Шёпот:</span>
                        <span class="stat-value whisper" style="color: ${whisperColor}">
                            ${whisper}%
                            ${this.getWhisperIcon(whisper)}
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
        if (!bonuses || Object.keys(bonuses).length === 0) {
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

    showError(card, playerName) {
        card.innerHTML = `
            <div class="herocard-error">
                <p>⚠️ Не удалось загрузить данные игрока</p>
                ${playerName ? `<small>Игрок: ${playerName}</small>` : ''}
                <small>Проверьте наличие игрока в системе RPG</small>
                <small><a href="${this.dataUrl}" target="_blank">Посмотреть все данные</a></small>
            </div>
        `;
    }

    // 🔄 МЕТОД АВТООБНОВЛЕНИЯ
    startAutoRefresh() {
        // Очищаем существующий интервал (если есть)
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        // Устанавливаем автообновление каждые 5 минут
        this.autoRefreshInterval = setInterval(() => {
            console.log('🔄 Автообновление карточек героев...');
            this.loadPlayersData()
                .then(() => {
                    this.processHeroCards();
                    console.log('✅ Карточки героев обновлены');
                })
                .catch(error => {
                    console.error('❌ Ошибка автообновления:', error);
                    // Продолжаем работу со старыми данными
                    this.processHeroCards();
                });
        }, 5 * 60 * 1000); // 5 минут

        console.log('✅ Автообновление карточек запущено (каждые 5 минут)');
    }

    // Метод для ручной остановки автообновления (опционально)
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('⏹️ Автообновление остановлено');
        }
    }

    // Метод для принудительного обновления (опционально)
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
        
        .herocard-error {
            text-align: center;
            padding: 20px;
            color: #f44336;
            background: rgba(244,67,54,0.1);
            border-radius: 8px;
            border: 1px solid #f44336;
        }
        
        .herocard-error a {
            color: #2196F3;
            text-decoration: underline;
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
        
        /* Индикатор обновления */
        .warframe-herocard.updating::before {
            content: '🔄';
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 0.8em;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    </style>
`;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем стили в head
    document.head.insertAdjacentHTML('beforeend', heroCardStyles);
    
    // Инициализируем интеграцию
    const heroCardSystem = new HeroCardIntegration();
    heroCardSystem.init();
    
    // Делаем систему доступной глобально для отладки (опционально)
    window.heroCardSystem = heroCardSystem;
    
    console.log('🎮 Система HeroCard инициализирована');
});

// Обработчик видимости страницы (обновляем при возвращении на вкладку)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && window.heroCardSystem) {
        console.log('🔍 Страница стала видимой, проверяем обновления...');
        window.heroCardSystem.forceRefresh();
    }
});
