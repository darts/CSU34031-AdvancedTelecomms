const app = require('express')()
const fs = require('fs')
const path = require('path')
const threadPath = path.join(__dirname, "threads.json")
const userPath = path.join(__dirname, "users.json")
const sysClock = new Date()
const ejs = require('ejs')
const keyLen = 20
const port = 3000

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
let addUser = (username, password) => {
    if (users.includes(username)) //unique names
        return false
    users[username] = { pwd: password, 'api-key': genKey(keyLen) }
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
    threads[threadID].content.push({ username: username, timestamp: sysClock.getTime, content: content })
    return this.threadAdd.SUCCESS
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

app.listen(port, () => console.log(`Host_Service listening at http://localhost:${port}`))


let threads = readThreadList()
let users = readUserList()
