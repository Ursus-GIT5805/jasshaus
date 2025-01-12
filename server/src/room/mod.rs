mod client;

use futures::SinkExt;
use jasshaus_game::{card::*, ruleset::*, setting::*, Game};

use rand::Rng;
use rand::prelude::SliceRandom;

use client::*;
use jasshaus_comm::socket_message::*;
use std::collections::HashMap;

#[derive(PartialEq, Eq)]
pub enum RoomState {
	ENTERING,
	TEAMING,
    PLAYING,
    ENDING,
}

pub struct Room {
    pub client_next: usize,
    pub clients: HashMap<usize, Client>,

    pub game: Game,
    pub state: RoomState,

	pub num_votes: usize,
	pub vote: Option<VotingType>,
}

impl Room {
    pub fn new() -> Self {
        Room {
            client_next: 0,
            clients: HashMap::new(),

            game: Game::new(),
            state: RoomState::ENTERING,

			num_votes: 0,
			vote: None,
        }
    }

	pub async fn cleanup(&mut self) {
		debug!("Room cleanup!");
		for (_,client) in self.clients.iter_mut() {
			let _ = client.ws.close().await;
		}

		self.client_next = 0;
		self.clients.clear();
		self.game = Game::new();
		self.state = RoomState::ENTERING;
		self.num_votes = 0;
		self.vote = None;
	}

    // Registering ---
    fn get_unused_player_id(&self) -> Option<usize> {
        let mut mex = vec![true; self.game.players.len()];
        for (_, client) in &self.clients {
            mex[client.player_id] = false;
        }

        for (i, v) in mex.into_iter().enumerate() {
            if v {
                return Some(i);
            }
        }
        None
    }

    pub async fn register(&mut self, ws_tx: WsWriter) -> Option<usize> {
        let id = self.client_next;

        let plr_id = match self.get_unused_player_id() {
            Some(pid) => pid,
            None => return None,
        };

		let joined_clients = self.clients.iter()
			.map(|(i,client)| (client.name.clone(), *i, client.player_id))
			.collect();

        self.clients.insert(id, Client::new(plr_id, ws_tx));
        self.send_to_all_except(id, SocketMessage::ClientJoined(id, plr_id))
            .await;
        self.send_to(id, SocketMessage::PlayerID(plr_id)).await;
        self.send_to(id, SocketMessage::GameSetting(self.game.setting.clone()))
            .await;
		self.send_to(id, SocketMessage::JoinedClients(joined_clients)).await;

        let num_connected = self.clients.len();

        if num_connected == self.game.players.len() {
            if self.state == RoomState::ENTERING {
				self.quit_vote();
				self.start_new_game(false).await;
            } else {
                let game = self.game.clone();
                let hand = self.game.players[plr_id].hand;
                self.send_to(id, SocketMessage::GameState(game, hand)).await;
            }
        }

		self.client_next += 1;
        return Some(id);
    }

    pub async fn unregister(&mut self, client_id: usize) {
        self.clients.remove(&client_id);
        self.send_to_all(SocketMessage::ClientDisconnected(client_id))
            .await;
    }

    // Communication functions ---

    // TODO Add errors
    async fn send_to(&mut self, client_id: usize, data: SocketMessage) {
        if let Some(client) = self.clients.get_mut(&client_id) {
            client.send(data).await;
        }
    }

    async fn send_to_all_except(&mut self, client_id: usize, data: SocketMessage) {
        for (id, client) in self.clients.iter_mut() {
            if *id == client_id {
                continue;
            }
            client.send(data.clone()).await;
        }
    }

    async fn send_to_all(&mut self, data: SocketMessage) {
        for (_, client) in self.clients.iter_mut() {
            client.send(data.clone()).await;
        }
    }

    // Utility functions ---

    async fn start_vote(&mut self, vote: VotingType) {
		self.vote = Some(vote.clone());
		self.num_votes = 0;
		for (_, client) in self.clients.iter_mut() {
			client.vote = None;
		}
		self.send_to_all(SocketMessage::NewVote(vote)).await;
    }

	fn quit_vote(&mut self) {
		self.vote = None;
	}

