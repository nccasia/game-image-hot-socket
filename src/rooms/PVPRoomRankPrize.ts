// import { Room, Client } from "@colyseus/core";
// import { PVPRoomState, ChoiceItem, Player, QuestionItem } from "./schema/PVPRoomState";
// import { GamePhase, GamePrizeMode, ClientMessage, ServerMessage, PlayerConnectStatus } from "./schema/StateEnum";
// import * as path from "path";
// import * as fs from "fs";

// const DEFAULT_MAX_QUESTIONS = 5;
// const RECONNECTION_TIMEOUT_SECONDS = 15;
// const CONFIRM_COUNTDOWN_DURATION_SECONDS = 10;
// const DELAY_BEFORE_NEXT_QUESTION_SECONDS = 5;
// const DELAY_BEFORE_RESULT_SECONDS = 1;
// const PENALTY_OUTGAME_ANSWERTIME = 9999;
// const DEFAULT_MAX_WINNER_RANKPRIZEMODE = 3;
// const MAX_RATIO_PRIZE = 0.98;

// const DB_FILE_PATH = './src/db.json';

// type KeywordData = { Key: string; vote: number; };
// type TopicRawData = { [answerKey: string]: KeywordData; };
// type JsonStructure = { [topic: string]: TopicRawData; };

// interface PlayerGameResult {
//   sessionId: string;
//   player: Player;
//   isWinner: boolean;
//   reward: number;
//   rank: number | null;
// }

// interface RoomOptions {
//   betValue?: number;
//   gameMode?: GamePrizeMode;
//   playerName?: string;
//   playerAvatarURL?: string;
//   initialCurrency?: number;
//   maxQuestions?: number;
//   maxWinner?: number;
// }

// export class PVPRoomRankPrize extends Room<PVPRoomState> {
//   state = new PVPRoomState();
//   maxClients = 4;
//   minClient = 1;
//   maxWinner = 1;

//   private maxQuestions: number = DEFAULT_MAX_QUESTIONS;
//   private currentQuestionIndex: number = 0;
//   private selectionSet: QuestionItem[] = [];
//   private currentChoiceList: string[] = [];
//   private currentBestChoice: string = "";

//   private confirmCountdownActive: boolean;

//   private delayBeforeNextQuestionActive: boolean = false;

//   private delayBeforeResultActive: boolean = false;


//   private poolPrize: number = 0;
//   private winnerResults: PlayerGameResult[] = [];

//   // ==================== LIFECYCLE ====================

//   onCreate(options: RoomOptions) {
//     this.maxQuestions = options.maxQuestions || DEFAULT_MAX_QUESTIONS;
//     this.maxWinner = options.maxWinner || DEFAULT_MAX_WINNER_RANKPRIZEMODE;

//     this.setupRoomMetadata(options);
//     this.randomizeBonusValue();
//     this.setupMessageHandlers();
//     this.setupGameMode();
//     this.loadAndPrepareSelectionSet();

//     this.setSimulationInterval(this.update.bind(this), 100);
//   }

//   onJoin(client: Client, options: RoomOptions) {
//     this.handlePlayerJoin(client, options);
//     if (this.hasReachedMaxClients()) {
//       this.lock();
//       this.checkRoomStateForGameStart();
//     }
//   }

//   async onLeave(client: Client, consented: boolean) {
//     console.log(`Client ${client.sessionId} left. Consented: ${consented}`);

//     const player = this.state.players.get(client.sessionId);
//     if (!player) {
//       console.warn(`Player ${client.sessionId} not found on leave.`);
//       return;
//     }


//     if (this.state.roomPhase === GamePhase.PLAYING) {
//       if (!consented) {
//         this.markPlayerAsDisconnected(client.sessionId);
//         this.broadcastPlayerUpdates();

//         try {
//           await this.allowReconnection(client, RECONNECTION_TIMEOUT_SECONDS);
//           this.reconnectPlayer(client.sessionId);
//         } catch (e) {
//           console.log(`Player ${client.sessionId} failed to reconnect after ${RECONNECTION_TIMEOUT_SECONDS} seconds.`);
//           this.markPlayerAsOutGame(client.sessionId);
//           this.checkPlayerAvailableInRoom();
//         }
//       } else {
//         const player = this.state.players.get(client.sessionId);
//         if (player) {
//           player.currency -= this.state.betValue;
//           this.poolPrize += this.state.betValue;
//         }

