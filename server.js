require('dotenv').config()
const express = require('express');
const superagent = require('superagent');
const http = require('http');
const { Server, Socket } = require("socket.io");
const { promises: fs1 } = require("fs");
const redis = require('redis');
const compress = require('compression');
const jp = require('jsonpath');
const mysql = require('mysql2/promise');
const { collectDefaultMetrics, register } = require('prom-client') ;
collectDefaultMetrics();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const routes = require('./routes');
const sync = require('./15MINUTESREFRESHANDTHENWHAT.js')

// Initialise les routes
app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(err);
    }
  });
  
app.listen(4001, '0.0.0.0');
app.set("view engine", "ejs");
app.use(compress())
app.use(express.static("public"));
routes(app)

var temp_data = {'online_player':'8', 'tps_now':'14.68', 'evolution':"-22"}

// CONNECT REDIS
const client = redis.createClient({
    url: `redis://default:${process.env.redis_pass}@${process.env.redis_ip}:${process.env.redis_port}`
});;

client.on('error', (err) => console.log('Redis Client Error', err));
client.connect();
client.select(process.env.currentdb);


//READ JSON DATA

(async () => {

    globalThis.GIBdb = await mysql.createConnection({
        host: process.env.gibdbHost,
        user: process.env.gibdbUser,
        password: process.env.gibdbPass,
        port: process.env.gibdbPort
    });

    GIBdb.connect()

    const stat_data_loc = 'public/ressources/json/stat_list.json';
    let rawdata = await fs1.readFile(stat_data_loc);
    globalThis.stat_data = await JSON.parse(rawdata);

    const texturesloc = 'public/ressources/json/textures.json';
    rawdata = await fs1.readFile(texturesloc);
    globalThis.blockstextures = await JSON.parse(rawdata);

    const textures_loc = 'public/ressources/textures/minecraft_block_entity.json';
    rawdata = await fs1.readFile(textures_loc);
    globalThis.textures = await JSON.parse(rawdata);

    const advancementData = 'public/ressources/json/advancement.json';
    rawdata = await fs1.readFile(advancementData);
    globalThis.advancement = await JSON.parse(rawdata);
})()

var uuid_pseudo = async () => {
    var player_keys = await client.sendCommand(['keys', "player:*"])

    var pseudo = {}

    for (keys of player_keys) {
        let redis_temp = await client.HGETALL(`${keys}`)
        pseudo[redis_temp.uuid] = redis_temp.lastName
    }      

    return pseudo
}

var uuid_color = async () => {
    var player_keys = await client.sendCommand(['keys', "player:*"])

    var color = {}

    for (keys of player_keys) {
        let redis_temp = await client.HGETALL(`${keys}`)
        color[redis_temp.uuid] = redis_temp.color
    }      

    return color
}

var findCaraInJSON = (id, research) => {

    let comp1 = {0:'statistiques', 1:'classements'}
    let comp2 = {0:'main', 1:'sub'}
    let stat = stat_data[comp1[id[0]]][comp2[id[1]]]

    for ( let tobject of stat ) {

        if ( tobject['id'] == id ) {

            return tobject[research]
        }
    }
}

const APIrequest = async (arg) => {

    let path = `https://api.gameinbox.eu/api/${arg}?token=${process.env.gibAPIToken}`
    try {
        const response = await superagent.get(path);
        return response.body

    } catch (error) {

        console.log(error.response.body);
    }
}

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

// !DATA TRANSFER

