var socket = io();

var setupListeners = function () {

  socket.emit("classement_page_loaded");
  new data_listener().init_socket()

  side_menu_function()
}

window.addEventListener("load", setupListeners);

const data_listener = class {

  // init all socket system for the page
  init_socket() {

    const stat_id = ((window.location.href).split("/")).pop()
    $('#statistic_b').addClass('current')

    socket.emit('classement_base_request')
    globalThis.unit = null

    socket.on('serverState', (isOnline) => {

      $('.server_state_circle').addClass(isOnline?'server_online':'server_offline')
      $('.server_state_value').text(isOnline?'En ligne':'Hors ligne')
    })

    socket.on('classement_base_data', (data) => {

      

      var main_title
      var sub_title
      let comp = {0:'main', 1:'sub'}
      let temp = data['classements'][comp[stat_id[1]]]
      for ( let tobject of temp ) {
        if ( tobject['id'] == stat_id ) {
          main_title = tobject['desc'][0]
          sub_title = tobject['desc'][1]
          unit = tobject['unit']
        }
      }
      
      if (main_title != undefined) {
        $('#class_title').text(main_title)
        $('#title_sub').text(sub_title)

        $('.title_c').css('opacity', '1')

        socket.emit('classement_request', stat_id)

        socket.on('classement_data', (data, pseudo) => {
    
          // manage classement data and build box
          let data_array_sort = sort_stat_array(data)
    
          let n = 0
          for (let [uuid , score] of data_array_sort) {
    
            let comp = {1 : '.first_c', 2 : '.second_c', 3 : '.third_c'}
            n ++ 
    
            if (n <= 3) {
              $(comp[n]).attr("id",`${uuid}`)
              $(comp[n]).find('.player_name').html(`<span class=player_position_hidden>#${n}</span>${pseudo[uuid]}`)
              $(comp[n]).find('.score').text(`${score} ${unit === null ? "" : unit}`)
            }
    
            else {
              var box_html = 
              `<div class='other_c' id=${uuid}>
                <p class='player_name'><span class=player_position_hidden>#${n}</span>${pseudo[uuid]}</p>
                <div class='score_c_over'>
                  <div class='score_c'>
                    <div class='score'>${score} ${unit === null ? "" : unit}</div>
                    </div>
                  </div>
                </div>`
              $('.class_c').append(box_html)
            }
          }
    
          // fade in animation for each classement line
          $('.class_c > div').each((index, elem) => {
            
            setTimeout(() => {$(`#${elem.id}`).css('opacity', '1')
            $(elem).find('.score').css('animation-name', 'score_text_anim')
            $(elem).find('.score_c_over').css('animation-name', 'score_anim')
              }, 50*(index) );
          })
        
        })

      }
      else {
        console.error('CLASS Error: no relative class ID')
        $('.redisError').find('div').html("ERREUR [Class number]: L'ID de classement renseigné n'est pas valide.") 
        $('.loader').css('opacity', 0)
        $('.more_info_b').css('opacity', 0)
        setTimeout(function(){$('.redisError').css('opacity', 1)}, 50);  
      }
    })

    socket.on('player_data', (data, rClass) => {

      const class_item = $('.first_c, .second_c, .third_c, .other_c')

      class_item.on('mouseover', (e) => {

        let player_id = e.target.id

        $(".other_position").css('opacity', '0')
        setTimeout(function(){$(".other_position").css('opacity', '1');}, 200);

        $(".player_skin_c").css('opacity', '0')
        setTimeout(function(){$(".player_skin_c").css('opacity', '1');}, 300);
        setTimeout(function(){
          if (data.type !== "block") {
            $('.player_skin_c img').attr('src', data.img[player_id])
          }
          else {
            $('.player_skin_c i').removeClass();
            $('.player_skin_c i').addClass(`${data.img[player_id]} icon-minecraft`)
          }
        }, 210);     

        $(e.target).find('.player_position_hidden').addClass('player_position_visible')

        let position = $(e.target).find('.player_position_hidden').text()
        $('.player_position').text(position)
        $('.d_player_name').text(data.pseudoComp[e.target.id])

        let score = $(e.target).find('.score').text()
        let score_value = parseInt(score.split(' ')[0])
        let score_unit = score.split(' ')[1]
        let old_score = (() => {
          let temp = parseInt($('.d_player_score').text().split(' ')[0])
          if (!temp) {temp = 0}
          return temp
        })()

        jQuery({ Counter: old_score }).animate({ Counter: score_value }, {
          duration: 250,
          easing: 'swing',
          step: function () {
            $('.d_player_score').text(`${Math.ceil(this.Counter)} ${score_unit}`);
          }});

        setTimeout(() => {$('.d_player_score').text(score)}, 255 );

        if (data.type === 'player') {

          $('.player_details').on('click', () => {
            window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/player/${player_id}`
          })

          $('.class_list').each((index, elem) => {
            $(elem).find('.other_class').text(rClass[index].classTitle)
            $(elem).find('.other_position').text( () => {
              let n = 0
              for (let [keys] of rClass[index].redisData) {
                n++
                if (keys == player_id) {return `#${n}`}
              }
            })
            $(elem).on('click', () => {
              window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/statistic/${rClass[index].classID}`
            })
          })

          $(`.other_class_c`).css('opacity', '1')
        }

        else {
          $('.player_skin').addClass('block')
          $('.player_details').css('grid-row','2/5')
          $('.player_details').css('height','60%')
        }


        $(`.player_details`).css('opacity', '1')
      })

      class_item.on('mouseout', (e) => {

        $(e.target).find('.player_position_visible').removeClass('player_position_visible')
      })
    })
  }
}

const sort_stat_array = (args) => {

  let data_array_sort = []

  for (let [key,value] of Object.entries(args)) {
    data_array_sort.push([key,value])
  }

  data_array_sort.sort(function(a, b) {
    return b[1] - a[1];
  })

  return data_array_sort
}

var side_menu_function = () => {

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
}