//         this.markPlayerAsOutGame(client.sessionId);
//         this.checkPlayerAvailableInRoom();
//       }
//     }
//     else if (this.state.roomPhase === GamePhase.ENDED) {
//       this.removePlayerFromRoom(client.sessionId);
//     }
//     else {
//       this.removePlayerFromRoom(client.sessionId);
//       this.checkRoomStateForGameStart()
//     }
//   }

//   onDispose() {
//     console.log("room", this.roomId, "disposing...");
//   }

//   // ==================== MESSAGE HANDLERS ====================

//   private setupMessageHandlers() {
//     this.onMessage(ClientMessage.ConfirmMatched, (client) => this.handlePlayerConfirm(client));
//     this.onMessage(ClientMessage.Choiced, (client, answer: string) => this.handlePlayerChoice(client, answer));
//     this.onMessage(ClientMessage.GetChoiceList, (client) => this.sendChoiceListToClient(client));
//   }

//   // ==================== PLAYER ACTIONS HANDLERS ====================

//   private handlePlayerJoin(client: Client, options: RoomOptions) {
//     const existingPlayer = this.state.players.get(client.sessionId);
//     if (existingPlayer) {
//       this.reconnectPlayer(client.sessionId);
//     } else {
//       this.createNewPlayer(client, options);
//     }
//     this.broadcastPlayerUpdates();
//   }

//   private handlePlayerConfirm(client: Client) {
//     const player = this.state.players.get(client.sessionId);
//     if (player && !player.isConfirmed) {
//       player.isConfirmed = true;
//       this.broadcastPlayerUpdates();

//       this.checkConfirmationStatusAndAdvance();
//     }
//   }

//   private handlePlayerChoice(client: Client, answer: string) {
//     const player = this.state.players.get(client.sessionId);

//     if (!player
//       || player.connectStatus === PlayerConnectStatus.IsOutGame
//       || this.state.roomPhase !== GamePhase.PLAYING) return;

//     if (!this.currentChoiceList.includes(answer)) {
//       console.warn(`Player ${client.sessionId} chose an invalid answer: ${answer}`);
//       return;
//     }

//     player.isChoiced = true;

//     const answerTime = (Date.now() - (this.state.questionBroadcastTime || Date.now())) / 1000;
//     player.answerTime += answerTime;

//     player.currentResult = (answer === this.currentBestChoice);
//     if (player.currentResult) {
//       player.point++;
//     }

//     this.broadcast(ServerMessage.UpdateChoiceStatus, {
//       id: client.sessionId,
//       isChoiced: player.isChoiced,
//       questionIndex: this.currentQuestionIndex
//     });

//     this.checkAllPlayersChoiced();
//   }


//   private sendChoiceListToClient(client: Client) {
//     this.clients.getById(client.sessionId)?.send(ServerMessage.ChoiceList, this.currentChoiceList);
//   }

//   // ==================== BROADCASTING ====================

//   private broadcastPlayerUpdates() {
//     const statusUpdate = Array.from(this.state.players.entries()).map(([sessionId, player]) => ({
//       id: sessionId,
//       name: player.playerName,
//       point: player.point,
//       isConfirmed: player.isConfirmed,
//       connectStatus: player.connectStatus
//     }));
//     this.broadcast(ServerMessage.PlayersUpdate, statusUpdate);
//   }

//   private broadcastQuestion(): void {
//     if (this.currentQuestionIndex < this.maxQuestions) {
//       const currentTopic = this.selectionSet[this.currentQuestionIndex];
//       this.currentChoiceList = currentTopic.choiceList.map(k => k.photo_id);

//       this.currentBestChoice = this.currentChoiceList[Math.floor(Math.random() * this.currentChoiceList.length)];
//       this.state.questionBroadcastTime = Date.now();
//       this.broadcast(ServerMessage.Question, this.currentChoiceList);

//     } else {
//       this.endGame();
//     }
//   }

