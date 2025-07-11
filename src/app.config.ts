import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { matchMaker } from "colyseus";
// import { PVPRoomRankPrize } from "./rooms/PVPRoomRankPrize";
import { PVPRoomSharePrize } from "./rooms/PVPRoomSharePrize";
import { IOInteract, IOReturn, Status } from "./IOInteract";

const PVP_RANK_PRIZE = 'pvp_rank_prize';
const PVP_SHARE_PRIZE = 'pvp_share_prize';

export default config({
    initializeGameServer: (gameServer) => { //
        // gameServer.define(PVP_RANK_PRIZE, PVPRoomRankPrize); //
        gameServer.define(PVP_SHARE_PRIZE, PVPRoomSharePrize); //
    },

    initializeExpress: (app) => { //
        app.get("/hello_world", (req, res) => { //
            res.send("It's time to kick ass and chew bubblegum!"); //
        });

        app.post("/matchmaking", async (req, res) => { //
            const { betValue, gameMode, playerName, mezonId } = req.body;
            let balance = 10000;
            await IOInteract.instance.getBalance(mezonId, async (returnData: IOReturn) => {
                if (returnData.status == Status.Success) {
                    balance = returnData.data.balance;
                }
                else {

                }
            });
            if (betValue === undefined || betValue === null) { //
                return res.status(400).json({ error: "betValue is required for matchmaking." }); //
            }
            if (typeof betValue !== 'number' || betValue < 0) { //
                return res.status(400).json({ error: "betValue must be a non-negative number." }); //
            }
            const validGameModes = [PVP_RANK_PRIZE, PVP_SHARE_PRIZE]; // Thêm STREAK_ROOM_NAME nếu bạn muốn hỗ trợ
            if (!validGameModes.includes(gameMode)) {
                return res.status(400).json({ error: `Invalid gameMode: ${gameMode}. Available modes are: ${validGameModes.join(', ')}` });
            }
            if (balance < betValue) {
                return res.status(400).json({ error: "Not enough gold to start." }); //
            }

            try {
                let rooms = (await matchMaker.query({})).filter((_r) =>
                    _r.name === gameMode && _r.metadata.bet === betValue
                );

                const availableRoom = rooms.find(room => room.locked === false);

                let roomToJoin; //
                let goldAmount = balance;
                if (availableRoom) { //
                    roomToJoin = availableRoom; //
                    console.log(`Joining existing room: ${roomToJoin.roomId} with bet: ${betValue}`); //
                } else {
                    const roomOptions = { betValue, gameMode, playerName, goldAmount }; //
                    roomToJoin = await matchMaker.createRoom(gameMode, roomOptions); //
                    console.log(`Created new room: ${roomToJoin.roomId} with bet: ${betValue}`); //
                }

                return res.json({ roomId: roomToJoin.roomId }); //
            } catch (err) {
                console.error("Matchmaking error:", err); //
                if (err instanceof Error && err.message.includes("Max room attempts reached")) { //
                    res.status(503).json({ error: "Server busy, please try again." }); //
                } else {
                    res.status(500).json({ error: "Matchmaking failed unexpectedly." }); //
                }
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

    beforeListen: async () => { //
    }
});