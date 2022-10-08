const mysql = require('mysql2/promise');
const redis = require('redis');
const request = require('request');
const { promises: fs1 } = require("fs");
const fs = require("fs");
const superagent = require('superagent');
require('dotenv').config()

const client = redis.createClient({
    url: `redis://default:${process.env.redis_pass}@${process.env.redis_ip}:${process.env.redis_port}`
});;

client.on('error', (err) => console.log('Redis Client Error', err));
client.connect();
client.select(process.env.currentdb);

module.exports = {
    init: async function () {

        let startingDate = new Date()
        console.log(`Sync starting at ${startingDate}`)

        const statDataLoc = 'public/ressources/json/stat_list.json';
        let rawData = await fs1.readFile(statDataLoc);
        globalThis.statListData = await JSON.parse(rawData);

        globalThis.GIBdb = await mysql.createConnection({
            host: process.env.gibdbHost,
            user: process.env.gibdbUser,
            password: process.env.gibdbPass,
            port: process.env.gibdbPort
        });

        GIBdb.connect()

        let playerData = await APIrequest('player/list')
        let APIplayerList = playerData['players']
        let APIplayerCount = playerData['count']

        console.log("\x1b[30m\x1b[47m", 'START OF PLAYER DATA UPDATE', '\x1b[0m')

        await updatePlayerData(APIplayerList)

        console.log("\x1b[30m\x1b[47m", 'START OF PLAYER SESSION UPDATE', '\x1b[0m')

        await updatePlayerSession()

        console.log("\x1b[30m\x1b[47m", 'START OF ADVANCEMENT DATA UPDATE', '\x1b[0m')

        await updateVanillaAdvancement()
        await updateCustomAdvancement()

        console.log("\x1b[30m\x1b[47m", 'START OF STAT DATA UPDATE', '\x1b[0m')

        await updateTimeStats()

        console.log("\x1b[30m\x1b[47m", 'START OF CLASS DATA UPDATE', '\x1b[0m')

        await updateClass()

        console.log("\x1b[30m\x1b[47m", 'CHECKING DAILY STAT', '\x1b[0m')

        await sdjCheck()

        let endDate = new Date()

        await client.HSET('sync', 'lastAllSyncDate', JSON.stringify(endDate))

        console.log("\x1b[32m", `Data refresh finished in ${((endDate - startingDate)/1000).toFixed(2)} sec`, '\x1b[0m')
    },
    getPlaytime: async function (playerIDType) {

        let playtimeData = {}
        let playerList = await getRedisPlayerList()
        let playerListEntries = Object.entries(playerList)
        for (let [playerLONG, playerData] of playerListEntries) {

            let playerUUID = playerData.uuid
            let IDTypeComp = {'id':playerLONG, 'uuid':playerUUID}
            let playerServerPlaytime = await APIrequest(`player/${playerLONG}/playtime`)
            playtimeData[IDTypeComp[playerIDType]] = playerServerPlaytime["playTime"][process.env.currentServer]
        }

        return playtimeData
    },
    getOnlineState: async function (playerIDType) {

        let onlineData = {}
        let playerList = await getRedisPlayerList()
        let playerListEntries = Object.entries(playerList)
        for (let [playerLONG, playerData] of playerListEntries) {

            let playerUUID = playerData.uuid
            let IDTypeComp = {'id':playerLONG, 'uuid':playerUUID}
            let playerServerOnlineRaw = await APIrequest(`player/${playerLONG}/session/latest`)

            onlineData[IDTypeComp[playerIDType]] = ((playerServerOnlineRaw["endedAt"] == null && playerServerOnlineRaw.serverName == process.env.currentServer) ? true:false)             
        }

        return onlineData
    },
    getServerState: async function () {

        let latestServerInfo = await APIrequest(`server/${process.env.currentServer}/infos/latest`)
        let serverLatestDateUpdate = new Date(latestServerInfo['createdAt'])
        let dateNow = new Date()
        let isOnline = false
        if ((serverLatestDateUpdate - dateNow) < 30000) isOnline = true
        return isOnline
    }
};

const APIrequest = async (arg) => {

    let path = `https://api.gameinbox.eu/api/${arg}?token=${process.env.gibAPIToken}`
    try {

        const response = await superagent.get(path);
        return response.body

    } catch (error) {

        console.log(error.response.body);
    }
}

const skinDownload = (uri, filename, callback) => {
    request.head(uri, () => {
        try { request(uri).pipe(fs.createWriteStream(filename)).on('close', callback) }
        catch(err) { console.error(err) }
    });
};

