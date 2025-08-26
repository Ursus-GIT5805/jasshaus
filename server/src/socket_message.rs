use serde::{Deserialize, Serialize};

#[derive(Clone, PartialEq, std::fmt::Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub struct ClientData {
	pub name: String,
}

#[derive(Clone, PartialEq, std::fmt::Debug, Serialize, Deserialize)]
pub enum RTCSignal {
	Offer,
	Answer,
	ICECandidate,
}

#[derive(Clone, PartialEq, std::fmt::Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum VotingType {
	Kick(usize),
	StartGame,
	Teaming,
	Revanche,
}

#[derive(Clone, PartialEq, std::fmt::Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum SocketMessage<T> {
	Event(T), // Contains a Game Event

	Vote(usize, usize),
	NewVote(VotingType),
	CurrentVote(VotingType, Vec<(usize, usize)>),
	QuitVote,

	RtcStart(usize),
	RtcSignaling(String, RTCSignal, usize),

	Introduction(ClientData),

	ClientJoined(ClientData, usize, usize),
	ClientDisconnected(usize),
	JoinedClients(Vec<(ClientData, usize, usize)>),

	PlayerID(usize, usize, usize),
	ChatMessage(String, usize),

	PlayerOrder(Vec<(usize, usize)>),

	StartMating,
	Mate(usize),

	Ping,
	Pong,
}
