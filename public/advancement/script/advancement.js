var socket = io();
globalThis.selectCat = 'story'

var setupListeners = function () {

    initPage()

    socket.emit("advancement_page_loaded");
    new data_listener().init_socket()

    catButton()
}

window.addEventListener("load", setupListeners);

const data_listener = class {

    async init_socket() {

      $('#statistic_b').addClass('current')
      socket.emit('advancement_request', selectCat)

      socket.on('serverState', (isOnline) => {

        $('.server_state_circle').addClass(isOnline?'server_online':'server_offline')
        $('.server_state_value').text(isOnline?'En ligne':'Hors ligne')
      })

      socket.on('advancement_data', async (data, totalPlayer, completionData) => {

        globalThis.lineCounter = 0

        let entries = Object.entries(data)
        for (let [, values] of entries) {

          createTableLine(values, totalPlayer, completionData)

          $(`.advancementTableC`).css('opacity' , 1)
        }

        trclick(data)
      })
    }
}

var initPage = () => {

    //* init side_menu fonctions
    // change background and text color when hover side menu button
    const sideb = $(".side_b")

    sideb.on('mouseover', (e) => {
        $(e.target).find('img').css("filter", "opacity(1)");
        $(e.target).find('p').css("text-shadow", "0 0 0 rgba(255,255,255,1)");
    });

    sideb.on('mouseout', (e) => {
        $(e.target).find('img').css("filter", "opacity(0.5)");
        $(e.target).find('p').css("text-shadow", "0 0 0 rgba(255,255,255,0.5)");
    });

    $('.side_b').on('click', (e) => {
      window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/${e.target.id.split('_')[0]}`
    }) 
}

var createTableLine = (catData, totalPlayer, completionData) => {

  lineCounter ++

  let img = catData['img']
  let id = catData['id'].split('/')[1]
  let cat = catData['id'].split('/')[0]
  let titlefr = catData['titleFR']
  let titleen = selectCat === 'custom' ? (Object.keys(catData.tier).length + (Object.keys(catData.tier).length === 1 ? " tier" : " tiers")) : catData['titleEN']
  let descfr = catData['descFR']
  let type = catData['type']
  let visibility = catData['visibility']
  let playerComplete = completionData[`${cat}${id}`]
  let pourcentage = `${Math.round((playerComplete / totalPlayer) * 100)}%`

  $(`<tr id=${id}>
      <td>
        <div class='progresC'>
          <div class='${type} visi${visibility}'><img src=${img}></div>
          <div class='titleC'>
              <div class='frtitle'>${titlefr}</div>
              <div class='entitle'>${titleen}</div>
          </div>
        </div>
      </td>
      <td>
        <div class='descC'>
          <div>${descfr}</div>
        </div>
      </td>
      <td>
        <div class='pourcentC'>
          <div class='pourcentage'>${pourcentage}</div>
          <div class="progressC">
            <div class="progressBar"></div>
          </div>
          <div class='playerNumber'>${playerComplete}/${totalPlayer}</div>
        </div>
      </td>
    </tr>` ).appendTo(".tbodySucces");

  setTimeout(function() {
    $(`#${id} .progressBar`).css('width', `${pourcentage}`);
    $(`#${id} .titleC`).addClass('titlecanim');
    $(`#${id} .descC div:first-child`).css('opacity', 1);
    $(`#${id} .progresC`).css('opacity', 1)
    $(`#${id} .progressC`).css('opacity', 1)
  }, 100 * lineCounter);
}

var catButton = () => {

  $('.selectAdvancementButtonC').on('click', (e) => {
    
    selectCat = e.target.classList[1];

    $('.select').removeClass('select')
    $(`.${selectCat}`).addClass('select')

    $(`.advancementTableC`).css('opacity' , 0)
    setTimeout(function() {

      $('tbody tr').remove()
      socket.emit('advancement_request', selectCat)
    }, 350);

  })
}

var trclick = (data) => {

  $('tbody tr').on('click', (e) => {

    $('.title_c, .selectAdvancementType, .advancementTableC').css('filter', 'blur(3px)')
    $('.popup').css('display', 'grid');

    createPopup(e.target.id, selectCat, data)

    setTimeout(function() {$('.popup').css('opacity', 1 )}, 100);
  })

  $('.goback').on('click', () => {

    $('.title_c, .selectAdvancementType, .advancementTableC').css('filter', 'blur(0px)')
    $('.popup').css('opacity', 0 )

    setTimeout(function() {$('.popup').css('display', 'none');
  $('.playerDetailsListC').empty()}, 300);
  })
}