const getRedisPlayerList = async () => {

    var player_keys = await client.sendCommand(['keys', "player:*"])
    var player_data = {}

    for (keys of player_keys) {

        let playerUUID = keys.split(':')[1]
        let temp_player_data = await client.sendCommand(['hmget', `${keys}`, 'lastName', 'id']) 
        
        player_data[temp_player_data[1]] = {}
        player_data[temp_player_data[1]]['name'] = temp_player_data[0]
        player_data[temp_player_data[1]]['uuid'] = playerUUID
    }  

    return player_data
}

const getStatNeed = (sqlStatID) => {

    redisStatID = []
    for (let [,statListArray] of Object.entries(statListData.statistiques)) {
        for (let statData of statListArray) {
            if (statData.dbStatID === sqlStatID) {
                redisStatID.push({
                    'id':statData.id,
                    'wantNumber':statData.wantNumber  
                })
            }
        }
    }
    return redisStatID
}

const selectTopOfOtherStat = async () => {

    let rawStatList = (await client.KEYS('rawstat:*')).sort()
    let savedLast = {}

    for (let rawStatRedisKey of rawStatList) {

        let statID = rawStatRedisKey.split(':')[1]
        let statMonthDate = rawStatRedisKey.split(':')[2]

        if (savedLast[statID] === undefined) {
            let rawStatData = await client.HGETALL(`${rawStatRedisKey}`)
            let rawStatDataEntries = Object.entries(rawStatData)
            let statMax = {}

            console.log(`Checking stat ${statID}`)

            for (let [itemName,] of rawStatDataEntries) {

                let lastValue = await getLastValue('rawstat', statID, itemName, false)
                statMax[itemName] = lastValue
            }

            let statMaxEntries = Object.entries(statMax);

            statMaxEntries.sort(function(a, b) {
                return b[1] - a[1];
            });

            statMax = statMaxEntries.slice(0, 25)
            nameList = [] 

            for (let [itemName,value] of statMax) {
                nameList.push(itemName)
                let rawValue = await client.HGET(`rawstat:${statID}:${statMonthDate}`, `${itemName}`)
                await client.HSET(`stat:${statID}:${statMonthDate}`, `${itemName}`, `${rawValue}`)
            }

            let currentKey = await client.HGETALL(`stat:${statID}:${statMonthDate}`)
            let currentKeyEntries = Object.entries(currentKey)
            for (let [itemName,] of currentKeyEntries) {
                
                if (!nameList.includes(itemName)) {
                    await client.HDEL(`stat:${statID}:${statMonthDate}`, `${itemName}`)
                    console.log("\x1b[31m", `Delete stat ${statID} ${itemName} (no longer in top25)`, '\x1b[0m')
                }
            }  
            
            savedLast[statID] = nameList
        }

        else {
            for (let itemName of savedLast[statID]) {
                let rawValue = await client.HGET(`rawstat:${statID}:${statMonthDate}`, `${itemName}`)
                if (rawValue !== null) await client.HSET(`stat:${statID}:${statMonthDate}`, `${itemName}`, `${rawValue}`)
            } 
        }
    }
}

const getLastValue = async (pre, statID, itemID, except, firstV) => {

    let lastValue
    let redisLKeys = await client.KEYS(`${pre}:${statID}:*`)
    if (redisLKeys.length != 0) {
        let redisLkeysSort = (redisLKeys.map(x => new Date(((x.split(':')[2]).split('T'))[0]))).sort((a,b) => {return new Date(b) - new Date(a)})

        let i = except ? 1 : 0
        let lastestDateKey = ((JSON.stringify(redisLkeysSort[i])).split(':')[0]).replace('"', '')
        
        let extractValue = async (Rkey) => {
            let lastestStatValue = await client.HGET(`${pre}:${statID}:${Rkey}`, `${itemID}`)
            
            if (lastestStatValue === null) {
                i ++
                if (i < redisLKeys.length) await extractValue(((JSON.stringify(redisLkeysSort[i])).split(':')[0]).replace('"', ''))
                else lastValue = 0
            }

            else {
                if (Object.keys(JSON.parse(lastestStatValue)).length === 0) lastValue = 0
                else {
                    let latestValueEntries = Object.entries(JSON.parse(lastestStatValue))
                    let lastValueEntry = latestValueEntries.pop()
                    lastValue = firstV != null ? [lastValueEntry[0], lastValueEntry[1]] : lastValueEntry[1]                 
                }
        
            }
        }  
        
        await extractValue(lastestDateKey)      
    }
    else (lastValue = 0)

    return lastValue  
}

// MAIN FUNCTION

