use serde::{Serialize, Deserialize};

#[derive(Clone)]
#[derive(PartialEq, std::fmt::Debug, Serialize, Deserialize)]
pub enum RTCSignal {
	Offer,
	Answer,
	ICECandidate,
}

#[derive(Clone)]
#[derive(PartialEq, std::fmt::Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum VotingType {
	Kick(usize),
	StartGame,
	Teaming,
	Revanche,
}

#[derive(Clone)]
#[derive(PartialEq, std::fmt::Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum SocketMessage<T> {
	Event(T), // Contains a Game Event

    Vote(usize,usize),
    NewVote(VotingType),
	CurrentVote(VotingType, Vec<(usize,usize)>),
	QuitVote,

	RtcStart(usize),
	RtcSignaling(String, RTCSignal, usize),

	ClientJoined(usize,usize),
	ClientDisconnected(usize),
	ClientIntroduction(String,usize),
	JoinedClients(Vec<(String,usize,usize)>),

	PlayerID(usize, usize, usize),
	ChatMessage(String,usize),

    PlayerOrder(Vec<(usize,usize)>),

	StartMating,
    Mate(usize),

	Ping,
	Pong,
}
