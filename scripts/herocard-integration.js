// scripts/herocard-integration.js
class HeroCardIntegration {
    constructor() {
        this.dataUrl = 'https://whisper-of-the-void.github.io/warframe-rpg-data/data/players.json';
        this.playersData = null;
    }

    async init() {
        try {
            await this.loadPlayersData();
            this.processHeroCards();
        } catch (error) {
            console.error('❌ Ошибка инициализации HeroCard:', error);
        }
    }

    async loadPlayersData() {
        const response = await fetch(this.dataUrl);
        this.playersData = await response.json();
        console.log('✅ Данные игроков загружены:', Object.keys(this.playersData.players).length);
    }

    processHeroCards() {
        const heroCards = document.querySelectorAll('.herocard');
        console.log(`🎯 Найдено карточек героев: ${heroCards.length}`);

        heroCards.forEach(card => {
            const playerName = this.findPlayerNameForCard(card);
            
            if (playerName && this.playersData.players[playerName]) {
                this.fillHeroCard(card, this.playersData.players[playerName]);
            } else {
                this.showError(card, playerName);
            }
        });
    }

    findPlayerNameForCard(card) {
        // Основной способ: ищем в блоке pa-author
        let playerName = this.findAuthorInPost(card);
        
        if (playerName) return playerName;

        // Запасной способ: ищем в URL (если есть параметр пользователя)
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
        return name && name.length > 1 && !name.includes(' ') && !name.includes('@') && !name.includes('Автор');
    }

    fillHeroCard(card, playerData) {
        card.innerHTML = this.createHeroCardHTML(playerData);
        console.log(`✅ Заполнена карточка для: ${playerData.name}`);
    }

    // Остальные функции остаются без изменений (createHeroCardHTML, getInfectionColor и т.д.)
    createHeroCardHTML(player) {
        const infectionColor = this.getInfectionColor(player.game_stats.infection.total);
        const whisperColor = this.getWhisperColor(player.game_stats.whisper.total);
        
        return `
            <div class="warframe-herocard">
                <div class="herocard-header">
                    <h3 class="herocard-title">🎮 ${player.name}</h3>
                    <div class="herocard-badges">
                        <span class="badge reputation">⭐ ${player.forum_data.positive_reputation}</span>
                        <span class="badge posts">📊 ${player.forum_data.posts}</span>
                    </div>
                </div>
                
                <div class="herocard-stats">
                    <div class="stat-row">
                        <span class="stat-label">💰 Кредиты:</span>
                        <span class="stat-value credits">${player.game_stats.credits.toLocaleString()}</span>
                    </div>
                    
                    <div class="stat-row">
                        <span class="stat-label">⚡ Заражение:</span>
                        <span class="stat-value infection" style="color: ${infectionColor}">
                            ${player.game_stats.infection.total}%
                            ${this.getInfectionIcon(player.game_stats.infection.total)}
                        </span>
                    </div>
                    
                    <div class="stat-row">
                        <span class="stat-label">👁 Шёпот:</span>
                        <span class="stat-value whisper" style="color: ${whisperColor}">
                            ${player.game_stats.whisper.total}%
                            ${this.getWhisperIcon(player.game_stats.whisper.total)}
                        </span>
                    </div>
                </div>
                
                <div class="herocard-meta">
                    <div class="meta-item">
                        <span class="meta-label">📅 На форуме:</span>
                        <span class="meta-value">${player.forum_data.days_since_registration} дн.</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">🕐 Был:</span>
                        <span class="meta-value">${player.forum_data.last_online}</span>
                    </div>
                </div>
                
                <div class="herocard-bonuses">
                    <div class="bonus-item">
                        <small>Бонус кредитов: ${player.bonuses.credits > 0 ? '+' : ''}${player.bonuses.credits}</small>
                    </div>
                    <div class="bonus-item">
                        <small>Бонус заражения: ${player.bonuses.infection > 0 ? '+' : ''}${player.bonuses.infection}%</small>
                    </div>
                    <div class="bonus-item">
                        <small>Бонус шёпота: ${player.bonuses.whisper > 0 ? '+' : ''}${player.bonuses.whisper}%</small>
                    </div>
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

    showError(card, playerName) {
        card.innerHTML = `
            <div class="herocard-error">
                <p>⚠️ Не удалось загрузить данные игрока</p>
                ${playerName ? `<small>Игрок: ${playerName}</small>` : ''}
                <small>Проверьте наличие игрока в системе RPG</small>
            </div>
        `;
    }
}

// Стили остаются без изменений
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
        }
        
        .bonus-item {
            margin: 2px 0;
            font-size: 0.8em;
            color: #ccc;
        }
        
        .herocard-error {
            text-align: center;
            padding: 20px;
            color: #f44336;
            background: rgba(244,67,54,0.1);
            border-radius: 8px;
            border: 1px solid #f44336;
        }
        
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

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    document.head.insertAdjacentHTML('beforeend', heroCardStyles);
    new HeroCardIntegration().init();
});
