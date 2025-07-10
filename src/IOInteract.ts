import { io } from "socket.io-client";
// import { eventBus } from "../src/globalEvent";
require('dotenv').config();

export class IOInteract {
    private static _instance: IOInteract = new this;
    public static get instance(): IOInteract {
        return this._instance
    }
    // socket = io("http://10.10.41.239:3001"); local
    US_socket = io("https://socketgameuser-server.ncc.studio/", { secure: true, transports: ['websocket'] }); // user server
    BE_socket = io("https://image-hot-be-socket.ncc.studio/", { secure: true, transports: ['websocket'] }); // backend server
    hash = process.env.REACT_APP_HASH
    gameName = "BestGuess"

    connect() {
        console.log(this.hash)
        this.US_socket.on("connect_error", (error) => {
            if (this.US_socket.active) {
            } else {
                console.log(error.message);
            }
        });
        this.US_socket.on("connect", () => {
            console.log('connect US_socket', this.US_socket.id);
        });
        this.US_socket.on("disconnect", () => {
            console.log('disconnect US_socket', this.US_socket.id);
        });

        this.BE_socket.on("connect_error", (error) => {
            if (this.BE_socket.active) {
            } else {
                console.log(error.message);
            }
        });
        this.BE_socket.on("connect", () => {
            console.log('connect BE_socket', this.BE_socket.id);
        });
        this.BE_socket.on("disconnect", () => {
            console.log('disconnect BE_socket', this.BE_socket.id);
        });
    }


    // US socket interaction
    addBalance(user: string, value: number, onSuccess: (response: IOReturn) => Promise<void>) {
        this.US_socket.emit('addBalance', { user: user, value: value, hash: this.hash, game: this.gameName }, (callbackData: any) => {
            onSuccess(callbackData)
        })
    }
    deductBalance(user: string, value: number, onSuccess: (response: IOReturn) => Promise<void>) {
        this.US_socket.emit('deductBalance', { user: user, value: value, hash: this.hash, game: this.gameName }, (callbackData: any) => {
            onSuccess(callbackData)
        })
    }
    getBalance(user: string, onSuccess: (response: IOReturn) => Promise<void>) {
        this.US_socket.emit('getBalance', { user: user, hash: this.hash, game: this.gameName }, (callbackData: any) => {
            onSuccess(callbackData)
        })
    }
    swapToken(user: string, value: number, onSuccess: (response: IOReturn) => Promise<void>) {
        this.US_socket.emit('swapToken', { user: user, value: value, hash: this.hash, game: this.gameName }, (callbackData: IOReturn) => {
            onSuccess(callbackData)
        })
    }
    startBet(user: string, value: number, onSuccess: (response: IOReturn) => Promise<void>) {
        this.US_socket.emit('betToken', { user: user, value: value, hash: this.hash, game: this.gameName }, (callbackData: IOReturn) => {
            onSuccess(callbackData)
        })
    }
    endBet(user: string, value: number, onSuccess: (response: IOReturn) => Promise<void>) {
        this.US_socket.emit('endBetToken', { user: user, value: value, hash: this.hash, game: this.gameName }, (callbackData: IOReturn) => {
            onSuccess(callbackData)
        })
    }



    // BE socket interaction
    getQuestion(onSuccess: (response: any) => Promise<void>) {
        console.log(">>> hash", this.hash)
        this.BE_socket.emit('getQuestion', { hash: this.hash }, (callbackData: any) => {
            onSuccess(callbackData)
        })
    }
    setFinishQuestion(questionId: string, leftPhotoVote: string, rightPhotoVote: string, onSuccess: (response: any) => Promise<void>) {
        this.BE_socket.emit('finishQuestion', {
            hash: this.hash, questionId: questionId,
            leftVote: leftPhotoVote,
            rightVote: rightPhotoVote,
        }, (callbackData: any) => {
            onSuccess(callbackData)
        })
    }
    endGame(playerResult: any, onSuccess: (response: any) => Promise<void>) {
        this.US_socket.emit('endGame', {
            hash: this.hash,
            gameData: playerResult,
        }, (callbackData: any) => {
            onSuccess(callbackData)
        })
    }
}

export class IOReturn {
    status: Status // 0: success, 1: fail, 2: warning
    data:
        {
            user: string,
            balance: number
        }
    message: string
}

export enum Status {
    Success = 0,
    Fail = 1,
    Warning = 2
}