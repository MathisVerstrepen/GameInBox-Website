const initParser = async (data, options) => {

    await ($('.loader .title').text("Traitement des données ..."))

    globalThis.completion = 25
    globalThis.datasetData = {}
    globalThis.displayPoints = 0
    globalThis.playerColorSaved = {}

    const sData = orderData(data)
    let stackDateList = (options.stack ? generateStackDate(data) : [])

    if (options.type === 'session') {

        let entries = Object.entries(sData)
        let playedTime = {}
        let totalDivision = entries.length * Object.entries(entries[0][1]).length
        let pourcentageToAdd = 75 / totalDivision
        
        for (let [mDate, allMonthData] of entries) {

            let tempDate = new Date(mDate)
            let refStartDate = new Date(options.dateRange[0])
            const startDate = options.keepOld && tempDate < refStartDate ? refStartDate : new Date(mDate)
            const endDate = new Date(tempDate.setMonth(startDate.getMonth() + 1))
            let entries = Object.entries(allMonthData)
            var whenSessionOpen 
            
            for (let [playerUUID, monthData] of entries) {
 
                addPourcent(pourcentageToAdd)
                await sleep(1);

                var isSessionOpen = false

                datasetData[playerUUID] == undefined ? datasetData[playerUUID] = [] : null
                playedTime[playerUUID] == undefined ? playedTime[playerUUID] = 0 : null
                
                var createNewPoint = (statut, date) => {

                    statut === 'session_closed' && isSessionOpen ?  (
                        isSessionOpen = false,
                        playedTime[playerUUID] += (new Date(date) - new Date(whenSessionOpen)) / 60000                        
                    )   :   (
                        isSessionOpen = true,
                        whenSessionOpen = date   
                    )
                    
                    let y = (playedTime[playerUUID] / 60).toFixed(2)
                    build_xy('sessionOpen', date, y, playerUUID)
                }
                
                if (options.stack) {
              
                    for (let date of stackDateList) {

                        let inDate = new Date(date) > startDate && new Date(date) < endDate

                        if (monthData[String(date)] === undefined) {

                            if (inDate) {

                                isSessionOpen ? (
                                    playedTime[playerUUID] += (new Date(date) - new Date(whenSessionOpen)) / 60000 ,     
                                    whenSessionOpen = date  
                                ) : null

                                let y = (playedTime[playerUUID] / 60).toFixed(2)

                                build_xy('sessionOpen', date, y, playerUUID)
                            }
                        }

                        else {

                            if (inDate) {

                                createNewPoint(monthData[date], date)
                            }
                        }
                    }
                }
              
                else {

                    let entries =  Object.entries(monthData)
                    for (let [date, statut] of entries) {

                        let inDate = new Date(date) > startDate && new Date(date) < endDate
                        if (inDate) {
                            createNewPoint(statut, date)
                        }                        
                    }
                }
            }
        }
    }

    if (options.type === 'number') {

        let previousValue = {}
        let previousDate = {}
        let initialValue = {}
        let entries = Object.entries(sData)
        let totalDivision = entries.length * Object.entries(entries[0][1]).length
        let pourcentageToAdd = 75 / totalDivision
        let lastPointSaved = {}
        let previousIndexSaved = {}

        for (let [mDate, allMonthData] of entries) {

            let entries = Object.entries(allMonthData)
            for (let [playerUUID, monthData] of entries) {
                
                addPourcent(pourcentageToAdd)

                await sleep(1);

                datasetData[playerUUID] == undefined ? datasetData[playerUUID] = [] : null
                previousValue[playerUUID] == undefined ? previousValue[playerUUID] = 0 : null
                let previousIndex = stackDateList.indexOf(mDate)

                // manage data hole when month change
                let startI = stackDateList.indexOf(previousDate[playerUUID])
                let endI = stackDateList.indexOf(mDate)
                for (let i = startI; i < endI; i++) {
                    build_xy('number_stack', stackDateList[i], previousValue[playerUUID], playerUUID, null) 
                }

                let entries = Object.entries(monthData)

                // create initial value for keepOld
                if (initialValue[playerUUID] == undefined) {

                    options.keepOld ? 
                        initialValue[playerUUID] = searchInitValueNumber(entries, new Date(options.dateRange[0])) 
                        :  initialValue[playerUUID] = 0
                }

                previousDate[playerUUID] == mDate

                for (let [date, value] of entries) {

                    date = JSON.parse(date)
                    let valueFinal = value - initialValue[playerUUID] <= 0 ? 0 : value - initialValue[playerUUID]

                    if (options.stack) {

                        while (new Date(date) >= new Date(stackDateList[previousIndex])) {

                            previousIndex ++
                            let rdate = stackDateList[previousIndex]
                            previousDate[playerUUID] = rdate
                            build_xy('number_stack', rdate, valueFinal, playerUUID, null) 
                        }
                    }

                    else {
                        build_xy('number_standard', date, valueFinal, playerUUID, previousValue[playerUUID])
                    }

                    previousValue[playerUUID] = valueFinal
                }

                let lastPreviousIndex
                try {
                    lastPreviousIndex = lastPointSaved[playerUUID][1] + previousIndex + 1
                }
                catch {
                    lastPreviousIndex = previousIndex
                }

                lastPointSaved[playerUUID] = [previousValue[playerUUID], lastPreviousIndex]

                // if (monthCounter === entries.length) {
                //     if (options.stack) {
                //         if (previousIndex < stackDateList.length) {
                //             for (let i = previousIndex; i <= stackDateList.length; i++) {
                //                 let rdate = stackDateList[i]
                //                 build_xy('number_stack', rdate, previousValue[playerUUID], playerUUID, previousValue[playerUUID])
                //             }
                //         }
                //     }
                //     else build_xy('number_standard', new Date(), previousValue[playerUUID], playerUUID, previousValue[playerUUID])                   
                // }
            }  
        }

        let lastPointSavedEntries = Object.entries(lastPointSaved)
        for (let [puuid, lvalue] of lastPointSavedEntries) {
            console.log(puuid)
            if (options.stack) {
                console.log(lvalue[1])
                if (lvalue[1] < stackDateList.length) {
                    for (let i = lvalue[1]; i <= stackDateList.length; i++) {
                        let rdate = stackDateList[i]
                        if (rdate != undefined) build_xy('number_stack', rdate, lvalue[0], puuid, lvalue[0])
                    }
                }
            }
            else build_xy('number_standard', new Date(new Date().setHours(new Date().getHours() +1)), lvalue[0], puuid, lvalue[0])                   
        }
    }

    completeParser(datasetData, options)
} 

