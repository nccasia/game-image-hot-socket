import { response } from "express";
import { io } from "socket.io-client";
// import { eventBus } from "../src/globalEvent";
require('dotenv').config();

export class IOInteract {
    private static _instance: IOInteract = new this;
    public static get instance(): IOInteract {
        return this._instance
    }
    // socket = io("http://10.10.41.233:3001"); local
    US_socket = io("https://socketgameuser-server.ncc.studio/", { secure: true, transports: ['websocket'] }); // user server
    // BE_socket = io("http://10.10.41.233:3002/", { secure: true, transports: ['websocket'] }); // backend server
    BE_socket = io("https://image-hot-be-socket.ncc.studio", { secure: true, transports: ['websocket'] }); // backend server
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
            console.log(`Add Balance ${value} to ${user}`)
            onSuccess(callbackData)
        })
    }
    deductBalance(user: string, value: number, onSuccess: (response: IOReturn) => Promise<void>) {
        this.US_socket.emit('deductBalance', { user: user, value: value, hash: this.hash, game: this.gameName }, (callbackData: any) => {
            console.log(`Deduct Balance ${value} to ${user}`)
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

    // startBet(user: string, value: number, onSuccess: (response: IOReturn) => Promise<void>) {
    //     this.US_socket.emit('betToken', { user: user, value: value, hash: this.hash, game: this.gameName }, (callbackData: IOReturn) => {
    //         console.log(`Start Bet ${value} to ${user}`)
    //         onSuccess(callbackData)
    //     })
    // }
    // endBet(user: string, value: number, onSuccess: (response: IOReturn) => Promise<void>) {
    //     this.US_socket.emit('endBetToken', { user: user, value: value, hash: this.hash, game: this.gameName }, (callbackData: IOReturn) => {
    //         console.log(`End Bet ${value} to ${user}`)
    //         onSuccess(callbackData)
    //     })
    // }

    // BE socket interaction
    getQuestion(onSuccess: (response: any) => Promise<void>) {
        return new Promise((resolve, reject) => {
            this.BE_socket.emit('getQuestion', { hash: this.hash }, async (callbackData: any) => {
                if (onSuccess) {
                    await onSuccess(callbackData);
                }
                resolve(callbackData);
            });
        });
    }

    getBotProfile(candyAmount: number, onSuccess: (response: any) => Promise<void>) {
        return new Promise((resolve, reject) => {
            this.BE_socket.emit('getBotProfile', { hash: this.hash, candyAmount: candyAmount }, async (callbackData: any) => {
                 if (onSuccess) {
                    await onSuccess(callbackData.data);
                }
                resolve(callbackData.data);
            });
        });
    }

    startBet(gameId: string, currencyType: string, gameData: any, onSuccess: (response: IOReturn) => Promise<void>) {
        return new Promise((resolve, reject) => {
            this.BE_socket.emit('betGame', { hash: this.hash, gameId: gameId, currencyType: currencyType, gameData: gameData }, async (callbackData: IOReturn) => {
                if (onSuccess) {
                    await onSuccess(callbackData);
                }
                resolve(callbackData);
            });
        });
    }
    endBet(gameId: string, winner: any, onSuccess: (response: IOReturn) => Promise<void>) {
        return new Promise((resolve, reject) => {
            this.BE_socket.emit('endGame', { hash: this.hash, gameId: gameId, winner: winner }, async (callbackData: IOReturn) => {
                if (onSuccess) {
                    await onSuccess(callbackData);
                }
                resolve(callbackData);
            });
        });
    }

    setFinishQuestion(questionId: string, leftPhotoVote: string, rightPhotoVote: string, onSuccess: (response: any) => Promise<void>) {
        this.BE_socket.emit('finishQuestion', {
            hash: this.hash,
            questionId: questionId,
            leftVote: leftPhotoVote,
            rightVote: rightPhotoVote,
        }, (callbackData: any) => {
            onSuccess(callbackData)
        })
    }

    endGame(playerResult: any, onSuccess: (response: any) => Promise<void>) {
        this.BE_socket.emit('endGame', {
            game: this.gameName,
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