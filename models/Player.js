class Player {
    constructor(userId, username) {
        this._userId = userId;
        this._userName = username;
    }

    get userId() {
        return this._userId;
    }

    set userId(value) {
        this._userId = value;
    }

    get userName() {
        return this._userName;
    }

    set username(value) {
        this._userName = value;
    }
}

module.exports = Player;