const updatePlayerData = async (APIplayerList) => {

    // créé une liste de tout les uuid des joueurs présent sur le redis
    let redisPlayersKeys = await client.sendCommand(['keys', `player:*`])
    let redisRegisterPlayerUUID = []
    for (let key of redisPlayersKeys) {
        redisRegisterPlayerUUID.push(key.split(':')[1])
    }

    let sqlRequest = `SELECT player_id, claims_color FROM survival.survival_profiles`
    let playerColorsRaw = (await GIBdb.execute(sqlRequest))[0]
    let playerColors = {}
    for (let uPlayerColors of playerColorsRaw) {
        playerColors[uPlayerColors.player_id] = uPlayerColors.claims_color
    }

    sqlRequest = `SELECT * FROM survival.player_bases`
    let playerBasesRaw = (await GIBdb.execute(sqlRequest))[0]
    let playerBases = {}
    for (let uPlayerBases of playerBasesRaw) {
        if (uPlayerBases.deleted_at == null) {
            let xyz = {}
            xyz['x'] = uPlayerBases.location_x
            xyz['y'] = uPlayerBases.location_y
            xyz['z'] = uPlayerBases.location_z
            playerBases[uPlayerBases.player_id] = JSON.stringify(xyz)
        }
    }

    let APIplayerListEntries = Object.entries(APIplayerList)
    for (let [APIplayerID, APIplayerUUID] of APIplayerListEntries) {

        let APIPlayerData = await APIrequest(`player/${APIplayerUUID}`)
        APIPlayerData['color'] = playerColors[APIplayerID]
        APIPlayerData['base'] = playerBases[APIplayerID]
        let APIPlayerDataEntries = Object.entries(APIPlayerData)
        let playerPlaytime = (await APIrequest(`player/${APIplayerID}/playtime`))['playTime'][process.env.currentServer]

        // regarde si le joueur est dans le redis
        if (!redisRegisterPlayerUUID.includes(APIplayerUUID) && playerPlaytime != undefined) {

            for (let [catName, value] of APIPlayerDataEntries) {

                await client.HSET(`player:${APIplayerUUID}`, `${catName}`, `${value}`)
            }

            // download his skin
            skinDownload(`https://crafatar.com/renders/body/${APIplayerUUID}`, `public/ressources/players_render/${APIplayerUUID}.png`, 
                    function(){console.log("\x1b[32m", `${APIplayerUUID}.png downloaded`)}, '\x1b[0m');

            console.log("\x1b[32m", `Upload player ${APIPlayerData.lastName}`, '\x1b[0m')
        }

        // verifie et actualise si possible les données du joueur
        else {  if (playerPlaytime != undefined) {
            console.log(`Checking data of ${APIPlayerData.lastName}`)

            // download his skin
            skinDownload(`https://crafatar.com/renders/body/${APIplayerUUID}`, `public/ressources/players_render/${APIplayerUUID}.png`, 
            function(){console.log("\x1b[32m", `${APIplayerUUID}.png downloaded`)}, '\x1b[0m');

            let redisActualPlayerData = await client.HGETALL(`player:${APIplayerUUID}`)
            let redisActualPlayerDataEntries = Object.entries(redisActualPlayerData)
            for (let [redisType, redisValue] of redisActualPlayerDataEntries) {

                if (String(APIPlayerData[redisType]) != redisValue) {

                    await client.HSET(`player:${APIplayerUUID}`, `${redisType}`, `${APIPlayerData[redisType]}`)
                    console.log("\x1b[32m", `Change ${redisType} value from ${redisValue} to ${APIPlayerData[redisType]} of ${APIPlayerData.lastName}`, '\x1b[0m')
                }
            }   
        }   }
    }
}

