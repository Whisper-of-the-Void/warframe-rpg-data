// scripts/updater.js
import axios from 'axios';
import { parse } from 'node-html-parser';
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
            
            const response = await axios.get(this.memberlistUrl, {
                responseType: 'arraybuffer',
                responseEncoding: 'binary'
            });
            
            // Конвертируем из windows-1251 в utf-8
            const html = Buffer.from(response.data).toString('win1251');
            
            console.log('✅ HTML получен, размер:', html.length, 'символов');
            
            return this.extractPlayersFromHTML(html);
            
        } catch (error) {
            console.error('❌ Ошибка парсинга:', error);
            return null;
        }
    }

    extractPlayersFromHTML(html) {
        const players = {};
        const root = parse(html);

        // Ищем таблицу пользователей
        const userTable = root.querySelector('.usertable table');
        
        if (!userTable) {
            console.error('❌ Таблица пользователей не найдена');
            return players;
        }

        console.log('✅ Найдена таблица пользователей');

        // Парсим строки таблицы
        const rows = userTable.querySelectorAll('tbody tr');
        console.log('📋 Найдено строк пользователей:', rows.length);

        rows.forEach((row, index) => {
            try {
                const cells = row.querySelectorAll('td');
                
                if (cells.length >= 6) {
                    // Извлекаем имя пользователя
                    const usernameLink = cells[0].querySelector('.usersname a');
                    const username = usernameLink ? usernameLink.text.trim() : cells[0].text.trim();
                    
                    if (!username || username === '') return;
                    
                    console.log(`👤 Обрабатываем пользователя: ${username}`);
                    players[username] = this.createPlayerData(username, cells);
                }
            } catch (cellError) {
                console.error(`❌ Ошибка обработки строки ${index}:`, cellError);
            }
        });

        console.log(`✅ Успешно обработано пользователей: ${Object.keys(players).length}`);
        return players;
    }

    createPlayerData(username, cells) {
        // Парсим бонусы из статуса
        const statusText = cells[1].text.trim();
        const bonuses = this.parseBonusesFromStatus(statusText);
        
        // Парсим количество сообщений
        const posts = parseInt(cells[3].text) || 0;

        return {
            id: this.generateId(username),
            name: username,
            forum_data: {
                status: statusText,
                posts: posts,
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

    generateId(username) {
        return username.toLowerCase()
            .replace(/[^a-z0-9а-яё]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }
}

// Основная функция
async function main() {
    console.log('🚀 Запуск обновления данных...');
    
    const parser = new ForumParser();
    const players = await parser.parseMembersList();
    
    if (players && Object.keys(players).length > 0) {
        const dataPath = path.join(__dirname, '../data/players.json');
        
        const dataToSave = {
            players: players,
            last_updated: new Date().toISOString(),
            version: "1.0.0",
            stats: {
                total_players: Object.keys(players).length,
                parsed_at: new Date().toISOString()
            }
        };
        
        fs.writeFileSync(dataPath, JSON.stringify(dataToSave, null, 2));
        console.log('✅ Данные успешно сохранены в players.json');
        
        // Выводим итоговый список
        console.log('📋 Итоговый список пользователей:');
        Object.keys(players).forEach(username => {
            const player = players[username];
            console.log(`   - ${username}: 💰${player.game_stats.credits} ⚡${player.game_stats.infection.total}% 👁${player.game_stats.whisper.total}%`);
        });
    } else {
        console.log('❌ Не удалось получить данные игроков');
        // Создаем тестовые данные
        const dataPath = path.join(__dirname, '../data/players.json');
        const testData = {
            players: {
                "TestUser": {
                    id: "testuser",
                    name: "TestUser",
                    forum_data: {
                        status: "💰+100 ⚡+50% 👁+25%",
                        posts: 10,
                    },
                    bonuses: { credits: 100, infection: 50, whisper: 25 },
                    game_stats: {
                        credits: 1100,
                        infection: { total: 50 },
                        whisper: { total: 25 }
                    },
                    last_updated: new Date().toISOString()
                }
            },
            last_updated: new Date().toISOString(),
            version: "1.0.0"
        };
        fs.writeFileSync(dataPath, JSON.stringify(testData, null, 2));
        console.log('📁 Создан тестовый файл players.json');
    }
}

main().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});
