const net = require('net')
const fs = require('fs')
const path = require('path')
const server = net.createServer()
const port = 4000

let blockListPath = path.join(__dirname, 'blockList.json')
let blockList = JSON.parse(fs.readFileSync(blockListPath, 'utf8'))
console.log(blockList)
blockList.blockedURLs.push('matrix.netsoc.ie')
// blockList = {blockedURLs:[]}
// fs.writeFile(blockListPath, JSON.stringify(blockList), ()=>{})


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
    // console.log(`New client connection!`)
    // console.log(clientProxySocket)

    //create the connection
    clientProxyConn.once('data', (data) => {
        let theData = data.toString()
        // console.log(theData) //print the data

        let reqData = getAddrAndPort(theData)
        // console.log(reqData)

        if (blockList.blockedURLs.includes(reqData.host)) {
            clientProxyConn.write('HTTP/1.1 403 FORBIDDEN\r\n\n')
            clientProxyConn.end()
            clientProxyConn.destroy()
            var blocked = true
        }


        if (!blocked) {
            let toServerConn = net.createConnection({
                host: reqData.host,
                port: reqData.port
            }, () => {
                // console.log(`Connected to server`)

                //if is HTTPS, confirm connection
                //else send the request to the server
                if (reqData.isHTTPS)
                    clientProxyConn.write('HTTP/1.1 200 OK\r\n\n')
                else
                    toServerConn.write(data)


                //Don't manually handle subsequent data streams, this is easier, faster and uses less memory
                //readableSrc.pipe(writableDest)

                //Pipe data coming from the client to the server
                // clientProxyConn.pipe(toServerConn)

                //Pipe data coming from the server to the client
                // toServerConn.pipe(clientProxyConn)

                //pretty sure this can be written as:
                clientProxyConn.pipe(toServerConn).pipe(clientProxyConn)

                console.log({Message:'Connection Established', 
                             Hostname: reqData.host,
                             Port: reqData.port,
                             HTTPS: reqData.isHTTPS})

                toServerConn.on('error', (err) => {
                    console.error({ 'Server Error': err })
                })
                toServerConn.on('close', () => {
                    console.warn({ 'Server Closed Conn': `${reqData.host}:${reqData.port}` })
                })
            })

            clientProxyConn.on('error', (err) => {
                console.error({ 'Client Error': err })
            })
            clientProxyConn.on('close', () => {
                console.warn({ 'Client closed conn': `${reqData.host}:${reqData.port}` })
            })
        }else{
            console.log({Message:'Connection Blocked', 
                         Hostname: reqData.host,
                         Port: reqData.port,
                         HTTPS: reqData.isHTTPS})
        }
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

server.listen(port)

server.on('listening', ()=>{
    console.log(`Server running on: ${server.address().address !== '::' ? server.address().address:'localhost'}:${server.address().port}`)
})
