import { Room, Client } from "@colyseus/core";
import { PVPRoomState, ChoiceItem, Player, QuestionItem } from "./schema/PVPRoomState";
import * as enums from "./schema/StateEnum";
import * as interfaces from "./schema/StateInterface";
import { IOInteract, Status } from "../IOInteract";
import { json } from "express";

const DEFAULT_MAX_QUESTIONS = 5;
const RECONNECTION_TIMEOUT_SECONDS = 15;
const CONFIRM_COUNTDOWN_DURATION_SECONDS = 5;
const CHOICE_COUNTDOWN_DURATION_SECONDS = 10;
const DELAY_BEFORE_NEXT_QUESTION_SECONDS = 5;
const DELAY_BEFORE_RESULT_SECONDS = 1;
const PENALTY_OUTGAME_ANSWERTIME = 9999;
const MAX_RATIO_PRIZE = 1;

export class PVPRoomSharePrize extends Room<PVPRoomState> {
  state = new PVPRoomState();
  maxClients = 99;
  minClient = 1;
  maxWinner = 1;
  private isErrorState: boolean = false;

  private maxQuestions: number = DEFAULT_MAX_QUESTIONS;
  private selectionSet: QuestionItem[] = [];
  private currentChoiceList: string[] = [];
  private currentBestChoice: string = "";

  private listPrepareBundle: string[] = [];

  private confirmCountdownActive: boolean;

  private chocieCountDownActive: boolean;

  private delayBeforeNextQuestionActive: boolean = false;

  private delayBeforeResultActive: boolean = false;


  private poolPrize: number = 0;
  private winnerResults: interfaces.PlayerGameResult[] = [];

  // ==================== LIFECYCLE ====================

  async onCreate(options: interfaces.OptionData) {
    this.maxQuestions = DEFAULT_MAX_QUESTIONS;
    this.setupRoomMetadata(options);
    // this.randomizeBonusValue();
    this.setupMessageHandlers();
    this.setupGameMode();
    this.setupRoomState();

    await IOInteract.instance.getQuestion(async (returnData) => {
      if (returnData.status === Status.Success) {
        this.loadAndPrepareSelectionSet(returnData.data);
      } else {
        console.error("Không thể lấy câu hỏi sau nhiều lần thử. Vui lòng kiểm tra lại kết nối hoặc dịch vụ.");
        this.isErrorState = true;
      }
    });

    if (this.selectionSet) {
      const choiceListSet = this.selectionSet.map(questionItem => questionItem.choiceList);
      const photoIdPairs: interfaces.QuestionItemChoiceList = { idList: [] };

      choiceListSet.forEach(choiceList => {
        const currentPair: interfaces.ChoiceItemIdPair = { questionItem: ["", ""] };
        choiceList.forEach((choiceItem, index) => {
          if (index < 2) {
            currentPair.questionItem[index] = choiceItem.photo_id;
          }
        });
        photoIdPairs.idList.push(currentPair);
      });
      this.prepareDataForPreloadBundle(photoIdPairs);
    }

    this.setSimulationInterval(this.update.bind(this), 100);
  }

  onJoin(client: Client, options: interfaces.RoomOptions) {
    if (this.isErrorState) {
      console.warn(`Client ${client.sessionId} cố gắng tham gia phòng lỗi. Ngắt kết nối.`);
      client.leave();
      return;
    }

    if (this.listPrepareBundle) {
      this.broadcastBundleListForPrepare(client);
    }

    let optionData = options.payload;

    this.handlePlayerJoin(client, optionData);
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`Client ${client.sessionId} left. Consented: ${consented}`);

    const player = this.state.players.get(client.sessionId);
    if (!player) {
      console.warn(`Player ${client.sessionId} not found on leave.`);
      return;
    }

