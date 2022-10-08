const monthNames = ["Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Decembre"];
var HomeVisited = false
var StatVisited = false
var PlayerVisited = false
var socket = io();

var setupListeners = function () {

  socket.emit("home_page_loaded");
  new data_listener().init_socket()

  side_menu_function()
  button_emit()
  search_engine()
  docPanelFunction()
}

window.addEventListener("load", setupListeners);

const data_listener = class {

  // create socket for graph updates
  create_socket(args) {
    return function(data) {

      $('.graph_box_c').css('opacity','0');
      
      try { playerChart.destroy(); }
      catch (err) {};

      switch_graph_container();

      $(args[1]).text(args[2]);
      player_chart(args[0], data, args[3], args[4], args[5]);

      setTimeout(() => {
        $('.graph_box_c').css('opacity','1');

      }, 100);
    };
  };

  // init all socket system for the page
  init_socket() {

    // display window depending of url route
    if (json_data == 'accueil') {
      $('#accueil_w').css('display', 'grid')
      $('#accueil_w').css('opacity', '1')
      $('#accueil_b').addClass('current')
      socket.emit('accueil_data_request')
      HomeVisited = true
    }

    if (json_data == 'statistic') {
      $('#statistic_w').css('display', 'grid')
      $('#statistic_w').css('opacity', '1')
      $('#statistic_b').addClass('current')
      socket.emit('stat_w_request')
      StatVisited = true
    }

    if (json_data == 'player') {
      $('#player_w').css('display', 'grid')
      $('#player_w').css('opacity', '1')
      $('#player_b').addClass('current')
      socket.emit('player_list_request')
    }

    if (json_data.substring(0,3) == 'doc') {
      $('#doc_w').css('display', 'grid')
      $('#doc_w').css('opacity', '1')
      $('#doc_b').addClass('current')
      let sub = json_data.split(',')[1]
      console.log(sub)
      setTimeout(function() {
      if (sub === '') $(`#general-b`).trigger("click")
      else $(`#${sub}-b`).trigger("click")
      }, 10);
    }

    socket.on('serverState', (isOnline) => {

      $('.server_state_circle').addClass(isOnline?'server_online':'server_offline')
      $('.server_state_value').text(isOnline?'En ligne':'Hors ligne')
    })

    // manage data for home page and create graph and all the shit
    socket.on('home_data', (data) => {

      $('.mw_box')[0].click();
      player_online_function(data['player_c'])
      tps_function(data['tps_c'])
      setSDJData(data['sdj'])

      $('.mw_box, #statistic_c').css('opacity', 1)
      $('.mw_box, #statistic_c').css('transform', 'translateY(0)')
    })

    // manage the data coming from the server for graph updates
    var listener = [
      ['pa24h', '#p_graph_title', 'Joueurs en ligne pendant les dernières 24h', 'p_player_chart', 27, 'Joueurs en ligne'],
      ['pa1w', '#p_graph_title', 'Joueurs en ligne pendant la dernière semaine', 'p_player_chart', 27, 'Joueurs en ligne'],
      ['pa1m', '#p_graph_title', 'Joueurs en ligne pendant le dernier mois', 'p_player_chart', 27, 'Joueurs en ligne'],
      ['tps1h', '#tps_graph_title', 'Evolution des TPS pendant la derniere heure', 'tps_player_chart', 20, 'TPS'],
      ['tps24h', '#tps_graph_title', 'Evolution des TPS pendant les dernieres 24 heures', 'tps_player_chart', 20, 'TPS']
    ];
    for (let args of listener) {
      socket.on(args[0], new data_listener().create_socket(args))
    };

    // create new categorie box in statistic page and animate it
    var addnewcat = (i, key1, key2, value) => {
      let newP = document.createElement("p");
      newP.setAttribute('id', `${value['id']}`);
      newP.textContent = `${value['title']}`;
      let parent_node = document.getElementById(`${key1}_c`)
      if (key2 == 'main') {
        newP.setAttribute('class', 'cat_element top_cat');
        let reference_node = document.getElementById(`${key1}_autre`)
        setTimeout(() => {parent_node.insertBefore(newP, reference_node)}, i*50);
      }
      if (key2 == 'sub') {
        newP.setAttribute('class', 'cat_element');
        setTimeout(() => {parent_node.appendChild(newP)}, (i*50)+150);
      }
    }
    socket.on('stat_w_data', (data) => {
      for (const [key1, value1] of Object.entries(data)) {
        for (const [key2, value2] of Object.entries(value1)) {
          setTimeout(() => {
            for (let i = 0; i<(value2.length); i++ ) {addnewcat(i, key1, key2, value2[i])}
          }, 180);
      }}
      setTimeout(() => {$('.sous_cat_o').css('visibility','visible')}, 300);
    })

    // create player box in player list
    socket.on('player_list_data', (playerList) => {

      globalThis.playerList

      if (!PlayerVisited) {

        const sortable = Object.fromEntries(
          Object.entries(playerList).sort(
            ([,a],[,b]) => a['name'].toLowerCase().localeCompare(b['name'].toLowerCase())
            )
        )

        console.log(sortable)
        console.log(playerList)

        let playerListEntries = Object.entries(sortable)
        for (let [playerUUID, playerInfo] of playerListEntries) {

          var newplayercard =
          ` <div class='player_card_c' id='${playerUUID}'>
              <img src='/ressources/players_render/${playerUUID}.png' class='player_skin' alt="Image en cours de traitement">
              <div class='statut'><p class='statutPinging'>Pinging...</p></div>
              <div class='text_c'>
                <p class='player_name'>${playerInfo.name}</p>
                <p class='hour_play'>Pinging...</p>
              </div>
            </div>  `
          $('#p_main_c').append(newplayercard);
        }

        PlayerVisited = true
      }

      socket.on('playerPlaytimeData', (PlaytimeData, playerList) => {

        let PlaytimeDataEntries = Object.entries(PlaytimeData)
        for (let [id, playTime] of PlaytimeDataEntries) {

          let playTimeHour = (playTime / 3600).toFixed(2)
          $(`#${playerList[id].uuid} .hour_play`).text(playTimeHour + "h jouées")
        }
      })

      socket.on('playerOnlineData', (OnlineData, playerList) => {

        let OnlineDataEntries = Object.entries(OnlineData)
        let onlineComp = {true:"En ligne", false:"Hors ligne"}
        for (let [id, isOnline] of OnlineDataEntries) {

          $(`#${playerList[id].uuid} .statutPinging`).removeClass('offline online')
          if (isOnline) $(`#${playerList[id].uuid} .statutPinging`).addClass('online')
          else $(`#${playerList[id].uuid} .statutPinging`).addClass('offline')
          $(`#${playerList[id].uuid} .statutPinging`).text(onlineComp[isOnline])
        }
      })
    });

    socket.on('sdj', (data) => {

      console.log(data)
    })

  };
}

