const app = require('express')()
const axios = require('axios').default
const https = require('https')
const http = require('http')
const fs = require('fs');

const httpPort = 80
const httpsPort = 8080

const options = {
    key: fs.readFileSync('key/selfsigned.key'),
    cert: fs.readFileSync('key/selfsigned.crt')
  };


app.get('/', (req, res) => {
    console.log(req)
    // axios.get(req.originalUrl)
    //     .then(axRes => {
    //         res.send(axRes.data)
    //         console.log(axRes)
    //     }).catch(axRes =>{
    //         console.error(axRes)
    //     })
})

http.createServer(app).listen(httpPort, ()=>{
    console.log(`HTTP server listening on port ${httpPort}`)
})
https.createServer(options,app).listen(httpsPort, ()=>{
    console.log(`HTTPS server listening on port ${httpsPort}`)
})
// https.createServer(options, app).listen(443)

// app.listen(port, () => { console.log(`Listening on port ${port}`) })
