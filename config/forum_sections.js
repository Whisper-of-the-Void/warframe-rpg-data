// config/forum_sections.js
const GAME_SECTIONS = {
    roleplay: [7]  // Ролевые игры - игровые посты
};

const FLOOD_SECTIONS = {
    offtopic: [9],     // Оффтоп
    evenings: [10],    // Вечеринки
    diaries: [11],     // Дневники
    contest: [12]      // Конкурсы
};

// Для парсера - полный список всех разделов
const ALL_SECTIONS = {
    ...GAME_SECTIONS,
    ...FLOOD_SECTIONS
};

module.exports = {
    GAME_SECTIONS,
    FLOOD_SECTIONS,
    ALL_SECTIONS
};