//   private broadcastChoiceResults(): void {
//     const choiceResults = Array.from(this.state.players.entries()).map(([sessionId, player]) => ({
//       id: sessionId,
//       result: player.currentResult,
//       point: player.point,
//       questionIndex: this.currentQuestionIndex
//     }));
//     this.broadcast(ServerMessage.UpdateChoiceResult, choiceResults);
//   }

//   private broadcastGameResults(result: PlayerGameResult[]) {
//     const formattedResult = result.map(({ sessionId, player, reward, rank, isWinner }) => ({
//       sessionId,
//       nickname: player.playerName,
//       point: player.point,
//       reward,
//       rank: rank ?? null,
//       isWinner,
//     }));

//     this.broadcast(ServerMessage.GameEnded, {
//       gameMode: this.state.gameMode,
//       result: formattedResult,
//     });
//   }

//   // ==================== ROOM & GAME LOGIC SETUP ====================

//   private setupRoomMetadata(options: RoomOptions): void {
//     if (options.betValue !== undefined) {
//       this.setMetadata({ bet: options.betValue });
//       this.state.betValue = options.betValue;
//     } else {
//       console.warn("Bet value not provided in room options. Defaulting to 0.");
//       this.setMetadata({ bet: 0 });
//       this.state.betValue = 0;
//     }
//   }

//   private setupGameMode(): void {
//     this.state.gameMode = GamePrizeMode.RANKPRIZE;
//   }

//   private createNewPlayer(client: Client, options: RoomOptions) {
//     const player = new Player();
//     player.id = client.sessionId;
//     player.playerName = options.playerName || `Guest-${client.sessionId.substring(0, 4)}`;
//     player.playerAvatarURL = options.playerAvatarURL || "";
//     player.isChoiced = false;
//     player.isConfirmed = false;
//     player.connectStatus = PlayerConnectStatus.IsConnected
//     player.currency = options.initialCurrency;
//     player.point = 0;
//     player.answerTime = 0;
//     player.currentResult = false;
//     player.lastActionTime = Date.now();
//     this.state.players.set(player.id, player);
//     console.log(`Player ${player.playerName} (${player.id}) joined.`);
//   }

//   private markPlayerAsDisconnected(sessionId: string): void {
//     const player = this.state.players.get(sessionId);
//     if (player) {
//       player.connectStatus = PlayerConnectStatus.IsDisconnected
//       player.lastActionTime = Date.now();
//       console.log(`Player ${sessionId} marked as disconnected.`);
//     }
//   }

//   private reconnectPlayer(sessionId: string): void {
//     const player = this.state.players.get(sessionId);
//     if (player) {
//       player.connectStatus = PlayerConnectStatus.IsConnected
//       player.lastActionTime = Date.now();
//       this.broadcastPlayerUpdates();
//       console.log(`Player ${sessionId} reconnected successfully.`);

//       if (this.state.roomPhase === GamePhase.PLAYING) {
//         const client = this.clients.getById(sessionId);
//         if (client) {
//           client.send(ServerMessage.Question, this.currentChoiceList);
//           console.log(`Sent current question and choice list to reconnected player ${sessionId}.`);
//         }
//       }
//       else if (this.state.roomPhase === GamePhase.ENDED) {
//         const client = this.clients.getById(sessionId);

//         if (client) {
//           const formattedResult = this.winnerResults.map(({ sessionId, player, reward, rank }) => ({
//             sessionId,
//             nickname: player.playerName,
//             point: player.point,
//             reward,
//             rank: rank ?? null,
//           }));

//           client.send(ServerMessage.GameEnded, {
//             gameMode: this.state.gameMode,
//             result: formattedResult
//           });
//         }
//       }
//     }
//   }

//   private markPlayerAsOutGame(sessionId: string) {
//     const player = this.state.players.get(sessionId);
//     if (player) {
//       player.connectStatus = PlayerConnectStatus.IsOutGame
//       player.answerTime = PENALTY_OUTGAME_ANSWERTIME;
//       player.lastActionTime = Date.now();
//       console.log(`Player ${sessionId} leave the game.`);
//     }
//     this.broadcastPlayerUpdates();
//     this.checkAllPlayersChoiced();
//   }