const updatePlayerSession = async () => {

    let redisPlayerList = await getRedisPlayerList()
    let redisPlayerListEntries = Object.entries(redisPlayerList)
    let currentMonthDate = JSON.stringify(new Date()).substring(1, 8) + '-01T00'
    let lastRefreshMonth = (await client.HGET('sync', 'lastAllSyncDate')).substring(1, 8) + '-01T00'
    let AllNewSessionCounter = 0

    let buildSessionOneMonth = async (MonthDate) => {
        for (let [playerLONG, playerData] of redisPlayerListEntries) {

            console.log(`Checking session of ${playerData.name}`)

            let lastValue
            let newRedisValue
            let currentRedisValue = await client.HGET(`stat:0002:${MonthDate}`, `${playerData.uuid}`)

            if (currentRedisValue === null) {

                await client.HSET(`stat:0002:${MonthDate}`, `temp`, `temp`)

                newRedisValue = {}
                let redisLKeys = await client.KEYS(`stat:0002:*`)
        
                if (redisLKeys.length <= 1) {
                    lastValue = ['2000-01-01T00:00:00.000Z', 'session_closed']
                }
                else {
                    lastValue = await getLastValue('stat', '0002', playerData.uuid, true, true)
                    if (lastValue == 0) lastValue = ['2000-01-01T00:00:00.000Z', 'session_closed']
                }

                await client.HDEL(`stat:0002:${MonthDate}`, `temp`)
            }
            else {
                newRedisValue = JSON.parse(currentRedisValue)
                let currentRedisValueEntries = Object.entries(newRedisValue)
                if (currentRedisValueEntries.length !== 0) {
                    let lastValueEntry = currentRedisValueEntries.pop()
                    lastValue = [lastValueEntry[0], lastValueEntry[1]]                
                }
                else {
                    lastValue = await getLastValue('stat', '0002', playerData.uuid, true, true)
                }

            }

            let lastSessionDate = lastValue[0]
            let lastSessionState = lastValue[1]
            let newSessionCounter = 0
            let maxMonth = new Date(new Date(MonthDate + ':00:00.000Z').setMonth(new Date(MonthDate + ':00:00.000Z').getMonth() + 1))

            if (new Date() - new Date(lastSessionDate) > 3600000) {
                let allSessionData = await APIrequest(`player/${playerLONG}/sessions`)
                for (let [,sessionArray] of Object.entries(allSessionData)) {
                    for (let uSession of sessionArray) {
                        if (new Date(uSession.startedAt) >= new Date(lastSessionDate) && uSession.serverName === process.env.currentServer && new Date(uSession.startedAt) <= maxMonth) {

                            newSessionCounter ++
                            newRedisValue[uSession.startedAt] = 'session_openned'
                            if (uSession.endedAt != null) newRedisValue[uSession.endedAt] = 'session_closed'
                        }
                    }
                }
            }

            else {
                let SessionData1h = await APIrequest(`player/${playerLONG}/sessions/hour`)
                for (let [,sessionArray] of Object.entries(SessionData1h)) {
                    for (let uSession of sessionArray) {
                        if (new Date(uSession.startedAt) >= new Date(lastSessionDate) && uSession.serverName === process.env.currentServer && new Date(uSession.startedAt) <= maxMonth) {

                            newSessionCounter ++
                            newRedisValue[uSession.startedAt] = 'session_openned'
                            if (uSession.endedAt != null) newRedisValue[uSession.endedAt] = 'session_closed'
                        }
                    }
                }
            }

            if (newSessionCounter !== 0) console.log("\x1b[32m", `Uploaded ${newSessionCounter} new session`, '\x1b[0m')
            
            await client.HSET(`stat:0002:${MonthDate}`, `${playerData.uuid}`, `${JSON.stringify(newRedisValue)}`)
        
            AllNewSessionCounter += newSessionCounter
        }        
    }

    if (currentMonthDate === lastRefreshMonth) await buildSessionOneMonth(currentMonthDate)
    else {
        let startMonth = lastRefreshMonth.substring(5, 7)
        let endMonth = currentMonthDate.substring(5, 7)
        for (let month = startMonth; month <= endMonth; month ++) {
            month = String(month)
            if (month.length === 1) month = '0' + month
            await buildSessionOneMonth(`2022-${month}-01T00`)
        }
    }

    await buildPlayerActivityDatasets()
}

const buildPlayerActivityDatasets = async () => {

    console.log("\x1b[30m\x1b[47m", 'START BUILDING PLAYER ACTIVITY DATASET', '\x1b[0m')

    let allKeys = await client.KEYS('stat:0002:*')
    let toDateKeys = allKeys.map(x => new Date(x.split(':')[2] + ':00:00.000Z'))
    let dateKeysSorted = toDateKeys.sort((a, b) => a - b)
    let datasetAllTime = []
    let allPlayerActivityRaw = []
    let lastValue = 0
    let lastavgdata = null
    let topAver = 0
    let totTime = 0

    for (let dateKeys of dateKeysSorted) {

        let key = (JSON.stringify(dateKeys).split(':')[0]).replace('"', '')

        let data = await client.HGETALL('stat:0002:' + key)
        let dataEntries = Object.entries(data)

        for (let [, value] of dataEntries) {

            let valueEntries = Object.entries(JSON.parse(value))
            for (let [date, sessionstate] of valueEntries) {

                let sessionData = {}
                sessionData[date] = sessionstate

                allPlayerActivityRaw.push(sessionData)
            }
        }
    }

    const compareDate = ( a, b ) => {
        let date1 = new Date(Object.keys(a)[0])
        let date2 = new Date(Object.keys(b)[0])
        if ( date1 < date2 ) return -1;
        if ( date1 > date2 ) return 1;
        return 0;
    }

    allPlayerActivityRaw.sort(compareDate)

    for (let elt of allPlayerActivityRaw) {

        let eltEntries = Object.entries(elt)[0]

        let last24hDate = new Date(new Date().setDate(new Date().getDate() - 1))

        let newXY = {}
        newXY['x'] = eltEntries[0]
        newXY['y'] = (eltEntries[1] === 'session_closed' ? lastValue += -1 : lastValue += 1)
        datasetAllTime.push(newXY)

        if (last24hDate < new Date(eltEntries[0])) {
            if (lastavgdata === null) lastavgdata = [eltEntries[0], lastValue]
            else {
                let timeElapse = new Date(eltEntries[0]) - new Date(lastavgdata[0])
                topAver += timeElapse * lastavgdata[1]
                totTime += timeElapse
                lastavgdata = [eltEntries[0], lastValue]
            }
        }
    }

    await client.HSET('perf:average', 'player24h', (topAver/totTime).toFixed(2))
    await client.SET('playerActivity', JSON.stringify(datasetAllTime))

    console.log("\x1b[32m", `Uploaded ${allPlayerActivityRaw.length} unique session activity`, '\x1b[0m')

}