    // Gameplay functions ---

	/// Ends the current game
    async fn end_game(&mut self) {
        debug!("End game");
        self.start_vote(VotingType::Revanche).await;
        self.state = RoomState::ENDING;
    }

    /*async fn handle_marriage(&mut self) -> bool {
        if !self.game.playtype.is_trumpf() { return false; }
        todo!("Implement this");
    }*/

    fn get_first_announceplayer(&self) -> usize {
        match self.game.setting.startcondition {
            StartingCondition::CARD(card) => self
                .game
                .players
                .iter()
                .enumerate()
                .find(|(_, plr)| plr.hand.contains(card))
                .map(|(i, _)| i)
                .unwrap_or(0),
            StartingCondition::RANDOM => {
                let mut rng = rand::thread_rng();
                rng.gen::<usize>() % self.game.players.len()
            }
            _ => 0,
            // StartingCondition::PLAYER(plr) => plr,
        }
    }

    async fn start_round(&mut self) {
        debug!("Start new round");

		let cards = {
			let mut cards = all_cards();
			let mut rng = rand::thread_rng();
			cards.shuffle(&mut rng);

			let plrs = self.game.players.len();
			let cards_per_player = cards.len() / plrs;

			let mut out = vec![Cardset::default(); plrs];

			for (i, card) in cards.into_iter().enumerate() {
				out[i / cards_per_player].insert(card);
			}

			out
		};

		self.game.start_new_round(cards);

        for (_, client) in self.clients.iter_mut() {
            let plr_id = client.player_id;
            client
                .send(SocketMessage::NewCards(self.game.players[plr_id].hand))
                .await;
        }
    }

    async fn start_new_game(&mut self, revanche: bool) {
        debug!("Start game!");
		self.game = Game::new();
        self.state = RoomState::PLAYING;
		self.quit_vote();

        self.start_round().await;

        if !revanche || self.game.setting.apply_startcondition_on_revanche {
            self.game.announce_player = self.get_first_announceplayer();
            self.game.current_player = self.game.announce_player;
            debug!("Starting player is {}", self.game.announce_player);
        }
		// TODO change beginner player after Revanche

        self.send_to_all(SocketMessage::StartGame).await;
        self.send_to_all(SocketMessage::SetAnnouncePlayer(self.game.announce_player))
            .await;
    }

    async fn play_card(&mut self, card: Card, plr_id: usize) {
		if self.game.current_player != plr_id {
			error!("Player played when it's not his turn.");
			return;
		}
        if !self.game.is_legal_card(&self.game.players[plr_id].hand, card) {
            error!("It's illegal to play this card!");
            return;
        }

        self.game.play_card(card);

        match self.game.get_turn() {
            1 => {
				if self.game.num_played_cards() == 0 {
					let shows: Vec<Vec<Show>> = self
						.game
						.players
						.iter()
						.map(|plr| plr.shows.clone())
						.collect();

					self.send_to_all(SocketMessage::ShowList(shows)).await;
				}
            }
            9 => {
                self.start_round().await;
            }
            _ => {}
        }

        if self.game.should_end() {
            self.end_game().await;
        }
        self.send_to_all(SocketMessage::PlayCard(card)).await;
    }

    async fn announce(&mut self, pt: Playtype, misere: bool, plr_id: usize) {
        if self.game.can_announce(plr_id) {
			self.game.announce(pt, misere);
			self.send_to_all(SocketMessage::Announce(pt, misere)).await;

			if let Some(plr) = self.game.player_with_marriage() {
				let team = self.game.players[plr].team_id;
				if self.game.marriage_would_win(team) {
					self.send_to_all(SocketMessage::HasMarriage(plr)).await;
				}
			}
        }
    }

	async fn pass(&mut self, plr_id: usize) {
		if self.game.can_pass(plr_id) {
			self.game.pass();
			self.send_to_all(SocketMessage::Pass).await;
		} else {
			error!("Player cannot pass!");
		}
	}