//   private removePlayerFromRoom(sessionId: string) {
//     console.log(`Removing player ${sessionId} from room.`);
//     this.state.players.delete(sessionId);
//     this.broadcastPlayerUpdates();

//     if (this.state.roomPhase === GamePhase.CONFIRM) {
//       this.checkRoomStateForGameStart();
//     } else if (this.state.roomPhase === GamePhase.PLAYING) {
//       this.checkAllPlayersChoiced();

//       if (this.state.players.size === 1) this.endGame();
//     }
//   }

//   private randomizeBonusValue(): void {
//     const bonusValueList = [1.5, 2, 5, 10, 20, 50, 100, 1000];
//     const randomIndex = Math.floor(Math.random() * bonusValueList.length);
//     this.state.bonusValue = bonusValueList[randomIndex];
//     console.log(`Bonus value set to: ${this.state.bonusValue}`);
//   }

//   private loadAndPrepareSelectionSet(): void {
//     const data = this.readJsonFile(DB_FILE_PATH);
//     if (!data) {
//       console.error("Failed to load selection set from db.json. Room might not function correctly.");
//       return;
//     }

//     const topics = Object.keys(data);
//     if (topics.length < this.maxQuestions) {
//       console.warn(`Not enough topics in db.json (${topics.length}) for ${this.maxQuestions} questions. Using available topics.`);
//       this.maxQuestions = topics.length;
//       if (this.maxQuestions === 0) {
//         console.error("No topics available in db.json. Game cannot proceed.");
//         return;
//       }
//     }

//     const shuffledTopics = topics.sort(() => 0.5 - Math.random());
//     for (let i = 0; i < this.maxQuestions; i++) {
//       const topicKey = shuffledTopics[i];
//       const answersRaw = Object.values(data[topicKey]);

//       try {
//         const selectedKeywordsData = this.getRandomElements(answersRaw, 2);
//         const topicItem = new QuestionItem();
//         topicItem.questionId = topicKey;

//         selectedKeywordsData.forEach(kData => {
//           const keyword = new ChoiceItem();
//           keyword.photo_id = kData.Key;
//           topicItem.choiceList.push(keyword);
//         });
//         this.selectionSet.push(topicItem);
//       } catch (error) {
//         console.error(`Error processing topic ${topicKey}:`, error);
//       }
//     }
//     console.log(`Selection set created with ${this.selectionSet.length} topics.`);
//   }

//   private readJsonFile(filePath: string): JsonStructure | null {
//     try {
//       const fullPath = path.resolve(filePath);
//       const jsonData = fs.readFileSync(fullPath, 'utf-8');
//       return JSON.parse(jsonData) as JsonStructure;
//     } catch (err) {
//       console.error(`Error reading JSON file ${filePath}:`, err);
//       return null;
//     }
//   }

//   private getRandomElements<T>(arr: T[], count: number): T[] {
//     if (arr.length < count) {
//       throw new Error(`Array must contain at least ${count} elements to pick ${count}.`);
//     }
//     const shuffled = arr.sort(() => 0.5 - Math.random());
//     return shuffled.slice(0, count);
//   }

//   public update(deltaTime: number) {
//     if (this.state.roomPhase === GamePhase.CONFIRM && this.confirmCountdownActive) {
//       const previousConfirmTime = this.state.remainingConfirmTime;
//       this.state.remainingConfirmTime = Math.max(0, previousConfirmTime - (deltaTime / 1000));

//       if (Math.floor(this.state.remainingConfirmTime) <= 0) {
//         this.stopConfirmCountdown();
//         this.checkAllPlayersConfirmed();
//       }
//     }


//     if (this.state.roomPhase === GamePhase.PLAYING && this.delayBeforeNextQuestionActive) {
//       const previousDelayTime = this.state.remainingDelayTime;
//       this.state.remainingDelayTime = Math.max(0, previousDelayTime - (deltaTime / 1000));

//       if (Math.floor(this.state.remainingDelayTime) <= 0) {
//         this.stopDelayBeforeNextQuestion();
//         this.currentQuestionIndex++;
//         this.resetPlayerChoiceStatus();
//         this.broadcastQuestion();
//       }
//     }


//     if (this.delayBeforeResultActive) {
//       const previousResultTime = this.state.remainingDelayTime;
//       this.state.remainingDelayTime = Math.max(0, previousResultTime - (deltaTime / 1000));

