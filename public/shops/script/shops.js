var socket = io();

var setupListeners = function () {

    initPage()

    socket.emit("shop_page_loaded");
    new data_listener().init_socket()
}

window.addEventListener("load", setupListeners);

const data_listener = class {

  // init all socket system for the page
  async init_socket() {

    $('#statistic_b').addClass('current')

    socket.emit('shopDataRequest')

    socket.on('serverState', (isOnline) => {

        $('.server_state_circle').addClass(isOnline?'server_online':'server_offline')
        $('.server_state_value').text(isOnline?'En ligne':'Hors ligne')
      })

    socket.on('shopDataReceived', (data, pseudo, totaltrade) => {

        let isClickObj = {}

        if (data.length != 0) $('.noShop').css('display', 'none')
        else $('.noShop').text('Aucun shop trouvé, pour le moment...')

        let shopTempSave = []
        let newData = []
        for (let shopData of data) {
    
            let shopDesignation = shopData.owner + shopData.itemPriceName.toLowerCase().replace('_', '-')

            if (!shopTempSave.includes(shopDesignation) || shopData.itemPriceName == 'ENCHANTED_BOOK') {
                shopTempSave.push(shopDesignation)
                newData.push(shopData)
            }
        }

        data = newData

        let initClickEvents = () => {
            $('.shopContainer').off()
            $('.shopContainer').on('click', (e) => {
                let shopID = (e.target.id).split('-')[1]
                if (isClickObj[shopID]) {
                    isClickObj[shopID] = false
                    $(`#shop-${shopID} .shopInfo`).css('opacity', 0)
                    $(`#shop-${shopID}`).css('transform', 'rotatex(0deg)')
                    $('.shopHistory').css('pointer-events', 'none')
                    setTimeout(function(){
                        $(`#shop-${shopID} .shopMain`).css('opacity', 1)
                    }, 100); 
                }
                else {
                    isClickObj[shopID] = true
                    $(`#shop-${shopID} .shopMain`).css('opacity', 0)
                    $(`#shop-${shopID}`).css('transform', 'rotatex(180deg)')
                    $('.shopHistory').css('pointer-events', 'all')
                    setTimeout(function(){
                        $(`#shop-${shopID} .shopInfo`).css('opacity', 1)
                    }, 100); 
                }
            })
            $('.shopHistory').on({
                mouseenter: (e) => {
                    $(e.target.querySelector('img')).removeClass('historynh')
                    $(e.target.querySelector('img')).addClass('historyh')
                    $(e.target.querySelector('div')).removeClass('historynh')
                    setTimeout(function(){$(e.target.querySelector('div')).addClass('historyh')}, 200); 
                },
                mouseleave: (e) => {
                    $(e.target.querySelector('img')).removeClass('historyh')
                    setTimeout(function(){$(e.target.querySelector('img')).addClass('historynh')}, 200); 
                    $(e.target.querySelector('div')).removeClass('historyh')
                    $(e.target.querySelector('div')).addClass('historynh')
                }
            });
            $('.shopHistory').on('click', (e) => {
                let shopID = e.target.parentNode.parentNode.id.split('-')[1]
                console.log(shopID, data)
                displayTradeHistoryPopUp(data[shopID-1], pseudo, totaltrade)
            })
        }

        let constructShopItem = (sd,n) => {
            let shopContainer = `
            <div class='shopContainer' id=shop-${n}>
                <div class='shopMain'>
                    <div class='itemContainer'>
                        <div class='iconContainer'>
                            <i class="icon-minecraft icon-minecraft-${sd.itemName.toLowerCase().replace('_', '-')}"></i>
                        </div>
                        <div class='itemTitle'><span class='itemName'>${sd.itemName.toLowerCase().replace('_', ' ')}</span><span class='itemPrice'>${sd.itemQuantity}</span></div>
                    </div>
                    <hr id='hrTop'>
                    <img src="/ressources/icon/exchange.svg" alt="exchangeIcoSVG">
                    <hr id='hrBottom'>
                    <div class='priceContainer' id='priceContainer'>
                        <div class='iconContainer'>
                            <i class="icon-minecraft icon-minecraft-${sd.itemPriceName.toLowerCase().replace('_', '-')}"></i>
                        </div>
                        <div class='priceTitle'><span class='pricePrice'>${sd.itemPrice}</span><span class='priceName'>${sd.itemPriceName.toLowerCase().replace('_', ' ')}</span></div>
                    </div>
                </div>
                <div class='shopInfo'>
                    <div class='shopOwner'>
                        <div class='shopOwnerTitle'>Propriétaire</div>
                        <div class='shopOwnerName'>${pseudo[sd.owner]}</div>
                    </div>
                    <div class='shopPosition'>
                        <div class='shopPositionTitle'>Position</div>
                        <div class='shopPositionValue'>${sd.location}</div>
                    </div>
                    <div class='shopTrade'>
                        <div class='shopTradeTitle'>Popularité</div>
                        <div class='shopTradeValue'>${sd.trade}</div>
                    </div>
                    <div class='shopHistory'>
                        <img src="/ressources/icon/list.svg" alt="listIcoSVG" class="historynh">
                        <div class='shopHistoryTitle historynh'>Historique des ventes</div>
                    </div>
                </div>
            </div>`
            return shopContainer
        }

        let constructAllListSort = () => {

            data.sort((a, b) => {return a.itemPriceName.localeCompare(b.itemPriceName);})

            $('.allShopContainer').html('')
            $('.allShopContainer').removeClass('allShopContainer_playersort allShopContainer_popsort')
    
            let shopList = []
            let nc = 0
            isClickObj = {}

            for (let shopData of data) {
    
                let shopDesignation = shopData.owner + shopData.itemPriceName.toLowerCase().replace('_', '-')
    
                if (!shopList.includes(shopDesignation) || shopData.itemPriceName == 'ENCHANTED_BOOK') {
                    shopList.push(shopDesignation)
                    nc ++
                    isClickObj[nc] = false
                    let shopContainer = constructShopItem(shopData, nc)
    
                    $('.allShopContainer').append(shopContainer)                
                }
            }
    
            for (let n = 1; n <= nc; n++) {
                setTimeout(function(){
                    $(`#shop-${n}`).addClass('shopEntranceAnim')
                }, 50 * n); 
            }

            initClickEvents()
        }

        let constructPlayerSort = () => {

            let playerShops = {}

            for (let shopData of data) {
                if (shopData['owner'] in playerShops) {
                    playerShops[shopData['owner']].push(shopData)
                }
                else {
                    playerShops[shopData['owner']] = []
                    playerShops[shopData['owner']].push(shopData)
                }
            }

            $('.allShopContainer').html('')
            $('.allShopContainer').removeClass('allShopContainer_popsort')
            $('.allShopContainer').addClass('allShopContainer_playersort')

            let playerShopsKeys = Object.keys(playerShops).sort(function(a,b){return playerShops[b].length-playerShops[a].length})
            let shopList = []
            let newData = []
            let nc = 0
            isClickObj = {}

            for (let playerID of playerShopsKeys) {

                let playerContainer = `<div class='playerName' id=playername-${playerID}>${pseudo[playerID]}</div><div class='playerContainer' id=player-${playerID}></div>`
                $('.allShopContainer').append(playerContainer)

                for (let shopData of playerShops[playerID]) {

                    newData.push(shopData)

                    let shopDesignation = shopData.owner + shopData.itemPriceName.toLowerCase().replace('_', '-')
        
                    if (!shopList.includes(shopDesignation) || shopData.itemPriceName == 'ENCHANTED_BOOK') {
                        shopList.push(shopDesignation)
                        nc ++
                        isClickObj[nc] = false
                        let shopContainer = constructShopItem(shopData, nc)
        
                        $(`#player-${playerID}`).append(shopContainer)                
                    }
                }
            }

            let n = 1
            for (let playerID of playerShopsKeys) {
                $(`#playername-${playerID}`).on('click', () => {
                    window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/player/${playerID}`
                })
                setTimeout(function(){
                    $(`#player-${playerID}, #playername-${playerID}`).addClass('playerBorderAnim')
                    $(`#player-${playerID} .shopContainer`).addClass('shopEntranceAnim')
                }, 150 * n);  
                n++ 
            }

            data = newData

            console.log(shopList)

            initClickEvents()
        }

        let constructPopularitySort = () => {

            data.sort((a, b) => {return b.trade - a.trade;})

            $('.allShopContainer').html('')
            $('.allShopContainer').removeClass('allShopContainer_playersort')
            $('.allShopContainer').addClass('allShopContainer_popsort')
    
            let shopList = []
            let nc = 0
            isClickObj = {}

            let top3Container = `<div class='top3Container'><p>Top 3 des articles les plus vendus</p></div>`
            $('.allShopContainer').append(top3Container)

            for (let n = 0; n <= 2; n++) {
                let shopData = data[n]
                let shopDesignation = shopData.owner + shopData.itemPriceName.toLowerCase().replace('_', '-')
                shopList.push(shopDesignation)
                nc ++
                isClickObj[nc] = false
                let shopContainer = constructShopItem(shopData, nc)
                let score = `<div class='top top${n+1}'>N°${n+1} avec ${shopData.trade} achats</div>`

                $('.top3Container').append(shopContainer)
                $('.top3Container').append(score)
            }

            let otherPop = `<div class='otherPop'><p>Autre articles populaires</p></div>`
            $('.allShopContainer').append(otherPop)
            let notPop = `<div class='notPop'><p>Articles impopulaires</p></div>`
            $('.allShopContainer').append(notPop)

            for (let n = 3; n < data.length; n++) {
                let shopData = data[n]
                let shopDesignation = shopData.owner + shopData.itemPriceName.toLowerCase().replace('_', '-')
                shopList.push(shopDesignation)
                nc ++
                isClickObj[nc] = false
                let shopContainer = constructShopItem(shopData, nc)
                let score = `<div class='topbis top${n+1}'><span>N°${n+1}</span><span>${shopData.trade} achats</span></div>`

                if (shopData.trade > 2) {$('.otherPop').append(score);$('.otherPop').append(shopContainer);}
                else {$('.notPop').append(score);$('.notPop').append(shopContainer);}
                
            }
    
            for (let n = 0; n <= nc; n++) {
                setTimeout(function(){
                    if (n<3) {$(`.top${n+1}`).addClass('top3Anim')}
                    else {$(`.top${n+1}`).addClass('topbisAnim')}
                    $(`#shop-${n}`).addClass('shopEntranceAnim')
                }, 50 * n); 
            }

            initClickEvents()
        }

        let constructPriceSort = () => {

            data.sort((a, b) => {return b.itemQuantity - a.itemQuantity;})

            $('.allShopContainer').html('')
            $('.allShopContainer').removeClass('allShopContainer_playersort')
            $('.allShopContainer').addClass('allShopContainer_popsort')
    
            let shopList = []
            let nc = 0
            isClickObj = {}

            let top3Container = `<div class='topPriceContainer'><p>Articles les plus chers</p></div>`
            $('.allShopContainer').append(top3Container)

            for (let n = 0; n <= 2; n++) {
                let shopData = data[n]
                let shopDesignation = shopData.owner + shopData.itemPriceName.toLowerCase().replace('_', '-')
                shopList.push(shopDesignation)
                nc ++
                isClickObj[nc] = false
                let shopContainer = constructShopItem(shopData, nc)

                $('.topPriceContainer').append(shopContainer)
            }

            let onediamond = `<div class='onediamond'><p>Articles à 1 diamant seulement !</p></div>`
            $('.allShopContainer').append(onediamond)
            let otherprice = `<div class='otherprice'><p>Autres prix dans l'ordre décroissant</p></div>`
            $('.allShopContainer').append(otherprice)

            for (let n = 3; n < data.length; n++) {
                let shopData = data[n]
                let shopDesignation = shopData.owner + shopData.itemPriceName.toLowerCase().replace('_', '-')
                shopList.push(shopDesignation)
                nc ++
                isClickObj[nc] = false
                let shopContainer = constructShopItem(shopData, nc)

                if (shopData.itemQuantity == 1) {$('.onediamond').append(shopContainer);}
                else {$('.otherprice').append(shopContainer);}
                
            }
    
            for (let n = 0; n <= nc; n++) {
                setTimeout(function(){
                    $(`#shop-${n}`).addClass('shopEntranceAnim')
                }, 50 * n); 
            }

            initClickEvents()
        }

        let constructResearchListSort = (c) => {

            data.sort((a, b) => {return a.itemPriceName.localeCompare(b.itemPriceName);})

            if (c != '') {

                $('.allShopContainer').html('')
                $('.allShopContainer').removeClass('allShopContainer_playersort allShopContainer_popsort')
        
                let shopList = []
                let nc = 0
                isClickObj = {}

                for (let shopData of data) {
        
                    let shopDesignation = shopData.owner + shopData.itemPriceName.toLowerCase().replace('_', '-')
        
                    if ((!shopList.includes(shopDesignation) || shopData.itemPriceName == 'ENCHANTED_BOOK') && (shopData.itemPriceName.toLowerCase()).includes(c)) {
                        shopList.push(shopDesignation)
                        nc ++
                        isClickObj[nc] = false
                        let shopContainer = constructShopItem(shopData, nc)
        
                        $('.allShopContainer').append(shopContainer)                
                    }
                }
        
                for (let n = 1; n <= nc; n++) {
                    setTimeout(function(){
                        $(`#shop-${n}`).addClass('shopEntranceAnim')
                    }, 10 * n); 
                }

                initClickEvents()                
            }
            else {
                let select_value = $('.sort_select_c>select').val()

                if (select_value === 'all') {constructAllListSort()}
                if (select_value === 'player') {constructPlayerSort()}
                if (select_value === 'popularity') {constructPopularitySort()}
                if (select_value === 'price') {constructPriceSort()}
            }
        }

        if(mobileCheck()) {constructAllListSort()}
        else{constructPopularitySort()}

        $('.sort_select_c>select').prop('selectedIndex', 2);
        $('.sort_select_c, .search_c').css('transform', 'translateY(0%)')
        $('.sort_select_c, .search_c').css('opacity', 1)

        $('.sort_select_c>select').on('change', () => {

            let select_value = $('.sort_select_c>select').val()

            if (select_value === 'all') {constructAllListSort()}
            if (select_value === 'player') {constructPlayerSort()}
            if (select_value === 'popularity') {constructPopularitySort()}
            if (select_value === 'price') {constructPriceSort()}

        })

        $('.search_c>input').on('input', () => {
            constructResearchListSort($('.search_c>input').val())
        })
    })
  }
}

