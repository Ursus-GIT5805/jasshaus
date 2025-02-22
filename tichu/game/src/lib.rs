pub mod card;
pub mod setting;

#[cfg(feature = "server")]
pub mod server;

use card::*;
use setting::*;

use wasm_bindgen::prelude::*;
use tsify_next::Tsify;
use serde::{Serialize, Deserialize};

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, PartialEq, Eq)]
#[derive(Copy)]
#[derive(Serialize, Deserialize)]
#[repr(u8)]
pub enum TichuState {
	None,
	Tichu,
	GrandTichu,
	// HugeTichu,
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, PartialEq, Eq)]
#[derive(Copy)]
#[derive(Serialize, Deserialize)]
pub enum PlayerState {
	DecidingGrandTichu,
	Playing,
	Finished,
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, PartialEq, Eq)]
#[derive(Copy)]
#[derive(Serialize, Deserialize)]
#[repr(u8)]
pub enum Phase {
	Distributing,
	Exchange,
	Playing,
	Bombing,
}

// #[derive(Tsify)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
#[wasm_bindgen(getter_with_clone)]
#[derive(Clone, PartialEq, Eq)]
#[derive(Serialize, Deserialize)]
pub struct Player {
	pub team_id: usize,

	// Private Information
	#[serde(skip)]
	pub cards: Cardset,
	#[serde(skip)]
	pub exchange: Vec<Card>,

	pub state: PlayerState,
	pub won_cards: Cardset,
	pub tichu: TichuState,
}

impl Player {
	pub fn new(team_id: usize) -> Self {
		Self {
			team_id,
			cards: Cardset::default(),
			exchange: vec![],
			state: PlayerState::Playing,

			won_cards: Cardset::default(),
			tichu: TichuState::None,
		}
	}

	pub fn clear_round_data(&mut self) {
		self.cards.clear();
		self.won_cards.clear();
		self.exchange.clear();

		self.tichu = TichuState::None;
		self.state = PlayerState::DecidingGrandTichu;
	}

	pub fn finished(&self) -> bool {
		self.state == PlayerState::Finished
	}
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone)]
#[derive(Default)]
#[derive(Eq, PartialEq)]
#[derive(Serialize, Deserialize)]
pub struct Team {
	pub points: i32,
}

#[derive(Clone, PartialEq, Eq)]
#[derive(Serialize, Deserialize)]
#[wasm_bindgen(getter_with_clone)]
pub struct Game {
	pub phase: Phase,
	pub wished_number: Option<u8>,
	pub best_play: Option<Play>,
	pub played_cards: Cardset,

	pub first_finished: Option<usize>,
	pub last_player: usize,
	pub current_player: usize,

	pub setting: Setting,

	pub players: Vec<Player>,
	pub teams: Vec<Team>,
}

#[wasm_bindgen]
impl Game {
	pub fn new(setting: Setting) -> Self {
		let players = (0..setting.num_players).map(|i| Player::new(i&1)).collect();

		Self {
			phase: Phase::Distributing,
			wished_number: None,
			best_play: None,
			played_cards: Cardset::default(),

			first_finished: None,
			last_player: 0,
			current_player: 0,

			setting,

			players,
			teams: vec![Team::default(); 2],
		}
	}

	/// Start a new round.
	/// This does evaluate the results from the current round (see `end_round`).
	pub fn start_new_round(&mut self) {
		for plr in self.players.iter_mut() {
			plr.clear_round_data();
		}

		self.best_play = None;
		self.phase = Phase::Distributing;
		self.first_finished = None;
	}

	/// Start exchanging cards
	pub fn start_exchange(&mut self) {
		self.phase = Phase::Exchange;
	}

	/// Returns true when it's time to start exchanging
	pub fn should_start_exchange(&self) -> bool {
		self.phase == Phase::Distributing &&
			!self.players.iter().any(|p| p.cards.len() != self.cards_per_player())
	}

	/// Returns true when it's time to evaluate the exchange
	pub fn should_end_exchange(&self) -> bool {
		self.phase == Phase::Exchange &&
			!self.players.iter().any(|p| p.exchange.is_empty())
	}