const completeParser = async (datasetData, options) => {

    $('.loader .title').text('Rendu du graphique ...')
    await sleep(1)

    var chartData = {'datasets': []}

    let entries = Object.entries(datasetData)
    for (let [player, dataset] of entries) {

        // add last point for session dataset
        if (options.type === 'session' && dataset.length !== 0) {
            let onlineStatut = options.online[player]
            let datasetEntries = Object.entries(dataset)
            let newLine = {}
            let lastValue = datasetEntries[datasetEntries.length-1][1]['y']
            if (onlineStatut) {
                newLine['x'] = new Date()
                newLine['y'] = parseFloat(lastValue) + ((new Date() - new Date( datasetEntries[datasetEntries.length-1][1]['x'])) / 3600000)
            }
            else {
                newLine['x'] = new Date()
                newLine['y'] = lastValue
            }
            dataset.push(newLine)
        }

        let pHex = '#' + player_color[player]
        if (pHex !== '#undefined') playerColorSaved[player] = pHex
        else pHex = playerColorSaved[player] 

        chartData['datasets'].push({
            label: `${player_name[player]}`,
            data: dataset,
            borderColor: hexToRgbA(pHex,0.7),
            backgroundColor: hexToRgbA(pHex,0.1),
            spanGaps: true,
            fill: (options.stack ? '-1' : false)
          })
    }

    chartOption = {
        'chartData' : chartData,
        'stack' : options.stack,
        'dateDiff' : ((new Date(options.dateRange[1]) - new Date(options.dateRange[0])) / 2628000000).toFixed(2),
        'keepOld' : options.keepOld,
        'minDate' : options.dateRange[0],
        'maxDate' : options.dateRange[1],
        'dataType' : options.type,
        'unit' : options.unit
    }

    console.log(chartOption.chartData)

    console.log(`%cNombre de points traités : ${displayPoints}`, "color:rgba(255,0,0,0.8)")

    build_chart(chartOption)

    animateOption("show")
}

const build_xy = (type, x, y, uuid, previousValue) => {

    displayPoints ++

    if (x !== undefined) {
    
        if (type === 'number_standard') {

            let previousDate = new Date(x).setMinutes(new Date(x).getMinutes() - 1)
            datasetData[uuid].push({'x': previousDate, 'y': previousValue})
            datasetData[uuid].push({'x': x, 'y': y})
        }

        if (type === 'number_stack' || type === 'sessionOpen') {

            // console.log(x, y)

            datasetData[uuid].push({'x': x, 'y': y})
        }
    }
}

const generateStackDate = (data) => {

    let list = [Object.keys(data).sort()[0]]

    let entries = Object.entries(data)
    for (let [, allMonthData] of entries) {

        let entries = Object.entries(allMonthData)
        for (let [,monthData] of entries) {

            let entries = Object.entries(monthData)
            for (let [date] of entries) {

                if (date.substring(0,1) === '"') date = JSON.parse(date)

                if (!list.includes(date)) {
                    list.push(date)
                }
            }
        }
    }

    list.push(new Date(new Date().setHours(new Date().getHours() + 1)))

    return list.sort()
}

const orderData = (unsortData) => {

    let sortedData = {}
    let keyList = Object.keys(unsortData)

    keyList.sort((a,b) => {
        return (new Date(a) < new Date(b) ? -1 : 1)
    })

    for (let keys of keyList) {
        sortedData[keys] = unsortData[keys]
    }

    return sortedData
}

const searchInitValueNumber = (entries, dateSearched) => {

    for (let [monthDate, value] of entries) {
        monthDate = JSON.parse(monthDate)
        if (dateSearched < new Date(monthDate)) {
            return value
        }
    }  
}

const hexToRgbA = (hex, op) => {
    var c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+op+')';
    }
    throw new Error('Bad Hex');
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const addPourcent = async (pourcentageToAdd) => {

    completion += pourcentageToAdd
    let statut = String(Math.trunc(completion)) + '%'
    await ($('.pourcent').text(statut))
    await ($('.progressBar').css('width', statut))
}