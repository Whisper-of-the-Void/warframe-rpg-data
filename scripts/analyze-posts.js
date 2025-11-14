// scripts/analyze-posts.js
const EnhancedUpdater = require('./updater');
const fs = require('fs');
const path = require('path');

async function analyzePosts() {
    try {
        console.log('🚀 Запуск анализа постов пользователей...');
        
        const updater = new EnhancedUpdater();
        
        // Загружаем текущие данные
        const playersPath = path.join(__dirname, '../data/players.json');
        const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        
        // Обновляем статистику постов
        const updatedPlayers = await updater.updateAllPlayersWithPosts(playersData.players);
        
        // Сохраняем обновленные данные
        playersData.players = updatedPlayers;
        playersData.last_updated = new Date().toISOString();
        playersData.posts_analyzed_at = new Date().toISOString();
        
        fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));
        
        console.log('✅ Анализ постов успешно завершен!');
        
    } catch (error) {
        console.error('❌ Ошибка анализа постов:', error);
        process.exit(1);
    }
}

analyzePosts();
