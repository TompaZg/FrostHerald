const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows how to use the bot and lists all commands'),

    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('📚 FrostHerald Help Guide')
            .setDescription('Schedule and manage announcements for your server')
            .addFields(
                {
                    name: '🔷 Basic Commands',
                    value: 
                        '`/announce` - Create a new announcement\n' +
                        '`/help` - Show this help message\n' +
                        '`/ping` - Check bot response time\n' +
                        '`/debug` - Show debug information (admin only)',
                    inline: false
                },
                {
                    name: '📢 Creating Announcements',
                    value: 
                        '`/announce` command options:\n' +
                        '• `message` - The announcement text\n' +
                        '• `channel` - Where to send the announcement\n' +
                        '• `time` - When to send (format: YYYY-MM-DD HH:mm in UTC)\n' +
                        '• `title` - Custom title (optional)\n' +
                        '• `repeat_hours` - Repeat interval in hours (optional)\n' +
                        '• `embed` - Send as embed or plain text (optional)',
                    inline: false
                },
                {
                    name: '⏰ Time Format Example',
                    value: 
                        'To schedule for February 25th, 2025 at 15:30 UTC:\n' +
                        '`2025-02-25 15:30`',
                    inline: false
                },
                {
                    name: '🔁 Repeat Options',
                    value: 
                        '• `0` - No repeat (default)\n' +
                        '• `1` - Every hour\n' +
                        '• `24` - Daily\n' +
                        '• `168` - Weekly\n' +
                        'Or any custom hours between 1 and 720',
                    inline: false
                },
                {
                    name: '📝 Preview & Controls',
                    value: 
                        'After creating an announcement, you\'ll see a preview with:\n' +
                        '• `Confirm` - Schedule the announcement\n' +
                        '• `Cancel` - Cancel creation\n' +
                        '• `Send Preview` - Test how it looks in the channel',
                    inline: false
                },
                {
                    name: '❓ Need More Help?',
                    value: 'Contact the server administrators or check the bot\'s documentation.',
                    inline: false
                }
            )
            .setColor('#00ff00')
            .setFooter({ 
                text: 'All times are in UTC timezone',
            })
            .setTimestamp();

        return interaction.reply({
            embeds: [helpEmbed],
            ephemeral: true
        });
    }
}; 