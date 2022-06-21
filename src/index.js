const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require("path");

const versions = {server:"1.0.1",clientdesktop:"1.0.1",protocol:1}

const Diff = require('diff');

app.get('/', (req, res) => {
    res.send('Hello world<\nnotechat.ru');
});
app.use('/assets', express.static(path.resolve("") +'/public/assets/'));
app.get('/client', (req, res) => {
    res.sendFile(path.resolve("") +'/public/notepad.html');
});
app.get('/client/*', (req, res) => {
    res.sendFile(path.resolve("") +'/public/notepad.html');
});


app.get('/version', (req, res) => {
    res.send(versions);
});
app.get('/version/clientdesktop', (req, res) => {
    res.send(versions.clientdesktop);
});

const crypto = require("crypto");
const randomId = () => crypto.randomBytes(8).toString("hex");

const { InMemorySessionStore } = require("./sessionStore");
const sessionStore = new InMemorySessionStore();

io.use((socket, next) => {
    const sessionID = socket.handshake.auth.sessionID;
    if (sessionID) {
      const session = sessionStore.findSession(sessionID);
      if (session) {
        //console.log("1️⃣ Existing session");
        socket.sessionID = sessionID;
        socket.userID = session.userID;
        return next();
      }
    }
    socket.sessionID = randomId();
    socket.userID = randomId();
    //console.log("0️⃣ New session");
    next();
});

// TODO: save all data to DB
var document = [];
/*
{
    text: "",
    lastChanged: timestamp,
    lastChangedBy: user
}
*/

io.on('connection', (socket) => {

    console.log("q",socket.handshake.query)

    var room = socket.handshake.query.room || "doc";

    // persist session
    sessionStore.saveSession(socket.sessionID, {
        userID: socket.userID,
        connected: true,
    });

    // emit session details
    socket.emit("session", {
        sessionID: socket.sessionID,
        userID: socket.userID,
    });

    socket.join(room);
    const users = [];
    // Send the user other users
    for (let [id, socket] of io.of("/").sockets) {
        users.push({
          userID: id,
          //username: socket.username,
        });
    }
    socket.emit("users", users);

    if(!document[room])
        document[room] = {text:"",lastChanged:0}

    socket.emit("past_history", document[room].text);

    // notify existing users
    socket.broadcast.to(room).emit("user_connected", {
        userID: socket.id,
        //username: socket.username,
    });

    console.log('a user connected');

    // LEGACY
    socket.on('message', (msg) => {
        console.log("",socket.id," ✉️ ",room," ===> ",  msg)
        //io.emit('message', msg);
        document[room].text=msg;
        document[room].lastChanged = Date.now();
        socket.broadcast.to(room).emit("message", msg);
    });

    socket.on('patch', (msg) => {
        console.log("",socket.id," ✉️ ",room," ===> ",  msg)
        //io.emit('message', msg);
        //console.log(Diff.parsePatch(msg))

        // ТУТ ВОЗМОЖНА ОШИБКА: ДРУГОЙ ПОЛЬЗОВАТЕЛЬ УСПЕЛ ИЗМЕНИТЬ ДОКУМЕНТ
        try{
            let p = Diff.applyPatch( document[room].text , Diff.parsePatch(msg))
            console.log("pApplyed", p)
            document[room].text= p;

            document[room].lastChanged = Date.now();
            socket.broadcast.to(room).emit("patch", msg);
        }catch(e){
            io.to(room).emit('patch_error', "error");
        }
    });

    socket.on('cursor', (msg) => {
        io.to(room).emit('cursor', {userID: socket.userID, socketID: socket.id, pos: msg});
    });

    socket.on('disconnect', () => {
        console.log('user disconnected ',socket.id);
        socket.broadcast.to(room).emit("user_disconnected", {
            userID: socket.id,
        });

        sessionStore.saveSession(socket.sessionID, {
            userID: socket.userID,
            connected: false,
        });
    });

});

server.listen( process.env.PORT || 3000, () => {
    console.log('listening on *:3000');
});