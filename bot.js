const Discord = require('discord.js');
const Datastore = require('nedb'),
    activityDB = new Datastore({
        filename: './activity.db',
        autoload: true
    });
const bot = new Discord.Client();

function convertMS(ms) {
    var d, h, m, s;
    s = Math.floor(ms / 1000);
    m = Math.floor(s / 60);
    s = s % 60;
    h = Math.floor(m / 60);
    m = m % 60;
    d = Math.floor(h / 24);
    h = h % 24;
    return {
        d: d,
        h: h,
        m: m,
        s: s
    };
};

class UserActivity {
    constructor(user, activity) {
        // If no activity was passed, then create an empty object to avoid errors
        if (!activity) {
            activity = {};
        }
        // Fill the information
        this.userId = user.id;
        this.username = user.username;
        this.avatar = user.avatar || '';
        this.avatarURL = user.avatarURL || '';
        this.lastVoiceSessionStart = activity.lastVoiceSessionStart || undefined;
        this.lastVoiceSessionEnd = activity.lastVoiceSessionEnd || undefined;
        this.totalVoiceTime = activity.totalVoiceTime || 0;
        this.sentMessageCount = activity.sentMessageCount || 0;
        this.setReactionCount = activity.setReactionCount || 0;
        this.gotReactionCount = activity.gotReactionCount || 0;
    }
}

function updateActivity(userObj) {
    activityDB.update({
        userId: userObj.userId
    }, userObj, {
        upsert: true
    });
}

bot.on('ready', () => {
    console.log('bot ready');

    // Launch indexing on database
    // Using a unique constraint with the index
    activityDB.ensureIndex({
        fieldName: 'userId',
        unique: true
    });
});

bot.on('message', (msg) => {
    console.log(`Message [${msg.content}] was sent`);
    switch (msg.channel.type) {
        case 'text':
            // Search for users activity, who posted a message
            activityDB.findOne({
                userId: msg.author.id
            }, (err, activity) => {
                let userObj;
                // If we dont have no activity for current user, we will create it with initial values
                if (!activity) {
                    userObj = new UserActivity(msg.author);
                } else {
                    // In other case just updates values
                    userObj = new UserActivity(msg.author, activity);
                }
                // Increase sent message count
                userObj.sentMessageCount++;
                // Update activity
                updateActivity(userObj);
                // User Joins a voice channel
                // channel.send(`user ${userObj.username} was updated with new message count: ${userObj.sentMessageCount}`);
            });
            break;
        case 'dm':
            switch (msg.content) {
                case '!me':
                    // Search for users activity, who posted a message
                    activityDB.findOne({
                        userId: msg.author.id
                    }, (err, activity) => {
                        // If user does not have any activity, prompt it
                        if (!activity) {
                            msg.author.send('No information');
                        } else {
                            // Prompt information about who we are showing data
                            msg.author.send(`Information about **${activity.username}**`);
                            // Convert MS to object with days, months, minutes and seconds
                            const totalVoiceTime = convertMS(activity.totalVoiceTime);
                            // Prompt total voice chat time
                            msg.author.send(`Voice chat total time - ${totalVoiceTime.d} days, ${totalVoiceTime.h} hours, ${totalVoiceTime.m} minutes, ${totalVoiceTime.s} seconds`);
                            // Prompt total sent message count:
                            msg.author.send(`Messages sent - ${activity.sentMessageCount}`);
                            // Prompt total added reaction count:
                            msg.author.send(`Reactions set - ${activity.setReactionCount}`);
                            // Prompt total got reaction count:
                            msg.author.send(`Reactions received - ${activity.gotReactionCount}`);
                        }
                    });
                    break;
            }
            break;
        default:
            break;
    }
});


