const https = require("https")
const helmet = require("helmet")


const express = require('express'), app = express()
const fs = require('fs')
const path = require('path')
const threadPath = path.join(__dirname, "threads.json")
const userPath = path.join(__dirname, "users.json")
const keyPath = path.join(__dirname, "keys", "server.key")
const certPath = path.join(__dirname, "keys", "server.crt")
const sysClock = new Date()
const ejs = require('ejs')
const keyLen = 20
const port = 3000



const key_options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
};

app.use(helmet()) //force https
app.use(express.json())

/**
 * Read and return all threads (**WARNING** synchronous)
 * @return {Array<{name:String, content:Array<{username:String, timestamp:Number, content:String}>>}
 */
let readThreadList = () => {
    return JSON.parse(fs.readFileSync(threadPath, 'utf8'))
}

/**
 * Write updated threads to disk
 * @param {Thread} thread Thread object
 */
let writeThreadList = (thread) => {
    fs.writeFile(threadPath, JSON.stringify(thread), (err) => {
        if (err)
            console.error(`Could not write updated threads to disk!`)
        else
            console.log(`Updated threads written to disk`)
    })
}

/**
 * Read and return all users (**WARNING** synchronous)
 * @return {Array<username:{pwd:String, api-key:String}>}
 */
let readUserList = () => {
    return JSON.parse(fs.readFileSync(userPath, 'utf8'))
}

/**
 * Write updated users to disk
 * @param {Users} users User object
 */
let writeUserList = (users) => {
    fs.writeFile(userPath, JSON.stringify(users), (err) => {
        if (err)
            console.error(`Could not write updated users to disk!`)
        else
            console.log(`Updated users written to disk`)
    })
}

/**
 * Generates and returns api key
 * @param {Number} length 
 * @return {String} The key
 */
let genKey = (length) => {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * Add a new user
 * @param {String} username 
 * @param {String} password
 * @return {Boolean} Successfully added
 */
let addUser = (username, password, privKey, pubKey) => {
    if (users.hasOwnProperty(username)) //unique names
        return false
    users[username] = { pwd: password, 'public-key': pubKey, "private-key": privKey }
    writeUserList(users)
}

/**
 * Function to create a new thread
 * @param {String} username
 * @param {String} title 
 * @param {String} content
 */
let createThread = (username, title, content) => {
    threads.push({
        "name": title,
        "content": [
            {
                "username": username,
                "timestamp": sysClock.getTime(),
                "content": content
            }
        ]
    })
    writeThreadList(threads)
}

/**
 * Enum for adding messages to thread
 * @enum {number}
 */
this.threadAdd = Object.freeze({ "SUCCESS": 1, "NO_SUCH_THREAD": -1, "INVALID_CONTENT": -2 })

/**
 * Adds a message to a thread, generates timestamp
 * @param {{threadID:Number, username:String, content:String}}
 * @return {{Status}}
 */
let addMessageToThread = ({ threadID, username, content }) => {
    threads[threadID].content.push({ username: username, timestamp: sysClock.getTime(), content: content })
    writeThreadList(threads)
    return this.threadAdd.SUCCESS
}

/**
 * Checks if user exists and password matches
 * @param {String} username
 * @param {String} password
 * @return {Number} `1` on success, `0` password fail, `-1` username fail
 */
let userExists = (username, password) => {
    if (!users.hasOwnProperty(username))
        return -1
    if (!(users[username]['pwd'] === password))
        return 0
    return 1
}




app.get('/', (req, res) => {
    ejs.renderFile('./views/home.ejs', { thread: threads }).then((e) => {
        res.send(e)
    })
})

app.get('/home', (req, res) => {
    ejs.renderFile('./views/home.ejs', { thread: threads }).then((e) => {
        res.send({ html: e })
    })
})

app.get('/thread', (req, res) => {
    ejs.renderFile('./views/thread.ejs', { thread: threads[req.query.thread] }).then((e) => {
        res.send({ html: e })
    })
})

app.post('/newThread', (req, res) => {
    // console.log(req.body)
    createThread(req.body.user, req.body.title, req.body.content)
    res.sendStatus(200)
})

app.post('/newPost', (req, res) => {
    addMessageToThread({ threadID: req.body.thread, username: req.body.user, content: req.body.content })
    res.sendStatus(200)
})

app.post('/loginCreate', (req, res) => {
    let username = req.body.username
    let password = req.body.password
    let isNewUser = req.body.isNewUser
    let privKey = req.body.privKey
    let pubKey = req.body.pubKey

    // console.log(username, password)


    if (!isNewUser) {
        if (userExists(username, password) === 1) {
            res.send({ privKey: users[username]['private-key'], pubKey: users[username]['public-key'] })
        } else {
            res.sendStatus(401)
        }
    } else {
        if (userExists(username, password) === -1) {//no user with this acc
            addUser(username, password, privKey, pubKey)
            res.send({ privKey: users[username]['private-key'], pubKey: users[username]['public-key'] })
        } else {
            res.sendStatus(402)
        }
    }
})

https.createServer(key_options, app).listen(port);

// app.listen(port, () => console.log(`Host_Service listening at http://localhost:${port}`))


let threads = readThreadList()
let users = readUserList()
