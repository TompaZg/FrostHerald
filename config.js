module.exports = {
    defaultSettings: {
        timezone: 'UTC',
        embedColor: '#00ff00',
        maxAnnouncements: 10,
        maxRepeatDuration: '1y', // 1 godina
        allowedRoles: ['Admin', 'Moderator'],
        cooldown: 5000 // 5 sekundi između komandi
    },
    permissions: {
        manage: ['Administrator', 'ManageMessages'],
        create: ['SendMessages', 'ViewChannel'],
        required: ['ViewChannel', 'SendMessages', 'EmbedLinks']
    }
}; 