var initPage = () => {

    // side button hover
    const sideb = $(".side_b")

    sideb.on('mouseover', (e) => {
        $(e.target).find('img').css("filter", "opacity(1)");
        $(e.target).find('p').css("text-shadow", "0 0 0 rgba(255,255,255,1)");
    });
  
    sideb.on('mouseout', (e) => {
        $(e.target).find('img').css("filter", "opacity(0.5)");
        $(e.target).find('p').css("text-shadow", "0 0 0 rgba(255,255,255,0.5)");
    });
  
    sideb.on('click', (e) => {
        if (e.target.id.split('_')[0] !== 'dynmap') window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/${e.target.id.split('_')[0]}`
      })
    
    $('#dynmap_b').on('click', () => {
    window.open(
        'https://bluemap.survival.gameinbox.net/',
        '_blank'
    )})
}

var displayTradeHistoryPopUp = (shopData, pseudo, totaltrade) => {

    $('.tradeList, .svalue').empty();

    $('.topbar, .allShopContainer').addClass('blur')
    $('.tradeHistobg, .tradeHisto').removeClass('hidePopUp')
    $('.tradeHistobg, .tradeHisto').addClass('showPopUp')

    $('.backbutton').on('click', () => {
        $('.tradeHistobg, .tradeHisto').removeClass('showPopUp')
        $('.tradeHistobg, .tradeHisto').addClass('animHidePopUp')
        setTimeout(()=>{$('.topbar, .allShopContainer').removeClass('blur')}, 300); 
        setTimeout(()=>{$('.tradeHistobg, .tradeHisto').addClass('hidePopUp')}, 400); 
    })

    let tradeHistory = shopData.tradehistory
    if (tradeHistory.length != 0) {
        let totalSale = 0
        let totalIncome = 0
        let lastData = [tradeHistory[0]['created_at'], tradeHistory[0]['player_id'], 0, 0]
        for (let trade of tradeHistory) {
            totalSale += trade.quantity
            totalIncome += shopData.itemQuantity * trade.quantity
            let date_diff = Math.abs(new Date(trade.created_at) - new Date(lastData[0]))
            if (date_diff > 3600 || lastData[1] != trade.player_id) {
                let trade_item_html = `
                <div class="trade_item">
                    <div class="trade_date">${new Date(lastData[0]).toLocaleDateString("fr")} à ${new Date(lastData[0]).toLocaleTimeString("fr")}</div>
                    <div class="trade_desc">
                        <div class="header">A vendu</div>
                        <div class="item_sold_quantity">${lastData[2]*shopData.itemPrice}</div>
                        <div class="item_sold">${shopData.itemPriceName.toLowerCase().replace('_', ' ')}</div>
                        <div class="middler">pour</div>
                        <div class="price">${lastData[3]}</div>
                        <div class="price_type">${shopData.itemName}</div>
                    </div>
                    <div class="buyer_desc">
                        <div class="header">Acheté par</div>
                        <p class="buyer_name">${pseudo[lastData[1]]}</p>
                    </div>
                </div>
                `
                $('.tradeList').append(trade_item_html)
                lastData[0] = trade.created_at
                lastData[1] = trade.player_id
                lastData[2] = trade.quantity
                lastData[3] = shopData.itemQuantity * trade.quantity
            }
            else {
                lastData[0] = trade.created_at
                lastData[1] = trade.player_id
                lastData[2] += trade.quantity
                lastData[3] += shopData.itemQuantity * trade.quantity
            }
        }

        let trade_item_html = `
        <div class="trade_item">
            <div class="trade_date">${new Date(lastData[0]).toLocaleDateString("fr")} à ${new Date(lastData[0]).toLocaleTimeString("fr")}</div>
            <div class="trade_desc">
                <div class="header">A vendu</div>
                <div class="item_sold_quantity">${lastData[2]*shopData.itemPrice}</div>
                <div class="item_sold">${shopData.itemPriceName.toLowerCase().replace('_', ' ')}</div>
                <div class="middler">pour</div>
                <div class="price">${lastData[3]}</div>
                <div class="price_type">${shopData.itemName}</div>
            </div>
            <div class="buyer_desc">
                <div class="header">Acheté par</div>
                <div class="buyer_name">${pseudo[lastData[1]]}</div>
            </div>
        </div>
        `
        $('.tradeList').append(trade_item_html)
        $('.saleVolumeC>.svalue').append(totalSale)
        $('.salePartC>.svalue').append(`${(totalSale / totaltrade *100).toFixed(1)}%`)
        $('.estimateIncomeC>.svalue').append(totalIncome)        
    }
    else {
        $('.saleVolumeC>.svalue').append(0)
        $('.salePartC>.svalue').append('0%')
        $('.estimateIncomeC>.svalue').append(0)  
        $('.tradeList').append('<div class="nosales">Aucune vente enregistrée</div>')
    }

}

window.mobileCheck = function() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
};