var button_emit = () => {

  // emit data request to the serveur when button clicked
  // player graph buttons clicked
  $('.p_btn_graph').click( (event) => {

    let btn_id = event.target.id
    socket.emit('graph_request', btn_id);
  });

  // tps graph buttons clicked
  $('.tps_btn_graph').click( (event) => {
    let btn_id = event.target.id

    if (btn_id == '') {btn_id = (event.target.parentElement.id)}

    socket.emit('graph_request', btn_id);
  });

  // accueil box clicked
  $('.mw_box').click( (event) => {
    switch_graph_container = () => {
      let id = event.target.id
      let check = (cid) => {return (id == cid ? "grid" : "none")}

      $('#player_graph_c').css("display",check('player'))
      $('#tps_graph_c').css("display",check('tps'))
      $('#sdj_graph_c').css("display",check('sdj'))
    }

    let id = event.target.id
    if (id=='player') {socket.emit('graph_request', 'pa24h')}
    if (id=='tps') {socket.emit('graph_request', 'tps1h')}
  });

  // side menu button clicked
  $(".side_b").on('click', (event) => {
    let id = event.target.id

    if (id !== 'dynmap_b') {
      let bg = {'accueil':'1','player':'2','statistic':'3','doc':'2'}

      $('.current').removeClass('current')
      $(`#${id}`).addClass('current')

      history.pushState({'page_id':id.split('_')[0]}, `${id.split('_')[0]}` , `/gameinbox/${id.split('_')[0]}/`)

      // background animation and window switch animation
      hidew = (w) => {
        setTimeout(function(){$(`#${w}_w`).css('display','none');}, 150);
        setTimeout(function(){$('#bg').removeClass(`bg${bg[w]}`);}, 100);
      }
      
      for (w of ['accueil','player','statistic','doc']) {
        if (w != id.split('_')[0]) {
          $(`#${w}_w`).css('opacity','0')
          $(`#bg`).css('opacity','0')
          hidew(w)
      }}

      setTimeout(() => {$(`#${id.split('_')[0]}_w`).css('display','grid')}, 150); 
      setTimeout(() => {$(`#${id.split('_')[0]}_w`).css('opacity','1')}, 180);
      setTimeout(() => {$('#bg').addClass(`bg${bg[id.split('_')[0]]}`)}, 100); 
      setTimeout(() => {$(`#bg`).css('opacity','1')}, 180);

      if ( id == 'accueil_b' ) {
        socket.emit('accueil_data_request')
      }

      if( id == 'statistic_b' ) {   
        if (!StatVisited) {socket.emit('stat_w_request')}
        StatVisited = true
      }
      
      if( id == 'player_b' ) {
        socket.emit('player_list_request')
      }      
    }
  });

  // player card clicked
  $('#p_main_c').on( "click", ".player_card_c", function() {
    window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/player/${this.id}`
  })

  // statistique element clicked
  $('.element_c').on( "click", ".cat_element", function() {
    window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/statistic/${this.id}`
  })
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

  $('#dynmap_b').on('click', () => {
    window.open(
      'https://bluemap.survival.gameinbox.net/',
      '_blank'
  )})
}

