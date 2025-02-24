const Sequelize = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite',
    logging: false
});

const Announcement = sequelize.define('announcement', {
    id: {
        type: Sequelize.STRING,
        primaryKey: true
    },
    userId: Sequelize.STRING,
    channelId: Sequelize.STRING,
    message: Sequelize.TEXT,
    scheduledTime: Sequelize.DATE,
    repeat: Sequelize.STRING,
    useEmbed: Sequelize.BOOLEAN,
    guildId: Sequelize.STRING,
    status: {
        type: Sequelize.STRING,
        defaultValue: 'scheduled' // scheduled, completed, cancelled
    },
    title: {
        type: Sequelize.STRING,
        defaultValue: 'Announcement'
    }
});

module.exports = {
    sequelize,
    Announcement
}; 