var socket = io();

var setupListeners = function () {

  init_page()

  socket.emit("statistique_page_loaded", ((window.location.href).split("/")).pop());
  new data_listener().init_socket()
}

window.addEventListener("load", setupListeners);

const data_listener = class {

  // init all socket system for the page
  async init_socket() {

    $('#statistic_b').addClass('current')
    globalThis.stat_id = ((window.location.href).split("/")).pop()

    socket.emit('statistique_base_request')

    socket.on('serverState', (isOnline) => {

      $('.server_state_circle').addClass(isOnline?'server_online':'server_offline')
      $('.server_state_value').text(isOnline?'En ligne':'Hors ligne')
    })

    socket.on('statistique_base_data', (data) => {

      var main_title
      var sub_title
      const comp = {0:'main', 1:'sub'}
      let temp = data['statistiques'][comp[stat_id[1]]]
      for ( let tobject of temp ) {
        if ( tobject['id'] == stat_id ) {
          main_title = tobject['desc'][0]
          sub_title = tobject['desc'][1]
        }
      }

      $('#class_title').text(main_title)
      $('#title_sub').text(sub_title)

      $('.title_c').css('opacity', '1')

    })

    socket.on('stat_update_avancement', (nTot, nNow) => {

      let statut = String(Math.trunc((nNow / nTot * 100) * 0.25)) + '%'
      $('.progressBar').css('width', statut)
      $('.pourcent').text(statut)
    })

    initChart()
}}

var initChart = () => {

  var startDate = (new Date($('#datepickerStart').datepicker( "getDate" ))).toJSON()
  var endDate = (new Date($('#datepickerEnd').datepicker( "getDate" ))).toJSON()

  const emitOptions = {
    'id' : stat_id,
    'startDate' : startDate,
    'endDate' : endDate,
    'preCalc' : true
  }

  $('.progressBar').css('width', '0%')
  $('.loader .title').text("Obtention des données ...")

  socket.emit('statistique_request', emitOptions)

  socket.once('statistique_data', (data) => {

    if (data !== null) {

      let redisData = data.sessionData

      // manage error if no key or null data
      if (jQuery.isEmptyObject(redisData)) {
        if (redisData === null) {
          console.error('REDIS Error: no redis keycorresponding')
          $('.redisError').find('div').html("ERREUR [No Key]: Impossible de trouver la clé de données associées, essayez de rafraichir la page, si le problème persiste merci de contacter l'administrateur du site.")
        }
        else {
          console.error('REDIS Error: empty data')
          $('.redisError').find('div').html("ERREUR [Empty Data]: Les données associées sont vides, cette erreur peut apparaitre et est normale si aucune donnée n'a encore été généré pour cette catégorie, essayez de rafraichir la page, si le problème persiste merci de contacter l'administrateur du site.")      
        }
        $('.loader').css('opacity', 0)
        $('.more_info_b').css('opacity', 0)
        setTimeout(function(){$('.redisError').css('opacity', 1)}, 50);   
      }

      else {

        if (data.classCorr === null) $('.more_info_b_c').css('display', 'none')

        let keepOldComp = {'old_data_yes old_data_selected': true, 'old_data_no old_data_selected': false}
        let keepOld = keepOldComp[$('.old_data_selected').attr('class')]

        let stackComp = {'stack_yes stack_selected': true, 'stack_no stack_selected': false}
        let stack = stackComp[$('.stack_selected').attr('class')]

        globalThis.player_name = data.pseudo
        globalThis.player_color = data.color

        var parserOptions = {
          "type": data.dataType,
          "stack": stack,
          "keepOld": keepOld,
          "dateRange": [startDate, endDate],
          "unit": data.unit,
          "online": data.online
        }

        initParser(redisData, parserOptions)      
      } 
    }     
    else {
      console.error('STAT Error: no relative stat ID')
      $('.redisError').find('div').html("ERREUR [Stat number]: L'ID de statistique renseigné n'est pas valide.") 
      $('.loader').css('opacity', 0)
      $('.more_info_b').css('opacity', 0)
      setTimeout(function(){$('.redisError').css('opacity', 1)}, 50);  
    }
  })
}

