var socket = io();

var setupListeners = function () {
  side_menu_function()
  
  socket.emit("player_page_loaded");
  new data_listener().init_socket()
}

window.addEventListener("load", setupListeners);

const data_listener = class {

  // init all socket system for the page
  async init_socket() {

    globalThis.playerID = ((window.location.href).split("/")).pop()
    $('#player_b').addClass('current')

    socket.emit('allPlayerDataRequest', playerID)

    socket.on('serverState', (isOnline) => {

      $('.server_state_circle').addClass(isOnline?'server_online':'server_offline')
      $('.server_state_value').text(isOnline?'En ligne':'Hors ligne')
    })

    socket.on('allPlayerData', (PlayerData, ClassData, ShopData, StatData) => {

      if (PlayerData !== null) {
        globalThis.playerPseudo = PlayerData.lastName

        createTop(PlayerData)
        createClassList(ClassData)
        createShopsList(ShopData)
        createStatsList(StatData)

        $('.loader').css('display', 'none')
        $('.topLeftContainer, .topRightContainer, .bottomContainer').css('opacity', '1')        
      }
      else {
        $('.loader').text('Aucun joueur trouvé')
        $('.loader').css('color', 'rgba(255,0,0,0.8)')
      }
    })
  }
}

var side_menu_function = () => {

  // change background and text color when hover side menu button
  const sideb = $(".side_b")
  sideb.mouseover(function() {
      $(this).find('img').css("filter", "opacity(1)");
      $(this).find('p').css("text-shadow", "0 0 0 rgba(255,255,255,1)");
  });
  sideb.mouseout(function() {
      $(this).find('img').css("filter", "opacity(0.5)");
      $(this).find('p').css("text-shadow", "0 0 0 rgba(255,255,255,0.5)");
  });

  sideb.on('click', (e) => {
    if (e.target.id.split('_')[0] !== 'dynmap') window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/${e.target.id.split('_')[0]}`
  })

  $('#dynmap_b').on('click', () => {
    window.open(
      'https://bluemap.survival.gameinbox.net/',
      '_blank'
  )})

  $('.voirPlusClass, .voirPlusStats').on('click', () => {
    window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/statistic`
  }) 

  $('.voirPlusShops').on('click', () => {
    window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/shops`
  })
}

var createTop = (data) => {

  $('.playerSkin').attr('src', `/ressources/players_render/${data.uuid}.png`);
  $('.playerName').text(data.lastName)
  $('.playerUUID span').text(data.uuid)
  $('.playerPlaytime span').text((data.playtime / 3600).toFixed(2) + 'h')
  $('.playerJoinDate span').text(`${new Date(data.joinDate).toLocaleDateString("fr")} à ${new Date(data.joinDate).toLocaleTimeString("fr")}`)
  $('.playerLastDate span').text(data.lastDate === null ? 'En ligne' : `${new Date(data.lastDate).toLocaleDateString("fr")} à ${new Date(data.lastDate).toLocaleTimeString("fr")}`)
  $('.playerSucessMade span').text(`${data.achievementDone}`)

  try {
    let coord = JSON.parse(data.base)
    $('.x .value').text(`${coord['x'].toFixed(0)}`)
    $('.y .value').text(`${coord['y'].toFixed(0)}`)
    $('.z .value').text(`${coord['z'].toFixed(0)}`)
  }
  catch(e) {
    $('.y .value').text(`Non renseigné`)
    $('.y .value').css('color', 'rgba(5,96,253,1)')
    $('.desc').css('display', 'none')
  }

  $('.topRightContainer').on('mouseover', () => {

    $('.baseCoord .desc').css('transform', 'translateY(-20%)')
    $('.baseCoord .desc').removeClass('coordHide')
  })

  $('.topRightContainer').on('mouseout', () => {

    $('.baseCoord .desc').css('transform', 'translateY(-50%)')
    $('.baseCoord .desc').addClass('coordHide')
  })
}

var createClassList = (data) => {

  $('.classListItem').each(function(i, obj) {

    try {
      $(obj).find('.classPos').text('#' + data[i].position)
      $(obj).find('.className').text(data[i].classTitle)
      $(obj).on('click', () => {
        window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/statistic/${data[i].classID}`
      }) 
    }
    catch(e) {
      $(obj).find('.className').text("Aucune donnée")
    }
  }); 

  $('.classListTile span').text(playerPseudo)
}

var createShopsList = (data) => {

  $('.shopsListTile span, .noShops span').text(playerPseudo)

  if (data !== []) {

    let index = 0
    for (let shopData of data) {

      if (index <= 2) {
        
        let shopLine = `
        <div class='shopLine' id=shop-${index}>
            <div class='itemContainer'>
                <div class='iconContainer'>
                  <i class="icon-minecraft icon-minecraft-${shopData.itemName.toLowerCase().replace('_', '-')}"></i>
                </div>
                <div class='itemTitle'><span class='itemPrice'>${shopData.itemPrice}</span><span class='itemName'>${shopData.itemName.toLowerCase().replace('_', ' ')}</span></div>
            </div>
            <hr id='hrTop'>
            <img src="/shops/content/exchange.svg" alt="exchangeIcoSVG">
            <hr id='hrBottom'>
            <div class='priceContainer' id='priceContainer'>
                <div class='iconContainer'>
                  <i class="icon-minecraft icon-minecraft-${shopData.itemPriceName.toLowerCase().replace('_', '-')}"></i>
                </div>
                <div class='priceTitle'><span class='pricePrice'>${shopData.itemQuantity}</span><span class='priceName'>${shopData.itemPriceName.toLowerCase().replace('_', ' ')}</span></div>
            </div>
            <div class='locationContainer'>
                <img src="/shops/content/location.svg" alt="locationIcoSVG">
                <div class='locationTitle'>${shopData.location[0]} ${shopData.location[1]} ${shopData.location[2]}</div>
            </div>
        </div>`

        $('.shopContainer').append(shopLine)
        $('.noShops').css('display', 'none')
      }
      else {
        $('.playerHasMore').css('opacity', 1)
        $('.playerHasMore').text(`+${index - 2} autres shops`)
      }

      index ++
    }
  }
}

var createStatsList = (data) => {

  let entries = Object.entries(data)
  for (let [statID, statData] of entries) {

    let value = statData.value === undefined ? "Aucune donnée" : statData.value + (statData.unit === null ? "" : statData.unit)
    let statsLine = `
    <div class='statsLine' id='${statID}'>
      <div class='statsTitle'>${statData.title}</div>
      <div class='statsValue'>${value}</div>
    </div>  `

    $('.statsList').append(statsLine)
  }

  $(`.statsLine`).on('click', (e) => {
    window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/statistic/${e.target.id}`
  }) 

  $('.statsListTile span').text(playerPseudo)
}