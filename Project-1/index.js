const app = require('express')()
const axios = require('axios').default
const https = require('https')
const http = require('http')


const port = 8080

app.get('/', (req, res) => {
    console.log(req)
    axios.get(req.originalUrl)
        .then(axRes => {
            res.send(axRes.data)
            console.log(axRes)
        }).catch(axRes =>{
            console.error(axRes)
        })
})

http.createServer(app).listen(80)
https.createServer(app).listen(8080)
// https.createServer(options, app).listen(443)

// app.listen(port, () => { console.log(`Listening on port ${port}`) })
