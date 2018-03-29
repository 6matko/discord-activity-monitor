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
        this.lastVoiceSessionStart = activity.lastVoiceSessionStart || null;
        this.lastVoiceSessionEnd = activity.lastVoiceSessionEnd || null;
        this.totalVoiceTime = activity.totalVoiceTime || 0;
        this.sentMessageCount = activity.sentMessageCount || 0;
        this.setReactionCount = activity.setReactionCount || 0;
        this.gotReactionCount = activity.gotReactionCount || 0;
    }
}

class Activity {
    constructor(guild, user, action, type) {
        this.user = {
            userId: user.id,
            username: user.username,
            avatar: user.avatar || '',
            avatarURL: user.avatarURL || '',
        };
        this.guild = {
            id: guild.id,
            name: guild.name
        }
        this.when = new Date();
        this.action = action || 'noAction';
        this.type = type || 'noType';
        this.lastVoiceSessionStart = 0;
        this.lastVoiceSessionEnd = 0;
    }
}

function getUserActivitySummary(activityList) {
    // Create user activity object with default values
    let userActivityInfo = {
        messagesAdded: 0,
        messagesRemoved: 0,
        reactionsAdded: 0,
        reactionsRemoved: 0,
        reactionsSet: 0,
        reactionsUnset: 0,
        totalVoiceTime: 0
    };

    // Walkthrough every activity and update user activity info
    // with appropriate information
    for (const activity of activityList) {
        //#region Messages
        // Count added messages
        if (activity.action === 'add' && activity.type === 'message') {
            userActivityInfo.messagesAdded++;
        }
        // Count removed messages
        if (activity.action === 'remove' && activity.type === 'message') {
            userActivityInfo.messagesRemoved++;
        }
        //#endregion

        //#region Reactions
        // Count added reactions
        if (activity.action === 'add' && activity.type === 'reaction') {
            userActivityInfo.reactionsAdded++;
        }
        // Count removed reactions
        if (activity.action === 'remove' && activity.type === 'reaction') {
            userActivityInfo.reactionsRemoved++;
        }
        // Count received reactions
        if (activity.action === 'set' && activity.type === 'reaction') {
            userActivityInfo.reactionsSet++;
        }
        // Count reactions that were taken away
        if (activity.action === 'unset' && activity.type === 'reaction') {
            userActivityInfo.reactionsUnset++;
        }
        //#endregion

        //#region Voice time
        if (activity.action === 'end' && activity.type === 'voice') {
            // Count difference between voice session start and end
            // Add this difference to voice total time
            userActivityInfo.totalVoiceTime += activity.lastVoiceSessionEnd - activity.lastVoiceSessionStart;
        }
        //#endregion
    }

    // Return information
    return userActivityInfo;
}

bot.on('ready', () => {
    console.log('bot ready');

    // Launch indexing on database
    // Using a unique constraint with the index

    // activityDB.ensureIndex({
    //     fieldName: 'userId',
    //     unique: true
    // });
});

