export enum GamePrizeMode {
  RANKPRIZE = "pvp_rank_prize",
  SHAREPRIZE = "pvp_share_prize"
}

export enum GamePhase {
  WAITTING = "waitting",
  CONFIRM = "confirm",
  PLAYING = "playing",
  ENDED = "ended"
}

export enum CurrencyType {
  Token = "token",
  Candy = "candy"
}

export enum PlayerConnectStatus{
  IsConnected = "isConnected",
  IsDisconnected = "isDisconnected",
  IsOutGame = "isOutGame"
}

export enum AnswerStatus {
  NONE = "none",
  ANSWERED = "answered",
  CORRECT = "correct",
  INCORRECT = "incorrect",
}


// Enum cho các loại tin nhắn từ client (đảm bảo đồng bộ với NetworkEvent ở client)
export enum ClientMessage {
  //Summary
  Choiced = "NetworkEvent.Choiced",
  GetChoiceList = "NetworkEvent.GetChoiceList",

  //Rank Prize Mode
  ConfirmMatched = "NetworkEvent.ConfirmMatched",

  //Share Prize Mode
  StartReady = "NetworkEvent.StartReady",
  ConfirmReady = "NetworkEvent.ConfirmReady",
  NotReady = "NetworkEvent.NotReady",
}

// Enum cho các loại tin nhắn gửi đến client (đảm bảo đồng bộ với NetworkEvent ở client)
export enum ServerMessage {
  //Summary
  StartGame = "NetworkEvent.StartGame",
  PlayersUpdate = "NetworkEvent.PlayersUpdate",
  Question = "NetworkEvent.Question",
  ChoiceList = "NetworkEvent.SendChoiceList",
  UpdateChoiceStatus = "NetworkEvent.UpdateChoiceStatus",
  UpdateChoiceResult = "NetworkEvent.UpdateChoiceResult",
  UpdateTop = "NetworkEvent.UpdateTop",
  GameEnded = "NetworkEvent.EndGameResult",
  UpdateGameProgress = "NetworkEvent.UpdateGameProgress",
  
  //Share Prize Mode
  CancelReady = "NetworkEvent.CancelReady",
  HostUpdate = "NetworkEvent.HostUpdate",
  PreloadBundle = "NetworkEvent.PreloadBundle",

  //ErrorMessage
  GetQuestionError = "NetworkEvent.GetQuestionError"
}