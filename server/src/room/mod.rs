pub mod client;

use rand::prelude::SliceRandom;

use async_trait::async_trait;
use std::marker::PhantomData;

use serde::*;
use client::*;
use crate::socket_message::{SocketMessage::*, *};

#[async_trait]
pub trait ServerRoom<T> {
	type Err;

	async fn start(&mut self, clients: &mut ClientHandler) -> Result<(), Self::Err>;

	async fn on_enter(&mut self, clients: &mut ClientHandler, plr_id: usize);
	async fn on_leave(&mut self, clients: &mut ClientHandler, plr_id: usize);
	async fn on_event(&mut self, clients: &mut ClientHandler, event: T, plr_id: usize) -> Result<(), Self::Err>;

	fn get_num_players(&self) -> usize;
	fn should_end(&self) -> bool;
}

#[derive(Clone)]
#[derive(PartialEq, Eq)]
pub enum RoomState {
	Entering,
	Teaming,
    Playing,
    Ending,
}

pub struct Room<E, G>
where
	G: ServerRoom<E>, E: Clone,
{
    _marker: PhantomData<E>,
    pub clients: ClientHandler,

	pub game: G,
    pub state: RoomState,

	pub num_votes: usize,
	pub vote: Option<VotingType>,
}

impl<E,G> Room<E,G>
where
	G: Default + ServerRoom<E> + Send,
	E: Clone + Serialize,
{
    pub fn new() -> Self {
        Room {
			_marker: PhantomData,
            clients: ClientHandler::default(),

            game: G::default(),
            state: RoomState::Entering,

			num_votes: 0,
			vote: None,
        }
    }

	pub async fn cleanup(&mut self) {
		for (_, client) in self.clients.iter_mut() {
			client.close().await;
		}
		self.clients.clear();
	}

	/// Returns a player ID, if one exists
    fn get_unused_player_id(&self) -> Option<usize> {
        let mut mex = vec![true; self.game.get_num_players()];
        for (_, client) in self.clients.iter() {
            mex[client.player_id] = false;
        }
		mex.into_iter().position(|r| r)
    }

	/// Register a new client given the SplitSink
    pub async fn register(&mut self, ws_tx: WsWriter) -> Option<usize> {
        let plr_id = self.get_unused_player_id()?;

		let joined_clients = self.clients.iter()
			.map(|(i,client)| (client.name.clone(), *i, client.player_id))
			.collect();
		let id = self.clients.register(plr_id, ws_tx);
        self.clients.send_to(id, PlayerID::<E>(plr_id, self.game.get_num_players())).await;
        self.clients.send_to_all_except(id, ClientJoined::<E>(id, plr_id))
            .await;

		self.game.on_enter(&mut self.clients, plr_id).await;
		self.clients.send_to(id, JoinedClients::<E>(joined_clients)).await;

		if let Some(vote) = self.vote.clone() {
			let votes = self.clients.iter()
				.filter(|(_, c)| c.vote.is_some())
				.map(|(i, c)| (c.vote.unwrap(), *i))
				.collect();
			self.clients.send_to(id, CurrentVote::<E>(vote, votes)).await;
		}

		if self.state == RoomState::Entering {
			let num_connected = self.clients.len();
			if num_connected == self.game.get_num_players() {
				self.quit_vote();
				let _ = self.game.start(&mut self.clients).await;
				self.state = RoomState::Playing;
			}
		}

        Some(id)
    }

	/// Unregister the client with the given id
    pub async fn unregister(&mut self, client_id: usize) {
		if self.vote.is_some() {
			if let Some(client) = self.clients.get(&client_id) {
				if client.vote.is_some() {
					self.num_votes -= 1;
					self.evaluate_vote().await;
				}
			}
		}

		let pid = if let Some(client) = self.clients.get(&client_id) {
			Some(client.player_id)
		} else {
			None
		};
		self.clients.remove(&client_id);

		if let Some(id) = pid {
			let _ = self.game.on_leave(&mut self.clients, id).await;
		}
        self.clients.send_to_all(ClientDisconnected::<E>(client_id))
            .await;
    }

	/// Start a new vote
	async fn start_vote(&mut self, vote: VotingType) {
		self.vote = Some(vote.clone());
		self.num_votes = 0;
		for (_, client) in self.clients.iter_mut() {
			client.vote = None;
		}
		self.clients.send_to_all(NewVote::<E>(vote)).await;
    }

	/// Quit the current vote
	fn quit_vote(&mut self) {
		self.vote = None;
	}

	/// Ends the current game
    async fn end_game(&mut self) {
		if self.state != RoomState::Ending {
			debug!("End game");
			self.start_vote(VotingType::Revanche).await;
			self.state = RoomState::Ending;
		}
    }

	async fn evaluate_vote( &mut self ) {
		let vote = match &self.vote {
			Some(v) => v,
			None => return,
		};

		if self.num_votes != self.clients.len() {
			return;
		}

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
					let _ = self.game.start(&mut self.clients).await;
					self.state = RoomState::Playing;
				} else {
					self.cleanup().await;
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

		self.clients.send_to_all_except(client_id, Vote::<E>(vote, client_id)).await;

		self.num_votes += 1;
		self.evaluate_vote().await;
	}

    async fn handle_team_choosing(&mut self) {
        if self.state != RoomState::Teaming { return; }

		// TODO Correctly handle team choosing
		// TODO This is merely shuffling, actually handle the requests
		let players = {
            let mut rng = rand::thread_rng();
			let mut v: Vec<usize> = (0..self.game.get_num_players()).collect();
			v.shuffle(&mut rng);
			v
		};

		let order = self.clients.iter()
			.map(|(i,_)| *i)
			.enumerate()
			.map(|(i,cid)| (cid, players[i]))
			.collect();

        self.clients.send_to_all(PlayerOrder::<E>(order)).await;
		let _ = self.game.start(&mut self.clients).await;
    }

	pub fn should_close(&self) -> bool {
		self.clients.is_empty()
	}

	async fn handle_event(&mut self, ev: E, plr_id: usize) {
		let _ = self.game.on_event(&mut self.clients, ev, plr_id).await;
		if self.game.should_end() { self.end_game().await; }
	}

    pub async fn handle_input(&mut self, input: SocketMessage<E>, client_id: usize) {
        let plr_id = match self.clients.get(&client_id) {
            Some(client) => client.player_id,
            None => return,
        };

        match input {
			Event(ev) => self.handle_event(ev, plr_id).await,
			RtcStart(_) => self.clients.send_to_all_except(client_id, RtcStart::<E>(client_id)).await,
            RtcSignaling(s, signal, recv) => {
                self.clients.send_to(recv, RtcSignaling::<E>(s, signal, client_id))
                    .await
            }
			ChatMessage(text, _) => {
				self.clients.send_to_all(ChatMessage::<E>(text, client_id)).await;
			},
            ClientIntroduction(name, _) => {
                if let Some(client) = self.clients.get_mut(&client_id) {
                    if client.name.is_empty() {
                        client.name = name.clone();
                        self.clients.send_to_all_except(
                            client_id,
                            ClientIntroduction::<E>(name, client_id),
                        )
                        .await;
                    }
                }
            }
			Vote(opt, _) => self.handle_vote(opt, client_id).await,
            _ => {
                error!("Invalid header!");
            }
        }
    }
}
