const Discord = require('discord.js');
const bot = new Discord.Client();


bot.on('ready', () => {
    console.log('bot ready');
});

bot.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.voiceChannel;
    let oldUserChannel = oldMember.voiceChannel;


    if (oldUserChannel === undefined && newUserChannel !== undefined) {
        // User Joins a voice channel
        console.log('user joined a channel');

    } else if (newUserChannel === undefined) {
        // User leaves a voice channel
        console.log('user left a channel');
    }
})

// Bot token
bot.login(process.env.BOT_TOKEN);