bot.on('message', (msg) => {
    console.log(`Message [${msg.content}] was sent`);
    switch (msg.channel.type) {
        case 'text':
            const newActivity = new Activity(msg.channel.guild, msg.author, 'add', 'message');
            activityDB.insert(newActivity, (err, doc) => {
                console.log(doc);
            });
            break;
        case 'dm':
            switch (msg.content) {
                case '!me':
                    // Search for users activity, who posted a message
                    activityDB.find({
                        'user.userId': msg.author.id,
                        $not: {
                            type: 'voice',
                            action: 'start'
                        }
                    }, (err, activityList) => {
                        // If user does not have any activity, prompt it
                        if (!activityList) {
                            msg.author.send('No information');
                        } else {
                            const userInformation = getUserActivitySummary(activityList);

                            // // Prompt information about who we are showing data
                            msg.author.send(`Information about **${activityList[0].user.username}**`);
                            // // Convert MS to object with days, months, minutes and seconds
                            const totalVoiceTime = convertMS(userInformation.totalVoiceTime);
                            // Prompt total voice chat time
                            // msg.author.send(`Voice chat total time - ${totalVoiceTime.d} days, ${totalVoiceTime.h} hours, ${totalVoiceTime.m} minutes, ${totalVoiceTime.s} seconds`);
                            msg.author.send(`Voice chat total time - ${totalVoiceTime.d} days, ${totalVoiceTime.h} hours, ${totalVoiceTime.m} minutes, ${totalVoiceTime.s} seconds`);
                            // Prompt total sent message count:
                            msg.author.send(`Messages sent: ${userInformation.messagesAdded - userInformation.messagesRemoved} (**+**${userInformation.messagesAdded} | **-**${userInformation.messagesRemoved})`);
                            msg.author.send(`Reactions added: ${userInformation.reactionsAdded - userInformation.reactionsRemoved} (**+**${userInformation.reactionsAdded} | **-**${userInformation.reactionsRemoved})`);
                            msg.author.send(`Reactions received: ${userInformation.reactionsSet - userInformation.reactionsUnset} (**+**${userInformation.reactionsSet} | **-**${userInformation.reactionsUnset})`);
                            // // Prompt total added reaction count:
                            // msg.author.send(`Reactions set - ${activity.setReactionCount}`);
                            // // Prompt total got reaction count:
                            // msg.author.send(`Reactions received - ${activity.gotReactionCount}`);
                        }
                    });
                    break;
                case '!test':
                    let yesterday = new Date();
                    let startDate = new Date();
                    startDate.setDate(startDate.getDate() - 6);
                    yesterday.setDate(yesterday.getDate() - 1);

                    activityDB.find({
                            'user.userId': msg.author.id,
                            $and: [{
                                    $not: {
                                        type: 'voice',
                                        action: 'start'
                                    },
                                },
                                {
                                    when: {
                                        $gte: startDate,
                                        $lte: yesterday
                                    }
                                }
                            ]
                        },
                        (err, docs) => {
                            console.log(docs);
                        });
                    break;
            }
            break;
        default:
            break;
    }
});


bot.on('messageDelete', (msg) => {
    const newActivity = new Activity(msg.channel.guild, msg.author, 'remove', 'message');
    activityDB.insert(newActivity, (err, doc) => {
        console.log(doc);
    });
});

bot.on('messageReactionAdd', (msgReaction, user) => {
    const newActivity = new Activity(msgReaction.message.channel.guild, user, 'add', 'reaction');
    const newSecondUserActivity = new Activity(msgReaction.message.channel.guild, msgReaction.message.author, 'set', 'reaction');
    activityDB.insert([newActivity, newSecondUserActivity], (err, doc) => {
        console.log(doc);
    });
});

bot.on('messageReactionRemove', (msgReaction, user) => {
    const newActivity = new Activity(msgReaction.message.channel.guild, user, 'remove', 'reaction');
    const newSecondUserActivity = new Activity(msgReaction.message.channel.guild, msgReaction.message.author, 'unset', 'reaction');
    activityDB.insert([newActivity, newSecondUserActivity], (err, doc) => {
        console.log(doc);
    });
});

bot.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.voiceChannel;
    let oldUserChannel = oldMember.voiceChannel;

    // Voice session start
    if ((oldUserChannel === undefined && newUserChannel !== undefined) || (oldMember.selfMute === true && newMember.selfMute === false)) {
        // If user is muted, dont start the session
        if (newMember.selfMute) {
            return;
        }
        // Create new activity
        let newActivity = new Activity(newUserChannel.guild, newMember.user, 'start', 'voice');
        newActivity.lastVoiceSessionStart = new Date();
        activityDB.insert(newActivity, (err, doc) => {
            console.log(doc);
        });

        // Voice session end
    } else if (newUserChannel === undefined || (oldMember.selfMute === false && newMember.selfMute === true)) {
        // If user is muted, dont end the session because it is wasnt even started
        if (oldMember.selfMute && newMember.selfMute) {
            return;
        }
        // Create new activity
        let newActivity = new Activity(oldUserChannel.guild, oldMember.user, 'end', 'voice');
        // Search for users activity, who left the voice channel
        activityDB.update({
                $and: [{
                        'user.userId': oldMember.user.id,
                        action: 'start',
                        type: 'voice'
                    },
                    {
                        $not: {
                            lastVoiceSessionStart: 0
                        }
                    },
                    {
                        lastVoiceSessionEnd: 0
                    }
                ]
            }, {
                $set: {
                    // Set end date of voice session
                    lastVoiceSessionEnd: new Date(),
                    // Set action as "voice end" since user ended voice session
                    action: 'end',
                    // Replace actions "when" date with current date because it happened just now
                    when: new Date()
                }
            },
            (err, activity) => {
                console.log(activity);
            });
    }
})

// Bot token
bot.login(process.env.BOT_TOKEN || 'MyToken');