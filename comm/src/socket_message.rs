use serde::{Serialize, Deserialize};

// use crate::voting::*;

use jasshaus_game::{
    Game,
    card::*,
    setting::*,
    ruleset::*,
};

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
	Teaming,
	Revanche,
}

#[derive(Clone)]
#[derive(PartialEq, std::fmt::Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum SocketMessage {
    // Gameplay Variants
    PlayCard(Card),
	PlayShow(Show), // GAMEPLAY
    Announce(Playtype, bool),
	Pass,
    ShowPoints(u16,usize),
    ShowList(Vec<Vec<Show>>),
    HasMarriage(usize),
    SetAnnouncePlayer(usize),
    GameState(Game, Cardset),
    GameSetting(Setting),

	StartGame,

    // Non-Gameplay Variants
    Vote(usize,usize),
    NewVote(VotingType),

	RtcStart(usize),
	RtcSignaling(String, RTCSignal, usize),

	ClientJoined(usize,usize),
	ClientDisconnected(usize),
	ClientIntroduction(String,usize),
	JoinedClients(Vec<(String,usize,usize)>),

	PlayerID(usize),
	ChatMessage(String,usize),
    NewCards(Cardset),

    PlayerOrder(Vec<(usize,usize)>),

	StartMating,
    Mate(usize),
}
