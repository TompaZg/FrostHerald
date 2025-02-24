const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cron = require('node-cron');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Store scheduled announcements and completed announcements
const announcements = [];
const completedAnnouncements = [];
// Cleanup old announcements every 24 hours
setInterval(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    while (completedAnnouncements.length > 50 || 
           (completedAnnouncements[0] && new Date(completedAnnouncements[0].completedAt) < sevenDaysAgo)) {
        completedAnnouncements.shift();
    }
}, 12 * 60 * 60 * 1000);

// Bot login
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

// Command handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore messages from other bots

    if (message.content.startsWith('!schedule')) {
        const args = message.content.split(' ');
        const command = args[1];

        switch (command) {
            case 'create':
                await handleCreateCommand(message);
                break;
            case 'list':
                await handleListCommand(message);
                break;
            case 'cancel':
                await handleCancelCommand(message, args[2]);
                break;
            case 'edit':
                await handleEditCommand(message, args[2]);
                break;
            case 'help':
                await handleHelpCommand(message);
                break;
            case 'status':
                await handleStatusCommand(message);
                break;
            case 'clear':
                await handleClearCommand(message);
                break;
            case 'history':
                await handleHistoryCommand(message);
                break;
            default:
                message.reply('Invalid command. Use `!schedule help` for a list of commands.');
        }
    }
});

// Function to handle !schedule create
async function handleCreateCommand(message) {
    await message.reply('What should the announcement be named?\n*(Example: "weekly_meeting" or "daily_reminder")*');
    const nameFilter = (m) => m.author.id === message.author.id;
    const nameCollector = message.channel.createMessageCollector({ filter: nameFilter, time: 60000 });

    let announcementName;
    nameCollector.on('collect', (m) => {
        announcementName = m.content;
        nameCollector.stop();
    });

    nameCollector.on('end', async () => {
        if (!announcementName) {
            await message.reply('No name provided. Announcement creation canceled.');
            return;
        }

        await message.reply('What should the announcement message be?\n*(Example: "🎯 Weekly Team Meeting starts in 10 minutes! Join voice channel #meetings")*');
        const contentFilter = (m) => m.author.id === message.author.id;
        const contentCollector = message.channel.createMessageCollector({ filter: contentFilter, time: 60000 });

        let announcementContent;
        contentCollector.on('collect', (m) => {
            announcementContent = m.content;
            contentCollector.stop();
        });

        contentCollector.on('end', async () => {
            if (!announcementContent) {
                await message.reply('No content provided. Announcement creation canceled.');
                return;
            }

            await message.reply('Mention the channel where the announcement should be posted (e.g., #general).');
            const channelFilter = (m) => m.author.id === message.author.id && m.mentions.channels.size > 0;
            const channelCollector = message.channel.createMessageCollector({ filter: channelFilter, time: 60000 });

            let announcementChannel;
            channelCollector.on('collect', (m) => {
                announcementChannel = m.mentions.channels.first();
                channelCollector.stop();
            });

            channelCollector.on('end', async () => {
                if (!announcementChannel) {
                    await message.reply('No channel provided. Announcement creation canceled.');
                    return;
                }

                await message.reply('What time should the announcement be posted?\n*(Format: "14:30" for daily or "25/12/2023 14:30" for specific date, all times in UTC)*');
                const timeFilter = (m) => m.author.id === message.author.id;
                const timeCollector = message.channel.createMessageCollector({ filter: timeFilter, time: 60000 });

                let announcementTime;
                timeCollector.on('collect', (m) => {
                    announcementTime = m.content;
                    timeCollector.stop();
                });

                timeCollector.on('end', async () => {
                    if (!announcementTime) {
                        await message.reply('No time provided. Announcement creation canceled.');
                        return;
                    }

                    await message.reply('Should the announcement repeat? (yes/no)');
                    const repeatFilter = (m) => m.author.id === message.author.id && ['yes', 'no'].includes(m.content.toLowerCase());
                    const repeatCollector = message.channel.createMessageCollector({ filter: repeatFilter, time: 60000 });

                    let repeatAnnouncement;
                    repeatCollector.on('collect', (m) => {
                        repeatAnnouncement = m.content.toLowerCase() === 'yes';
                        repeatCollector.stop();
                    });

                    repeatCollector.on('end', async () => {
                        if (repeatAnnouncement === undefined) {
                            await message.reply('No response provided. Announcement creation canceled.');
                            return;
                        }

                        let repeatInterval = null;
                        let repeatCount = null;

                        if (repeatAnnouncement) {
                            await message.reply('How often should the announcement repeat (in minutes)?');
                            const intervalFilter = (m) => m.author.id === message.author.id && !isNaN(m.content);
                            const intervalCollector = message.channel.createMessageCollector({ filter: intervalFilter, time: 60000 });

                            intervalCollector.on('collect', (m) => {
                                repeatInterval = parseInt(m.content);
                                intervalCollector.stop();
                            });

                            intervalCollector.on('end', async () => {
                                if (!repeatInterval) {
                                    await message.reply('No interval provided. Announcement creation canceled.');
                                    return;
                                }

                                await message.reply('How many times should the announcement repeat?');
                                const countFilter = (m) => m.author.id === message.author.id && !isNaN(m.content);
                                const countCollector = message.channel.createMessageCollector({ filter: countFilter, time: 60000 });

                                countCollector.on('collect', (m) => {
                                    repeatCount = parseInt(m.content);
                                    countCollector.stop();
                                });

                                countCollector.on('end', async () => {
                                    if (!repeatCount) {
                                        await message.reply('No repeat count provided. Announcement creation canceled.');
                                        return;
                                    }

                                    scheduleAnnouncement(announcementName, announcementContent, announcementChannel, announcementTime, repeatAnnouncement, repeatInterval, repeatCount);
                                    await message.reply('Announcement scheduled successfully!');
                                });
                            });
                        } else {
                            scheduleAnnouncement(announcementName, announcementContent, announcementChannel, announcementTime, repeatAnnouncement, repeatInterval, repeatCount);
                            await message.reply('Announcement scheduled successfully!');
                        }
                    });
                });
            });
        });
    });
}