	/// Ends the round and handles the points
	pub fn end_round(&mut self) {
		// Give won cards of unfinished players to the player that finished first
		if let Some(first_plr) = self.get_first_finished_player() {
			let mut gain = Cardset::new();

			let unfinished = self.players.iter_mut()
				.filter(|plr| plr.finished());

			for plr in unfinished {
				gain.merge(plr.won_cards);
				plr.won_cards.clear();
			}

			self.players[first_plr].cards.merge(gain);
		}

		// Give hand cards of unfinished players to the next team
		let representant = {
			let mut v = vec![0, self.teams.len()];
			for (id, plr) in self.players.iter().enumerate() {
				v[plr.team_id] = id;
			}
			v
		};

		for plr_id in 0..self.players.len() {
			if !self.players[plr_id].finished() {
				let team_id = self.players[plr_id].team_id;
				let id = representant[ (team_id+1) % self.teams.len() ];

				let cards = self.players[plr_id].cards;
				self.players[id].cards.merge(cards);
				self.players[plr_id].cards.clear();
			}
		}

		// Add points to the team
		for team_id in 0..self.teams.len() {
			let plr_ids = self.get_players_of_team(team_id);

			let points: i32 = plr_ids.into_iter()
				.map(|id| self.players[id].won_cards.count_points())
				.sum();

			self.teams[team_id].points += points;
		}
	}

	/// Return the next player in the player's team
	fn next_player_of_team(&self, plr: usize) -> usize {
		let team_id = self.players[plr].team_id;
		let plrs = self.get_players_of_team(team_id);
		let idx = *plrs.iter().find(|&id| *id == plr).unwrap_or(&0);
		plrs[(idx+1) % plrs.len()]
	}

	/// Takes the current cards and gives them to the `last_player`
	/// (i.e. give the cards to the player on whose cards wasn't played)
	fn take_cards(&mut self) {
		let plr = &mut self.players[self.current_player];
		plr.won_cards.merge(self.played_cards);

		self.played_cards.clear();
		self.best_play = None;
	}

	/// Proceed to the next player that will act next
	fn proceed_to_next_player(&mut self) {
		let num_players = self.players.len();
		let end = self.last_player;
		let mut cur = (self.current_player+1) % num_players;

		while self.players[cur].finished() && cur != end {
			cur = (cur+1) % num_players;
		}

		self.current_player = cur;
	}

	/// Play the trick
	/// This will not check if the trick is legal to play!
	pub fn play_trick(&mut self, trick: Trick, plr_id: usize) {
		let cards: Cardset = trick.clone().into();
		let play = Play::from(trick);

		// TODO Handle dog

		self.played_cards.merge(cards);
		self.last_player = plr_id;
		self.best_play = Some(play);

		self.current_player = plr_id;

		let plr = &mut self.players[plr_id];
		plr.cards.erase_set(cards);

		// See if wish is fulfilled
		if let Some(wish) = self.wished_number {
			if cards.count_number(wish) > 0 {
				self.wished_number = None;
			}
		}

		// Check if player finished
		if plr.cards.is_empty() {
			plr.state = PlayerState::Finished;
			if self.first_finished.is_none() {
				self.first_finished = Some(plr_id);
			}
		}

		self.proceed_to_next_player();
	}

	/// Wish for a number
	/// This will not check for legality!
	pub fn wish(&mut self, wish: u8) {
		self.wished_number = Some(wish);
	}

	/// Make the current player pass
	/// This will not check for legality!
	pub fn pass(&mut self) {
		self.proceed_to_next_player();

		if self.current_player == self.last_player {
			self.take_cards();
		}

		if self.players[self.current_player].finished() {
			self.proceed_to_next_player();
		}
	}

	/// Returns true when the given player can pass
	pub fn can_pass(&self, plr_id: usize) -> bool {
		self.phase == Phase::Playing && self.current_player == plr_id
	}

	/// Start playing
	pub fn start_playing(&mut self) {
		self.phase = Phase::Playing;
		for plr in self.players.iter_mut() {
			plr.state = PlayerState::Playing;
		}
		self.current_player = self.players.iter()
			.position(|plr| plr.cards.contains(ONE))
			.unwrap_or(0);
	}

	/// Handles the exchange
	pub fn handle_exchange(&mut self) {
		let num_players = self.players.len();
		let matrix = self.get_exchange_matrix();

		for (id, plr) in self.players.iter_mut().enumerate() {
			for &card in matrix[id].iter() {
				if card.is_legal() {
					plr.cards.erase(card);
				}
			}
			for sender in (0..num_players).filter(|&sid| sid != id) {
				plr.cards.insert( matrix[sender][id] );
			}

			plr.exchange.clear();
		}
	}


	/// Announce a Tichu (GT or normal)
	/// This will not check if it's a legal move!
	pub fn announce(&mut self, tichu: TichuState, plr_id: usize) {
		self.players[plr_id].tichu = tichu;
	}

	/// Sets the exchanging cards of a player
	/// This will not check if it's a legal move!
	pub fn exchange(&mut self, cards: Vec<Card>, plr_id: usize) {
		if cards.len() == self.players.len() - 1 {
			self.players[plr_id].exchange = cards;
		}
	}