    if (this.state.roomPhase === enums.GamePhase.PLAYING) {
      if (!consented) {
        this.markPlayerAsDisconnected(client.sessionId);
        this.broadcastPlayerUpdates();

        try {
          await this.allowReconnection(client, RECONNECTION_TIMEOUT_SECONDS);
          this.reconnectPlayer(client.sessionId);
        } catch (e) {
          console.log(`Player ${client.sessionId} failed to reconnect after ${RECONNECTION_TIMEOUT_SECONDS} seconds.`);
          this.markPlayerAsOutGame(client.sessionId);
          this.checkPlayerAvailableInRoom();
        }
      } else {
        const player = this.state.players.get(client.sessionId);
        if (player) {
          this.poolPrize += this.state.betValue;
        }

        this.markPlayerAsSurrender(client.sessionId);
        this.checkPlayerAvailableInRoom();
      }
    }
    else if (this.state.roomPhase === enums.GamePhase.ENDED) {
      this.removePlayerFromRoom(client.sessionId);
    }
    else {
      this.removePlayerFromRoom(client.sessionId);
    }
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  prepareDataForPreloadBundle(data: interfaces.QuestionItemChoiceList) {
    data.idList.forEach(item => {
      item.questionItem.forEach(key => {
        this.prepareBundleNameWithKey(key);
      });
    })
  }


  // ==================== MESSAGE HANDLERS ====================

  private setupMessageHandlers() {
    this.onMessage(enums.ClientMessage.StartReady, (client) => this.changeConfirmPhase(client));
    this.onMessage(enums.ClientMessage.Choiced, (client, answer: string) => this.handlePlayerChoice(client, answer));
    this.onMessage(enums.ClientMessage.GetChoiceList, (client) => this.sendChoiceListToClient(client));
  }

  // ==================== PLAYER ACTIONS HANDLERS ====================

  private handlePlayerJoin(client: Client, options: interfaces.OptionData) {
    const existingPlayer = this.state.players.get(client.sessionId);
    if (existingPlayer) {
      this.reconnectPlayer(client.sessionId);
    } else {
      this.createNewPlayer(client, options);
    }

    this.broadcastPlayerUpdates();
  }


  private changeConfirmPhase(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player && player.sessionId !== this.state.hostId) {
      return;
    }

