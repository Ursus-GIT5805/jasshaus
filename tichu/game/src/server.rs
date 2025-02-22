use game_server::room::{
	*,
	client::*,
};
use crate::setting::Setting;

use async_trait::*;
use serde::{Serialize, Deserialize};

use crate::*;

#[derive(Clone)]
#[derive(Eq, PartialEq)]
#[derive(Serialize, Deserialize)]
pub enum Event {
	// Client <-> Server
	Play(Trick, usize),
	WishPlay(Trick, u8, usize),
	Pass(usize),
	Announce(TichuState, usize),
	ExchangeCards(Vec<Card>),

	// Client -> Server only

	DecideGrandTichu(bool),

	// Server -> Client only

	AddCards(Cardset),
	StartPlaying(usize),
	StartDistribution(Cardset),
	StartExchange,

	State(Game, Cardset),
	Setting(Setting),
}
use Event::*;

#[derive(Clone)]
#[derive(Eq, PartialEq)]
pub struct TichuRoom {
	starts: u32,
	pile: Cardset,
	game: Game,
}

impl TichuRoom {
	pub async fn start_round(&mut self, clients: &mut ClientHandler) {
		self.game.start_new_round();
		self.pile = Cardset::full();

		let num = self.game.setting.num_cards_gt;
		for (pid, plr) in self.game.players.iter_mut().enumerate() {
			let cards = self.pile.choose_k(num);
			self.pile.erase_set(cards);
			plr.cards.merge(cards);
			clients.ev_send_to(pid, StartDistribution(cards)).await;
		}
	}

	pub async fn handle_play(&mut self, clients: &mut ClientHandler, trick: Trick, plr: usize) {
		if !self.game.legal_to_play(trick.clone(), None, plr) {
			return;
		}

		self.game.play_trick(trick.clone(), plr);
		clients.ev_send_to_all(Play(trick, plr)).await;

		if self.game.should_round_end() {
			self.game.end_round();
			self.game.start_new_round();
		}
	}

	pub async fn handle_wish(&mut self, clients: &mut ClientHandler, trick: Trick, wish: u8, plr: usize) {
		if !self.game.legal_to_play(trick.clone(), Some(wish), plr) {
			return;
		}

		self.game.play_trick(trick.clone(), plr);
		self.game.wish(wish);
		clients.ev_send_to_all(WishPlay(trick, wish, plr)).await;
	}

	pub async fn handle_pass(&mut self, clients: &mut ClientHandler, plr: usize) {
		if self.game.can_pass(plr) {
			self.game.pass();
			clients.ev_send_to_all(Pass(plr)).await;
		}
	}

	pub async fn handle_exchange(&mut self, clients: &mut ClientHandler, cards: Vec<Card>, plr: usize) {
		if self.game.can_exchange(cards.clone(), plr) {
			self.game.exchange(cards, plr);

			if self.game.should_end_exchange() {
				let num_players = self.game.players.len();
				let matrix = self.game.get_exchange_matrix();

				println!("{:?}", matrix);

				for id in 0..num_players {
					let recv: Vec<Card> = (1..num_players)
						.map(|i| matrix[(id+i) % num_players][id])
						.collect();

					clients.ev_send_to(id, ExchangeCards(recv)).await;
				}

				self.game.handle_exchange();
				self.game.start_playing();
				clients.ev_send_to_all(StartPlaying(self.game.current_player)).await;
			}
		}
	}

	pub async fn handle_gt(&mut self, clients: &mut ClientHandler, announce: bool, plr: usize) {
		if self.game.players[plr].state != PlayerState::DecidingGrandTichu {
			return;
		}

		if announce {
			self.game.players[plr].tichu = TichuState::GrandTichu;
			clients.ev_send_to_all(Announce(TichuState::GrandTichu, plr)).await;
		}

		let num = {
			let total = self.game.cards_per_player();
			let sub = self.game.setting.num_cards_gt;
			total - sub
		};

		let cards = self.pile.choose_k(num);
		self.pile.erase_set(cards);

		self.game.players[plr].state = PlayerState::Finished;
		self.game.players[plr].cards.merge(cards);
		clients.ev_send_to(plr, AddCards(cards)).await;

		if self.game.should_start_exchange() {
			self.game.start_exchange();
			clients.ev_send_to_all(StartExchange).await;
		}
	}
}

impl TryFrom<Setting> for TichuRoom {
	type Error = ();

	fn try_from(item: Setting) -> Result<Self, Self::Error> {
		let out = Self {
			starts: 0,
			pile: Cardset::new(),
			game: Game::new(item),
		};

		Ok(out)
	}
}

#[async_trait]
impl ServerRoom<Event> for TichuRoom {
	type Err = ();

	async fn start(&mut self, clients: &mut ClientHandler) -> Result<(), Self::Err> {
		self.game = Game::new( self.game.setting.clone() );
		self.starts += 1;

		self.start_round(clients).await;

		Ok(())
	}

	async fn on_enter(&mut self, clients: &mut ClientHandler, plr_id: usize) {
		if self.starts > 0 {
			let hand = self.game.players[plr_id].cards;
			clients.ev_send_to(plr_id, State(self.game.clone(), hand)).await;
		} else {
			clients.ev_send_to(plr_id, Setting(self.game.setting.clone())).await;
		}
	}

	async fn on_leave(&mut self, _clients: &mut ClientHandler, _plr_id: usize) {}

	async fn on_event(&mut self, clients: &mut ClientHandler, event: Event, plr_id: usize)
				-> Result<(), Self::Err>
	{
		match event {
			Play(cards, _) => self.handle_play(clients, cards, plr_id).await,
			WishPlay(cards, wish, _) => self.handle_wish(clients, cards, wish, plr_id).await,
			Pass(_) => self.handle_pass(clients, plr_id).await,
			Announce(_tichu, _) => {},

			ExchangeCards(cards) => self.handle_exchange(clients, cards, plr_id).await,
			DecideGrandTichu(announce) => self.handle_gt(clients, announce, plr_id).await,
			_ => {},
		}

		Ok(())
	}

	fn get_player_bound(&self) -> (usize,usize) {
		let n = self.game.setting.num_players;
		(n, n)
	}
	fn should_end(&self) -> bool {
		self.game.should_game_end()
	}
}