// Function to handle !schedule list
async function handleListCommand(message) {
    if (announcements.length === 0) {
        await message.reply('No announcements are currently scheduled.');
    } else {
        // Create an embed
        const embed = new EmbedBuilder()
            .setTitle('📅 Scheduled Announcements')
            .setColor(0x00FF00) // Green color
            .setDescription('Here are all the currently scheduled announcements:')
            .setTimestamp();

        // Add each announcement as a field in the embed
        announcements.forEach((announcement, index) => {
            const now = new Date();
            const [time, ampm] = announcement.time.split(' ');
            const [hours, minutes] = time.split(':');
            let nextRun = new Date();
            nextRun.setHours(parseInt(hours));
            nextRun.setMinutes(parseInt(minutes));
            if (nextRun < now) nextRun.setDate(nextRun.getDate() + 1);
            
            const repeatInfo = announcement.repeat
                ? `Repeats every ${announcement.interval} minutes, ${announcement.count} times`
                : 'Does not repeat';
            
            embed.addFields({
                name: `**${index + 1}. ${announcement.name}**`,
                value: `
                **Channel:** ${announcement.channel}
                **Time:** ${announcement.time} UTC
                **Next Run:** ${nextRun.toLocaleString()}
                **Repeat:** ${repeatInfo}
                **Message:** ${announcement.content}
                `,
                inline: false,
            });
        });

        // Send the embed
        await message.reply({ embeds: [embed] });
    }
}

// Function to handle !schedule cancel
async function handleCancelCommand(message, name) {
    if (!name) {
        await message.reply('Please provide the name of the announcement to cancel.');
        return;
    }

    const index = announcements.findIndex((announcement) => announcement.name === name);
    if (index === -1) {
        await message.reply(`No announcement found with the name "${name}".`);
    } else {
        announcements[index].task.stop(); // Stop the cron job
        announcements.splice(index, 1); // Remove the announcement from the list
        await message.reply(`Cancelled announcement: ${name}`);
    }
}