var player_online_function = (player_c_data) => {

  $('#container').text('')

  // manage up/down arrow of the number of player box
  globalThis.online_player = player_c_data[0];
  globalThis.total_player = player_c_data[1];

  var bar = new ProgressBar.SemiCircle(container, {
    strokeWidth: 6,
    color: 'rgba(255,255,255,0.2)',
    trailColor: 'rgba(255,255,255,0.2)',
    trailWidth: 6,
    easing: 'easeInOut',
    duration: 1000,
    svgStyle: null,
    text: {
      value: '',
      alignToBottom: false
    },
    from: {color: 'rgba(0,0,125,0.8)'},
    to: {color: 'rgba(5,96,253,0.8)'},
    step: (state, bar) => {
      bar.path.setAttribute('stroke', state.color);
      bar.setText(Math.round(bar.value()*total_player) + '/' + total_player);
      bar.text.style.color = 'rgba(5,96,253,0.75)';
    }
    });

  bar.text.style.fontFamily = "'Google Sans', sans-serif";
  bar.animate(online_player / total_player);

  let aveP = parseFloat(player_c_data[3])
  let playerEvol = (((online_player - aveP) / aveP)*100).toFixed(0)

  let sign = Math.sign(playerEvol)
  if (sign == 1 || sign == 0 ) $('#arrow').addClass('arrowup')
  else $('#arrow').addClass('arrowdown')
  $('#arrow').css('opacity', 1)
  
  $('#compare_title').text(`${playerEvol}%`)
}

var tps_function = (tps_data) => {

  // change color of tps and animates numbers
  let  i = 0
  for (let dom of [$('#value_now') , $('#value_1h'), $('#value_24h')]) {
    dom.html(tps_data[i]);
    dom.removeClass()

    if (tps_data[i] < 15) {dom.toggleClass('tps_bad')}
    else if (tps_data[i] < 18) {dom.toggleClass('tps_ok')}
    else {dom.toggleClass('tps_good')};

    let confirmTPS = (tps) => {setTimeout(() => {dom.text(parseFloat(tps).toFixed(2))}, 510);}

    jQuery({ Counter: 0 }).animate({ Counter: tps_data[i] }, {
      duration: 500,
      easing: 'swing',
      complete: function () {dom.text(tps_data[i])},
      step: function () {
        dom.text(this.Counter.toFixed(2));
      }
    })

    confirmTPS(tps_data[i])

    i ++;
  }
}