// connection between client and server 
io.on('connection', (socket) => {

    // display in console when user connect/disconnect
    console.log("\x1b[32m", `A user connect at ${JSON.stringify(new Date())}`, '\x1b[0m');
    socket.on('disconnect', () => {
        console.log("\x1b[31m", `A user disconnect at ${JSON.stringify(new Date())}`, '\x1b[0m');
      });
    
    // manage event to do when home page is loaded
    socket.on('home_page_loaded', async () => {

        // send all data necessary to display initial home page
        socket.on('accueil_data_request', async () => {

            let serverState = await sync.getServerState()
            socket.emit('serverState', serverState)

            let serverInfo = await APIrequest(`server/${process.env.currentServer}/infos/latest`)
            let playerList = await getRedisPlayerList()

            let tpsNow = serverInfo['tps']
            let perfAverage = await client.HGETALL('perf:average')
            let avetps1h = perfAverage['tps1h']
            let avetps24h = perfAverage['tps24h']
            let currentPlayer = serverInfo['onlineCount']
            let totalPlayer = Object.entries(playerList).length

            let selectStatID = await client.GET('sdj')
            let selectStatData = await client.HGETALL(`stat:${selectStatID}`)

            let entries = Object.entries(selectStatData)
            let maxData = {"value":0}
            entries.forEach(entry => {
                let [key, value] = entry
                if (maxData['value'] < parseFloat(value)) {
                    maxData = {"value":parseFloat(value),"player":key}
                }
            })

            let UUIDToPseudo = await uuid_pseudo()
            maxData['player'] = UUIDToPseudo[maxData['player']]
            maxData['title'] = await findCaraInJSON(selectStatID, 'title')
            maxData['unit'] = await findCaraInJSON(selectStatID, 'unit')
            maxData['id'] = selectStatID

            let averagePlayer = await client.HGET('perf:average', 'player24h')

            let sendData = {
                'player_c': [currentPlayer, totalPlayer, temp_data['evolution'], averagePlayer],
                'tps_c': [tpsNow, avetps1h, avetps24h],
                'sdj': maxData,
            }

            socket.emit('home_data', sendData);  
        })

        socket.on('graph_request', async (arg) => {

            // send data for home graph construction
            if (arg == 'tps1h' || arg == 'tps24h') {

                let redisDatasets = await client.HGETALL('perf:datasets')

                socket.emit(`${arg}`, redisDatasets[arg])
            }

            if (arg == 'pa24h' || arg == 'pa1w' || arg == 'pa1m') {

                let redisDatasets = await client.GET('playerActivity')

                socket.emit(`${arg}`, redisDatasets)
            }
        })

        socket.on('stat_w_request', async () => {

            // send data for home stat list page 
            socket.emit('stat_w_data', stat_data);             
        })

        socket.on('player_list_request', async () => {

            // send data for home player list page
            var player_keys = await client.sendCommand(['keys', "player:*"])
            var player_data = {}
            let playerList = await getRedisPlayerList()

            for (keys of player_keys) {

                let playerUUID = keys.split(':')[1]
                let temp_player_data = await client.sendCommand(['hmget', `${keys}`, 'lastName', 'id']) 
                
                player_data[playerUUID] = {}
                player_data[playerUUID]['name'] = temp_player_data[0]
                player_data[playerUUID]['id'] = temp_player_data[1]
            }        

            socket.emit('player_list_data', player_data)   

            let playerPlaytime = await sync.getPlaytime('id')

            socket.emit('playerPlaytimeData', playerPlaytime, playerList) 

            let playerOnlineState = await sync.getOnlineState('id')

            socket.emit('playerOnlineData', playerOnlineState, playerList) 
        });

        let serverState = await sync.getServerState()
        socket.emit('serverState', serverState)
    });

    // manage event to do when classement page is loaded
    socket.on('classement_page_loaded', () => {
        socket.on('classement_base_request', async () => {

            let serverState = await sync.getServerState()
            socket.emit('serverState', serverState)

            // send data for home stat list page 
            socket.emit('classement_base_data', stat_data);             
        })

        socket.on('classement_request', async (arg) => {

            // send classement data (player name and value)

            let currentClassData = await client.HGETALL(`stat:${arg}`)
            let entries = Object.entries(currentClassData)

            var imgType = findCaraInJSON(arg, 'img')
            var img = {}

            if (imgType === 'player') {

                var itemName = await uuid_pseudo()
                let excludeID = [arg, '1108']

                var keyFilter = (element) => {
                    for (let exc of excludeID) {
                        if (element === `stat:${exc}`) {
                            return false
                        }
                    }
                    return true
                }

                var class_keys = await client.sendCommand(['keys', "stat:1*"])
                class_keys = class_keys.filter(keyFilter)

                let n = 0;
                let random_temp = []
                var randomClass = []
                let n_keys = Object.keys(class_keys).length - 1
          
                while (n < 3) {
          
                    let r
                    (function random_array () {

                        r = Math.floor(Math.random() * n_keys)

                        return (random_temp.includes(r) || excludeID.includes(r))
                            ? (random_array()) : (r)
                    })()
            
                    random_temp.push(r)
    
                    let r_class_id = class_keys[r].split(':')[1]
    
                    let redis_temp = await client.HGETALL(`stat:${r_class_id}`)
    
                    redis_temp = Object.entries(redis_temp)
                
                    redis_temp.sort(function(a, b) {
                        return parseInt(b[1]) - parseInt(a[1]);
                    })
    
                    var r_class_title = findCaraInJSON(r_class_id, 'title')
    
                    randomClass.push({
                        'classID' : r_class_id,
                        'classTitle' : r_class_title,
                        'redisData' : redis_temp,
                    })
    
                  n++
                }

                for (let [uuid] of entries) {
                    img[uuid] = `/ressources/players_render/${uuid}.png`
                }
            }
            if (imgType === 'block') {

                var itemName = {}

                for (let [blockName] of entries) {

                    let robject = jp.query(textures, `$..minecraft[?(@.name=="${blockName}")]`) 

                    img[blockName] = robject[0]["css"]
                }
            }

            let data = {
                'pseudoComp' : itemName,
                'img' : img,
                'type' : imgType
            }

            socket.emit('classement_data', currentClassData, itemName)
            socket.emit('player_data', data, randomClass)
        })
    })

    socket.on('statistique_page_loaded', async (statID) => {

        const dataType = findCaraInJSON(statID, 'dataType')
        var itemComp = {}

        socket.on('statistique_base_request', async () => {

            let serverState = await sync.getServerState()
            socket.emit('serverState', serverState)

            // send data for home stat list page 
            socket.emit('statistique_base_data', stat_data);             
        })

        socket.on('statistique_request', async (options) => {

            let statID = options.id
            let classIDcorresponding = findCaraInJSON(statID, 'class')
            let startDate = options.startDate
            let endDate = options.endDate
            var stat_keys = await client.sendCommand(['keys', `stat:${statID}*`])
            let statUnit = findCaraInJSON(statID, 'unit')
            let wantNumberID = findCaraInJSON(statID, 'wantNumber')
            var pre_data = {}
            let validDate = []

            if (classIDcorresponding !== undefined) {

                let itemColor = {}

                for (ukeys of stat_keys) {
                    // let redisDate = new Date(`${uDate.split(':')[3]}:00:00.000Z`)
                    let redisDate = new Date(`${ukeys.split(':')[2]}:00:00.000Z`)

                    startDate = new Date(startDate)
                    var startDateM = new Date(startDate)
                    startDateM.setMonth(startDate.getMonth() - 1)

                    endDate = new Date(endDate)

                    if (startDateM <= redisDate && endDate >= redisDate) {
                        validDate.push(ukeys)
                    }}

                let nDate = validDate.length
                let nNow = 0

                for (let uDate of validDate) {

                    nNow ++

                    // let redisDate = new Date(`${uDate.split(':')[3]}:00:00.000Z`)
                    let redisDate = new Date(`${uDate.split(':')[2]}:00:00.000Z`)
                    let redis_temp = await client.HGETALL(uDate)
                    let redis_parse = {}

                    var rentries = Object.entries(redis_temp)
                    for (let [key, value] of rentries) {
                        redis_parse[key] = JSON.parse(value)
                    } 
                    
                    pre_data[redisDate.toJSON()] = redis_parse

                    socket.emit('stat_update_avancement', nDate, nNow)
                }    

                var finalData = pre_data

                const randomHex = () => {
                    return "000000".replace(/0/g,function(){return (~~(Math.random()*16)).toString(16);});
                }

                if (wantNumberID) {
                    itemComp = await uuid_pseudo()
                    itemColor = await uuid_color()
                }
                else {
                    let data_entries = Object.entries(finalData)
                    for (let [,monthV] of data_entries) {
                        let monthVentries = Object.entries(monthV)
                        for (let [blockName] of monthVentries) {
                            itemComp[blockName] = ((blockName.split('_')).join(' ')).toLowerCase()
                            itemColor[blockName] = randomHex()
                        }
                    }
                }  

                let onlinePlayers = await sync.getOnlineState('uuid')

                let dataSend = {
                    "sessionData" : finalData ,
                    "pseudo" : itemComp ,
                    "color" : itemColor,
                    "dataType" : dataType , 
                    "unit" : statUnit ,
                    "online" : onlinePlayers,
                    "classCorr" : classIDcorresponding
                }

                socket.emit('statistique_data', dataSend)                
            }
            else {
                socket.emit('statistique_data', null)
            }
        })

        socket.on('stat_class_request', async (stat_id) => {

            let classIDcorresponding = findCaraInJSON(stat_id, 'class')
            let classTitle = null
            let imgType = null
            let unit = null
            let classRedisData = null
            let img = {}
            let classEntries = null
            if (classIDcorresponding != null) {
               classTitle = (findCaraInJSON(classIDcorresponding, 'desc'))[0]
               imgType = findCaraInJSON(classIDcorresponding, 'img')
               unit = findCaraInJSON(classIDcorresponding, 'unit')
               classRedisData = await client.HGETALL(`stat:${classIDcorresponding}`)
               classEntries = Object.entries(classRedisData)
               classEntries.sort(function(a, b) {
                 return parseInt(b[1]) - parseInt(a[1]);
               })
   
               if (imgType === 'player') {
   
                   for (let [uuid] of classEntries) {
   
                       img[uuid] = `/ressources/players_render/${uuid}.png`
                   }
               }
   
               else {
   
                   for (let [blockName] of classEntries) {
   
                       let robject = jsonP.jsonPath(textures,`$..textures[?(@.id=="assets/minecraft/textures/block/${blockName}.png")]`)
               
                       let rtexture
                       robject != false ? (
                           rtexture = robject[0].texture.split('\u003d')[0]
                       ) : (
                           rtexture = 'err'
                       )
   
                       img[blockName] = rtexture
                   }
               }
            }

            let dataSend = {
                "classID" : classIDcorresponding ,
                "classData" : classEntries ,
                "pseudo" : itemComp,
                "classTitle" : classTitle , 
                "imgType" : imgType ,
                "unit" : unit ,
                "img" : img
            }

            socket.emit('stat_class_data', dataSend)
        })

    })

    socket.on('advancement_page_loaded', () => {


        socket.on('advancement_request', async (category) => {

            let serverState = await sync.getServerState()
            socket.emit('serverState', serverState)

            let playerList = await getRedisPlayerList()
            let totalPlayer = Object.entries(playerList).length

            let data = advancement[category]

            let entries = Object.entries(data)
            let completionData = {}
            for (let [, values] of entries) {
                let cat = values['id'].split('/')[0]
                let id = values['id'].split('/')[1]
                let redis_temp = await client.HGETALL(`stat:advancement:${cat}:${id}`)
                completionData[`${cat}${id}`] = Object.entries(redis_temp).length
            }

            socket.emit('advancement_data', data, totalPlayer, completionData)
        }) 

        socket.on('popup_request', async (advancementID, category) => {

            let uuidComp = await uuid_pseudo()
            let redis_temp = await client.HGETALL(`stat:advancement:${category}:${advancementID}`)

            Object.entries(redis_temp).forEach((e) => {redis_temp[e[0]] = JSON.parse(e[1])})

            socket.emit('popup_data', { redisData: redis_temp, uuidComp: uuidComp })
        })
    })

    socket.on('shop_page_loaded', () => {

        socket.on('shopDataRequest', async () => {

            let serverState = await sync.getServerState()
            socket.emit('serverState', serverState)

            var data = []
            let sqlRequest = `SELECT * FROM survival.player_shops`
            let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]
            let playerList = await getRedisPlayerList()

            sqlRequest = `SELECT * FROM survival.shop_trades;`
            let SQLshoptrades = (await GIBdb.execute(sqlRequest))[0]
            let tradeIndex = {}
            let tradeHistory = {}
            let totaltrade = SQLshoptrades.length

            for (let tradeData of SQLshoptrades) {
                if (tradeIndex[tradeData.shop_id] == undefined) {
                    tradeIndex[tradeData.shop_id] = 1
                    tradeHistory[tradeData.shop_id] = []
                }
                else {
                    tradeIndex[tradeData.shop_id] += 1
                }
                tradeData['player_id'] = playerList[tradeData['player_id']].uuid 
                tradeHistory[tradeData.shop_id].push(tradeData)
            }

            for (let shopData of newSQLTimeStatArray) {

                if (shopData.deleted_at === null) {
                    let newShopData = {}
                    newShopData['itemName'] = shopData.shop_type == 2 ? shopData.item_type : 'diamond'
                    newShopData['itemQuantity'] = shopData.price
                    newShopData['itemPriceName'] = shopData.shop_type == 2 ? 'diamond' : shopData.item_type
                    newShopData['itemPrice'] = shopData.quantity
                    newShopData['location'] = [shopData.world_x, shopData.world_y, shopData.world_z]
                    newShopData['owner'] = playerList[shopData.owner_id].uuid 
                    newShopData['trade'] = tradeIndex[shopData.id] == undefined ? 0 : tradeIndex[shopData.id]
                    newShopData['tradehistory'] = tradeHistory[shopData.id] == undefined ? [] : tradeHistory[shopData.id]
                    
                    let itemType = 'item'
                    for (let ublock of blockstextures.textures) {
                        let JSONBlockName = ((ublock.id).split('/')[4]).split('.')[0]
                        if (newShopData['itemName'].toLowerCase() == JSONBlockName || (newShopData['itemName']+'_top').toLowerCase() == JSONBlockName) {
                            itemType = 'block'
                        }
                    }
                    let priceType = 'item'
                    for (let ublock of blockstextures.textures) {
                        let JSONBlockName = ((ublock.id).split('/')[4]).split('.')[0]
                        if (newShopData['itemPriceName'].toLowerCase() == JSONBlockName || (newShopData['itemPriceName']+'_top').toLowerCase() == JSONBlockName) {
                            priceType = 'block'
                        }
                    }

                    newShopData['itemType'] = itemType
                    newShopData['priceType'] = priceType

                    data.push(newShopData)
                }
            }

            let pseudo = await uuid_pseudo()

            socket.emit('shopDataReceived', data, pseudo, totaltrade)
        })
    })

    socket.on('player_page_loaded', () => {
        
        socket.on('allPlayerDataRequest', async (ID) => {

            let serverState = await sync.getServerState()
            socket.emit('serverState', serverState)

            let playerList = await getRedisPlayerList()
            let playerListEntries = Object.entries(playerList)
            let pUUID = ID
            let playerID
            for (let [pid, pdata] of  playerListEntries) {
                if (pdata.uuid === pUUID) playerID = pid
            }
            
            if (playerID !== undefined) {

                // player main data
                let playerData = await client.HGETALL(`player:${pUUID}`)
                let apiplaytimerequest = await APIrequest(`player/${playerID}/playtime`)
                playerData['playtime'] = (await APIrequest(`player/${playerID}/playtime`))['playTime'][process.env.currentServer]
                let allSession = (await APIrequest(`player/${playerID}/sessions`)).sessions
                let joinDate = allSession[0].startedAt
                let lastDate = allSession.pop().endedAt
                playerData['joinDate'] = joinDate
                playerData['lastDate'] = lastDate
                let achievementDone = await client.HGET('stat:1110', pUUID)
                playerData['achievementDone'] = achievementDone

                // classsement data
                var classKeys = await client.sendCommand(['keys', "stat:1*"])
                var classList = []

                for (let key of classKeys) {

                    let classID = key.split(':')[1]
                    let redisTemp = await client.HGETALL(`stat:${classID}`)

                    redisTemp = Object.entries(redisTemp)
                    redisTemp.sort(function(a, b) {
                        return parseInt(b[1]) - parseInt(a[1]);
                    })

                    var classTitle = findCaraInJSON(classID, 'title')

                    let position = 0
                    try {
                        while (redisTemp[position][0] !== pUUID) {
                            position ++ 
                        }                    
                    }
                    catch (e) { position = null}

                    if (position !== null) {
                        classList.push({
                            'classID' : classID,
                            'classTitle' : classTitle,
                            'position' : position + 1,
                        })
                    }
                }

                classList.sort(function(a, b) {
                    return parseInt(a.position) - parseInt(b.position);
                })

                // shop data
                var shopFinalData = []
                let sqlRequest = `SELECT * FROM survival.player_shops where owner_id = ${playerID}`
                let newSQLTimeStatArray = (await GIBdb.execute(sqlRequest))[0]

                for (let shopData of newSQLTimeStatArray) {

                    if (shopData.deleted_at === null) {
                        let newShopData = {}
                        newShopData['itemName'] = shopData.shop_type == 2 ? shopData.item_type : 'diamond'
                        newShopData['itemQuantity'] = shopData.quantity
                        newShopData['itemPriceName'] = shopData.shop_type == 2 ? 'diamond' : shopData.item_type
                        newShopData['itemPrice'] = shopData.price
                        newShopData['location'] = [shopData.world_x, shopData.world_y, shopData.world_z]
                        newShopData['owner'] = playerList[shopData.owner_id].uuid 
                        
                        let itemType = 'item'
                        for (let ublock of blockstextures.textures) {
                            let JSONBlockName = ((ublock.id).split('/')[4]).split('.')[0]
                            if (newShopData['itemName'].toLowerCase() === JSONBlockName) {
                                itemType = 'block'
                            }
                        }
                        let priceType = 'item'
                        for (let ublock of blockstextures.textures) {
                            let JSONBlockName = ((ublock.id).split('/')[4]).split('.')[0]
                            if (newShopData['itemPriceName'].toLowerCase() === JSONBlockName) {
                                priceType = 'block'
                            }
                        }
                        newShopData['itemType'] = itemType
                        newShopData['priceType'] = priceType

                        shopFinalData.push(newShopData)
                    }
                }

                // stat data
                let statSelectID = ['1001','1002','1003','1101','1102','1103','1104','1105','1106','1107']
                let statData = {}

                for (let statID of statSelectID) {
                    let uStatData = await client.HGETALL(`stat:${statID}`)
                    var statTitle = findCaraInJSON(statID, 'title')
                    var statUnit = findCaraInJSON(statID, 'unit')
                    statData[statID] = {
                        "title" : statTitle,
                        "value" : uStatData === undefined ? '0' : uStatData[pUUID],
                        "unit" : statUnit
                    }
                }

                socket.emit('allPlayerData', playerData, classList, shopFinalData, statData)                
            }

            else {
                socket.emit('allPlayerData', null, null, null, null)
            }


        })
    });
});
  

server.listen(8080, () => {
    console.log('listening on *:8080');
});