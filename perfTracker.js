const https = require('https');
require('dotenv').config();
const redis = require('redis');
const client = redis.createClient({
    url: `redis://default:${process.env.redis_pass}@${process.env.redis_ip}:${process.env.redis_port}`
});;

client.on('error', (err) => console.log('Redis Client Error', err));
client.connect();
client.select(process.env.currentdb);

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const APIrequest = async (arg) => {

    return promise = new Promise ((resolve, reject) => { 

        const options = {
            hostname: 'api.gameinbox.eu',
            port: 443,
            path: `/api/${arg}?token=${process.env.gibAPIToken}`,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
        
            res.on('data', (d) => {
                resolve(JSON.parse(d))
            });
        });

        req.on('error', (e) => {
            console.log("API request failed")
            reject(e);
        });
        req.end();
    })
}

const countNumberRedis = async (lastDate, tps, mspt) => {

    let start = new Date()
    let startH1 = new Date((new Date()).setHours(start.getHours()-1))
    let startH24 = new Date((new Date()).setHours(start.getHours()-24))

    let tpsObject = JSON.parse(await client.GET('perf:tps'))
    let msptObject = JSON.parse(await client.GET('perf:mspt'))

    // TPS

    tpsObject[lastDate] = tps

    let tpsObjectEntries = Object.entries(tpsObject)
    let [sommeTPS1H, nsommeTPS1H, sommeTPS24H, nsommeTPS24H] = Array(4).fill(0);
    let datasetTPS1H = []
    let datasetTPS24H = []

    for (let [key, value] of tpsObjectEntries) {
        let tpsdate = new Date(key)
        if (tpsdate >= startH24) {
            if (tpsdate >= startH1) {
                sommeTPS1H += value
                nsommeTPS1H += 1
                datasetTPS1H.push(JSON.stringify({'x':key, 'y':value}))
            }
            sommeTPS24H += value
            nsommeTPS24H += 1
            datasetTPS24H.push(JSON.stringify({'x':key, 'y':value}))
        }
        else {
            delete tpsObject[key]
        }
    }

    let averageTPS24H = (sommeTPS24H / nsommeTPS24H).toFixed(2)
    let averageTPS1H = (sommeTPS1H / nsommeTPS1H).toFixed(2)

    await client.SET(`perf:tps`, `${JSON.stringify(tpsObject)}`)

    // MSPT

    msptObject[lastDate] = mspt

    let msptObjectEntries = Object.entries(msptObject)
    let [sommeMSPT1H, nsommeMSPT1H, sommeMSPT24H, nsommeMSPT24H] = Array(4).fill(0);
    let datasetMSPT1H = []
    let datasetMSPT24H = []

    for (let [key, value] of msptObjectEntries) {
        let msptdate = new Date(key)
        if (msptdate >= startH24) {
            if (msptdate>startH1) {
                sommeMSPT1H += value
                nsommeMSPT1H += 1
                datasetMSPT1H.push(JSON.stringify({'x':key, 'y':value}))
            }
            sommeMSPT24H += value
            nsommeMSPT24H += 1
            datasetMSPT24H.push(JSON.stringify({'x':key, 'y':value}))
        }
        else {
            delete msptObject[key]
        }
    }

    let averageMSPT24H = (sommeMSPT24H / nsommeMSPT24H).toFixed(2)
    let averageMSPT1H = (sommeMSPT1H / nsommeMSPT1H).toFixed(2)

    await client.SET(`perf:mspt`, `${JSON.stringify(msptObject)}`)

    await client.sendCommand(['hmset', 'perf:average', 'tps24h', `${averageTPS24H}`, 'tps1h', `${averageTPS1H}`, 'mspt24h', `${averageMSPT24H}`, 'mspt1h', `${averageMSPT1H}`])
    await client.sendCommand(['hmset', 'perf:datasets', 'tps24h', `${datasetTPS24H}`, 'tps1h', `${datasetTPS1H}`, 'mspt24h', `${datasetMSPT24H}`, 'mspt1h', `${datasetMSPT1H}`])

    let end = new Date()

    console.table([['TPS NOW', 'TPS 1H', 'TPS 24H','MSPT NOW', 'MSPT 1H', 'MSPT 24H'],[tps, averageTPS1H, averageTPS24H, mspt, averageMSPT1H, averageMSPT24H]])
    console.log(`${msptObjectEntries.length} keys in ${Math.abs(end - start)} ms`)
}

const tpsmsptUpdater = async () => {

    let lastDate = new Date()
    let tps
    let mspt
    let nSkip = 0

    while (true) {
    
        let serverInfo
        try { serverInfo = await APIrequest(`server/${process.env.currentServer}/infos/latest`)}
        catch(e) {serverInfo = null}

        if (serverInfo != null) {

            console.log(new Date(serverInfo['createdAt']) - new Date(lastDate) + ' ms')

            if (lastDate != serverInfo['createdAt']) {
                nSkip = 0
                lastDate = serverInfo['createdAt']
                tps = serverInfo['tps']
                mspt = serverInfo['mspt']
                countNumberRedis(lastDate, tps, mspt)
            }
            if (nSkip > 2){
                tps = 0
                mspt = 0
                lastDate = new Date()
                countNumberRedis(lastDate, tps, mspt)
            }

            nSkip += 1
        }
        else {
            console.error('API ERROR')
        }

        await sleep(15000)
    }
}

tpsmsptUpdater()