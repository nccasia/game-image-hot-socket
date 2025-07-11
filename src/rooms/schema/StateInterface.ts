import { GamePrizeMode, PlayerConnectStatus } from "./StateEnum";
import { Player } from "./PVPRoomState";

export interface PlayerGameResult {
  sessionId: string;
  mezonId: string;
  player: Player;
  isWinner: boolean;
  reward: number;
  rank: number | null;
}

export interface RoomOptions {
  betValue?: number;
  gameMode?: GamePrizeMode;
  playerName?: string;
  mezonId?: string;
  playerAvatarURL?: string;
  initialCurrency?: number;
  maxQuestions?: number;
  maxWinner?: number;
}

export interface ChoiceOption {
  photo_id: string,
  name: string,
  description: string,
  category: string,
  filePath: string,
  score: number,
  disable: number,
}

export interface QuestionItemInterface {
  leftPhoto: ChoiceOption,
  rightPhoto: ChoiceOption,
  leftWin: boolean,
  questionId: string,
}

export interface UpdateChoiceStatus {
    id: string,
    connectStatus: PlayerConnectStatus,
    isChoiced: boolean,
    questionIndex: number;
}

export interface UpdateChoiceResult {
    id: string,
    connectStatus: PlayerConnectStatus
    result: boolean,
    point: number,
    questionIndex: number,
}

export interface UpdatePlayerStatus {
    id: string,
    name: string,
    isHost: boolean,
    point: number,
    isConfirmed: boolean,
    connectStatus: PlayerConnectStatus,
}

export interface UpdatePlayerResult {
    sessionId: string,
    nickname: string,
    point: number,
    reward: number,
    rank: number,
}

export interface UpdateGameResult {
    sessionId: string,
    nickname: string,
    point: number,
    reward: number,
    rank: number,
    isWinner: boolean,
}

export interface ChoiceItemIdPair{
  questionItem: [string, string],
}

export interface QuestionItemChoiceList{
  idList: ChoiceItemIdPair[];
}

export interface GameResultUpdate{
  userId: string,
  amount: number,
  isWin: boolean,
}