	/// Checks whether the given Trick (and wish) is legally playable by the plr
	pub fn legal_to_play(&self, trick: Trick, wish: Option<u8>, plr_id: usize) -> bool {
		let cards: Cardset = trick.clone().into();

		if self.players[plr_id].state != PlayerState::Playing {
			println!("Player is not in the correct state!");
			return false;
		}
		if !self.players[plr_id].cards.contains_set(cards) {
			println!("Player doesn't not have the cards!");
			return false;
		}
		if wish.is_some() && !self.players[plr_id].cards.contains(ONE) {
			println!("Player cannot wish without the ONE");
			return false;
		}

		let play: Play = trick.into();

		let best = match self.best_play {
			Some(play) => play,
			None => return true,
		};

		// Check if wish is fulfilled
		if let Some(wish) = self.wished_number {
			if let Some(card) = cards.get_card_of_number(wish) {
				let can_play = match best.ty {
					Playtype::Single => {
						let play = Play::from(card);
						best.power < play.power
					},
					Playtype::Street(len) => {
						todo!()
					},
					_ => panic!("Unreachable statement!"),
				};

				if can_play {
					return false;
				}
			}
		}

		let ty_beats  = play.ty.can_beat(best.ty);
		let power_beats = play.ty == best.ty && best.power < play.power;

		ty_beats || power_beats
	}

	/// Checks whether the given player can legally exchange the given cards
	pub fn can_exchange(&self, vec: Vec<Card>, plr_id: usize) -> bool {
		let is_time = self.phase == Phase::Exchange && self.players[plr_id].exchange.is_empty();
		let has_cards = self.players[plr_id].cards.contains_set(vec);
		is_time && has_cards
	}

	/// Checks whether the given player can announce Tichu
	pub fn can_announce(&self, plr_id: usize) -> bool {
		let p = &self.players[plr_id];
		self.phase == Phase::Playing &&
			p.tichu == TichuState::None &&
			p.cards.len() == self.cards_per_player()
	}

	/// Returns the player IDs of the given team ID.
	pub fn get_players_of_team(&self, team_id: usize) -> Vec<usize> {
		self.players.iter()
			.enumerate()
			.filter(|(_,plr)| plr.team_id == team_id)
			.map(|(idx,_)| idx)
			.collect()
	}

	/// Returns the number of finished players
	pub fn num_finished_players(&self) -> usize {
		self.players.iter()
			.filter(|plr| plr.finished())
			.count()
	}

	/// Returns the number of unfinished players
	pub fn num_unfinished_players(&self) -> usize {
		self.players.iter()
			.filter(|plr| !plr.finished())
			.count()
	}

	/// Returns the number of unfinished teams
	pub fn num_unfinished_teams(&self) -> usize {
		let mut finished = vec![true; self.teams.len()];

		for plr in self.players.iter() {
			finished[plr.team_id] = finished[plr.team_id] && plr.finished();
		}

		finished.iter()
			.filter(|&b| !b)
			.count()
	}

	/// Returns the player who finished first
	pub fn get_first_finished_player(&self) -> Option<usize> {
		self.first_finished
	}

	/// Returns true if the round should end
	pub fn should_round_end(&self) -> bool {
		self.num_unfinished_teams() <= 1
	}

	/// Returns true if the game should end
	pub fn should_game_end(&self) -> bool {
		// TODO: check if multiple teams have the same number of points
		match self.setting.end_condition {
			EndCondition::Points(points) => self.teams.iter()
				.any(|team| points <= team.points)
		}
	}

	/// Returns how many cards a player receives
	pub fn cards_per_player(&self) -> usize {
		14 // TODO actually calculate depending on deck size
	}

	/// Parses the game state from the given Javascript Object (WASM only)
	#[cfg(target_family = "wasm")]
	pub fn from_object(obj: JsValue) -> Option<Self> {
		match serde_wasm_bindgen::from_value(obj) {
			Ok(r) => Some(r),
			Err(_) => None,
		}
	}
}

impl Game {
	/// Return a 2D vector with v{i,j} = the card player i gives to player j
	pub fn get_exchange_matrix(&self) -> Vec< Vec<Card> > {
		let num_players = self.players.len();
		let mut cards = vec![vec![Card::new(5,5); num_players]; num_players];

		// Determine which players receive which cards
		for (id, plr) in self.players.iter().enumerate() {
			for (i, &card) in plr.exchange.iter().enumerate() {
				let push_plr = (id+i+1) % num_players;
				cards[id][push_plr] = card;
			}
		}

		cards
	}
}