const updateTimeStats = async () => {

    let timeStatsLastSync = await client.HGET('sync', 'timeStatsLastSync')
    let sqlRequest = `select * from survival.time_stats where pushed_at > '${timeStatsLastSync}'`
    let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]
    let playerList = await getRedisPlayerList()
    let maxDate = timeStatsLastSync

    console.log(`${newSQLTimeStatArray.length} new element`)

    for (let newSQLTimeStat of newSQLTimeStatArray) {

        redisStatIDArray = await getStatNeed(newSQLTimeStat.stat_id)
        if (new Date(maxDate) < new Date(newSQLTimeStat.pushed_at)) maxDate = newSQLTimeStat.pushed_at

        for (let redisStatID of redisStatIDArray) {

            if (redisStatID.wantNumber) await constructRelativeToPlayerStat(redisStatID.id, newSQLTimeStat, playerList)
            else await constructRelativeToOtherStat(redisStatID.id, newSQLTimeStat)
        }
    }

    console.log("\x1b[30m\x1b[47m", 'START OF TOP STAT SELECTION', '\x1b[0m')

    await selectTopOfOtherStat()

    maxConvert = new Date(new Date(maxDate).setHours(new Date(maxDate).getHours()))
    await client.HSET('sync', 'timeStatsLastSync', `${maxConvert.toISOString().slice(0, 19).replace('T', ' ')}`)
}

const constructRelativeToPlayerStat = async (statID, SQLdata, playerList) => {

    console.log(`Processing of stat ${statID} (relative to player)`)

    let playerUUID = (playerList[SQLdata.player_id]).uuid
    let statMonthDate = (JSON.stringify(SQLdata.created_at)).substring(1, 8) + '-01T00'

    let currentRedisValue = await client.HGET(`stat:${statID}:${statMonthDate}`, `${playerUUID}`)

    let lastValue
    let newRedisValue
    if (currentRedisValue === null) {

        await client.HSET(`stat:${statID}:${statMonthDate}`, `temp`, `temp`)

        newRedisValue = {}
        let redisLKeys = await client.KEYS(`stat:${statID}:*`)

        if (redisLKeys.length <= 1) {
            lastValue = 0
        }
        else {
            lastValue = await getLastValue('stat', statID, playerUUID, true)
        }
        newRedisValue[JSON.stringify(new Date(new Date(SQLdata.created_at).setMinutes(new Date(SQLdata.created_at).getMinutes() -15)))] = lastValue
        
        await client.HDEL(`stat:${statID}:${statMonthDate}`, `temp`)
    }
    else {
        newRedisValue = JSON.parse(currentRedisValue)
        let currentRedisValueEntries = Object.entries(newRedisValue)
        if (currentRedisValueEntries.length !== 0) {
            lastValue = (currentRedisValueEntries.pop())[1]                    
        }
        else {
            lastValue = (await getLastValue('stat', statID, playerUUID, true))
        }
    }

    newRedisValue[JSON.stringify(SQLdata.created_at)] = lastValue + SQLdata.value

    await client.HSET(`stat:${statID}:${statMonthDate}`, `${playerUUID}`, `${JSON.stringify(newRedisValue)}`)
}