//       if (this.state.remainingDelayTime <= 0) {
//         this.stopDelayBeforeResult();
//         this.broadcastChoiceResults();
//         this.startDelayBeforeNextQuestion();
//       }
//     }
//   }

//   // ==================== ROOM STATE & GAME FLOW CONTROL ====================

//   private checkRoomStateForGameStart(): void {
//     const connectedPlayers = Array.from(this.state.players.values()).filter(
//       p => p.connectStatus === PlayerConnectStatus.IsConnected
//     );

//     if (connectedPlayers.length === this.maxClients) {
//       this.state.roomPhase = GamePhase.CONFIRM;
//       this.setupConfirmCountdown(CONFIRM_COUNTDOWN_DURATION_SECONDS);
//       this.lock();
//       console.log("Room ready. Entering CONFIRM phase.");
//     } else {
//       this.state.roomPhase = GamePhase.WAITTING;
//       if (this.locked) this.unlock();
//       this.stopConfirmCountdown();
//       this.state.players.forEach(player => player.isConfirmed = false);
//       console.log(`Waiting for players. Current: ${connectedPlayers.length}/${this.maxClients}`);
//     }
//   }

//   private setupConfirmCountdown(durationSeconds: number): void {
//     this.confirmCountdownActive = true;
//     this.state.remainingConfirmTime = durationSeconds;
//     console.log(`Confirm countdown started for ${durationSeconds} seconds.`);
//   }

//   private stopConfirmCountdown(): void {
//     this.confirmCountdownActive = false;
//     this.state.remainingConfirmTime = 0;
//   }

//   private checkConfirmationStatusAndAdvance(): void {
//     const players = Array.from(this.state.players.values());

//     const activePlayers = players.filter(
//       p => p.connectStatus === PlayerConnectStatus.IsConnected
//     );

//     const allActivePlayersConfirmed = activePlayers.length === this.maxClients &&
//       activePlayers.every(player => player.isConfirmed);

//     if (allActivePlayersConfirmed) {
//       this.stopConfirmCountdown();
//       this.state.roomPhase = GamePhase.PLAYING;
//       console.log("All players confirmed! Starting game...");
//       this.broadcastQuestion();
//     }
//   }

//   private checkAllPlayersConfirmed(): void {

//     if (this.state.roomPhase !== GamePhase.CONFIRM) {
//       return;
//     }

//     const players = Array.from(this.state.players.values());
//     const connectedPlayers = players.filter(
//       p => p.connectStatus === PlayerConnectStatus.IsConnected
//     );

//     if (connectedPlayers.length < this.maxClients || !connectedPlayers.every(player => player.isConfirmed)) {
//       console.log("Confirm countdown timeout or not all players confirmed. Kicking unconfirmed players.");
//       connectedPlayers.forEach(player => {
//         if (!player.isConfirmed) {
//           const client = this.clients.find(c => c.sessionId === player.id);
//           if (client) {
//             console.log(`Kicking unconfirmed player: ${player.id}`);
//             client.leave();
//           }
//         }
//       });
//       this.checkRoomStateForGameStart();
//     }

//     else if (connectedPlayers.length === this.maxClients && connectedPlayers.every(player => player.isConfirmed)) {
//       this.stopConfirmCountdown();
//       this.state.roomPhase = GamePhase.PLAYING;
//       console.log("All players confirmed! Starting game... (from timeout path)");
//       this.broadcastQuestion();
//     }
//   }

//   private checkAllPlayersChoiced(): void {
//     const allAnsweredOrDisconnected = Array.from(this.state.players.values()).every(player => {
//       if (player.connectStatus === PlayerConnectStatus.IsOutGame) {
//         return true;
//       }
//       return player.isChoiced;
//     });

//     if (allAnsweredOrDisconnected) {
//       this.startDelayBeforeResult();
//     }
//   }

//   private checkPlayerAvailableInRoom() {
//     if (this.state.roomPhase === GamePhase.PLAYING) {
//       const activePlayers = Array.from(this.state.players.values())
//         .filter(p => p.connectStatus !== PlayerConnectStatus.IsOutGame)

