class Event {
    // constructor
    constructor({type, message=null, data}) {
        this.type = type;
        this.message = message;
        this.data = data;
    }
}

module.exports = Event;