pub mod client;

use std::{ops::Deref, sync::Arc};
use tokio::sync::Mutex;
use rand::prelude::SliceRandom;

use async_trait::async_trait;
use std::{collections::HashMap, marker::PhantomData};

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

	fn get_player_bound(&self) -> (usize, usize);
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

pub struct RoomSetting<Game> {
	pub public: bool,
	pub game_setting: Game,
}

pub struct Room<S, E, G>
where
	S: Clone,
	E: Clone,
	G: ServerRoom<E> + TryFrom<S>,
{
    _marker: PhantomData<E>,
    pub clients: ClientHandler,

	pub setting: RoomSetting<S>,
	pub game: G,
    pub state: RoomState,

	pub num_votes: usize,
	pub vote: Option<VotingType>,
}

pub type RoomRef<S,E,G> = Arc< Mutex< Room<S,E,G> > >;

impl<S,E,G> Room<S,E,G>
where
	S: Clone,
	E: Clone + Serialize,
	G: ServerRoom<E> + Send + TryFrom<S>,
{
    pub fn try_new(setting: RoomSetting<S>) -> Result<Self, ()> {
		let game = G::try_from(setting.game_setting.clone())
			.map_err(|_| ())?;


		let res = Room {
			_marker: PhantomData,
            clients: ClientHandler::default(),

            game,
			setting,
            state: RoomState::Entering,

			num_votes: 0,
			vote: None,
        };

		Ok(res)
    }

	pub async fn cleanup(&mut self) {
		let futures = self.clients.iter_mut()
			.map(|(_, client)| client.close());

		futures::future::join_all(futures).await;
		self.clients.clear();
	}

	async fn check_active_clients(&mut self) {
		let mut ids = Vec::<usize>::new();
		let mut futures = vec![];

		for (id, client) in self.clients.iter_mut() {
			ids.push( *id );
			futures.push( client.is_active() );
		}

		let results = futures::future::join_all(futures).await;

		let iter = std::iter::zip(ids, results);
		for (id, _) in iter.filter(|(_, active)| !active) {
			debug!("Unregister {} due to inactivity.", id);
			self.unregister(id).await;
		}
	}

	/// Returns a player ID, if one exists
    fn get_unused_player_id(&self) -> Option<usize> {
		let (_, num_players) = self.game.get_player_bound();

        let mut mex = vec![true; num_players];
        for (_, client) in self.clients.iter() {
            mex[client.player_id] = false;
        }
		mex.into_iter().position(|r| r)
    }

	/// Register a new client given the SplitSink
    pub async fn register(&mut self, ws_tx: WsWriter) -> Option<(ConnectionRef, usize)> {
        let plr_id = match self.get_unused_player_id() {
			Some(id) => id,
			None => {
				self.check_active_clients().await;
				match self.get_unused_player_id() {
					Some(id) => id,
					None => return None,
				}
			}
		};

		let joined_clients = self.clients.iter()
			.map(|(i,client)| (client.name.clone(), *i, client.player_id))
			.collect();

		let (conn, id) = self.clients.register(plr_id, ws_tx);
		let (_, num_players) = self.game.get_player_bound();

		self.clients.send_to(id, PlayerID::<E>(id, plr_id, num_players)).await;
        self.clients.send_to_all_except(id, ClientJoined::<E>(id, plr_id))
            .await;

		self.clients.send_to(id, JoinedClients::<E>(joined_clients)).await;

		if let Some(vote) = self.vote.clone() {
			let votes = self.clients.iter()
				.filter(|(_, c)| c.vote.is_some())
				.map(|(i, c)| (c.vote.unwrap(), *i))
				.collect();
			self.clients.send_to(id, CurrentVote::<E>(vote, votes)).await;
		}

		self.game.on_enter(&mut self.clients, plr_id).await;

		if self.state == RoomState::Entering {
			let (low, up) = self.game.get_player_bound();
			let num_connected = self.clients.len();

			if num_connected == up {
				self.quit_vote().await;
				let _ = self.game.start(&mut self.clients).await;
				self.state = RoomState::Playing;
			} else if low <= num_connected {
				self.start_vote(VotingType::StartGame).await;
			}
		}

        Some((conn, id))
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

		let pid = if let Some(client) = self.clients.get_mut(&client_id) {
			client.close().await;
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
	async fn quit_vote(&mut self) {
		if let Some(_) = self.vote {
			self.clients.send_to_all(SocketMessage::<E>::QuitVote).await;
		}
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

		self.quit_vote().await;
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
		let (_, num_players) = self.game.get_player_bound();

		// TODO Correctly handle team choosing
		// TODO This is merely shuffling, actually handle the requests
		let players = {
            let mut rng = rand::thread_rng();
			let mut v: Vec<usize> = (0..num_players).collect();
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

	pub fn is_full(&self) -> bool {
		self.clients.len() == self.game.get_player_bound().1
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
                        client.name = if name.is_empty() {
							format!("unnamed{}", client_id)
						} else {
							name.clone()
						};

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

pub type RoomID = String;

#[derive(Serialize, Deserialize)]
#[derive(Debug)]
pub enum ServerRequest {
	CloseRoom(RoomID),

	ListRooms,
	CleanUnused,

	SaveToFile(String),
	LoadFromFile(String),
}

#[derive(Serialize, Deserialize)]
pub enum ServerAnswer {
	Successful,
	Unsuccessful,
	RoomList(Vec<RoomIndex>),
}

pub struct RoomManager<S,E,G>
where
	S: Clone + Send,
	E: Clone + Send,
	G: ServerRoom<E> + TryFrom<S> + Send,
{
	room_next: u32,
	rooms: HashMap<RoomID, RoomRef<S,E,G> >,
}

#[derive(Serialize, Deserialize)]
#[derive(Clone)]
pub struct RoomIndex {
	pub players: Vec<String>,
	pub id: RoomID,
	pub max_players: usize,
}

impl RoomIndex
{
	fn new<S,E,G>(id: RoomID, item: &Room<S,E,G>) -> Self
	where
		S: Clone,
		E: Clone,
		G: ServerRoom<E> + TryFrom<S>,
	{
		let names: Vec<_> = item.clients.iter()
			.map(|(_,client)| client.name.clone())
			.collect();

		Self {
			id,
			players: names,
			max_players: item.game.get_player_bound().1,
		}
	}
}

impl<S,E,G> RoomManager<S,E,G>
where
	S: Clone + Send,
	E: Clone + Serialize + Send,
	G: ServerRoom<E> + TryFrom<S> + Send,
{
	pub fn new() -> Self {
		Self {
			room_next: 0u32,
			rooms: HashMap::new(),
		}
	}

	pub fn create_room(&mut self, setting: RoomSetting<S>)
		-> Option<(String, RoomRef<S,E,G>)> {

		// TODO create a decent room id generator
		let id: RoomID = {
			let number = {
				const ORDER: [usize; 32] = [8, 19, 2, 13, 1, 17, 7, 0, 4, 11, 12, 9, 15, 18, 16, 5, 14, 3, 6, 10, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];

				let mut x: u32 = 0;
				for (i, &j) in ORDER.iter().enumerate() {
					x |= ((self.room_next >> j) & 1) << i;
				}
				x
			};

			// custom base 32 encoding
			let encode = {
				const BASE: &[u8] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef".as_bytes();

				let bytes: Vec<_> = (0..4)
					.map(|x| {
						let idx = (number >> 5*x) & 0x1F;
						BASE[idx as usize]
					})
					.collect();

				RoomID::from_utf8_lossy(&bytes).into()
			};

			self.room_next += 1;
			encode
		};

		// Handle if rooms are
		let room = match Room::<S,E,G>::try_new(setting) {
			Ok(r) => r,
			Err(_) => return None,
		};

		let roomref = Arc::from( Mutex::from(room) );

		if self.rooms.contains_key(&id) { return None; }
		self.rooms.insert(id.clone(), roomref.clone());

		debug!("Create room {}", id);
		Some((id, roomref))
	}

	pub async fn maintain_room(&mut self, id: &RoomID) {
		let close = match self.rooms.get(id) {
			Some(room) => {
				let mut rlock = room.lock().await;
				if rlock.should_close() {
					rlock.cleanup().await;
					true
				} else {
					false
				}
			},
			None => false
		};

		debug!("Close room {}", id);
		if close {
			self.rooms.remove(id);
		}
	}

	pub async fn maintain(&mut self) {
		let rooms_futures = self.rooms.iter()
			.map(|(id, room)| async move {
				let mut rlock = room.lock().await;
				if rlock.should_close() {
					rlock.cleanup().await;
					Some(id.clone())
				} else {
					None
				}
			});

		let rooms = futures::future::join_all(rooms_futures).await;

		let to_close = rooms.into_iter()
			.filter(|c| c.is_some())
			.map(|c| c.unwrap());

		for id in to_close {
			self.rooms.remove(&id);
		}

	}

	pub async fn index_rooms(&self) -> Vec<RoomIndex> {
		let mut v = vec![];
		for (id, room) in self.rooms.iter() {
			let rlock = room.lock().await;
			if !rlock.is_full() {
				v.push( RoomIndex::new( id.clone(), rlock.deref() ) );

				if v.len() >= 32 {
					break;
				}
			}
		}
		v
	}

	pub fn get_room(&self, id: &RoomID) -> Option< RoomRef<S,E,G> > {
		match self.rooms.get(id) {
			Some(c) => Some(c.clone()),
			None => None,
		}
	}

	pub async fn process_request(&mut self, req: ServerRequest) -> ServerAnswer {
		match req {
			ServerRequest::CloseRoom(room_id) => {
				match self.rooms.remove(&room_id) {
					Some(room) => {
						let mut lock = room.lock().await;
						lock.cleanup().await;
						ServerAnswer::Successful
					},
					None => ServerAnswer::Unsuccessful,
				}
			},
			ServerRequest::CleanUnused => {
				self.maintain().await;
				ServerAnswer::Successful
			},
			ServerRequest::ListRooms => {
				let futures = self.rooms.iter()
					.map(|(id, room)| {
						async move {
							let lock = room.lock().await;
							RoomIndex::new(id.clone(), lock.deref())
						}
					});

				let results = futures::future::join_all(futures).await;
				ServerAnswer::RoomList(results)
			},
			_ => todo!()
		}
	}
}