//       if (activePlayers.length === this.minClient) {
//         this.endGame();
//       }
//     }
//   }

//   private startDelayBeforeNextQuestion(): void {
//     this.delayBeforeNextQuestionActive = true;
//     this.state.remainingDelayTime = DELAY_BEFORE_NEXT_QUESTION_SECONDS;
//   }

//   private stopDelayBeforeNextQuestion(): void {
//     this.delayBeforeNextQuestionActive = false;
//     this.state.remainingConfirmTime = 0;
//   }

//   private resetPlayerChoiceStatus(): void {
//     this.state.players.forEach(player => {
//       player.isChoiced = false;
//       player.currentResult = false;
//     });
//   }

//   private startDelayBeforeResult(): void {
//     this.delayBeforeResultActive = true;
//     this.state.remainingDelayTime = DELAY_BEFORE_RESULT_SECONDS;
//   }

//   private stopDelayBeforeResult(): void {
//     this.delayBeforeResultActive = false;
//     this.state.remainingDelayTime = 0;
//   }

//   private endGame(): void {
//     this.stopDelayBeforeNextQuestion();

//     this.state.roomPhase = GamePhase.ENDED;
//     console.log("Game ended. Calculating prizes.");

//     this.calculatePrizePool();
//     this.resolveWinners();
//     this.distributePrize();
//     this.broadcastGameResults(this.winnerResults);
//   }

//   // ==================== PRIZE & REWARD LOGIC ====================

//   private calculatePrizePool(): void {
//     this.state.players.forEach(player => {

//       if (player.connectStatus === PlayerConnectStatus.IsConnected)
//         if (player.currency >= this.state.betValue) {
//           player.currency -= this.state.betValue;
//           this.poolPrize += this.state.betValue;
//         }
//         else {
//           console.warn(`Player ${player.id} does not have enough currency (${player.currency}) to bet ${this.state.betValue}.`);
//         }
//     });
//     this.poolPrize *= this.state.bonusValue;
//     console.log(`Calculated prize pool: ${this.poolPrize} (Base: ${this.poolPrize / this.state.bonusValue}, Bonus: ${this.state.bonusValue})`);
//   }

//   private resolveWinners(): void {
//     const playersArray = Array.from(this.state.players.entries());

//     this.winnerResults = playersArray
//       .map(([sessionId, player]) => ({
//         sessionId,
//         player,
//         reward: 0,
//         rank: null as number | null,
//         isWinner: false,
//       }))
//       .sort((a, b) => {
//         if (b.player.point !== a.player.point) {
//           return b.player.point - a.player.point;
//         }
//         return a.player.answerTime - b.player.answerTime;
//       })
//       .map((result, index) => {
//         result.rank = index + 1;
//         return result;
//       });

//     this.winnerResults = this.winnerResults.map(result => {
//       if (result.rank !== null && result.rank <= this.maxWinner) {
//         result.isWinner = true;
//       }
//       return result;
//     });
//   }


//   private distributePrize(): void {
//     if (!this.winnerResults || this.winnerResults.length === 0) {
//       console.warn("winnerResults is empty or not set. Cannot distribute prize.");
//       return;
//     }

//     const prizePool = this.poolPrize * MAX_RATIO_PRIZE;
//     const betValue = this.state.betValue;

//     const rankedWinners = this.winnerResults.filter(p => p.isWinner === true);
//     const topN = rankedWinners.length;

//     if (topN > 0) {
//       const totalWeight = (topN * (topN + 1)) / 2;

//       rankedWinners.forEach((winner, index) => {
//         const weight = topN - index;
//         const prize = (weight / totalWeight) * prizePool;
//         winner.reward = prize;
//         console.log(`RANKPRIZE: Rank ${winner.rank}: Player ${winner.player.playerName} (${winner.sessionId}) wins ${prize.toFixed(2)}.`);
//       });

//       this.winnerResults.forEach(player => {
//         if (!player.isWinner) {
//           player.reward = -betValue;
//         }
//       });

//     } else {
//       console.log("RANKPRIZE: No ranked winners to distribute prize. All players lose bet value.");
//       this.winnerResults.forEach(player => {
//         player.reward = -betValue;
//       });
//     }
//   }
// }