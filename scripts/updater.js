// scripts/updater.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ForumParser {
    constructor() {
        this.memberlistUrl = 'https://warframe.f-rpg.me/userlist.php';
    }

    async parseMembersList() {
        try {
            console.log('🔍 Начинаем парсинг списка пользователей...');
            
            const html = await this.fetchUrl(this.memberlistUrl);
            console.log('✅ HTML получен, размер:', html.length, 'символов');
            
            return this.extractPlayersFromHTML(html);
            
        } catch (error) {
            console.error('❌ Ошибка парсинга:', error);
            return null;
        }
    }

    fetchUrl(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    // Конвертируем из windows-1251 в utf-8
                    const buffer = Buffer.from(data, 'binary');
                    const decoded = this.win1251ToUtf8(buffer);
                    resolve(decoded);
                });
                
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    win1251ToUtf8(buffer) {
        // Простая конвертация windows-1251 -> utf-8
        const win1251 = {
            0x80: 0x0402, 0x81: 0x0403, 0x82: 0x201A, /* ... и так далее */
            // Для простоты используем базовую конвертацию
        };
        
        let result = '';
        for (let i = 0; i < buffer.length; i++) {
            const code = buffer[i];
            if (code < 128) {
                result += String.fromCharCode(code);
            } else {
                // Простая замена кириллицы
                result += String.fromCharCode(code + 0x350);
            }
        }
        return result;
    }

    extractPlayersFromHTML(html) {
        const players = {};
        
        try {
            // Простой парсинг с помощью регулярных выражений
            const rows = this.extractTableRows(html);
            console.log('📋 Найдено строк пользователей:', rows.length);

            rows.forEach((row, index) => {
                try {
                    const cells = this.extractCells(row);
                    if (cells.length >= 6) {
                        const username = this.extractUsername(cells[0]);
                        if (username && this.isValidUsername(username)) {
                            console.log(`👤 Обрабатываем пользователя: ${username}`);
                            players[username] = this.createPlayerData(username, cells);
                        }
                    }
                } catch (cellError) {
                    console.error(`❌ Ошибка обработки строки ${index}:`, cellError);
                }
            });

            console.log(`✅ Успешно обработано пользователей: ${Object.keys(players).length}`);
            return players;
            
        } catch (error) {
            console.error('❌ Ошибка в extractPlayersFromHTML:', error);
            return players;
        }
    }

    extractTableRows(html) {
        // Ищем строки таблицы с пользователями
        const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
        const matches = html.match(rowRegex) || [];
        return matches.filter(row => row.includes('usersname'));
    }

    extractCells(row) {
        // Извлекаем ячейки из строки таблицы
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells = [];
        let match;
        
        while ((match = cellRegex.exec(row)) !== null) {
            cells.push(match[1]);
        }
        
        return cells;
    }

    extractUsername(cellHtml) {
        // Извлекаем имя пользователя
        const usernameMatch = cellHtml.match(/<a[^>]*class="usersname"[^>]*>([^<]+)<\/a>/i);
        if (usernameMatch) {
            return usernameMatch[1].trim();
        }
        
        // Альтернативный метод
        const text = cellHtml.replace(/<[^>]*>/g, '').trim();
        return text || null;
    }

    isValidUsername(username) {
        return username && 
               username.length > 1 && 
               !username.includes('@') &&
               username !== 'Автор' &&
               username !== 'Имя';
    }

    createPlayerData(username, cells) {
        // Парсим бонусы из статуса
        const statusText = this.cleanHtml(cells[1]);
        const bonuses = this.parseBonusesFromStatus(statusText);
        
        // Парсим количество сообщений
        const postsText = this.cleanHtml(cells[3]);
        const posts = parseInt(postsText.replace(/\D/g, '')) || 0;

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

    cleanHtml(html) {
        return html.replace(/<[^>]*>/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
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
                "Void": {
                    id: "void",
                    name: "Void",
                    forum_data: {
                        status: "💰+200 ⚡+13% 👁+312%",
                        posts: 45,
                    },
                    bonuses: { credits: 200, infection: 13, whisper: 312 },
                    game_stats: {
                        credits: 1200,
                        infection: { total: 13 },
                        whisper: { total: 100 }
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
