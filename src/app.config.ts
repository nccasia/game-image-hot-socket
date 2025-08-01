import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { matchMaker } from "colyseus";
import { PVPRoomSharePrize } from "./rooms/PVPRoomSharePrize";
import { IOInteract, IOReturn, Status } from "./IOInteract";
import { RequestType } from "./Enums";
import { GamePrizeMode } from "./rooms/schema/StateEnum";
import { LobbyRoom } from "./rooms/LobbyRoom";

// const PVP_RANK_PRIZE = 'pvp_rank_prize';
const PVP_SHARE_PRIZE = 'pvp_share_prize';
const LOBBY_ROOM = 'lobby_room';

export default config({
    initializeGameServer: (gameServer) => { //
        gameServer.define(PVP_SHARE_PRIZE, PVPRoomSharePrize); //
        gameServer.define(LOBBY_ROOM, LobbyRoom); //
        matchMaker.createRoom(LOBBY_ROOM, {});
    },

    initializeExpress: (app) => { //
        app.get("/hello_world", (req, res) => { //
            res.send("It's time to kick ass and chew bubblegum!"); //
        });

        app.post("/matchmaking", async (req, res) => {
            const { type, payload } = req.body;

            try {
                // if (type === RequestType.FIND_ROOM || type === RequestType.CREATE_ROOM || type === RequestType.JOIN_ROOM_BY_ID) {
                //     await checkBalance(payload);
                // }

                switch (type) {
                    case RequestType.FIND_ROOM:
                        try {
                            let rooms = (await matchMaker.query({})).filter((_r) =>
                                _r.name === PVP_SHARE_PRIZE && _r.metadata.betValue === payload.betValue
                            );

                            const availableRoom = rooms.find(room => room.locked === false);

                            let roomToJoin;
                            if (availableRoom) {
                                roomToJoin = availableRoom;
                                console.log(`Joining existing room: ${roomToJoin.roomId} with bet: ${payload.betValue}`);
                            }
                            else {
                                const roomOptions = payload; //
                                roomToJoin = await matchMaker.createRoom(GamePrizeMode.SHAREPRIZE, roomOptions); //

                            }

                            return res.json({ success: true, roomId: roomToJoin.roomId });

                        } catch (err: any) {
                            console.error("Matchmaking error (FIND_ROOM):", err);
                            if (err.message && err.message.includes("Max room attempts reached")) {
                                return res.status(503).json({ success: false, error: "Server busy, please try again." });
                            }
                            return res.status(500).json({ success: false, error: "Matchmaking failed unexpectedly." });
                        }

                    case RequestType.CREATE_ROOM:
                        try {
                            const roomOptions = payload;
                            let roomToJoin = await matchMaker.createRoom(GamePrizeMode.SHAREPRIZE, roomOptions);
                            return res.json({ success: true, roomId: roomToJoin.roomId });
                        } catch (err: any) {
                            console.error("Matchmaking error (CREATE_ROOM):", err);
                            if (err.message && err.message.includes("Max room attempts reached")) {
                                return res.status(503).json({ success: false, error: "Server busy, please try again." });
                            }
                            return res.status(500).json({ success: false, error: "Failed to create room unexpectedly." });
                        }

                    case RequestType.GET_LIST_ROOM:
                        try {
                            let rooms = (await matchMaker.query({})).filter((_r) => _r.locked === false && _r.name === PVP_SHARE_PRIZE);
                            return res.json({ success: true, rooms: rooms });
                        } catch (err: any) {
                            console.error("Matchmaking error (GET_LIST_ROOM):", err);
                            return res.status(500).json({ success: false, error: "Failed to retrieve room list unexpectedly." });
                        }

                    case RequestType.JOIN_ROOM_BY_ID:
                        try {
                            let roomToJoin = (await matchMaker.query({})).find((_r) =>
                                _r.roomId === payload.roomId
                            );

                            if (!roomToJoin) {
                                return res.status(404).json({ success: false, error: `Room with ID ${payload.roomId} not found.` });
                            }

                            return res.json({ success: true, roomId: roomToJoin.roomId });

                        } catch (err: any) {
                            console.error("Matchmaking error (JOIN_ROOM):", err);
                            return res.status(500).json({ success: false, error: "Failed to join room by ID unexpectedly." });
                        }

                    default:
                        return res.status(400).json({ success: false, error: "Unknown matchmaking event type." });
                }
            } catch (error: any) {
                console.error("Matchmaking request failed:", error.message);
                const statusCode = error.message.includes("betValue") || error.message.includes("Not enough gem") ? 400 : 500;
                return res.status(statusCode).json({ success: false, error: error.message });
            }
        });

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") { //
            app.use("/", playground()); //
        }

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/monitor", monitor()); //
    },

    beforeListen: async () => { 
    }
});

export async function checkBalance(payload: { mezonId: string; betValue: number }): Promise<void> {
    // let balance: number;

    // const getBalancePromise = new Promise<IOReturn>((resolve, reject) => {
    //     IOInteract.instance.getBalance(payload.mezonId, async (response: IOReturn) => {
    //         if (response.status === Status.Success) {
    //             resolve(response);
    //         } else {
    //             reject(new Error("Failed to retrieve balance: " + response.status));
    //         }
    //     });
    // });

    // try {
    //     const returnData: IOReturn = await getBalancePromise;
    //     if (typeof returnData.data?.balance === 'number') {
    //         balance = returnData.data.balance;
    //     } else {
    //         throw new Error("Balance data is missing or invalid from API.");
    //     }
    // } catch (error: any) {
    //     console.error("Error fetching balance:", error.message);
    //     throw new Error("An error occurred while fetching balance.");
    // }

    // if (payload.betValue === undefined || payload.betValue === null) {
    //     throw new Error("betValue is required for matchmaking.");
    // }

    // if (typeof payload.betValue !== 'number' || payload.betValue < 0) {
    //     throw new Error("betValue must be a non-negative number.");
    // }

    // if (balance < payload.betValue) {
    //     throw new Error("Not enough gem to start. Top up gems or choose a lower bet.");
    // }
}