    async fn play_show(&mut self, show: Show, plr_id: usize) {
        if !self.game.can_show(plr_id) {
            error!("Player mustn't show at this time!");
            return;
        }
        if let Err(e) = self.game.players[plr_id].hand.has_show(show) {
            error!("Player can't show it: {:?}", e);
            return;
        }
        if self.game.players[plr_id].shows.iter().any(|s| *s == show) {
            error!("Player has already shown show!");
            return;
        }

		self.game.play_show(show, plr_id);
        let points = self.game.ruleset.get_show_value(show);
        self.send_to_all(SocketMessage::ShowPoints(points, plr_id)).await;
    }

	async fn evaluate_vote( &mut self ) {
		let vote = match &self.vote {
			Some(v) => v,
			None => return,
		};

		debug!("Evaluate: {:?}", vote);

		match vote {
			VotingType::Revanche => {
				let agree: usize = self.clients.iter()
					.filter(|(_,c)| c.vote == Some(0))
					.count();
				let decline: usize = self.clients.iter()
					.filter(|(_,c)| c.vote == Some(1))
					.count();

				if agree > decline {
					self.start_new_game(true).await;
				}
			}
			VotingType::Teaming => self.handle_team_choosing().await,
			_ => todo!("Not implemented yet..."),
		}

		self.quit_vote();
	}

	async fn handle_vote( &mut self, vote: usize, client_id: usize ) {
		match self.clients.get_mut(&client_id) {
			Some(client) => {
				if client.vote.is_some() { return; }
				client.vote = Some(vote);
			},
			None => return,
		}

		self.send_to_all_except(client_id, SocketMessage::Vote(vote, client_id)).await;

		self.num_votes += 1;
		if self.num_votes == self.clients.len() {
			self.evaluate_vote().await;
		}
	}

    async fn handle_team_choosing(&mut self) {
        if self.state != RoomState::TEAMING { return; }

		let players = {
            let mut rng = rand::thread_rng();
			let mut v: Vec<usize> = (0..self.game.players.len()).collect();
			v.shuffle(&mut rng);
			v
		};

		let order = self.clients.iter()
			.map(|(i,_)| *i)
			.enumerate()
			.map(|(i,cid)| (cid, players[i]))
			.collect();

        self.send_to_all(SocketMessage::PlayerOrder(order)).await;
        self.start_new_game(false).await;
    }

	pub fn should_close(&self) -> bool {
		let num_clients = self.clients.len();
		let num_players = self.game.players.len();

		match self.state {
			RoomState::ENTERING => num_players == 0,
			_ => num_clients <= num_players - 2,
		}
	}

    pub async fn handle_input(&mut self, input: SocketMessage, client_id: usize) {
        let plr_id = match self.clients.get(&client_id) {
            Some(client) => client.player_id,
            None => return,
        };
        debug!("[{}] {:?}", plr_id, input);

        match input {
            SocketMessage::PlayCard(card) => self.play_card(card, plr_id).await,
            SocketMessage::Announce(pt, misere) => self.announce(pt, misere, plr_id).await,
            SocketMessage::Pass => self.pass(plr_id).await,
            SocketMessage::PlayShow(show) => self.play_show(show, plr_id).await,
            // SocketMessage::Vote(vote, _) => self.handle_voting(vote, client_id).await,
			SocketMessage::RtcStart(_) => self.send_to_all_except(client_id, SocketMessage::RtcStart(client_id)).await,
            SocketMessage::RtcSignaling(s, signal, recv) => {
                self.send_to(recv, SocketMessage::RtcSignaling(s, signal, client_id))
                    .await
            }
			SocketMessage::ChatMessage(text, _) => {
				self.send_to_all(SocketMessage::ChatMessage(text, client_id)).await;
			},
            SocketMessage::ClientIntroduction(name, _) => {
                if let Some(client) = self.clients.get_mut(&client_id) {
                    if client.name.is_empty() {
                        client.name = name.clone();
                        self.send_to_all_except(
                            client_id,
                            SocketMessage::ClientIntroduction(name, client_id),
                        )
                        .await;
                    }
                }
            }
			SocketMessage::Vote(opt, _) => self.handle_vote(opt, client_id).await,
            _ => {
                error!("Invalid header!");
            }
        }
    }
}
