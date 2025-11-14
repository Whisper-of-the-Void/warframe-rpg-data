class HeroCardIntegration {
    constructor() {
        this.playersData = {};
        this.baseURL = 'https://whisper-of-the-void.github.io/warframe-rpg-data/data/players.json';
    }

    async loadPlayersData() {
        try {
            const response = await fetch(this.baseURL + '?t=' + Date.now());
            if (!response.ok) throw new Error('Network error');
            this.playersData = await response.json();
            console.log('✅ Данные игроков загружены:', Object.keys(this.playersData).length);
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
        }
    }

    processHeroCards() {
        const authors = document.querySelectorAll('.pa-author a');
        
        authors.forEach(authorElement => {
            const authorName = authorElement.textContent.trim();
            const playerData = this.playersData[authorName];
            
            // Находим ближайший пост для вставки карточки
            const post = authorElement.closest('.post');
            if (!post) return;

            // Удаляем старую карточку если есть
            const oldCard = post.querySelector('.warframe-herocard');
            if (oldCard) oldCard.remove();

            // Создаем новую карточку
            const heroCard = this.createHeroCard(authorName, playerData);
            if (heroCard) {
                post.insertBefore(heroCard, post.firstChild);
            }
        });
    }

    createHeroCard(authorName, playerData) {
        const card = document.createElement('div');
        card.className = 'warframe-herocard';
        
        if (!playerData) {
            // Карточка для игрока не найденного в базе
            card.innerHTML = `
                <div class="herocard-header">
                    <h3 class="herocard-title">🎮 ${authorName}</h3>
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
            `;
            return card;
        }

        // Данные с значениями по умолчанию
        const reputation = playerData.reputation || 0;
        const posts = playerData.posts || 0;
        const credits = playerData.credits || 0;
        const infection = playerData.infection || 0;
        const whisper = playerData.whisper || 0;
        const bonuses = playerData.bonuses || {};
        const onForum = playerData.onForum || 'Неизвестно';
        const lastSeen = playerData.lastSeen || 'Неизвестно';

        // Определяем цвета для статусов
        const infectionColor = infection >= 80 ? '#F44336' : infection >= 50 ? '#FF9800' : '#4CAF50';
        const whisperColor = whisper >= 80 ? '#F44336' : whisper >= 50 ? '#FF9800' : '#4CAF50';
        const infectionEmoji = infection >= 80 ? '🔴' : infection >= 50 ? '🟡' : '🟢';
        const whisperEmoji = whisper >= 80 ? '🔴' : whisper >= 50 ? '🟡' : '🟢';

        card.innerHTML = `
            <div class="herocard-header">
                <h3 class="herocard-title">🎮 ${authorName}</h3>
                <div class="herocard-badges">
                    <span class="badge reputation">⭐ ${reputation}</span>
                    <span class="badge posts">📊 ${posts}</span>
                </div>
            </div>
            
            <div class="herocard-stats">
                <div class="stat-row">
                    <span class="stat-label">💰 Кредиты:</span>
                    <span class="stat-value credits">${credits.toLocaleString()}&nbsp;CR</span>
                </div>
                
                <div class="stat-row">
                    <span class="stat-label">⚡ Заражение:</span>
                    <span class="stat-value infection" style="color: ${infectionColor}">
                        ${infection}% ${infectionEmoji}
                    </span>
                </div>
                
                <div class="stat-row">
                    <span class="stat-label">👁 Шёпот:</span>
                    <span class="stat-value whisper" style="color: ${whisperColor}">
                        ${whisper}% ${whisperEmoji}
                    </span>
                </div>
            </div>
            
            <div class="herocard-meta">
                <div class="meta-item">
                    <span class="meta-label">📅 На форуме:</span>
                    <span class="meta-value">${onForum}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">🕐 Был:</span>
                    <span class="meta-value">${lastSeen}</span>
                </div>
            </div>
            
            ${this.renderBonuses(bonuses)}
        `;

        return card;
    }

    renderBonuses(bonuses) {
        if (!bonuses || Object.keys(bonuses).length === 0) return '';
        
        const bonusEntries = [];
        if (bonuses.credits) bonusEntries.push(`<div class="bonus-item"><small>Бонус кредитов: +${bonuses.credits}</small></div>`);
        if (bonuses.infection) bonusEntries.push(`<div class="bonus-item"><small>Бонус заражения: +${bonuses.infection}%</small></div>`);
        if (bonuses.whisper) bonusEntries.push(`<div class="bonus-item"><small>Бонус шёпота: +${bonuses.whisper}%</small></div>`);
        
        return bonusEntries.length > 0 ? `
            <div class="herocard-bonuses">
                ${bonusEntries.join('')}
            </div>
        ` : '';
    }

    async init() {
        try {
            await this.loadPlayersData();
            this.processHeroCards();
            this.startAutoRefresh();
        } catch (error) {
            console.error('❌ Ошибка инициализации HeroCard:', error);
        }
    }

    startAutoRefresh() {
        // Обновляем карточки каждые 5 минут
        setInterval(() => {
            this.loadPlayersData().then(() => {
                this.processHeroCards();
                console.log('🔄 Карточки героев обновлены');
            });
        }, 5 * 60 * 1000);
    }
}

// Автоматическая инициализация
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const heroCard = new HeroCardIntegration();
        heroCard.init();
    });
}
