var build_info_panel = (firstOpen) => {

    if (!firstOpen) {

        socket.emit('stat_class_request', stat_id) 

        socket.on('stat_class_data', (data) => {

            console.log(data)

            if (data.classID !== null) {
                $('.info_title').text(data.classTitle)

                for (let i = 0 ; i < 5 ; i++) {

                    let imgType = data.img[data.classData[i][0]].split(':')[0]

                    var newItemBox = document.createElement("div");
                    newItemBox.classList.add('item_more_info')
                    newItemBox.id = `item_${i}`

                    var newItemImg = document.createElement("img");
                    newItemImg.classList.add('item_more_img')
                    newItemImg.src = data.img[data.classData[i][0]]

                    var newItemName = document.createElement("div");
                    newItemName.classList.add('item_more_name')
                    newItemName.innerHTML = `${data.pseudo[data.classData[i][0]]}`

                    var newItemValue = document.createElement("div");
                    newItemValue.classList.add('item_more_value')
                    newItemValue.innerHTML = `${data.classData[i][1]} ${data.unit === null ? "" : data.unit}`

                    var newItemPosition = document.createElement("div");
                    newItemPosition.classList.add('item_more_position')
                    newItemPosition.innerHTML = `#${i+1}`

                    newItemBox.appendChild(newItemImg)
                    newItemBox.appendChild(newItemName)
                    newItemBox.appendChild(newItemValue)
                    newItemBox.appendChild(newItemPosition)

                    $('.more_info_c').append(newItemBox);

                    setTimeout(function(){
                        $(`#item_${i}`).css('transform', 'translate(0)')
                    }, 100*(i+1));

                    if (imgType !== 'data') {
                        $(`#item_${i}`).on('click', () => {
                            window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/player/${data.classData[i][0]}`
                        }) 
                    }
                }

                var newExternalBox = document.createElement("div");
                newExternalBox.classList.add('external_box');

                var newExternalImg = document.createElement("img");
                newExternalImg.classList.add('external_img')
                newExternalImg.src = `/ressources/icon/external_link.svg`
                newExternalBox.appendChild(newExternalImg)

                var newExternalBoxText = document.createElement("div");
                newExternalBoxText.classList.add('external_text');
                newExternalBoxText.innerHTML = 'Aller au classement complet' 
                newExternalBox.appendChild(newExternalBoxText)  

                $('.more_info_c').append(newExternalBox);

                setTimeout(function(){
                    $('.external_box').css('transform', 'translateY(0)')
                }, 650);

                $('.external_box').on('click', () => {
                    window.location.href = ((window.location.href).split('/')[2] === 'localhost:8080' ? 'http://localhost:8080/' : 'https://diikstra.fr/') + `gameinbox/statistic/${data.classID}`
                })                 
            }
        })
    }
}