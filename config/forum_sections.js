// config/forum_sections.js

// ИГРОВЫЕ РАЗДЕЛЫ - посты здесь дают игровой прогресс
const GAME_SECTIONS = {
    roleplay: [1, 7] // Точка Сингулярности и другие игровые разделы
};

// ФЛУДОВЫЕ РАЗДЕЛЫ - посты здесь не дают игрового прогресса
const FLOOD_SECTIONS = {
    offtopic: [9],
    evenings: [10],
    diaries: [11],
    contest: [12]
};

// Функции для работы с разделами
const SectionUtils = {
    // Получение всех ID игровых разделов
    getAllGameSectionIds() {
        return Object.values(GAME_SECTIONS).flat();
    },

    // Получение всех ID флудовых разделов
    getAllFloodSectionIds() {
        return Object.values(FLOOD_SECTIONS).flat();
    },

    // Проверка, является ли раздел игровым по ID
    isGameSection(sectionId) {
        return this.getAllGameSectionIds().includes(parseInt(sectionId));
    },

    // Проверка, является ли раздел флудовым по ID
    isFloodSection(sectionId) {
        return this.getAllFloodSectionIds().includes(parseInt(sectionId));
    },

    // Получение типа раздела по ID
    getSectionType(sectionId) {
        const id = parseInt(sectionId);
        
        // Проверяем игровые разделы
        for (const [type, ids] of Object.entries(GAME_SECTIONS)) {
            if (ids.includes(id)) return type;
        }
        
        // Проверяем флудовые разделы
        for (const [type, ids] of Object.entries(FLOOD_SECTIONS)) {
            if (ids.includes(id)) return type;
        }
        
        return 'technical'; // Все остальное - техническое
    },

    // Получение веса раздела для расчета очков активности
    getSectionWeight(sectionId) {
        if (this.isGameSection(sectionId)) return 2.0;
        if (this.isFloodSection(sectionId)) return 0.5;
        return 0.1; // Технические разделы
    }
};

module.exports = {
    GAME_SECTIONS,
    FLOOD_SECTIONS,
    ...SectionUtils
};