var createPopup = (advancementID, cat, data) => {

  let frtitle = data[advancementID]['titleFR']
  let entitle = selectCat === 'custom' ? (Object.keys(data[advancementID]['tier']).length + (Object.keys(data[advancementID]['tier']).length === 1 ? " tier" : " tiers")) : data[advancementID]['titleEN']
  let img = data[advancementID]['img']
  let type = data[advancementID]['type']
  let visibility = data[advancementID]['visibility']
  let frdesc = data[advancementID]['descFR']

  $('.popProgresC img').attr('src', img)
  $('.popimgC')[0].className = 'popimgC'
  $('.popimgC').addClass(`popimgC pop${type} pop${visibility}`)
  $('.popfrtitle').text(frtitle)
  $('.popentitle').text(entitle)
  $('.popDescC').text(frdesc)

  if (cat === 'custom') {

    $('.gomcnet').css('opacity', 0)
    $('.gomcnet').off()

    createTierBox(data, advancementID)

    socket.emit('popup_request', advancementID, cat)
  }
  else {

    $('.playerDetailsTier').text('')
    let tierBox = `
    <div class='tierBox' id=tier1>
      <div class='tierNumber'>Aucun tier</div>
    </div>`

    $('.playerDetailsTier').append(tierBox)
    $('.tierNumber').css('margin-right', '0%')

    socket.emit('popup_request', advancementID, cat)

    titlefrnormalize = frtitle.normalize("NFD").replace(/[\u0300-\u036f-?]/g, "")
    titlefrnormalize = titlefrnormalize.replace(/[ -']/g, "-").toLowerCase()
  
    minecraftNetURL = `https://fr-minecraft.net/advancement-${cat}.${advancementID}-${titlefrnormalize}.html`
  
    $('.gomcnet').off()
    $('.gomcnet').on('click', () => {
      window.open(minecraftNetURL,'_blank');
    }) 
    $('.gomcnet').css('opacity', 1)
  }

  socket.once('popup_data', ({redisData, uuidComp}) => {

    console.log('in')

    let entries = Object.entries(redisData)
    let playerListCounter = 0

    for (let [uuid, date] of entries) {

      playerListCounter ++

      let minute = String(new Date(date).getMinutes())
      let hour = String(new Date(date).getHours())
      let day = String(new Date(date).getDate())
      let month = String(new Date(date).getMonth() + 1)
      let year = String(new Date(date).getFullYear())

      if (minute.length < 2) minute = '0' + minute;
      if (hour.length < 2) hour = '0' + hour;
      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;

      let divID = `${advancementID}:${uuid}`.replaceAll(/-|_|:/g,'')

      $(`<div id=${divID}>
          <div class='playerSkin'>
            <img src='/ressources/players_render/${uuid}.png'>
          </div>
          <div class='playerPseudo'>
            <div class='playerbg'></div>
            ${uuidComp[uuid]}
          </div>
          <div class='playerDate'>
            ${day}/${month}/${year} à ${hour}h${minute}
          </div>
        </div>` ).appendTo(".playerDetailsListC");

      setTimeout(function() {
        $(`#${divID}`).css('opacity', 1);
        $(`#${divID}`).css('transform', 'translateY(0%)');
      }, 75 * playerListCounter);
    }
  })
}

var createTierBox = (data, advancementID) => {

  let entries = Object.entries(data[advancementID]['tier'])
  let comp = {'1':'I','2':'II','3':'III','4':'IV','5':'V'}
  $('.playerDetailsTier').text('')

  if (entries.length === 1) {
    let tierBox = `
    <div class='tierBox' id=tier1>
      <div class='tierNumber'>Un seul tier</div>
    </div>`

    $('.playerDetailsTier').append(tierBox)
    $('.tierNumber').css('margin-right', '0%')
  }
  else {
    for (let [keys, value] of entries) {

      let tierBox = `
      <div class='tierBox' id=tier${keys}>
        <div class='tierNumber'>Tier ${comp[keys]}</div>
        <div class='tierValue'>${value}</div>
      </div>`

      $('.tierNumber').css('margin-right', '50%')
      $('.playerDetailsTier').append(tierBox)
    }    
  }
}