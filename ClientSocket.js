const OPEN = 1;

class ClientSocket {
    static index = 0;
    // constructor
    constructor(uuid, nickname, name, ws) {
        this.uuid = uuid;
        this.nickname = `${nickname} ${++ClientSocket.index}`;
        this.name = name;
        this.ws = ws;

        this.privateSocket = null;
    }

    send(Event) {
        if (this.ws.readyState === OPEN) {
            this.ws.write(
            JSON.stringify({
                event: Event
            })
          );
        }
      }

      setPrivateSocket(ClientSocket) {
          this.privateSocket = ClientSocket;
      }

}

module.exports = ClientSocket;