bot.on('messageDelete', (msg) => {
    // Search for users activity, who posted a message
    activityDB.findOne({
        userId: msg.author.id
    }, (err, activity) => {
        let userObj;
        // If we dont have no activity for current user, we will create it with initial values
        if (!activity) {
            userObj = new UserActivity(msg.author);
        } else {
            // In other case just updates values
            userObj = new UserActivity(msg.author, activity);
        }
        // Decrease sent message count
        userObj.sentMessageCount--;
        // Update activity
        updateActivity(userObj);
        // User Joins a voice channel
        // channel.send(`user ${userObj.username} joined a channel`);
    });
});

bot.on('messageReactionAdd', (msgReaction, user) => {
    // Search for users activity, who added a reaction
    activityDB.findOne({
        userId: user.id
    }, (err, activity) => {
        let userObj;
        // If we dont have no activity for current user, we will create it with initial values
        if (!activity) {
            userObj = new UserActivity(user);
        } else {
            // In other case just updates values
            userObj = new UserActivity(user, activity);
        }
        // Increase added reaction count to user who added reaction
        userObj.setReactionCount++;
        // Update activity
        updateActivity(userObj);
        // Search for message authors activity
        activityDB.findOne({
            userId: msgReaction.message.author.id
        }, (err, msgAuthorActivity) => {
            let authorObj;
            // If we found message authors activity, then
            if (msgAuthorActivity) {
                // ... create activity object
                authorObj = new UserActivity(msgReaction.message.author, msgAuthorActivity);
                // ... and increase got reaction count
                authorObj.gotReactionCount++;
            } else {
                // If message author does not have any activity, init new activity with got reaction count 1
                authorObj = new UserActivity(msgReaction.message.author, {
                    gotReactionCount: 1
                });
            }
            // Update messege authors activity
            updateActivity(authorObj);
        })
    });
});

bot.on('messageReactionRemove', (msgReaction, user) => {
    // Search for users activity, who removed a reaction
    activityDB.findOne({
        userId: user.id
    }, (err, activity) => {
        let userObj;
        // If we dont have no activity for current user, we will create it with initial values
        if (!activity) {
            userObj = new UserActivity(user);
        } else {
            // In other case just updates values
            userObj = new UserActivity(user, activity);
        }
        // Decrease added reaction count to user who removed reaction
        userObj.setReactionCount--;
        // Update activity
        updateActivity(userObj);
        // Search for message authors activity
        activityDB.findOne({
            userId: msgReaction.message.author.id
        }, (err, msgAuthorActivity) => {
            // Create authors activity object
            let authorObj = new UserActivity(msgReaction.message.author, msgAuthorActivity);
            // Decrease got reaction count
            authorObj.gotReactionCount--;
            // Update messege authors activity
            updateActivity(authorObj);
        })
    });
});

bot.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.voiceChannel;
    let oldUserChannel = oldMember.voiceChannel;
    const channel = bot.channels.find("name", "general");

    if (oldUserChannel === undefined && newUserChannel !== undefined) {
        // Search for users activity, who joined the voice channel
        activityDB.findOne({
            userId: newMember.user.id
        }, (err, activity) => {
            let userObj;
            // If we dont have no activity for current user, we will create it with initial values
            if (!activity) {
                userObj = new UserActivity(newMember.user);
            } else {
                // In other case just updates values
                userObj = new UserActivity(newMember.user, activity);
            }
            // Set voice session start time
            userObj.lastVoiceSessionStart = new Date();
            // Update activity
            updateActivity(userObj);
            // // User Joins a voice channel
            // channel.send(`user ${userObj.username} joined a channel`);
        });
        // channel.send('test');
    } else if (newUserChannel === undefined) {
        // Search for users activity, who left the voice channel
        activityDB.findOne({
            userId: oldMember.user.id
        }, (err, activity) => {
            let userObj = new UserActivity(oldMember.user, activity);
            userObj.lastVoiceSessionEnd = new Date();
            userObj.totalVoiceTime += userObj.lastVoiceSessionEnd - activity.lastVoiceSessionStart;
            updateActivity(userObj);
        });
        // // User leaves a voice channel
        // channel.send(`user ${oldMember.user.username} left a channel`);

    }
})

// Bot token
bot.login(process.env.BOT_TOKEN || "MyToken");