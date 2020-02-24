process.env.UV_THREADPOOL_SIZE = 1000
const net = require('net')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const server = net.createServer()
const port = 4000
const stdin = process.openStdin()
const blockListName = 'blockList.json'
const blockListPath = path.join(__dirname, blockListName)
let verbose = true
let caching = true
let timing = true
let maxCacheSize = 10000000 //10MB cache
let currentCacheSize = 0
let bytesSavedFromNetwork = 0 //how much bandwidth has been saved
let suppressErrs = false

/**
 * Read and return blocklist  
 * @return {{blockedURLs:Array}}
 */
let readBlockList = () => {
    return JSON.parse(fs.readFileSync(blockListPath, 'utf8'))
}
let blockList = readBlockList()

let cache = []

//No clients connected 
server.on('close', () => {
    console.log(`All clients disconnected`)
})

//Something broke
server.on('error', (err) => {
    console.error({ ERROR: err })
    exec('npm start', (err, stdout, stderr) => {
        if (err) {
            console.error(err)
        } else {
            console.log(`stdOUT: ${stdout}`)
            console.log(`stdERR: ${stderr}`)
        }
    })
})

//new connection to server
server.on('connection', (clientProxyConn) => {
    //create the connection
    clientProxyConn.once('data', (data) => {
        let theData = data.toString()
        let reqData = getAddrAndPort(theData)
        //if it's blacklisted, send 403 and kill connection
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
                //if is HTTPS, confirm connection
                //else send the request to the server
                if (reqData.isHTTPS) {
                    clientProxyConn.write('HTTP/1.1 200 OK\r\n\n')
                    //Don't manually handle subsequent data streams, this is easier, faster and uses less memory
                    //readableSrc.pipe(writableDest)
                    clientProxyConn.pipe(toServerConn).pipe(clientProxyConn)
                } else {
                    if (isWebsocketRequest(data)) {//don't cache websockets, or headers that request 'no-cache'
                        console.log(`Not caching websocket request for: ${reqData.rawURL}`)
                        clientProxyConn.pipe(toServerConn).pipe(clientProxyConn)
                    } else { //need to manually handle chunked data
                        let cachedRes = getFromCache(reqData.rawURL)
                        let startTime = Date.now()
                        if (!cachedRes) { //response not already cached 
                            toServerConn.write(data)
                            let dataWhole = []
                            let isChunked = false
                            let cacheableResponse = false
                            let checkedCachability = false
                            toServerConn.on('data', (resData) => {
                                if (!checkedCachability) { //need to check if we can cache it
                                    console.log(`Packet from '${reqData.rawURL}', does not allow caching`)
                                    cacheableResponse = isCacheableResponse(resData)
                                    checkedCachability = true
                                }
                                if (!cacheableResponse) { //not cacheable
                                    clientProxyConn.write(resData)
                                    clientProxyConn.pipe(toServerConn).pipe(clientProxyConn)
                                } else {
                                    if (isChunked || resData.toString().includes('Transfer-Encoding: chunked\r\n')) { //for chunked data need to cache differently
                                        clientProxyConn.write(resData)

                                        dataWhole.push(resData)
                                        if (!isChunked)
                                            isChunked = true

                                        if (resData.toString().slice(-5) == '0\r\n\r\n') { //end of chunked encoding
                                            addToCache(dataWhole[0], reqData.rawURL, dataWhole.splice(0, 1))
                                        }
                                    } else {
                                        clientProxyConn.write(resData)
                                        if (timing)
                                            console.log({ url: reqData.rawURL, cached: false, time: `${(Date.now() - startTime).toString()}ms` })
                                        clientProxyConn.pipe(toServerConn).pipe(clientProxyConn)
                                        addToCache(resData, reqData.rawURL)
                                    }
                                }
                            })
                        } else {
                            if (cachedRes.chunkArr) { //data was chunked, send each TCP packet
                                clientProxyConn.write(cachedRes.cachedStr)
                                cachedRes.chunkArr.forEach(e => {
                                    clientProxyConn.write(e)
                                })
                            } else {
                                clientProxyConn.write(cachedRes)
                            }
                            if (timing)
                                console.log({ url: reqData.rawURL, cached: true, time: `${(Date.now() - startTime).toString()}ms` })
                        }
                    }
                }

                if (verbose)
                    console.log({
                        Message: 'Connection Established',
                        Hostname: (reqData.isHTTPS ? reqData.host : reqData.rawURL),
                        Port: reqData.port,
                        HTTPS: reqData.isHTTPS
                    })

                toServerConn.on('error', (err) => {
                    if (!suppressErrs)
                        console.error({ 'Server Error': err })
                })
                toServerConn.on('close', () => {
                    console.warn({ 'Server Closed Conn': `${reqData.host}:${reqData.port}` })
                })
            })

            clientProxyConn.on('error', (err) => {
                if (!suppressErrs)
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
 * timing - print timing data of cache hits/misses  
 * notiming - disables printing of cache hit/miss timing data  
 * showsaving - shows how many bytes have been served from cache  
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
        case 'cache':
            caching = true
            break
        case 'nocache':
            caching = false
            break
        case 'timing':
            timing = true
            break
        case 'notiming':
            timing = false
            break
        case 'showsaving':
            console.log({ 'Saved Bytes': bytesSavedFromNetwork.toLocaleString() })
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
 * @return {Buffer|{cachedStr:Buffer, chunkArr:Array<Buffer>}}
 */
let getFromCache = (url) => {
    if (!caching)
        return false
    if (cache[url]) {
        let tmpCache = cache[url]
        if (tmpCache.expiryTime > (Date.now() / 1000)) {
            console.log(`Cached data for ${url}, found`)
            let cachedStr = tmpCache.firstHalfData + (Math.floor(Date.now() / 1000) - tmpCache.startTime) + tmpCache.secondHalfData

            cachedStr = Buffer.from(cachedStr, 'binary')
            // console.log({ cacheURL: url, cachedStr: cachedStr, str: cachedStr.toString('binary') })
            bytesSavedFromNetwork += tmpCache.size
            //handle chunked and non-chunked data differently
            if (!tmpCache.chunkArr)
                return cachedStr
            return { cachedStr: cachedStr, chunkArr: tmpCache.chunkArr }
        } else { //data is old
            console.log(`Cached data for ${url}, expired... purging`)
            cache = cache.splice(cache.indexOf('url'), 1)
            return false
        }
    }
    return false
}

/**
 * @param {Buffer} responseBuffer The raw data response from the server  
 * @param {string} url The url the request if for  
 * @param {Array<Buffer>} chunkArr The chunks for a chunked response
 */
let addToCache = (responseBuffer, url, chunkArr = false) => {
    let parsedBuffer = responseBuffer.toString('binary')
    if (parsedBuffer.includes('404 Not Found\r\n'))//dont cache 404
        return
    if (parsedBuffer.includes('Cache-Control: max-age=')) {
        let expiryTime = parsedBuffer.split('Cache-Control: max-age=')[1]
        if (expiryTime && expiryTime.split('\r\n', 1)[0]) {
            let size = responseBuffer.length
            if (chunkArr)
                chunkArr.forEach(e => {
                    size += e.length
                })
            expiryTime = expiryTime.split('\r\n', 1)[0].split(',')[0]
            expiryTime = parseInt(expiryTime) + Math.floor((Date.now() / 1000))
            if (parsedBuffer.includes('Age: ')) { //header includes age, this is ideal
                var ageSplit = parsedBuffer.split('Age: ')
                var secondHalfData = ageSplit[1].split('\r\n')
                expiryTime -= parseInt(secondHalfData[0])
                var startTime = Math.floor(Date.now() / 1000) - parseInt(secondHalfData[0])
            } else { //header does not include age, this is not ideal
                let theHeaderArr = parsedBuffer.split('Cache-Control: max-age=')
                theHeaderArr[0] += 'Cache-Control: max-age='
                theHeaderArr[1] = theHeaderArr[1].split('\r\n')
                theHeaderArr[0] += theHeaderArr[1][0] + '\r\n'
                var ageSplit = []
                ageSplit[0] = theHeaderArr[0]
                var secondHalfData = theHeaderArr[1]
            }
            secondHalfData.splice(0, 1)
            secondHalfData = secondHalfData.join('\r\n')
            cache[url] = {
                expiryTime: expiryTime,
                firstHalfData: ageSplit[0] + 'Age: ',
                secondHalfData: '\r\n' + secondHalfData,
                startTime: startTime,
                chunkArr: chunkArr,
                size: size
            }
            currentCacheSize += size
            console.log({ CachedURL: url, Size: `${size.toLocaleString()} bytes` })
        } else {
            console.log(`Could not cache response from: ${url}, due to header parameters`)
        }
    } else {
        console.log(`Could not cache response from: ${url}, due to header parameters`)
    }
}

/**
 * Determines if a HTTP request is for a websocket
 * @param {Buffer} rawData The raw request data
 * @param {Boolean} allowNoCache Respond true to no cache requests
 */
let isWebsocketRequest = (rawData) => {
    let stringifiedData = rawData.toString()
    if (stringifiedData.includes('Upgrade: WebSocket\r\n') || stringifiedData.includes('Connection: Upgrade\r\n'))
        return true
    return false
}

/**
 * Determines if a response wants to be cached
 * @param {Buffer} rawData
 */
let isCacheableResponse = (rawData) => {
    let stringifiedData = rawData.toString()
    if (stringifiedData.includes('Cache-Control: no-cache\r\n') || stringifiedData.includes('Pragma: no-cache\r\n') || !stringifiedData.includes('Cache-Control: max-age='))
        return false
    return true
}