// Function to handle !schedule edit
async function handleEditCommand(message, name) {
    if (!name) {
        await message.reply('Please provide the name of the announcement to edit.');
        return;
    }

    const index = announcements.findIndex((announcement) => announcement.name === name);
    if (index === -1) {
        await message.reply(`No announcement found with the name "${name}".`);
    } else {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_message')
                    .setLabel('Edit Message')
                    .setStyle('Primary'),
                new ButtonBuilder()
                    .setCustomId('edit_time')
                    .setLabel('Edit Time')
                    .setStyle('Primary'),
                new ButtonBuilder()
                    .setCustomId('edit_repeat')
                    .setLabel('Edit Repeat Settings')
                    .setStyle('Primary'),
                new ButtonBuilder()
                    .setCustomId('edit_channel')
                    .setLabel('Edit Channel')
                    .setStyle('Primary')
            );

        const response = await message.reply({
            content: `What would you like to edit for "${name}"?`,
            components: [row]
        });

        const filter = i => i.user.id === message.author.id;
        const collector = response.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            switch(i.customId) {
                case 'edit_message':
                    await handleMessageEdit(message, index);
                    break;
                case 'edit_time':
                    await handleTimeEdit(message, index);
                    break;
                case 'edit_repeat':
                    await handleRepeatEdit(message, index);
                    break;
                case 'edit_channel':
                    await handleChannelEdit(message, index);
                    break;
            }
            await i.update({ components: [] });
        });
        const editFilter = (m) => m.author.id === message.author.id && ['message', 'time', 'repeat'].includes(m.content.toLowerCase());
        const editCollector = message.channel.createMessageCollector({ filter: editFilter, time: 60000 });

        editCollector.on('collect', async (m) => {
            const editType = m.content.toLowerCase();
            if (editType === 'message') {
                await message.reply('What should the new message be?');
                const messageFilter = (m) => m.author.id === message.author.id;
                const messageCollector = message.channel.createMessageCollector({ filter: messageFilter, time: 60000 });

                messageCollector.on('collect', (m) => {
                    announcements[index].content = m.content;
                    messageCollector.stop();
                });

                messageCollector.on('end', async () => {
                    await message.reply('Announcement message updated successfully!');
                });
            } else if (editType === 'time') {
                await message.reply('What should the new time be (in UTC, e.g., 14:30)?');
                const timeFilter = (m) => m.author.id === message.author.id;
                const timeCollector = message.channel.createMessageCollector({ filter: timeFilter, time: 60000 });

                timeCollector.on('collect', (m) => {
                    announcements[index].time = m.content;
                    timeCollector.stop();
                });

                timeCollector.on('end', async () => {
                    await message.reply('Announcement time updated successfully!');
                });
            } else if (editType === 'repeat') {
                await message.reply('Should the announcement repeat? (yes/no)');
                const repeatFilter = (m) => m.author.id === message.author.id && ['yes', 'no'].includes(m.content.toLowerCase());
                const repeatCollector = message.channel.createMessageCollector({ filter: repeatFilter, time: 60000 });

                repeatCollector.on('collect', (m) => {
                    announcements[index].repeat = m.content.toLowerCase() === 'yes';
                    repeatCollector.stop();
                });

                repeatCollector.on('end', async () => {
                    await message.reply('Announcement repeat settings updated successfully!');
                });
            }
        });
    }
}

// Function to handle !schedule help
async function handleHelpCommand(message) {
    const embed = new EmbedBuilder()
        .setTitle('📢 Announcement Scheduler Help')
        .setColor(0x0099FF)
        .setDescription('Here\'s how to use the Announcement Scheduler bot:')
        .addFields(
            { 
                name: '📝 Basic Commands',
                value: `
• !schedule create - Create new announcement
• !schedule list - Show all announcements
• !schedule cancel <name> - Cancel an announcement
• !schedule edit <name> - Edit an announcement
• !schedule status - Check bot status
• !schedule clear - Remove all announcements
                `
            },
            {
                name: '✨ Creating an Announcement - Example',
                value: `
Q: What should the announcement be named?
A: "weekly_meeting"

Q: What should the announcement message be?
A: "🎯 Weekly Team Meeting starts in 10 minutes! Join voice channel #meetings"

Q: Mention the channel
A: #announcements

Q: What time? (UTC)
A: 14:30 (for daily)
or 25/12/2023 14:30 (for specific date)

Q: Should it repeat?
A: yes

Q: How often? (minutes)
A: 10080 (weekly = 7 days × 24 hours × 60 minutes)

Q: How many times?
A: 52 (for one year)
                `
            }
        )
        .setFooter({ text: 'All times are in UTC' });

    await message.reply({ embeds: [embed] });
}

// Function to handle !schedule status
async function handleStatusCommand(message) {
    await message.reply('Announcement Scheduler is online and ready!');
}

// Function to handle !schedule clear
async function handleClearCommand(message) {
    announcements.forEach((announcement) => announcement.task.stop()); // Stop all cron jobs
    announcements.length = 0; // Clear the announcements array
    await message.reply('All scheduled announcements have been cleared.');
}

