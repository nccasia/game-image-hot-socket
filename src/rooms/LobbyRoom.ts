import { Room, matchMaker } from "@colyseus/core";
import { RoomInfo, LobbyState, RoomMetadata } from "./schema/LobbyRoomState"
import { GamePrizeMode } from "./schema/StateEnum";
import { RequestType } from "../Enums";


export class LobbyRoom extends Room<LobbyState> {
    state = new LobbyState();
    maxClients = Infinity; 
    autoDispose = false
    private pollingInterval: NodeJS.Timeout | null = null;

    async onCreate(options: any) {
        await this.updateRoomList();
        
        this.pollingInterval = setInterval(async () => {
            await this.updateRoomList();
        }, 3000);
    }

    onJoin(client: any, options: any) {
    }

    onLeave(client: any, consented: boolean) {
    }

    onDispose() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    private async updateRoomList () {
        const roomList = (await matchMaker.query({})).filter((_r) => _r.name === GamePrizeMode.SHAREPRIZE);
        this.state.rooms.clear();

        roomList.forEach(room => {
            const roomInfo = new RoomInfo();
            const newMetadata = new RoomMetadata(); 
            Object.assign(newMetadata, room.metadata);
            
            roomInfo.roomId = room.roomId,
            roomInfo.name = room.name,
            roomInfo.clients = room.clients,
            roomInfo.maxClients = room.maxClients,
            roomInfo.locked = room.locked,
            roomInfo.metadata = newMetadata,
            roomInfo.createAt = room.createAt,
            roomInfo.private = room.private,
            roomInfo.processId = room.processId,
            roomInfo.unlisted = room.unlisted,

            this.state.rooms.set(roomInfo.roomId, roomInfo)
        })
    }

    update(){
        this.updateRoomList();
    }
}