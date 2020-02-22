const net = require('net')
const server = net.createServer()
const port = 4000

//No clients connected 
server.on('close', () => {
    console.log(`All clients disconnected`)
})

//Something broke
server.on('error', (err) => {
    console.error({ ERROR: err })
    throw err
})

//TODO make this multithreaded, maybe workers with credentials?
//Client should only connect once so we can thread this bit
server.on('connection', (clientProxyConn) => {
    console.log(`New client connection!`)
    // console.log(clientProxySocket)

    //create the connection
    clientProxyConn.once('data', (data) => {
        let theData = data.toString()
        // console.log(theData) //print the data

        let reqData = getAddrAndPort(theData)
        console.log(reqData)

        let toServerConn = net.createConnection({
            host: reqData.host,
            port: reqData.port
        }, () => {
            console.log(`Connected to server`)

            //if is HTTPS, confirm connection
            //else send the request to the server
            if (reqData.isHTTPS)
                clientProxyConn.write('HTTP/1.1 200 OK\r\n\n')
            else
                toServerConn.write(data)


            //Don't manually handle subsequent data streams, this is easier, faster and uses less memory
            //readableSrc.pipe(writableDest)

            //Pipe data coming from the client to the server
            clientProxyConn.pipe(toServerConn)

            //Pipe data coming from the server to the client
            toServerConn.pipe(clientProxyConn)

            //pretty sure this can be written as:
            // clientProxyConn.pipe(toServerConn).pipe(clientProxyConn)


            toServerConn.on('error', (err)=>{
                console.error({ 'Server Error': err })
            })
            toServerConn.on('close', ()=>{
                console.warn({'Server Closed Conn':`${reqData.host}:${reqData.port}`})
            })
        })
        clientProxyConn.on('error', (err)=>{
            console.error({ 'Client Error': err })
        })
        clientProxyConn.on('close', ()=>{
            console.warn({'Client closed conn':`${reqData.host}:${reqData.port}`})
        })
    })

})


/**
 * Parses out: hostname, port and if a connection is HTTPS
 * @param {string} data data object stringified
 * @returns {{host:string, port:string, isHTTPS:boolean}} hostname, port and whether the connection is using HTTPS
 */
let getAddrAndPort = (data) => {
    let hostData = []
    /*
     * Cannot actually read the data if using TLS but
     * HTTPS connections contain the keyword 'CONNECT'
     */
    hostData['isHTTPS'] = data.indexOf('CONNECT') !== -1
    if (hostData.isHTTPS) {
        let splitStr = data.split(` `)[1].split(`:`)
        hostData['host'] = splitStr[0]
        hostData['port'] = splitStr[1]
    } else {
        let splitStr = data.split(`Host: `)[1].split(`\r\n`)[0].split(`:`)
        hostData['host'] = splitStr[0]
        //HTTP defaults to port 80 but just in case...
        hostData['port'] = splitStr[1] ? splitStr[1] : '80'
    }
    return hostData
}










server.listen(port, () => {
    console.log(`Server running on: ${server.address().address}:${server.address().port}`)
})
