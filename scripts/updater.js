// scripts/updater.js
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ForumParser {
    constructor() {
        this.memberlistUrl = 'https://warframe.f-rpg.me/userlist.php';
    }

    async parseMembersList() {
        try {
            console.log('🔍 Начинаем парсинг списка пользователей...');
            
            const response = await fetch(this.memberlistUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const html = await response.text();
            return this.extractPlayersFromHTML(html);
            
        } catch (error) {
            console.error('❌ Ошибка парсинга:', error);
            return null;
        }
    }

    extractPlayersFromHTML(html) {
        const players = {};
        const $ = cheerio.load(html);

        // Простая логика парсинга - адаптируйте под вашу структуру HTML
        $('.usertable table tbody tr').each((index, row) => {
            try {
                const cells = $(row).find('td');
                if (cells.length >= 6) {
                    const username = $(cells[0]).find('.usersname a').text().trim();
                    if (username) {
                        players[username] = this.createPlayerData(username, cells, $);
                        console.log(`👤 Обработан: ${username}`);
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка обработки строки:', error);
            }
        });

        console.log(`✅ Обработано пользователей: ${Object.keys(players).length}`);
        return players;
    }

    createPlayerData(username, cells, $) {
        const statusText = $(cells[1]).text().trim();
        const bonuses = this.parseBonusesFromStatus(statusText);
        
        return {
            id: username.toLowerCase().replace(/[^a-z0-9а-яё]/g, '_'),
            name: username,
            forum_data: {
                status: statusText,
                posts: parseInt($(cells[3]).text()) || 0,
            },
            bonuses: bonuses,
            game_stats: {
                credits: 1000 + bonuses.credits,
                infection: { total: Math.max(0, Math.min(100, bonuses.infection)) },
                whisper: { total: Math.max(0, Math.min(100, bonuses.whisper)) }
            },
            last_updated: new Date().toISOString()
        };
    }

    parseBonusesFromStatus(status) {
        const creditsMatch = status.match(/💰([+-]?\d+)/);
        const infectionMatch = status.match(/⚡([+-]?\d+)%/);
        const whisperMatch = status.match(/👁([+-]?\d+)%/);

        return {
            credits: creditsMatch ? parseInt(creditsMatch[1]) : 0,
            infection: infectionMatch ? parseInt(infectionMatch[1]) : 0,
            whisper: whisperMatch ? parseInt(whisperMatch[1]) : 0
        };
    }
}

// Основная функция
async function main() {
    console.log('🚀 Запуск обновления данных...');
    
    const parser = new ForumParser();
    const players = await parser.parseMembersList();
    
    if (players) {
        const dataPath = path.join(__dirname, '../data/players.json');
        const dataToSave = {
            players: players,
            last_updated: new Date().toISOString(),
            version: "1.0.0"
        };
        
        fs.writeFileSync(dataPath, JSON.stringify(dataToSave, null, 2));
        console.log('✅ Данные успешно сохранены в players.json');
    } else {
        console.log('❌ Не удалось получить данные игроков');
    }
}

main().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});
