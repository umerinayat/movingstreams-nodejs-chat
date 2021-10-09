const express = require('express');
const http = require('http');
const sockjs = require('sockjs');
const uuid = require('node-uuid');

const ClientSocket = require('./ClientSocket');
const Event = require('./Event');

const options = {prefix:'/chat', sockjs_url: 'http://www.movingstreams.com', disable_cors: true};

const app = express();
const httpServer = http.createServer(app);
const sockServer = sockjs.createServer(options);

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

const connections = new Map();

process.setMaxListeners(0);

sockServer.on('connection', (ws) => {

    const cuuid = uuid.v4();
    const newClientSocket = new ClientSocket(cuuid, 'AnonymousUser', null, ws);
    connections.set(newClientSocket.uuid, newClientSocket);

    let isConnected = false;

    for (let [uuid, clientSocket] of connections) {
        if (uuid != newClientSocket.uuid && clientSocket.privateSocket == null) {
            clientSocket.privateSocket = newClientSocket;
            newClientSocket.privateSocket = clientSocket;

            newClientSocket.send(new Event({
                type: 'notification',
                message: `You are <b> ${newClientSocket.nickname} </b>, If you want to change your name then type <b style='color: green'>  '/nick yourname' </b> in the message box and send it.`,
                data: {
                    client: {
                        uuid: newClientSocket.uuid,
                        nickname: newClientSocket.nickname
                    },
                }
            }));
            
            newClientSocket.send(new Event({
                type: 'notification',
                message: `You are connected with: <b>${clientSocket.nickname}</b>`,
                data: {
                    client: {
                        uuid: newClientSocket.uuid,
                        nickname: newClientSocket.nickname
                    },
                    connected: {
                        uuid: clientSocket.uuid,
                        nickname: clientSocket.nickname,
                        message: `Hi, I am ${clientSocket.nickname} I would love to chat with you`
                    }
                }
            }));

            clientSocket.send(new Event({
                type: 'notification',
                message: `You are connected with: <b>${newClientSocket.nickname}</b>`,
                data: {
                    client: {
                        uuid: clientSocket.uuid,
                        nickname: clientSocket.nickname
                    },
                    connected: {
                        uuid: newClientSocket.uuid,
                        nickname: newClientSocket.nickname,
                        message: `Hi, I am ${newClientSocket.nickname} I would love to chat with you`
                    }
                }
            }));

            isConnected = true;
            break;
        }
    }

    if (!isConnected) {
        newClientSocket.send(new Event({
            type: 'waiting',
            message: `You are <b> ${newClientSocket.nickname} </b>, If you want to change your name then type <b style='color: green'>  '/nick yourname' </b> in the message box and send it.`,
            data: {
                client: {
                    uuid: newClientSocket.uuid,
                    nickname: newClientSocket.nickname
                },
            }
        }
        ));
    }

    // const connect_message = nickname + ' has connected';

    // wsSend('notification', client_uuid, nickname, connect_message);

    ws.on('data', (message) => {
        let parsedMesg = JSON.parse(message.toString());
        let clientSocket = connections.get(cuuid);

        if (clientSocket) {
            if (parsedMesg.event == 'message') {
                let msg = parsedMesg.message;
                if (msg.indexOf('/nick') === 0) {
                    let nickname_array = msg.split(' ');
                    if (nickname_array.length >= 2) {
                        let old_nickname = clientSocket.nickname;
                        clientSocket.nickname = nickname_array[1];
                        let nickname_message =
                            'Client ' + old_nickname + ' changed to ' + clientSocket.nickname;

                            clientSocket.send(new Event({
                                type: 'message',
                                message: `Your named has been changed now you are <b> ${clientSocket.nickname} </b>`,
                                data: {
                                    client: {
                                        uuid: clientSocket.uuid,
                                        nickname: clientSocket.nickname
                                    }
                                }
                            }));

                        if (clientSocket.privateSocket) {
                            clientSocket.privateSocket.send(new Event({
                                type: 'message',
                                message: `Your partner <b>${old_nickname}</b> has changed their name to <b>${clientSocket.nickname}</b>`,
                                data: {
                                    client: {
                                        uuid: clientSocket.uuid,
                                        nickname: clientSocket.nickname
                                    }
                                }
                            }));
                        }
                    }
                } else {
                    if (clientSocket.privateSocket) {
                        
                        clientSocket.send(new Event({
                            type: 'message',
                            message: msg,
                            data: {
                                client: {
                                    uuid: clientSocket.uuid,
                                    nickname: clientSocket.nickname
                                }
                            }
                        }));

                        clientSocket.privateSocket.send(new Event({
                            type: 'message',
                            message: msg,
                            data: {
                                client: {
                                    uuid: clientSocket.uuid,
                                    nickname: clientSocket.nickname
                                },
                                private: {}
                            }
                        }));
                    }
                }
            }

            else if (parsedMesg.event == 'typing') {
                if (clientSocket.privateSocket) {
                    clientSocket.privateSocket.send(new Event({
                        type: 'typing',
                        message: clientSocket.nickname + ' typing...',
                        data: {
                            client: {
                                uuid: clientSocket.uuid,
                                nickname: clientSocket.nickname
                            }
                        }
                    }));
                }
            } else if (parsedMesg.event == 'clear-typing') {
                if (clientSocket.privateSocket) {
                    clientSocket.privateSocket.send(new Event({
                        type: 'clear-typing',
                        message: clientSocket.nickname + ' clear typing...',
                        data: {
                            client: {
                                uuid: clientSocket.uuid,
                                nickname: clientSocket.nickname
                            }
                        }
                    }));
                }
            }
        }



    });

    var closeSocket = (customMessage) => {

        const clientSocket = connections.get(cuuid);

        if (clientSocket) {
            if (clientSocket.privateSocket) {
                clientSocket.privateSocket.send(new Event({
                    type: 'notification',
                    message: `<b>${clientSocket.nickname}</b> has been disconnected`,
                    data: {
                        client: {
                            uuid: clientSocket.uuid,
                            nickname: clientSocket.nickname
                        },
                        private: {}
                    }
                }));

                clientSocket.privateSocket.privateSocket = null;
                clientSocket.privateSocket.send(new Event({
                    type: 'notification',
                    message: `Please Wait Connecting With New Friend`,
                    data: {
                        client: {
                            uuid: clientSocket.privateSocket.uuid,
                            nickname: clientSocket.privateSocket.nickname
                        },
                    }
                }
                ));

                connections.delete(clientSocket.uuid);

            } else {
                connections.delete(cuuid);
            }
        }
    };

    ws.on('close', function () {
        closeSocket();
    });

    process.on('SIGINT', function () {
        console.log('Closing things');
        closeSocket('Server has disconnected');
        process.exit();
    });

});


sockServer.installHandlers(httpServer, options);

console.log(' [*] Listening on 0.0.0.0:8181' );
httpServer.listen(8181, '0.0.0.0');

app.get('/random-chat', function (req, res) {
    res.sendFile(__dirname + '/client.html');
});