const constructRelativeToOtherStat = async (statID, SQLdata) => {

    console.log(`Processing of stat ${statID} (relative to other)`)

    let statMonthDate = (JSON.stringify(SQLdata.created_at)).substring(1, 8) + '-01T00'
    let content = JSON.parse(SQLdata.content)

    for (let [, contentData] of Object.entries(content)) {

        let contentDataEntries = Object.entries(contentData)
        for (let [itemName, itemValue] of contentDataEntries) {

            const manageItemValue = async (Iname, Ivalue) => {

                if (typeof Ivalue === 'object') {
                    await manageItemValue(Object.entries(Ivalue)[0][0],Object.entries(Ivalue)[0][1])
                }
                else {
                    let currentRedisValue = await client.HGET(`rawstat:${statID}:${statMonthDate}`, `${Iname}`)
                    let lastValue
                    let newRedisValue
    
                    if (currentRedisValue === null) {

                        await client.HSET(`rawstat:${statID}:${statMonthDate}`, `temp`, `temp`)
    
                        newRedisValue = {}
                        let redisLKeys = await client.KEYS(`rawstat:${statID}:*`)
    
                        if (redisLKeys.length <= 1) {
                            lastValue = 0
                        }
                        else {
                            lastValue = await getLastValue('rawstat', statID, Iname, true)
                        }
                        newRedisValue[JSON.stringify(new Date(new Date(SQLdata.created_at).setMinutes(new Date(SQLdata.created_at).getMinutes() -15)))] = lastValue
                        await client.HDEL(`rawstat:${statID}:${statMonthDate}`, `temp`)
                    }
                    else {

                        newRedisValue = JSON.parse(currentRedisValue)
                        let currentRedisValueEntries = Object.entries(newRedisValue)
                        if (currentRedisValueEntries.length !== 0) {
                            lastValue = (currentRedisValueEntries.pop())[1]                    
                        }
                        else {
                            lastValue = await getLastValue('rawstat', statID, Iname, true)
                        }
                    }   

                    newRedisValue[JSON.stringify(SQLdata.created_at)] = lastValue + Ivalue

                    await client.HSET(`rawstat:${statID}:${statMonthDate}`, `${Iname}`, `${JSON.stringify(newRedisValue)}`)
                }             
            }

            await manageItemValue(itemName, itemValue)
        }
    }
}

const updateClass = async () => {

    classListData = statListData.classements
    let playerList = await getRedisPlayerList()

    for (let [,classListArray] of Object.entries(classListData)) {

        for (let classData of classListArray) {

            console.log(`Checking classement titled: ${classData.title}`)

            let relatedStatID = classData.stat
            let classID = classData.id

            if (relatedStatID !== null) await updateExistingDataClass(relatedStatID, classID, playerList)
            else {

                let recoltType = classData.recoltType

                if (recoltType === "timePlay") await createTimePlayClass(classID)
                if (recoltType === "dbvalue") await createDBValueClass(classID, classData.dbStatID, playerList)
                if (recoltType === "lastDeathTime") await createLastDeathClass(classID, playerList)
                if (recoltType === "groundDistance") await createGroundDistanceClass(classID, playerList)
                // if (recoltType === "afktime") await createAFKTimeClass(classID, playerList)
                if (recoltType === "achievement") await createAchievementClass(classID, playerList)
                if (recoltType === "elytra") await createElytraClass(classID, playerList)
                if (recoltType === "time") await createTimeClass(classID, playerList)
            }
        }
    }
}

const updateExistingDataClass = async (relatedStatID, classID, playerList) => {

    playerListEntries = Object.entries(playerList)
    for (let [, pdata] of playerListEntries) {

        pUUID = pdata.uuid
        lastValue = await getLastValue('stat', relatedStatID, pUUID, false, null)
        await client.HSET(`stat:${classID}`, `${pUUID}`, lastValue)
    }
}

const createTimePlayClass = async (classID) => {

    let playTime = await module.exports.getPlaytime('uuid')
    let playerList = await getRedisPlayerList()
    let afktime = await createAFKTimeClass('1107', playerList)
    let playTimeEntries = Object.entries(playTime)

    for (let [playerUUID, playerPlayTime] of playTimeEntries) {
        playerPlayTimeH = ((playerPlayTime / 3600) - afktime[playerUUID]).toFixed(2);
        await client.HSET(`stat:${classID}`, `${playerUUID}`, playerPlayTimeH)
    }
}

const createDBValueClass = async (classID, dbID, playerList) => {

    let sqlRequest = `SELECT sum(value) as value, player_id FROM survival.time_stats where stat_id = ${dbID} group by player_id`
    let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]

    for (let playerStat of newSQLTimeStatArray) {

        if (playerList[playerStat.player_id] !== undefined) {
            let pUUID = playerList[playerStat.player_id].uuid
            let pValue = playerStat.value

            await client.HSET(`stat:${classID}`, `${pUUID}`, pValue)            
        }
    }
}

