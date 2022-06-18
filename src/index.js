const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require("path");


app.get('/', (req, res) => {
    res.send('Hello world<');
});

app.get('/client', (req, res) => {
    res.sendFile(path.resolve("") +'/public/index.html');
});


var document = "";

io.on('connection', (socket) => {
    socket.join("doc");
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

    socket.emit("past_history", document);

    // notify existing users
    socket.broadcast.emit("user_connected", {
        userID: socket.id,
        //username: socket.username,
    });

    console.log('a user connected');

    socket.on('message', (msg) => {
        console.log("New message",socket.id,"🟥 ",  msg)
        //io.emit('message', msg);
        document=msg;
        socket.broadcast.emit("message", msg);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected ',socket.id);
        socket.broadcast.emit("user_disconnected", {
            userID: socket.id,
        });
    });

});

server.listen( process.env.PORT || 3000, () => {
    console.log('listening on *:3000');
});