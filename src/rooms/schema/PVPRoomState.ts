import { ArraySchema, Schema, type } from "@colyseus/schema";
import { GamePhase, PlayerConnectStatus } from "./StateEnum";

export class Player extends Schema{
  @type("string") userId: string;
  @type("string") mezonId: string;
  @type("string") playerName: string;
  @type("string") playerAvatarURL: string;
  @type("number") answerTime: number = 0;
  @type("number") point: number = 0;
  @type("number") currency: number;
  @type("number") lastActionTime: number = 0;
  @type("boolean") isHost: boolean;
  @type("boolean") isConfirmed: boolean;
  @type("boolean") isChoiced: boolean;
  @type("boolean") isSurrender: boolean;
  @type("boolean") currentResult: boolean;
  @type("string") connectStatus: PlayerConnectStatus = PlayerConnectStatus.IsConnected;
}

export class ChoiceItem {
  @type("string") photo_id: string = "";
  @type("string") name: string = "";
  @type("string") description: string = "";
  @type("string") category: string = "";
  @type("string") filePath: string = "";
  @type("number") score: number = 0;
  @type("number") vote: number = 0;
  @type("number") disable: number = 0;
}

export class QuestionItem {
  @type("boolean") firstChoiceTrue: boolean;
  @type("string") questionId: string = "";
  @type([ChoiceItem]) choiceList = new ArraySchema<ChoiceItem>();
}

export class PVPRoomState extends Schema{
  @type("string") gameMode: string;
  @type("number") betValue: number;
  @type("string") roomPhase = GamePhase.WAITTING;
  @type("string") hostId: string;
  @type("number") remainingConfirmTime: number;
  @type("number") remainingChoiceTime: number;
  @type("number") questionBroadcastTime: number = 0;

  @type("number") remainingDelayTime: number = 0;
  @type("number") bonusValue: number = 1;
  @type({ map: Player }) players = new Map<string, Player>();
}