// Function to schedule announcements
function scheduleAnnouncement(name, content, channel, time, repeat, interval, count) {
    let minute, hour, day, month;
    
    // Check if time contains a date
    if (time.includes('/')) {
        const [dateStr, timeStr] = time.split(' ');
        [hour, minute] = timeStr.split(':');
        [day, month] = dateStr.split('/');
        cronExpression = `${minute} ${hour} ${day} ${month} *`;
    } else {
        // Handle time-only format
        [hour, minute] = time.split(':');
        cronExpression = `${minute} ${hour} * * *`;
    }
    
    const task = cron.schedule(cronExpression, () => {
        channel.send(content);
        if (!repeat) {
            completedAnnouncements.push({
                name,
                content,
                channel,
                time,
                completedAt: new Date()
            });
        }
        if (repeat) {
            let currentCount = 0;
            const repeatTask = setInterval(() => {
                channel.send(content);
                currentCount++;
                if (currentCount >= count) {
                    clearInterval(repeatTask);
                    completedAnnouncements.push({
                        name,
                        content,
                        channel,
                        time,
                        completedAt: new Date()
                    });
                }
            }, interval * 60000);
        }
    });

    announcements.push({ name, content, channel, time, repeat, interval, count, task });
}

// Log in to Discord
client.login('MTM0MzUzMzI0MzQ0NTU0Mjk5Mg.GLgnzj.bbe-yNatwyCGaWPw-RqgqzgFZXjTX-giuvgUys');


// Edit handler functions
async function handleMessageEdit(message, index) {
    await message.reply('What should the new message be?');
    const messageFilter = (m) => m.author.id === message.author.id;
    const messageCollector = message.channel.createMessageCollector({ filter: messageFilter, time: 60000 });

    messageCollector.on('collect', async (m) => {
        announcements[index].content = m.content;
        announcements[index].task.stop();
        scheduleAnnouncement(
            announcements[index].name,
            m.content,
            announcements[index].channel,
            announcements[index].time,
            announcements[index].repeat,
            announcements[index].interval,
            announcements[index].count
        );
        announcements.splice(index, 1);
        await message.reply('Announcement message updated successfully!');
        messageCollector.stop();
    });
}

async function handleTimeEdit(message, index) {
    await message.reply('What should the new time be (in UTC, e.g., 14:30 or 25/12/2023 14:30)?');
    const timeFilter = (m) => m.author.id === message.author.id;
    const timeCollector = message.channel.createMessageCollector({ filter: timeFilter, time: 60000 });

    timeCollector.on('collect', async (m) => {
        announcements[index].task.stop();
        scheduleAnnouncement(
            announcements[index].name,
            announcements[index].content,
            announcements[index].channel,
            m.content,
            announcements[index].repeat,
            announcements[index].interval,
            announcements[index].count
        );
        announcements.splice(index, 1);
        await message.reply('Announcement time updated successfully!');
        timeCollector.stop();
    });
}

