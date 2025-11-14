// test-connection.js
const fetch = require('node-fetch');

async function testConnection() {
    try {
        console.log('🔍 Проверяем доступность форума...');
        const response = await fetch('https://rusff.me/memberlist.php');
        
        console.log('✅ Статус ответа:', response.status);
        console.log('✅ Статус текст:', response.statusText);
        
        if (response.ok) {
            const html = await response.text();
            console.log('✅ HTML получен, размер:', html.length, 'символов');
            console.log('✅ Первые 500 символов:');
            console.log(html.substring(0, 500));
        }
        
    } catch (error) {
        console.error('❌ Ошибка подключения:', error.message);
    }
}

testConnection();
