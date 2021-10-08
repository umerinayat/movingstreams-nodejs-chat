const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const uuid = require('node-uuid');

const wss = new WebSocketServer({ port: 8181 });

let clients = [];

function wsSend(type, client_uuid, nickname, message, client) {

    if (client) {
        if (client.unknowClient) {
            let clientSocket = client.ws;
            if (clientSocket.readyState === WebSocket.OPEN) {

                if (type == 'typing' || type == 'clear-typing') {

                } else {
                    clientSocket.send(
                        JSON.stringify({
                            type: type,
                            id: client_uuid,
                            nickname: nickname,
                            message: message,
                        })
                    );
                }
                

            }

            if (type == 'connected') {

                let unknowClientWs = client.unknowClient.ws;

                unknowClientWs.send(
                    JSON.stringify({
                        type: type,
                        id: client.unknowClient.id,
                        nickname: client.unknowClient.nickname,
                        message: 'You are connected with: ' + client.id,
                    })
                );
            }

            if (type == 'message') {

                let unknowClientWs = client.unknowClient.ws;

                unknowClientWs.send(
                    JSON.stringify({
                        type: type,
                        id: client_uuid,
                        nickname: nickname,
                        message: message,
                    })
                );
            }

            if (type == 'typing') {
                let unknowClientWs = client.unknowClient.ws;

                unknowClientWs.send(
                    JSON.stringify({
                        type: type,
                        id: client_uuid,
                        nickname: nickname,
                        message: message,
                    })
                );
            }

            if (type == 'clear-typing') {
                let unknowClientWs = client.unknowClient.ws;

                unknowClientWs.send(
                    JSON.stringify({
                        type: type,
                        id: client_uuid,
                        nickname: nickname,
                        message: message,
                    })
                );
            }
        }
    }

}

let clientIndex = 1;

wss.on('connection', (ws) => {

    const client_uuid = uuid.v4();
    let nickname = 'AnonymousUser' + clientIndex;
    clientIndex += 1;

    let unknowClient = clients.find(c => {
        return c.id != client_uuid && c.unknowClient == null;
    });

    if (unknowClient) {
        let client = { id: client_uuid, ws: ws, nickname: nickname, unknowClient: unknowClient };
        unknowClient = { ...unknowClient, unknowClient: client };

        clients = clients.map(c => {
            if (c.id == unknowClient.id) {
                return unknowClient;
            }
            return c;
        });

        clients.push(client);

        wsSend('connected', client_uuid, nickname, 'You are connected with: ' + unknowClient.id, client);
    } else {
        let client = { id: client_uuid, ws: ws, nickname: nickname, unknowClient: null };
        clients.push(client);
        wsSend('waiting', client_uuid, nickname, 'Please Wait...', client);
    }

    // console.log('client [%s] connected', client_uuid);

    // const connect_message = nickname + ' has connected';

    // wsSend('notification', client_uuid, nickname, connect_message);

    ws.on('message', (message) => {
        let parsedMesg = JSON.parse(message.toString());
        let c = clients.find(c => c.id == client_uuid);


        if (parsedMesg.event == 'message') {
            let msg = parsedMesg.message;
            if (msg.indexOf('/nick') === 0) {
                let nickname_array = msg.split(' ');

                if (nickname_array.length >= 2) {
                    let old_nickname = nickname;
                    nickname = nickname_array[1];
                    let nickname_message =
                        'Client ' + old_nickname + ' changed to ' + nickname;

                    wsSend('nick_update', client_uuid, nickname, nickname_message, c);
                }
            } else {
                wsSend('message', client_uuid, nickname, msg, c);
            }
        } else if (parsedMesg.event == 'typing') {
            wsSend('typing', client_uuid, nickname, 'typing...', c);
        } else if (parsedMesg.event == 'clear-typing') {
            wsSend('clear-typing', client_uuid, nickname, 'clear typing', c);
        } else if (parsedMesg.event == 'reconnect') {
        }
    });

    var closeSocket = (customMessage) => {
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].id == client_uuid) {
                var disconnect_message;
                if (customMessage) {
                    disconnect_message = customMessage;
                } else {
                    disconnect_message = nickname + ' has disconnected';
                }
                wsSend('notification', client_uuid, nickname, disconnect_message);
                clients.splice(i, 1);
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