var init_page = () => {

  $('#statistic_b').addClass('current')

  //* set date for date inputs
  $( "#datepickerStart" ).datepicker({
    dateFormat: "dd-mm-yy"
  });
  $( "#datepickerStart" ).datepicker('setDate', new Date(new Date().setDate(new Date().getDate() - 3)));

  $( "#datepickerEnd" ).datepicker({
    dateFormat: "dd-mm-yy"
  });
  $( "#datepickerEnd" ).datepicker('setDate', new Date(new Date().setDate(new Date().getDate() + 1)));

  // $('.date_start_input').val(month_back);

  //* init graph option buttons
  // isoler les données
  $('.old_data_yes,.old_data_no').on('click', (event) => {

    let select_class = event.target.className

    $('.old_data_yes, .old_data_no').removeClass('old_data_selected')
    $(`.${select_class}`).addClass('old_data_selected')

    animateOption('hide')

    setTimeout(initChart(), 260);
  })

  // cumuler les temps
  $('.stack_yes, .stack_no').on('click', (event) => {

    let select_class = event.target.className

    $('.stack_yes, .stack_no').removeClass('stack_selected')
    $(`.${select_class}`).addClass('stack_selected')

    animateOption('hide')

    setTimeout(initChart(), 260); 
  })

  // selectionner plages dates

  $('#datepickerStart, #datepickerEnd').on('change', () => {

    $('.error').css('opacity', 0)

    let start_date = new Date($('#datepickerStart').datepicker( "getDate" ))
    let end_date = new Date($('#datepickerEnd').datepicker( "getDate" ))

    if (start_date >= end_date) {
      $('.chart_c').css('opacity', 0)
      $('.error .error_desc').text("\nLa date de début est plus grande que la date de fin.")
      $('.error').css('opacity', 1)
    }

    else {
      setTimeout(initChart(), 260); 
      animateOption('hide')
    }
    
  });

  // hide/show
  $('.show').on('click', () => {
    myChart.data.datasets.forEach(function(ds) {ds.hidden = null;});
    myChart.update();
  })
  $('.hide').on('click', () => {
    myChart.data.datasets.forEach(function(ds) {ds.hidden = true;});
    myChart.update();
  })

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
    if (e.target.id.split('_')[0] !== 'dynmap') window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/${e.target.id.split('_')[0]}`
  }) 

  $('#dynmap_b').on('click', () => {
    window.open(
      'https://bluemap.survival.gameinbox.net/',
      '_blank'
  )})

  // init more info button
  $('.more_info_b').on('mouseover', (e) => {
    $(e.target).find('span').css("width", "auto");
    setTimeout(function(){$(e.target).find('span').css("opacity", "1");}, 300);
  })
  $('.more_info_b').on('mouseout', (e) => {
    $(e.target).find('span').css("opacity", "0");
    setTimeout(function(){$(e.target).find('span').css("width", "0");}, 300);
  })

  var firstOpen = false
  $('.more_info_b').on('click', () => {
    $('.more_info_c').css('transform', 'translate(0)')
    $('.settings_c, .chart_c, .more_info_b').addClass('blur')
    build_info_panel(firstOpen)
    firstOpen = true
  })

  $('.info_back').on('click', () => {
    $('.more_info_c').css('transform', 'translate(35vw)')
    $('.settings_c, .chart_c, .more_info_b').removeClass('blur')
  })
}

var build_chart = (options) => {

  try {myChart.destroy()}
  catch(e) {console.warn("Can't destroy chart (This error is normal if this page is initialized for the first time) ")}

  const ctx = document.getElementById('chart').getContext('2d');
  globalThis.myChart = new Chart(ctx, {
    type: 'line',
    data: options.chartData,
    options: {
      scales: {
        y: {
          ticks: {
            callback: function(val, index) {
              return `${this.getLabelForValue(val)} ${options.unit === null ? "" : options.unit}`
            },
            color: 'rgba(255,255,255,0.7)',
          },
          stacked: options.stack,
        },
        x: {
          type: 'time',
          time: {
            unit: 'day'
          },
          min: options.minDate,
          max: options.maxDate
        }
      },
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      elements: {
        point: {
          radius: options.dataType === 'session' ?
            options.stack && options.dateDiff >= 1.5 ? 0 : 3 
            : 0 
          }
      },
    }
  });
}

var animateOption = (option) => {
  if (option == 'show') {
    $('.loader').css('opacity', 0)
    $('.chart_c').css('opacity', 1)
    $('.more_info_b').css('opacity', 1)
  
    let i = 0
    for (let box of ['.old_data_c', '.stack_c', '.date_c', '.hide_c']) {
      i++
      setTimeout(function(){
        $(box).css('transform', 'translateY(0)')
      }, 50*i);
    }
  }
  if (option == 'hide') {
    $('.chart_c').css('opacity', 0)
    $('.loader').css('opacity', 1)
    $('.more_info_b').css('opacity', 0)
  
    let i = 0
    for (let box of ['.old_data_c', '.stack_c', '.date_c', '.hide_c']) {
      i++
      setTimeout(function(){
        $(box).css('transform', 'translateY(9vh)')
      }, 50*i);
    }
  } 
}