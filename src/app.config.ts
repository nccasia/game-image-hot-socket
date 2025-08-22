import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { matchMaker } from "colyseus";
import { PVPRoomSharePrize } from "./rooms/PVPRoomSharePrize";
import { RequestType } from "./Enums";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { IOInteract } from "./IOInteract";

// const PVP_RANK_PRIZE = 'pvp_rank_prize';
const PVP_SHARE_PRIZE = "pvp_share_prize";
const LOBBY_ROOM = "lobby_room";

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
                switch (type) {
                    case RequestType.CREATE_ROOM:
                        let roomToJoin;
                        const roomOptions = payload;
                        roomToJoin = await matchMaker.createRoom(PVP_SHARE_PRIZE, roomOptions);
                        return res.json({ success: true, roomId: roomToJoin.roomId });

                    case RequestType.FIND_ROOM:
                        try {
                            let rooms = (await matchMaker.query({})).filter((_r) =>
                                _r.name === PVP_SHARE_PRIZE && _r.metadata.betValue === payload.betValue
                            );
                            const availableRoom = rooms.find(r => r.locked === false);

                            let allRoom = (await matchMaker.query({})).filter((_r: any) => _r.name === PVP_SHARE_PRIZE);

                            let roomToJoin;
                            if (availableRoom) {
                                roomToJoin = availableRoom;
                                return res.json({ success: true, roomId: roomToJoin.roomId, status: "ROOM_FOUND" });
                            } else if (allRoom.length === 0){
                                return res.json({ success: false, status: "NO ROOM AVAILABLE" });
                            } else {
                                return res.json({ success: false, status: "WAITING_FOR_ROOM" });
                            }
                        } catch (err: any) {
                            console.error("Matchmaking error (FIND_ROOM):", err);
                            if (err.message && err.message.includes("Max room attempts reached")) {
                                return res.status(503).json({ success: false, error: "Server busy, please try again." });
                            }
                            return res.status(500).json({ success: false, error: "Matchmaking failed unexpectedly." });
                        }

                    case RequestType.GET_LIST_ROOM:
                        try {
                            let rooms = (await matchMaker.query({})).filter((_r) => _r.locked === false && _r.name === PVP_SHARE_PRIZE).sort((a, b) => {
                                if(a.metadata.betValue != b.metadata.betValue){
                                    return b.metadata.betValue - a.metadata.betValue;
                                }
                            });
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
                                return res.status(404).json({ success: false, error: `Room with ID ${payload.roomId} not found.`, status: "ROOM_NOT_FOUND" });
                            }

                            return res.json({ success: true, roomId: roomToJoin.roomId, status: "JOIN_SUCCESS" });
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

        app.post("/transaction", async (req, res) => {
            const option = req.body;

            try {
                IOInteract.instance.swapToken(option.user, option.balance, async (returnData) => {
                    console.log(returnData);
                });

                return res.json({ success: true, status: "WITHDRAW_SUCCESS" });
            } catch (error) {
                return res.status(500).json({ success: false, error: "Failed to Withdraw token." });
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