async function handleRepeatEdit(message, index) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('toggle_repeat')
                .setLabel('Toggle Repeat')
                .setStyle('Primary'),
            new ButtonBuilder()
                .setCustomId('edit_interval')
                .setLabel('Edit Interval')
                .setStyle('Secondary'),
            new ButtonBuilder()
                .setCustomId('edit_count')
                .setLabel('Edit Count')
                .setStyle('Secondary')
        );

    const response = await message.reply({
        content: 'What repeat setting would you like to modify?',
        components: [row]
    });

    const filter = i => i.user.id === message.author.id;
    const buttonCollector = response.createMessageComponentCollector({ filter, time: 60000 });

    buttonCollector.on('collect', async (i) => {
        if (i.customId === 'toggle_repeat') {
            const newRepeatValue = !announcements[index].repeat;
            if (newRepeatValue) {
                await i.reply('Enter the interval in minutes:');
                const intervalFilter = (m) => m.author.id === message.author.id && !isNaN(m.content);
                const intervalCollector = message.channel.createMessageCollector({ filter: intervalFilter, time: 60000 });

                intervalCollector.on('collect', async (m) => {
                    const interval = parseInt(m.content);
                    await message.reply('Enter the repeat count:');
                    const countFilter = (m) => m.author.id === message.author.id && !isNaN(m.content);
                    const countCollector = message.channel.createMessageCollector({ filter: countFilter, time: 60000 });

                    countCollector.on('collect', async (m) => {
                        const count = parseInt(m.content);
                        announcements[index].task.stop();
                        scheduleAnnouncement(
                            announcements[index].name,
                            announcements[index].content,
                            announcements[index].channel,
                            announcements[index].time,
                            true,
                            interval,
                            count
                        );
                        announcements.splice(index, 1);
                        await message.reply('Repeat settings updated successfully!');
                        countCollector.stop();
                    });
                });
            } else {
                announcements[index].repeat = false;
                await i.reply('Repeat has been disabled');
            }
        } else if (i.customId === 'edit_interval') {
            await i.reply('Enter the new interval in minutes:');
            const intervalFilter = (m) => m.author.id === message.author.id && !isNaN(m.content);
            const intervalCollector = message.channel.createMessageCollector({ filter: intervalFilter, time: 60000 });

            intervalCollector.on('collect', async (m) => {
                announcements[index].interval = parseInt(m.content);
                await message.reply('Interval updated successfully!');
                intervalCollector.stop();
            });
        } else if (i.customId === 'edit_count') {
            await i.reply('Enter the new repeat count:');
            const countFilter = (m) => m.author.id === message.author.id && !isNaN(m.content);
            const countCollector = message.channel.createMessageCollector({ filter: countFilter, time: 60000 });

            countCollector.on('collect', async (m) => {
                announcements[index].count = parseInt(m.content);
                await message.reply('Repeat count updated successfully!');
                countCollector.stop();
            });
        }
        buttonCollector.stop();
    });
}

async function handleChannelEdit(message, index) {
    await message.reply('Mention the new channel for the announcement (e.g., #general)');
    const channelFilter = (m) => m.author.id === message.author.id && m.mentions.channels.size > 0;
    const channelCollector = message.channel.createMessageCollector({ filter: channelFilter, time: 60000 });

    channelCollector.on('collect', async (m) => {
        const newChannel = m.mentions.channels.first();
        announcements[index].channel = newChannel;
        announcements[index].task.stop();
        scheduleAnnouncement(
            announcements[index].name,
            announcements[index].content,
            newChannel,
            announcements[index].time,
            announcements[index].repeat,
            announcements[index].interval,
            announcements[index].count
        );
        announcements.splice(index, 1);
        await message.reply('Announcement channel updated successfully!');
        channelCollector.stop();
    });
}
// Function to handle !schedule history
async function handleHistoryCommand(message) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('today')
                .setLabel('Today')
                .setStyle('Primary'),
            new ButtonBuilder()
                .setCustomId('week')
                .setLabel('Last 7 Days')
                .setStyle('Primary'),
            new ButtonBuilder()
                .setCustomId('month')
                .setLabel('Last Month')
                .setStyle('Primary'),
            new ButtonBuilder()
                .setCustomId('all')
                .setLabel('All History')
                .setStyle('Primary')
        );

    const response = await message.reply({
        content: 'Select a time period to view announcement history:',
        components: [row]
    });

    const filter = i => i.user.id === message.author.id;
    const collector = response.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        const now = new Date();
        let filterDate = now;
        
        switch(i.customId) {
            case 'today':
                filterDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                filterDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                filterDate.setMonth(now.getMonth() - 1);
                break;
            case 'all':
                filterDate = new Date(0);
                break;
        }

        const filteredAnnouncements = completedAnnouncements.filter(a => 
            new Date(a.completedAt) > filterDate
        );

        const embed = new EmbedBuilder()
            .setTitle('📜 Announcement History')
            .setColor(0x0099FF)
            .setDescription(`Showing announcements ${i.customId === 'all' ? 'from all time' : `from ${filterDate.toLocaleDateString()}`}`);

        if (filteredAnnouncements.length === 0) {
            embed.addFields({
                name: 'No Announcements',
                value: 'No announcements found for this time period.',
                inline: false
            });
        } else {
            filteredAnnouncements.forEach((announcement, index) => {
                embed.addFields({
                    name: `${index + 1}. ${announcement.name}`,
                    value: `
                    **Channel:** ${announcement.channel}
                    **Time:** ${announcement.time}
                    **Completed At:** ${new Date(announcement.completedAt).toLocaleString()}
                    **Message:** ${announcement.content}
                    `,
                    inline: false
                });
            });
        }

        await i.update({ embeds: [embed], components: [] });
    });
}
