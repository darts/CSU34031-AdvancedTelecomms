const net = require('net')
const fs = require('fs')
const path = require('path')
const server = net.createServer()
const port = 4000
const stdin = process.openStdin();
const blockListName = 'blockList.json'
const blockListPath = path.join(__dirname, blockListName)
let verbose = true

/**
 * Read and return blocklist  
 * @return {{blockedURLs:Array}}
 */
let readBlockList = () => {
    return JSON.parse(fs.readFileSync(blockListPath, 'utf8'))
}
let blockList = readBlockList()

let cache = {}

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
    //create the connection
    clientProxyConn.once('data', (data) => {
        let theData = data.toString()
        // console.log(theData) //print the data

        let reqData = getAddrAndPort(theData)
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
                // console.log({theData:theData, cacheControl:theData.split('Cache-Control: ')[1].split('\r\n\r\n')[0]})



                //if is HTTPS, confirm connection
                //else send the request to the server
                if (reqData.isHTTPS) {
                    clientProxyConn.write('HTTP/1.1 200 OK\r\n\n')
                    //Don't manually handle subsequent data streams, this is easier, faster and uses less memory
                    //readableSrc.pipe(writableDest)
                    clientProxyConn.pipe(toServerConn).pipe(clientProxyConn)
                } else {
                    console.log(reqData)
                    let cachedRes = getFromCache(reqData.rawURL)
                    if (!cachedRes) {
                        toServerConn.write(data)
                        toServerConn.on('data', (resData) => {
                            clientProxyConn.write(resData)
                            addToCache(resData, reqData.rawURL)
                        })
                    }
                }

                if (verbose)
                    console.log({
                        Message: 'Connection Established',
                        Hostname: reqData.host,
                        Port: reqData.port,
                        HTTPS: reqData.isHTTPS
                    })

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
                console.warn({ 'Client Closed Conn': `${reqData.host}:${reqData.port}` })
            })
        } else {
            if (verbose)
                console.log({
                    Message: 'Connection Blocked',
                    Hostname: reqData.host,
                    Port: reqData.port,
                    HTTPS: reqData.isHTTPS
                })
        }
    })
})


/**
 * Parses out: hostname, port and if a connection is HTTPS
 * @param {string} data data object stringified
 * @returns {{host:string, port:string, isHTTPS:boolean, rawURL:string}} hostname, port, whether the connection is using HTTPS and the full path trying to be accessed (if HTTP)
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
        hostData['rawURL'] = data.split('http://')[1].split(' ')[0]
        let splitStr = data.split(`Host: `)[1].split(`\r\n`)[0].split(`:`)
        hostData['host'] = splitStr[0]
        //HTTP defaults to port 80 but just in case...
        hostData['port'] = splitStr[1] ? splitStr[1] : '80'
    }
    return hostData
}

server.listen(port, () => {
    console.log(`Server running on: ${server.address().address !== '::' ? server.address().address : 'localhost'}:${server.address().port}`)
})

stdin.addListener('data', (data) => {
    handleInput(data.toString().trim())
})


/**
 * Handles the strings input by the user
 * 
 * @param {String} consoleInput The console input stringified and trimmed  
 * 
 * Commands:   
 * block <domain> - adds domain to blocklist  
 * unblock <domain> - removes domain from blocklist  
 * cache - enables caching  
 * nocache - disables caching  
 * verbose - prints all connections to console  
 * noverbose - disables printing of all connections to console  
 */
let handleInput = (consoleInput) => {
    let splitData = consoleInput.split(' ')
    let keyword = splitData[0]
    let param = splitData[1]
    switch (keyword) {
        case 'block':
            if (!blockList.blockedURLs.includes(param)) {
                blockList.blockedURLs.push(param)
                writeBlockList(blockList)
            } else {
                console.warn(`${param}, has already been blocked!`)
            }
            break
        case 'unblock':
            if (blockList.blockedURLs.includes(param)) {
                blockList.blockedURLs.splice(blockList.blockedURLs.indexOf(param), 1)
                writeBlockList(blockList)
            } else {
                console.warn(`${param}, was not blacklisted!`)
            }
            break
        case 'verbose':
            verbose = true
            break
        case 'noverbose':
            verbose = false
            break
        default:
            console.error(`Input not recognised: ${keyword}, is not a keyword`)
            break
    }
}

/**
 * Write updated blocklist  
 * @param {blockList}  
 */
let writeBlockList = (blockList) => {
    fs.writeFile(blockListPath, JSON.stringify(blockList), (err) => {
        if (err)
            console.error(`Could not write updated blocklist to disk!`)
        else
            console.log(`Updated blocklist written to disk`)
    })
}

/**
 * @param {string} url The requested URL  
 * @return {{cacheObj}}
 */
let getFromCache = (url) => {
    if (cache[url]) {
        let tmpCache = cache[url]
        if (tmpCache.expiryTime > (Date.now() / 1000)) {
            console.log(`Cached data for ${url}, found`)
            let cachedStr = tmpCache.firstHalfData + (tmpCache.startTime + (Date.now() / 1000)) + tmpCache.secondHalfData
            console.log(cachedStr)
            return false
            cachedStr = Buffer.from(cachedStr, 'utf-8')
            return cachedStr
        } else {
            console.log(`Cached data for ${url}, expired... purging`)
            return false
        }
    }
    return false
}


/**
 * @param {Buffer} responseBuffer The raw data response from the server
 */
let addToCache = (responseBuffer, url) => {
    let parsedBuffer = responseBuffer.toString()
    if (parsedBuffer.includes('Cache-Control: max-age=')) {
        let expiryTime = parsedBuffer.split('Cache-Control: max-age=')[1].split('\r\n')[0]
        if (expiryTime) {
            expiryTime = parseInt(expiryTime) + Math.floor((Date.now() / 1000))
            let ageSplit = parsedBuffer.split('Age: ')
            let secondHalfData = ageSplit[1].split('\r\n')

            expiryTime -= parseInt(secondHalfData[0])
            let startTime = parseInt(secondHalfData[0] + Math.floor((Date.now() / 1000)))
            // console.log(parsedBuffer)
            cache[url] = {
                expiryTime: expiryTime,
                firstHalfData: ageSplit[0] + 'Age: ',
                secondHalfData: '\r\n' + secondHalfData[1],
                startTime: startTime
            }
            console.log(cache[url])
        } else {
            console.log(`Could not cache response from: ${url}, due to header parameters`)
        }
    } else {
        console.log(`Could not cache response from: ${url}, due to header parameters`)
    }
}
