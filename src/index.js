const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require("path");

const versions = {server:"1.0.1",clientdesktop:"1.0.1",protocol:1}

app.get('/', (req, res) => {
    res.send('Hello world<');
});

app.get('/client', (req, res) => {
    res.sendFile(path.resolve("") +'/public/index.html');
});


app.get('/version', (req, res) => {
    res.send(versions);
});
app.get('/version/clientdesktop', (req, res) => {
    res.send(versions.clientdesktop);
});

var document = [];

io.on('connection', (socket) => {

    console.log("q",socket.handshake.query)

    var room = socket.handshake.query.room || "doc";

    socket.join(room);
    const users = [];

    //console.log(io.sockets.adapter.rooms['doc']);
    // Send the user other users
    for (let [id, socket] of io.of("/").sockets) {
        users.push({
          userID: id,
          //username: socket.username,
        });
    }
    
    socket.emit("users", users);

    socket.emit("past_history", document[room]);

    // notify existing users
    socket.broadcast.to(room).emit("user_connected", {
        userID: socket.id,
        //username: socket.username,
    });

    console.log('a user connected');

    socket.on('message', (msg) => {
        console.log("",socket.id," ✉️ ",room," ===> ",  msg)
        //io.emit('message', msg);
        document[room]=msg;
        socket.broadcast.to(room).emit("message", msg);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected ',socket.id);
        socket.broadcast.to(room).emit("user_disconnected", {
            userID: socket.id,
        });
    });

});

server.listen( process.env.PORT || 3000, () => {
    console.log('listening on *:3000');
});