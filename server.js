const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const uuid = require('node-uuid');

const ClientSocket = require('./ClientSocket');
const Event = require('./Event');

const wss = new WebSocketServer({ port: 8181 });

const connections = new Map();

process.setMaxListeners(0);

wss.on('connection', (ws) => {

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
                message: `You are connected with: ${clientSocket.nickname}`,
                data: {
                    client: {
                        uuid: newClientSocket.uuid,
                        nickname: newClientSocket.nickname
                    },
                    private: {
                        uuid: clientSocket.uuid,
                        nickname: clientSocket.nickname
                    }
                }
            }));

            clientSocket.send(new Event({
                type: 'notification',
                message: `You are connected with: ${newClientSocket.nickname}`,
                data: {
                    client: {
                        uuid: clientSocket.uuid,
                        nickname: clientSocket.nickname
                    },
                    private: {
                        uuid: newClientSocket.uuid,
                        nickname: newClientSocket.nickname
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
            message: `Please Wait...`,
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

    ws.on('message', (message) => {
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

                        if (clientSocket.privateSocket) {
                            clientSocket.privateSocket.send(new Event({
                                type: 'nick_update',
                                message: nickname_message,
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
                                }
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
                    message: `${clientSocket.nickname} has been disconnected`,
                    data: {
                        client: {
                            uuid: clientSocket.privateSocket.uuid,
                            nickname: clientSocket.privateSocket.nickname
                        },
                        private: {
                            uuid: clientSocket.uuid,
                            nickname: clientSocket.nickname
                        }
                    }
                }));

                connections.delete(clientSocket.uuid);
                connections.delete(clientSocket.privateSocket.uuid);

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
