import {Schema, type } from "@colyseus/schema";

export class RoomMetadata extends Schema {
    @type("number") betValue : number;
}

export class RoomInfo extends Schema {
    @type("string") roomId: string;
    @type("number") clients: number;
    @type("string") createAt: string;
    @type("boolean") locked: boolean;
    @type("number") maxClients: number | null;
    @type(RoomMetadata) metadata: RoomMetadata;
    @type("string") name: string;
    @type("boolean") private: boolean;
    @type("string") processId: string;
    @type("boolean") unlisted: boolean;
}

export class LobbyState extends Schema {
    @type({ map: RoomInfo }) rooms = new Map<string, RoomInfo>()
}