    this.state.roomPhase = enums.GamePhase.CONFIRM;
    this.setupConfirmCountdown(CONFIRM_COUNTDOWN_DURATION_SECONDS);
    this.lock();
  }

  private handlePlayerChoice(client: Client, answer: string) {
    const player = this.state.players.get(client.sessionId);

    if (!player
      || player.connectStatus === enums.PlayerConnectStatus.IsOutGame
      || this.state.roomPhase !== enums.GamePhase.PLAYING) return;

    if (!this.currentChoiceList.includes(answer)) {
      console.warn(`Player ${client.sessionId} chose an invalid answer: ${answer}`);
      return;
    }

    player.isChoiced = true;

    const answerTime = (Date.now() - (this.state.questionBroadcastTime || Date.now())) / 1000;
    player.answerTime += answerTime;

    player.currentResult = answer;
    if (answer === this.currentBestChoice) {
      player.point++;
    }

    this.selectionSet[this.state.currentQuestionIndex].choiceList.forEach(choice => {
      if (answer === choice.photo_id) choice.vote++;
    })

    let listPlayer: [string, Player][] = Array.from(this.state.players.entries())
    const choiceStatus = listPlayer.map(([sessionId, player]) => ({
      id: sessionId,
      isChoiced: (player as Player).isChoiced,
      connectStatus: (player as Player).connectStatus,
      questionIndex: this.state.currentQuestionIndex
    }));

    // this.broadcast(enums.ServerMessage.UpdateChoiceStatus, choiceStatus);
    this.checkAllPlayersChoiced();
  }

  private sendChoiceListToClient(client: Client) {
    this.clients.getById(client.sessionId)?.send(enums.ServerMessage.Question, this.currentChoiceList);
  }

  // ==================== BROADCASTING ====================

  private broadcastBundleListForPrepare(client: Client) {
    client.send(enums.ServerMessage.PreloadBundle, this.listPrepareBundle);
  }

  private broadcastPlayerUpdates() {
    this.updateHost();
    let statusUpdate

    if (this.state.roomPhase === enums.GamePhase.WAITTING) {
      let listPlayer: [string, Player][] = Array.from(this.state.players.entries())

      statusUpdate = listPlayer.map(([sessionId, player]) => ({
        id: sessionId,
        name: (player as Player).playerName,
        isHost: (player as Player).isHost,
        point: (player as Player).point,
        isConfirmed: (player as Player).isConfirmed,
        connectStatus: (player as Player).connectStatus
      }));
    }
    else {
      statusUpdate = this.updateTopPlayers()
    }

    this.broadcast(enums.ServerMessage.PlayersUpdate, statusUpdate);
  }

  private broadcastQuestion(): void {
    if (this.state.currentQuestionIndex < this.maxQuestions) {
      const currentTopic = this.selectionSet[this.state.currentQuestionIndex];
      this.currentChoiceList = currentTopic.choiceList.map(k => k.photo_id);

      this.currentBestChoice = currentTopic.firstChoiceTrue ? this.currentChoiceList[0] : this.currentBestChoice = this.currentChoiceList[1];

      this.state.questionBroadcastTime = Date.now();
      this.broadcast(enums.ServerMessage.Question, this.currentChoiceList);
      this.setupChoiceCountDown(CHOICE_COUNTDOWN_DURATION_SECONDS);

      if (this.state.currentQuestionIndex === 0) {
        const updateTopList = this.updateTopPlayers()
        this.broadcast(enums.ServerMessage.UpdateTop, updateTopList);
      }
    } else {
      this.endGame();
    }
  }

  private broadcastChoiceResults(): void {
    let listPlayer: [string, Player][] = Array.from(this.state.players.entries())

    const choiceResults = listPlayer.map(([sessionId, player]) => ({
      id: sessionId,
      result: this.currentBestChoice,
      point: (player as Player).point,
      connectStatus: (player as Player).connectStatus,
      questionIndex: this.state.currentQuestionIndex,
      maxQuestion: this.maxQuestions
    }));
    const updateTopList = this.updateTopPlayers()
    this.broadcast(enums.ServerMessage.UpdateTop, updateTopList);
    this.broadcast(enums.ServerMessage.UpdateChoiceResult, choiceResults);
  }

  private broadcastGameResults(result: interfaces.PlayerGameResult[]) {
    const formattedResult: interfaces.UpdateGameResult[] = result.map(({ player, reward, rank, isWinner }) => ({
      sessionId: player.sessionId,
      userId: player.userId,
      nickname: player.playerName,
      point: player.point,
      reward,
      rank: rank ?? null,
      isWinner,
    }));

    this.broadcast(enums.ServerMessage.GameEnded, {
      gameMode: this.state.gameMode,
      result: formattedResult,
    });
  }

  broadcastError() {
    this.broadcast(enums.ServerMessage.GetQuestionError, {
      message: "Can't get Questions to Server for setup room. Cancel Room! "
    });
  }

  // ==================== ROOM & GAME LOGIC SETUP ====================

  setupRoomState() {
    this.state.maxQuestions = DEFAULT_MAX_QUESTIONS;
    this.state.currentQuestionIndex = 0;
  }

  private setupRoomMetadata(options: interfaces.OptionData): void {
    if (options.betValue !== undefined) {
      this.setMetadata({ betValue: options.betValue });
      this.state.betValue = options.betValue;
    } else {
      console.warn("Bet value not provided in room options. Defaulting to 0.");
      this.setMetadata({ bet: 0 });
      this.state.betValue = 0;
    }
  }

  private setupGameMode(): void {
    this.state.gameMode = enums.GamePrizeMode.SHAREPRIZE
  }

  private createNewPlayer(client: Client, options: interfaces.OptionData) {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.userId = options.userId;
    player.mezonId = options.mezonId;
    player.playerName = options.playerName;
    // player.playerAvatarURL = options.playerAvatarURL;
    player.isChoiced = false;
    player.isConfirmed = false;
    player.isSurrender = false;
    player.connectStatus = enums.PlayerConnectStatus.IsConnected
    player.point = 0;
    player.answerTime = 0;
    player.currentResult = "";
    player.lastActionTime = Date.now();
    this.state.players.set(player.sessionId, player);
  }

  private markPlayerAsDisconnected(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (player) {
      player.connectStatus = enums.PlayerConnectStatus.IsDisconnected
      player.lastActionTime = Date.now();
      console.log(`Player ${sessionId} marked as disconnected.`);
    }
  }

  private reconnectPlayer(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (player) {
      player.connectStatus = enums.PlayerConnectStatus.IsConnected
      player.lastActionTime = Date.now();
      this.broadcastPlayerUpdates();
      console.log(`Player ${sessionId} reconnected successfully.`);

      if (this.state.roomPhase === enums.GamePhase.PLAYING) {
        const client = this.clients.getById(sessionId);
        if (client) {
          client.send(enums.ServerMessage.PreloadBundle, this.listPrepareBundle);

          client.send(enums.ServerMessage.Question, this.currentChoiceList);
          console.log(`Sent current question and choice list to reconnected player ${sessionId}.`);
        }
      }
      else if (this.state.roomPhase === enums.GamePhase.ENDED) {
        const client = this.clients.getById(sessionId);

        if (client) {
          const formattedResult: interfaces.UpdatePlayerResult[] = this.winnerResults.map(({ player, reward, rank }) => ({
            userId: player.userId,
            mezonId: player.mezonId,
            nickname: player.playerName,
            point: player.point,
            reward,
            rank: rank ?? null,
          }));

          client.send(enums.ServerMessage.GameEnded, {
            gameMode: this.state.gameMode,
            result: formattedResult
          });
        }
      }
    }
  }

  private markPlayerAsOutGame(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (player) {
      player.connectStatus = enums.PlayerConnectStatus.IsOutGame
      player.answerTime = PENALTY_OUTGAME_ANSWERTIME;
      player.lastActionTime = Date.now();
      console.log(`Player ${sessionId} leave the game.`);
      this.broadcastPlayerUpdates();
      this.checkAllPlayersChoiced();
    }
  }

  private markPlayerAsSurrender(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (player) {
      player.isSurrender = true;
      player.connectStatus = enums.PlayerConnectStatus.IsOutGame
      player.lastActionTime = Date.now();
      console.log(`Player ${sessionId} leave the game.`);
      this.broadcastPlayerUpdates();
      this.checkAllPlayersChoiced();
    }
  }

  private updateHost() {
    const activePlayers = Array.from(this.state.players.values())
      .filter(p => (p as Player).connectStatus !== enums.PlayerConnectStatus.IsOutGame)

    if (activePlayers.length > 0) {
      const newHost = (activePlayers[0] as Player).sessionId;
      this.state.hostId = newHost;
      activePlayers[0].isHost = true;
    }
  }

  private removePlayerFromRoom(sessionId: string) {
    this.state.players.delete(sessionId);
    this.broadcastPlayerUpdates();
    if (this.state.roomPhase === enums.GamePhase.CONFIRM) {
      this.checkRoomState();
    }
    if (this.state.roomPhase === enums.GamePhase.PLAYING) {
      this.checkAllPlayersChoiced();
      this.checkPlayerAvailableInRoom();
    }
  }

  private randomizeBonusValue(): void {
    // const bonusValueList = [1.5, 2, 5, 10, 20, 50, 100, 1000];
    // const randomIndex = Math.floor(Math.random() * bonusValueList.length);
    // this.state.bonusValue = bonusValueList[randomIndex];
    // this.state.bonusValue = bonusValueList[randomIndex];
    // console.log(`Bonus value set to: ${this.state.bonusValue}`);
  }

  private loadAndPrepareSelectionSet(jsonData: interfaces.QuestionItemInterface[]): void {
    let numAvailableQuestions = jsonData.length;

    if (numAvailableQuestions === 0) {
      console.error("No questions available in the provided JSON data. Game cannot proceed.");
      return;
    }

    if (numAvailableQuestions < this.maxQuestions) {
      console.warn(`Not enough questions in the provided data (${numAvailableQuestions}) for ${this.maxQuestions} questions. Using available questions.`);
      this.maxQuestions = numAvailableQuestions;
    }

    const selectedQuestions = this.getRandomElements(jsonData, this.maxQuestions);

    this.selectionSet = [];

    selectedQuestions.forEach(question => {
      try {
        const topicItem = new QuestionItem();

        let firstChoice = new ChoiceItem();
        let secondChoice = new ChoiceItem();

        this.convertChoiceData(firstChoice, question.leftPhoto)
        this.convertChoiceData(secondChoice, question.rightPhoto);

        topicItem.choiceList.push(firstChoice);
        topicItem.choiceList.push(secondChoice);

        topicItem.firstChoiceTrue = question.leftWin;
        topicItem.questionId = question.questionId;

        this.selectionSet.push(topicItem);
      } catch (error) {
        console.error(`Error processing:`, error);
      }
    });
  }

  private convertChoiceData(choice: ChoiceItem, data: interfaces.ChoiceOption) {
    if (data.photo_id) choice.photo_id = data.photo_id;
    if (data.name) choice.name = data.name;
    if (data.description) choice.description = data.description;
    if (data.category) choice.category = data.category;
    if (data.filePath) choice.filePath = data.filePath;
    if (data.score) choice.score = data.score;
    if (data.disable) choice.disable = data.disable;
    choice.vote = 0;
  }

  private getRandomElements<T>(arr: T[], count: number): T[] {
    if (arr.length < count) {
      throw new Error(`Array must contain at least ${count} elements to pick ${count}.`);
    }
    const shuffled = arr.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  public update(deltaTime: number) {
    if (this.state.roomPhase === enums.GamePhase.CONFIRM && this.confirmCountdownActive) {
      const previousConfirmTime = this.state.remainingConfirmTime;
      this.state.remainingConfirmTime = Math.max(0, previousConfirmTime - (deltaTime / 1000));

      if (Math.floor(this.state.remainingConfirmTime) <= 0) {
        this.stopConfirmCountdown();
        this.checkAllPlayersReady();
      }
    }

    if (this.state.roomPhase === enums.GamePhase.PLAYING && this.chocieCountDownActive) {
      const previousChoiceTime = this.state.remainingChoiceTime;
      this.state.remainingChoiceTime = Math.max(0, previousChoiceTime - (deltaTime / 1000));

      if (Math.floor(this.state.remainingChoiceTime) <= 0) {
        this.stopChoiceCountdown();
        this.checkAllPlayersChoiced();
        this.startDelayBeforeResult();
      }
    }


    if (this.state.roomPhase === enums.GamePhase.PLAYING && this.delayBeforeNextQuestionActive) {
      const previousDelayTime = this.state.remainingDelayTime;
      this.state.remainingDelayTime = Math.max(0, previousDelayTime - (deltaTime / 1000));

      if (Math.floor(this.state.remainingDelayTime) <= 0) {
        this.stopDelayBeforeNextQuestion();
        this.state.currentQuestionIndex++;
        this.resetPlayerChoiceStatus();
        this.broadcastQuestion();
      }
    }


    if (this.delayBeforeResultActive) {
      const previousResultTime = this.state.remainingDelayTime;
      this.state.remainingDelayTime = Math.max(0, previousResultTime - (deltaTime / 1000));

      if (this.state.remainingDelayTime <= 0) {
        this.stopDelayBeforeResult();
        this.sendResultFinishQuestion();
        this.broadcastChoiceResults();
        this.startDelayBeforeNextQuestion();
      }
    }
  }

  // ==================== ROOM STATE & GAME FLOW CONTROL ====================

  private checkRoomState(): void {
    const connectedPlayers = Array.from(this.state.players.values()).filter(
      p => (p as Player).connectStatus === enums.PlayerConnectStatus.IsConnected
    );

    if (connectedPlayers.length === this.minClient) {
      this.state.roomPhase = enums.GamePhase.WAITTING;
      if (this.locked) this.unlock();
      this.stopConfirmCountdown();
      this.state.players.forEach(player => player.isConfirmed = false);
    }
  }

  private setupConfirmCountdown(durationSeconds: number): void {
    this.confirmCountdownActive = true;
    this.state.remainingConfirmTime = durationSeconds;
    console.log(`Confirm countdown started for ${durationSeconds} seconds.`);
  }

  private stopConfirmCountdown(): void {
    this.confirmCountdownActive = false;
    this.state.remainingConfirmTime = 0;
  }

  private setupChoiceCountDown(durationSeconds: number): void {
    this.chocieCountDownActive = true;
    this.state.remainingChoiceTime = durationSeconds;
    console.log(`Choice countdown started for ${durationSeconds} seconds.`)
  }

  private stopChoiceCountdown(): void {
    this.chocieCountDownActive = false;
    this.state.remainingChoiceTime = 0;
  }

  private checkAllPlayersReady(): void {
    if (this.state.roomPhase !== enums.GamePhase.CONFIRM) {
      return;
    }

    this.stopConfirmCountdown();
    this.state.roomPhase = enums.GamePhase.PLAYING;
    let gameData: any[] = []
    this.state.players.forEach(player => {
      gameData.push({ userId: player.userId, amount: this.state.betValue })
    })
    IOInteract.instance.startBet(this.roomId, gameData, async () => { })

    console.log("All players confirmed! Starting game... (from timeout path)", this.roomId, " ", JSON.stringify(gameData));
    this.broadcastQuestion();
  }

  private checkAllPlayersChoiced(): void {
    this.state.players.forEach(player => {
      if (player.isChoiced === false)
        player.currentResult = "";
    })
  }

  private checkPlayerAvailableInRoom() {
    if (this.state.roomPhase === enums.GamePhase.PLAYING) {
      const activePlayers = Array.from(this.state.players.values())
        .filter(p => (p as Player).connectStatus !== enums.PlayerConnectStatus.IsOutGame)

      if (activePlayers.length === this.minClient) {
        this.endGame();
      }
    }
  }

  private startDelayBeforeNextQuestion(): void {
    this.delayBeforeNextQuestionActive = true;
    this.state.remainingDelayTime = DELAY_BEFORE_NEXT_QUESTION_SECONDS;
  }

  private stopDelayBeforeNextQuestion(): void {
    this.delayBeforeNextQuestionActive = false;
    this.state.remainingDelayTime = 0;
  }

  private resetPlayerChoiceStatus(): void {
    this.state.players.forEach(player => {
      player.isChoiced = false;
      player.currentResult = "";
    });
  }

  private startDelayBeforeResult(): void {
    this.delayBeforeResultActive = true;
    this.state.remainingDelayTime = DELAY_BEFORE_RESULT_SECONDS;
  }

  private stopDelayBeforeResult(): void {
    this.delayBeforeResultActive = false;
    this.state.remainingDelayTime = 0;
  }

  private endGame(): void {
    this.stopDelayBeforeNextQuestion();

    this.state.roomPhase = enums.GamePhase.ENDED;
    console.log("Game ended. Calculating prizes.");

    this.calculatePrizePool();
    this.resolveWinners();
    this.distributePrize();

    this.winnerResults.forEach(player => {
      if (player.isWinner) {
        IOInteract.instance.endBet(this.roomId, player.player.userId, async () => { })
      }
    })

    this.broadcastGameResults(this.winnerResults);
  }

  sendResultFinishQuestion() {
    let leftPhotoVote = this.selectionSet[this.state.currentQuestionIndex].choiceList[0].vote;
    let rightPhotoVote = this.selectionSet[this.state.currentQuestionIndex].choiceList[1].vote;

    IOInteract.instance.setFinishQuestion(
      this.selectionSet[this.state.currentQuestionIndex].questionId,
      leftPhotoVote.toString(),
      rightPhotoVote.toString(), async () => { }
    );
  }

  private updateTopPlayers(): any[] {
    let listPlayer: [string, Player][] = Array.from(this.state.players.entries())

    let topPlayers = listPlayer.map(([sessionId, player]) => ({
      sessionId: sessionId,
      name: (player as Player).playerName,
      isHost: (player as Player).isHost,
      point: (player as Player).point,
      answerTime: (player as Player).answerTime,
      isConfirmed: (player as Player).isConfirmed,
      connectStatus: (player as Player).connectStatus,
      rank: null as number | null,
    }))
      .sort((a, b) => {
        if (b.point !== a.point) {
          return b.point - a.point;
        }
      })
      .map((result, index) => {
        result.rank = index + 1;
        return result;
      });

    return topPlayers;
  }

  // ==================== PRIZE & REWARD LOGIC ====================

  private calculatePrizePool(): void {
    this.state.players.forEach(player => {
      if (player.connectStatus != enums.PlayerConnectStatus.IsOutGame) {
        this.poolPrize += this.state.betValue;
      }
      else {
      }
    });
  }

  private resolveWinners(): void {
    const playersArray: [string, Player][] = Array.from(this.state.players.entries());

    this.winnerResults = playersArray
      .map(([sessionId, player]) => ({
        sessionId,
        player,
        userId: player.userId,
        mezonId: player.mezonId,
        reward: 0,
        rank: null as number | null,
        isWinner: false,
      }))
      .sort((a, b) => {
        if ((a as interfaces.PlayerGameResult).player.isSurrender && !(b as interfaces.PlayerGameResult).player.isSurrender) {
          return 1;
        }
        if (!(a as interfaces.PlayerGameResult).player.isSurrender && (b as interfaces.PlayerGameResult).player.isSurrender) {
          return -1;
        }
        if ((b as interfaces.PlayerGameResult).player.point !== (a as interfaces.PlayerGameResult).player.point) {
          return (b as interfaces.PlayerGameResult).player.point - (a as interfaces.PlayerGameResult).player.point;
        }
      })
      .map((result, index) => {
        (result as interfaces.PlayerGameResult).rank = index + 1;
        return result as interfaces.PlayerGameResult;
      });

    if (this.winnerResults.length > 0) {
      if (!this.winnerResults[0].player.isSurrender) {
        this.winnerResults[0].isWinner = true;
      } else {
        const firstNonSurrenderedWinner = this.winnerResults.find(
          (result) => !result.player.isSurrender
        );
        if (firstNonSurrenderedWinner) {
          firstNonSurrenderedWinner.isWinner = true;
        }
      }
    }
  }

  private distributePrize(): void {
    if (!this.winnerResults || this.winnerResults.length === 0) {
      console.warn("winnerResults is empty or not set. Cannot distribute prize.");
      return;
    }

    const prizePool = this.poolPrize * MAX_RATIO_PRIZE;
    const betValue = this.state.betValue;
    const winner = this.winnerResults.length > 0 ? this.winnerResults[0] : null;
    if (winner) {
      winner.reward = prizePool - betValue;
      console.log(`SHAREPRIZE: Player ${winner.player.playerName} (${winner.userId}) (Rank ${winner.rank}) wins ${(winner.reward).toFixed(2)} (all prize pool).`);

      this.winnerResults.forEach(player => {
        if (player !== winner) {
          player.reward = betValue;
        }
      });
    } else {
      console.log("SHAREPRIZE: No players found to distribute prize.");
      this.winnerResults.forEach(player => {
        player.reward = betValue;
      });
    }
  }

  prepareBundleNameWithKey(key: string) {
    const bundleKeyPath = this.splitKeyValue(key)
    const bundleIndex = Math.trunc(parseInt(bundleKeyPath.item) / 20);

    const bundleName = `${bundleKeyPath.category}_${bundleIndex}`
    this.addingBundleName(bundleName);
  }

  addingBundleName(bundleName: string) {
    if (this.listPrepareBundle.includes(bundleName)) return;

    this.listPrepareBundle.push(bundleName);
  }

  splitKeyValue(value: string): {
    category: string,
    item: string
  } | null {
    if (value.includes('_')) {
      const parts = value.split('_');

      if (parts.length >= 2) {
        const category = parts[0];
        const item = parts[1]
        return { category, item };
      }
    }
    return null;
  }
}