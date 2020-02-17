const app = require('express')()
const axios = require('axios').default

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

app.listen(port, () => { console.log(`Listening on port ${port}`) })
