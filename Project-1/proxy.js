const net = require('net')
const server = net.createServer()
const port = 4000

//No clients connected 
server.on('close', ()=>{
    console.log(`All clients disconnected`)
})

//Something broke
server.on('error', (err)=>{
    console.error({ERROR:err})
    throw err
})

//TODO make this multithreaded
//Client should only connect once so we can thread this bit
server.on('connection', (clientProxySocket) =>{
    console.log(`New client connection!`)
    // console.log(clientProxySocket)

    //create the connection
    clientProxySocket.once('data', (data)=>{
        let theData = data.toString()
        // console.log(theData) //print the data

        let reqData = getAddrAndPort(theData)
        console.log(reqData)


    
    })

})


/**
 * Parses out: hostname, port and if a connection is HTTPS
 * @param {string} data data object stringified
 * @returns {{host:string, port:string, isHTTPS:boolean}} hostname, port and whether the connection is using HTTPS
 */
let getAddrAndPort = (data) => {
    let hostData =[]
    //HTTPS connections contain the keyword 'CONNECT'
    hostData['isHTTPS'] = data.indexOf('CONNECT') !== -1

    if(hostData.isHTTPS){
        let splitStr = data.split(` `)[1].split(`:`)
        hostData['host'] = splitStr[0]
        hostData['port'] = splitStr[1]
    }else{
        let splitStr = data.split(`Host: `)[1].split(`\r\n`)[0].split(`:`)
        hostData['host'] = splitStr[0]
        hostData['port'] = splitStr[1] ? splitStr[1] : '80' //default to port 80 if no connection
    }
    return hostData
}










server.listen(port, ()=>{
    console.log(`Server running on: ${server.address().address}:${server.address().port}`)
})
