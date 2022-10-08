module.exports = (app) => {

    const sync = require('./15MINUTESREFRESHANDTHENWHAT.js')

    console.log(process.env.maintenance)

    if (process.env.maintenance == 'on') {
        app.get('/*', (req, res) => {
            res.render('./maintenance/maintenance')
        }) 
    }

    else {
        // diikstra home page
        app.get('/', (req, res) => {
            // res.sendFile(path.resolve('views/diikstra_home/diikstra_home.html'))
            res.render('./diikstra_home/diikstra_home')
        })

        // redirect /gameinbox to /gameinbox/home
        app.get('/gameinbox', (req, res) => {
            res.redirect('http://localhost:8080/gameinbox/accueil/')
        })

        // all gameinbox home page
        for (let arg of ['accueil', 'statistic', 'player', 'doc*', 'dynmap']) {

            app.get(`/gameinbox/${arg}/`, (req, res) => {
                let arg = req.url.split('/')[2]
                if (arg !== 'doc') res.render('./gameinbox_home/home', {param: arg})
                else res.render('./gameinbox_home/home', {param: [arg, req.url.split('/')[3]]})
            })
        }

        // player page with uuid in param 
        app.get('/gameinbox/player/*', (req, res) => {
            res.render('./player_template/player')
        })

        // statistic page with statistic id in param
        app.get('/gameinbox/statistic/0*', (req, res) => {
            res.render('./template_stat/statTemplate')
        })

        // classement page with classement id in param
        app.get('/gameinbox/statistic/1*', (req, res) => {
            res.render('./template_class/classTemplate')
        })

        // redirect for advancement page
        app.get('/gameinbox/statistic/2001', (req, res) => {
            res.redirect('http://localhost:8080/gameinbox/advancement/minecraft/')
        })

        // redirect for shops page
        app.get('/gameinbox/statistic/2003', (req, res) => {
            res.redirect('http://localhost:8080/gameinbox/shops/')
        })
        

        // advancement page
        for (let arg of ['Minecraft', 'Aventure', 'Agriculture', 'Nether', "L'End", 'Custom']) {

            app.get(`/gameinbox/advancement/${arg}/`, (req, res) => {
                res.render('./advancement/advancement', { param: req.url.split('/')[3] })
            })
        }

        // page des shops
        app.get('/gameinbox/shops', (req, res) => {
            res.render('./shops/shops')
        })

        // lancement du script d'actualisation des données
        app.get('/sicelienleakcestlamortpcqcestchiantenfaiteleakezpaslelien', (req, res) => {
            res.send('OK')
            sync.init()
        })

        // all other routes 404
        app.get('*', function(req, res){
            res.status(404).render('./404/404')
        })        
    }


        
}