const createLastDeathClass = async (classID, playerList) => {

    let sqlRequest = `SELECT MAX(created_at) as max, player_id FROM survival.time_stats where stat_id = 9 group by player_id`
    let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]
    let SQLdataEntries = Object.entries(newSQLTimeStatArray)
    let playerListEntries = Object.entries(playerList)
    let playTime = await module.exports.getPlaytime('id')

    for (let [pLONG, pData] of playerListEntries) {

        let pUUID = pData.uuid
        let elapsedTime = 0
        for (let [, pdata] of SQLdataEntries) {

            if (pdata.player_id == pLONG) {

                let lastDeathDate = pdata.max
                let sessionDataList = (await APIrequest(`player/${pLONG}/sessions`)).sessions
                for (let sessionData of sessionDataList) {
        
                    let start = new Date(new Date(sessionData.startedAt).setHours(new Date(sessionData.startedAt).getHours() + 1 ))
                    let end = sessionData.endedAt == null ? new Date(new Date().setHours(new Date().getHours() + 1 )) : new Date(new Date(sessionData.endedAt).setHours(new Date(sessionData.endedAt).getHours() + 1 ))

                    if (end > new Date(lastDeathDate) && end > new Date(process.env.currentServerOpenDate) && sessionData.serverName === process.env.currentServer) {

                        if (start > new Date(lastDeathDate)) elapsedTime += (end - start)
                        else elapsedTime += (end - new Date(lastDeathDate))
                    }
                }
            }
        }

        if (elapsedTime === 0) elapsedTime = playTime[pLONG]*1000

        await client.HSET(`stat:${classID}`, `${pUUID}`, (elapsedTime / 3600000).toFixed(2))
    }
}

const createGroundDistanceClass = async (classID, playerList) => {

    let playerListEntries = Object.entries(playerList)
    let lastTimeSync = await client.HGET('sync', 'timePlayerPositionLastSync')
    let playerLastPosition = JSON.parse(await client.HGET('sync', 'playerLastPosition'))
    let newSyncTime = new Date((new Date().setHours(new Date().getHours()+1))).toISOString().slice(0, 19).replace('T', ' ');

    for (let [playerLONG, playerData] of playerListEntries) {

        let playerDistanceTotal
        let PreviousData = await client.HGET(`stat:${classID}`, playerData.uuid)

        if (PreviousData === null) playerDistanceTotal = 0
        else playerDistanceTotal = parseFloat(PreviousData)

        let lastPosition = {}
        lastPosition['x'] = (playerLastPosition[playerLONG] === undefined ? 0 : playerLastPosition[playerLONG]['x'])
        lastPosition['z'] = (playerLastPosition[playerLONG] === undefined ? 0 : playerLastPosition[playerLONG]['z'])

        let sqlRequest = `SELECT x,z FROM survival.movement_stats where player_id = ${playerLONG} and created_at between '${lastTimeSync}' and '${newSyncTime}'`
        let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]

        for (let movementData of newSQLTimeStatArray) {

            let x1 = movementData.x
            let z1 = movementData.z
            let x2 = lastPosition['x']
            let z2 = lastPosition['z']

            let distance = Math.sqrt(Math.pow((x1-x2), 2) + Math.pow((z1-z2), 2))
            playerDistanceTotal += distance

            lastPosition['x'] = x1
            lastPosition['z'] = z1
        }

        playerLastPosition[playerLONG] = {}
        playerLastPosition[playerLONG]['x'] = lastPosition['x']
        playerLastPosition[playerLONG]['z'] = lastPosition['z']

        await client.HSET(`stat:${classID}`, playerData.uuid, playerDistanceTotal.toFixed(2))
    }

    await client.HSET('sync', 'timePlayerPositionLastSync', newSyncTime)
    await client.HSET('sync', 'playerLastPosition', JSON.stringify(playerLastPosition))
}

const createAFKTimeClass = async (classID, playerList) => {

    let playerListEntries = Object.entries(playerList)
    let sqlRequest = `SELECT player_id, begin_time, ending_time FROM survival.afk_stats`
    let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]
    let playerAFKTime = {}

    for (let [, playerData] of playerListEntries) {
        playerAFKTime[playerData.uuid] = 0
    }

    for (let afksession of newSQLTimeStatArray) {

        if (!isNaN(afksession.ending_time) && afksession.ending_time!= null) {

            if (playerList[afksession.player_id] !== undefined) {
                let puuid = playerList[afksession.player_id].uuid
                playerAFKTime[puuid] += parseFloat(((afksession.ending_time - afksession.begin_time) / 3600000))
            }
            
        }
    }

    let playerAFKTimeEntries = Object.entries(playerAFKTime)
    for (let [uuid,value] of playerAFKTimeEntries) {
        await client.HSET(`stat:${classID}`, uuid, value.toFixed(2))
    }

    return playerAFKTime
}

const createAchievementClass = async (classID, playerList) => {

    let classData = {}
    let playerListEntries = Object.entries(playerList)
    for (let [,pData] of playerListEntries) {
        classData[pData.uuid] = 0
    }

    let allAdvKey = await client.KEYS('stat:advancement:*')
    for (let advKey of allAdvKey) {

        let advData = await client.HGETALL(advKey)
        let advDataEntries = Object.entries(advData)
        for (let [pUUID,] of advDataEntries) {
            classData[pUUID] += 1
        }
    }

    let classDataEntries = Object.entries(classData)
    for (let [pUUID,value] of classDataEntries) {
        await client.HSET(`stat:${classID}`, pUUID, value)
    }
}

