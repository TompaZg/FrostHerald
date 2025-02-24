const { sequelize, Announcement } = require('./db');
const logger = require('./utils/logger');

async function initDatabase() {
    try {
        // First, try to get existing announcements
        let existingAnnouncements = [];
        try {
            await sequelize.query('SELECT * FROM announcements');
            existingAnnouncements = await Announcement.findAll();
        } catch (error) {
            logger.info('No existing announcements found or table does not exist');
        }

        // Sync database with new schema
        await sequelize.sync({ force: true });

        // Restore existing announcements if any
        if (existingAnnouncements.length > 0) {
            for (const announcement of existingAnnouncements) {
                await Announcement.create({
                    ...announcement.toJSON(),
                    title: 'Announcement' // Set default title for existing announcements
                });
            }
            logger.info(`Restored ${existingAnnouncements.length} announcements`);
        }

        logger.info('Database synchronized successfully');
    } catch (error) {
        logger.error('Failed to sync database:', error);
        process.exit(1);
    }
}

initDatabase(); 