var setSDJData = (data) => {

  $('.sdjStatTitle span').text(data.title)
  $('.sdjStatPlayer').text(data.player)
  $('.sdjStatValue').text(data.value + (data.unit === null ? "" : data.unit))

  $('#sdj').on('click', () => {
    window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/statistic/${data.id}`
  })
}

var search_engine = () => {

  // function for searching player in player window
  $('#player_search').on('input', function() { 
    $('.player_card_c').each( (index, valeur) => {
      let name = $(valeur).find('.player_name').text().toLowerCase()
      if (!name.includes($(this).val().toLowerCase())) {
        $(valeur).css('display','none')
      }
      else {$(valeur).css('display','grid')}
    })
  })
}

var player_chart = (period , redis_data, container_id, xmax, g_label) => {

  // console.log(JSON.parse(redis_data))

  // create chart
  if (redis_data[0] === '[') redis_data = (JSON.parse(redis_data))
  else redis_data = (JSON.parse(`[${redis_data}]`))
  var rotate_v = 0;
  var minx
  var pointR = 2
  var ymax = 20
  var isStepped = false

  if (period == 'tps1h') minx = new Date((new Date()).setHours((new Date()).getHours()-1))
  if (period == 'tps24h') minx = new Date((new Date()).setHours((new Date()).getHours()-24))

  if (period == 'pa24h') minx = new Date((new Date()).setHours((new Date()).getHours()-24))
  if (period == 'pa1w') minx = new Date((new Date()).setDate((new Date()).getDate()-7))
  if (period == 'pa1m') minx = new Date((new Date()).setMonth((new Date()).getMonth()-1))

  if (period == 'pa24h' || period == 'pa1w' || period == 'pa1m') {
    pointR = 0;
    ymax = total_player;
    isStepped = true
    let currentPlayerA = {}
    currentPlayerA['x'] = new Date()
    currentPlayerA['y'] = online_player
    redis_data.push(currentPlayerA)
  }

  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    rotate_v = 50
  }

  var ctx = document.getElementById(container_id).getContext('2d');
  globalThis.playerChart = new Chart(ctx, {
      type: 'line',
      data: {
          datasets: [{
              data: redis_data,
              backgroundColor: [
                'rgba(0, 153, 255, 0.25)'
              ],
              borderColor: [
                'rgba(0, 153, 255, 0.6)'
              ],
              borderWidth: 1,
              pointRadius: pointR,
              fill: {
                target: 'origin',
                above: 'rgba(5,96,253,0.05)'
              },
              stepped: isStepped,
          }]
      },
      
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: ymax,
            ticks: {
              font: {
                family: "'Google Sans', sans-serif"
              }
            }
          },
          x: {
            type: 'time',
            time: {
              unit: 'minute'
            },
            min: minx,
            max: new Date(),
            ticks: {
              font: {
                family: "'Google Sans', sans-serif",
                size: '9vh'
              } ,               
              autoSkip: false,
              maxRotation: rotate_v,
              minRotation: rotate_v
            }
          }
        } ,
        plugins: {
          legend: {
            display: false
          }
        } ,  
        animation: {
          duration: 0
        },    
        responsive: true,
        maintainAspectRatio: false,
        parsing: true
      }
  });

}

var docPanelFunction = () => {

  let previousPanelID = 'general'
  $('.selectDocCat').on('click', async (event) => {
    let catBID = (event.target.id).split('-')[0]
    $('.docSelect').removeClass('docSelect')
    $('#' + event.target.id).addClass('docSelect')
    $('#' + previousPanelID).css('display', 'none')
    $('#' + previousPanelID).css('opacity', 0)
    $('#' + catBID).css('display', 'block')
    $('#' + catBID).css('opacity', 1)
    previousPanelID = catBID
    history.pushState({'page_id':'doc-'+catBID}, `${catBID}` , `/gameinbox/doc/${catBID}/`)
  }) 
}