const createElytraClass = async (classID, playerList) => {

    let playerListEntries = Object.entries(playerList)
    let sqlRequest = `SELECT * FROM survival.time_stats where stat_id = 11`
    let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]
    let playerElytraDistance = {}

    for (let [, playerData] of playerListEntries) {
        playerElytraDistance[playerData.uuid] = 0
    }

    for (let elytradata of newSQLTimeStatArray) {
        for (let distance of JSON.parse(elytradata.content).distances) {
            playerElytraDistance[playerList[elytradata.player_id].uuid] += distance
        }
    }

    let playerElytraDistanceEntries = Object.entries(playerElytraDistance)
    for (let [uuid,value] of playerElytraDistanceEntries) {
        await client.HSET(`stat:${classID}`, uuid, (value/100).toFixed(2))
    }
}

const createTimeClass = async (classID, playerList) => {

    let playerListEntries = Object.entries(playerList)
    let sqlRequest = `SELECT * FROM survival.time_stats where stat_id = 8 and content is not null`
    let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]
    let playerSneakTime = {}

    for (let [, playerData] of playerListEntries) {
        playerSneakTime[playerData.uuid] = 0
    }

    for (let sneakdata of newSQLTimeStatArray) {
        for (let stime of JSON.parse(sneakdata.content).time) {
            if (sneakdata.player_id !== undefined) playerSneakTime[playerList[sneakdata.player_id].uuid] += stime 
        }
    }

    let playerSneakTimeEntries = Object.entries(playerSneakTime)
    for (let [uuid,value] of playerSneakTimeEntries) {
        await client.HSET(`stat:${classID}`, uuid, (parseFloat(value)/60000).toFixed(2))
    }
}

const updateVanillaAdvancement = async () => {

    console.log('Checking Vanilla Advancement')

    let playerList = await getRedisPlayerList()
    let sqlRequest = `SELECT player_id, content, created_at FROM survival.time_stats where stat_id = 10`
    let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]

    for (let achievementData of newSQLTimeStatArray) {

        if (playerList[achievementData.player_id] !== undefined) {
            let pUUID = (playerList[achievementData.player_id]).uuid
            let playerAchievementList = (JSON.parse(achievementData.content))["achievements"]
            for (let uAchievement of playerAchievementList) {

                let achievementCat = (uAchievement.split('/')[0]).split(':')[1]
                let achievementID = uAchievement.split('/')[1]

                if (achievementCat !== 'recipes') {

                    await client.HSET(`stat:advancement:${achievementCat}:${achievementID}`, pUUID, JSON.stringify(achievementData.created_at))
                }
            }            
        }

    }
}

const updateCustomAdvancement = async () => {

    console.log('Checking Custom Advancement')

    let playerList = await getRedisPlayerList()
    let sqlRequest = `SELECT player_id, achievement_id, created_at FROM survival.completed_achievements;`
    let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]

    for (let achievementData of newSQLTimeStatArray) {

        if (playerList[achievementData.player_id] !== undefined) {
            let pUUID = (playerList[achievementData.player_id]).uuid
            let achievementID = achievementData.achievement_id
            await client.HSET(`stat:advancement:custom:${achievementID}`, pUUID, JSON.stringify(achievementData.created_at))            
        }
    }

    sqlRequest = `SELECT player_id, achievement_id, created_at FROM survival.current_tiers;`
    newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]

    for (let achievementData of newSQLTimeStatArray) {

        if (playerList[achievementData.player_id] !== undefined) {
            let pUUID = (playerList[achievementData.player_id]).uuid
            let achievementID = achievementData.achievement_id
            await client.HSET(`stat:advancement:custom:${achievementID}`, pUUID, JSON.stringify(achievementData.created_at))            
        }
    }

}

const sdjCheck = async () => {

    let lastDate = (await client.HGET('sync', 'lastDateDailyStat'))
    let lastDay = new Date(JSON.parse(lastDate)).getDate()
    let nowDay = new Date().getDate()

    if (lastDay != nowDay) {
        let currentStatID = await client.GET('sdj')
        let possibleID = ['1001','1002','1003','1106','1101','1102','1110','1103','1104','1105','1109','1107']
        
        const getRElement = () => {
            let newClassID = possibleID[Math.floor(Math.random()*possibleID.length)]
            if (newClassID === currentStatID) newClassID = getRElement()
            return newClassID
        }

        let newID = getRElement()

        await client.SET('sdj', newID)
        await client.HSET('sync', 'lastDateDailyStat', JSON.stringify(new Date()))

        console.log(`Update from ${currentStatID} to ${newID}`)
    }

    else console.log('No change needed')
}