pub mod card;
pub mod setting;

pub mod trick;

#[cfg(feature = "server")]
pub mod server;

use card::*;
use trick::*;
use setting::*;

use wasm_bindgen::prelude::*;
use tsify_next::Tsify;
use serde::{Serialize, Deserialize};
use thiserror::Error;

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
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
	GiveAway(usize),
	DecideGrandTichu(bool, usize),

	// Server -> Client only

	AddCards(Cardset),
	StartPlaying(usize),
	StartDistribution(Cardset),
	StartExchange,
	DidExchange(usize),
	NewGame,

	State(Game, Cardset),
	Setting(Setting),
}

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
#[repr(u8)]
pub enum Phase {
	Distributing,
	Exchange,
	GiveAway,
	Playing,
}

// #[derive(Tsify)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
#[wasm_bindgen(getter_with_clone)]
#[derive(Clone, PartialEq, Eq)]
#[derive(Serialize, Deserialize)]
pub struct Player {
	pub team_id: TeamID,

	pub num_cards: usize,
	pub finished: bool,
	pub won_cards: Cardset,
	pub tichu: TichuState,

	// Private Information
	pub cards: Cardset,
	#[wasm_bindgen(skip)]
	pub exchange: Vec<Card>,
}

impl Player {
	pub fn new(team_id: usize) -> Self {
		Self {
			team_id,

			num_cards: 0,
			cards: Cardset::default(),
			exchange: vec![],
			finished: false,

			won_cards: Cardset::default(),
			tichu: TichuState::None,
		}
	}

	pub fn clear_round_data(&mut self) {
		self.num_cards = 0;
		self.cards.clear();
		self.won_cards.clear();
		self.exchange.clear();

		self.tichu = TichuState::None;
		self.finished = false;
	}

	pub fn finished(&self) -> bool {
		self.finished
	}
}

pub type PlayerID = usize;
pub type TeamID = usize;

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
	best_trick: Option<Trick>,
	played_cards: Cardset,

	pub first_finished: Option<usize>,
	pub last_player: usize,
	pub current_player: usize,

	pub setting: Setting,

	pub players: Vec<Player>,
	pub teams: Vec<Team>,
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, PartialEq)]
#[derive(Error, Debug)]
#[derive(Serialize, Deserialize)]
pub enum LegalityError {
	#[error("Can't do during this state")]
	WrongTime,
	#[error("The wish is not legal")]
	IllegalWish,
	#[error("The current wish is unfulfilled")]
	UnfulfilledWish,
	#[error("The trick can't beat the current one")]
	TrickTooWeak,
	#[error("Player does not own the needed cards")]
	MissingCards,
}

#[wasm_bindgen]
impl Game {
	pub fn new(setting: Setting) -> Self {
		let players = (0..setting.num_players).map(|i| Player::new(i&1)).collect();

		Self {
			phase: Phase::Distributing,
			wished_number: None,
			best_trick: None,
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

		self.best_trick = None;
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
			!self.players.iter().any(|p| p.num_cards != self.cards_per_player())
	}

	/// Returns true when it's time to evaluate the exchange
	pub fn should_end_exchange(&self) -> bool {
		self.phase == Phase::Exchange &&
			!self.players.iter().any(|p| p.exchange.is_empty())
	}

	/// Ends the round and handles the points
	pub fn end_round(&mut self) {
		if self.best_trick.is_some() {
			self.take_cards();
		}

		// Give won cards of unfinished players to the player that finished first
		if let Some(first_plr) = self.get_first_finished_player() {
			let mut gain = Cardset::new();

			let unfinished = self.players.iter_mut()
				.filter(|plr| !plr.finished());

			for plr in unfinished {
				gain.merge( &plr.won_cards );
				plr.won_cards.clear();
			}

			self.players[first_plr].won_cards.merge( &gain );
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
			if self.players[plr_id].finished() {
				continue;
			}

			let team_id = self.players[plr_id].team_id;
			let next_team = (team_id+1) % self.teams.len();
			let id = representant[next_team];

			let cards = self.players[plr_id].cards.clone();
			self.players[id].won_cards.merge( &cards );
			self.players[plr_id].cards.clear();
		}

		// Add points to the team
		for plr in self.players.iter() {
			let team_id = plr.team_id;
			let points = plr.won_cards.count_points();
			self.teams[team_id].points += points;
		}
	}

	/// Return the next player in the player's team
	fn next_player_of_team(&self, plr: usize) -> usize {
		let team_id = self.players[plr].team_id;
		let plrs = self.get_players_of_team(team_id);
		let idx = plrs.iter().position(|&id| id == plr).unwrap_or(0);

		plrs[(idx+1) % plrs.len()]
	}

	/// Takes the current cards and gives them to the `last_player`
	/// (i.e. give the cards to the player with the best trick)
	fn take_cards(&mut self) {
		if let Some(trick) = &self.best_trick {
			match trick {
				Trick::Dragon => {
					self.phase = Phase::GiveAway;
					return;
				},
				_ => {},
			}
		}

		self.current_player = self.last_player;
		let plr = &mut self.players[self.last_player];
		plr.won_cards.merge( &self.played_cards );

		self.played_cards.clear();
		self.best_trick = None;

		if plr.finished() {
			self.proceed_to_next_player();
		}
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

	fn handle_finish(&mut self, plr_id: usize) {
		self.players[plr_id].finished = true;

		if self.first_finished.is_none() {
			self.handle_tichu(plr_id);
		}

		let teams = self.teams.len();
		let mut num_plrs = vec![0; teams];
		let mut finished_plrs = vec![0; teams];

		for plr in self.players.iter() {
			num_plrs[plr.team_id] += 1;
			finished_plrs[plr.team_id] += plr.finished() as i32;
		}

		let num_finished_teams = num_plrs.iter().zip(finished_plrs.iter())
			.filter(|(&total, &finished)| total == finished)
			.count();

		let num_at_least_one = finished_plrs.iter()
			.filter(|&x| *x != 0)
			.count();

		println!("Finish ratio: {} {}", num_finished_teams, num_at_least_one);

		// One team finished and no other player of another team did!
		if num_finished_teams == 1 && num_at_least_one == 1 {
			// Give extra points for finishing fast
			let team_id = self.players[plr_id].team_id;
			self.teams[team_id].points += self.setting.fast_finish_points;
		}
	}

	/// Play the trick
	/// This will not check if the trick is legal to play!
	pub fn play_trick(&mut self, trick: Trick, plr_id: usize) {
		let cards: Cardset = trick.get_cards();

		self.played_cards.merge( &cards );
		self.last_player = plr_id;

		let plr = &mut self.players[plr_id];
		plr.num_cards -= cards.len();
		plr.cards.erase_set( &cards );

		self.current_player = plr_id;

		match &trick {
			Trick::Dog => {
				let next = self.next_player_of_team(self.current_player);
				self.current_player = next;
				self.last_player = next;

				if self.players[next].finished() {
					self.proceed_to_next_player();
				}
				return;
			},
			Trick::Phoenix(_) => {
				let pow = match &self.best_trick {
					Some(tr) => tr.get_power(),
					None => 0,
				};

				self.best_trick = Some(Trick::Phoenix(pow));
			},
			_ => {
				self.best_trick = Some(trick);
			},
		}

		// See if wish is fulfilled
		if let Some(wish) = self.wished_number {
			if cards.count_number(wish) > 0 {
				self.wished_number = None;
			}
		}

		// Check if player finished
		if plr.num_cards == 0 {
			self.handle_finish(plr_id);
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
	}

	/// Returns true when the given player can pass
	pub fn can_pass(&self, plr_id: usize) -> bool {
		if self.phase != Phase::Playing ||
			self.current_player != plr_id
		{
			return false;
		}

		let trick = match &self.best_trick {
			Some(tr) => tr,
			None => return false,
		};

		if let Some(num) = self.wished_number {
			let hand = &self.players[plr_id].cards;

			if can_fulfill(hand, trick.clone(), num) {
				return false;
			}
		}

		true
	}

	/// Start playing
	pub fn start_playing(&mut self) {
		self.phase = Phase::Playing;
		for plr in self.players.iter_mut() {
			plr.finished = false;
		}
		self.current_player = self.players.iter()
			.position(|plr| plr.cards.contains(ONE))
			.unwrap_or(0);
	}

	fn handle_tichu(&mut self, plr_id: usize) {
		self.first_finished = Some(plr_id);

		for (id, plr) in self.players.iter().enumerate() {
			let points = match plr.tichu {
				TichuState::Tichu => self.setting.tichu_points,
				TichuState::GrandTichu => self.setting.grand_tichu_points,
				_ => continue,
			};
			let sign = if id == plr_id {
				1
			} else {
				-1
			};

			self.teams[plr.team_id].points += sign*points;
		}
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

		// Immediately subtract points if someone already finished
		if self.first_finished.is_some() {
			let points = match tichu {
				TichuState::Tichu => self.setting.tichu_points,
				TichuState::GrandTichu => self.setting.grand_tichu_points,
				_ => 0,
			};

			let team_id = self.players[plr_id].team_id;
			self.teams[team_id].points -= points;
		}
	}

	/// Gives away the current cards to the given player
	/// If the current phase is not Phase::GiveAway, this does nothing
	pub fn give_away(&mut self, plr_id: usize) {
		if self.phase == Phase::GiveAway {
			self.players[plr_id].won_cards.merge(&self.played_cards);
			self.played_cards.clear();
			self.best_trick = None;

			self.phase = Phase::Playing;

			if self.players[self.current_player].finished() {
				self.proceed_to_next_player();
			}
		}
	}

	/// Sets the exchanging cards of a player
	/// This will not check if it's a legal move!
	pub fn exchange(&mut self, cards: Vec<Card>, plr_id: usize) {
		if cards.len() == self.players.len() - 1 {
			self.players[plr_id].exchange = cards;
		}
	}

	/// Checks whether the given Trick (and wish) is legally playable by the plr
	pub fn legal_to_play(&self, trick: &Trick, wish: Option<u8>, plr_id: usize) -> Result<(), LegalityError> {
		let cards: Cardset = trick.get_cards();
		let hand = &self.players[plr_id].cards;

		if self.phase != Phase::Playing || self.players[plr_id].finished() {
			return Err(LegalityError::WrongTime);
		}
		if !self.players[plr_id].cards.contains_set( cards.clone() ) {
			println!("Player doesn't not have the cards!");
			return Err(LegalityError::MissingCards);
		}
		if let Some(num) = wish {
			let in_range = (1..NUM_NUMBERS as u8).contains(&num);

			if !self.players[plr_id].cards.contains(ONE) || !in_range {
				return Err(LegalityError::IllegalWish);
			}
		}
		if plr_id != self.current_player && !trick.is_bomb() {
			if !trick.is_bomb() {
				return Err(LegalityError::WrongTime);
			}

			// Player can't play bomb if no trick was already played
			if self.best_trick.is_none() {
				return Err(LegalityError::WrongTime);
			}
		}

		let best = match &self.best_trick {
			Some(trick) => trick,
			None => {
				// no best trick, so there might be a wish
				let res = if let Some(wish) = self.wished_number {
					cards.count_number(wish) != 0 || hand.count_number(wish) == 0
				} else {
					true
				};

				if res {
					return Ok(());
				} else {
					return Err(LegalityError::UnfulfilledWish)
				}
			},
		};

		// Check if the wish is considered
		if let Some(wish) = self.wished_number {
			if cards.count_number(wish) == 0 {
				let hand = &self.players[plr_id].cards;

				if can_fulfill(hand, best.clone(), wish) {
					return Err(LegalityError::UnfulfilledWish);
				}
			}
		}

		if trick.can_beat(best) {
			Ok(())
		} else {
			Err(LegalityError::TrickTooWeak)
		}
	}

	/// Checks whether the given player can legally exchange the given cards
	pub fn can_exchange(&self, vec: Vec<Card>, plr_id: usize) -> bool {
		let is_time = self.phase == Phase::Exchange && self.players[plr_id].exchange.is_empty();
		let has_cards = self.players[plr_id].cards.contains_set( vec );
		is_time && has_cards
	}

	/// Checks whether the given player can announce Tichu
	pub fn can_announce(&self, plr_id: usize) -> bool {
		let p = &self.players[plr_id];
		self.phase == Phase::Playing &&
			p.tichu == TichuState::None &&
			p.num_cards == self.cards_per_player()
	}

	/// Checks whether the given 'plr_id' can give the cards away to 'target'.
	pub fn can_give_away(&self, target: usize, plr_id: usize) -> bool {
		let tid1 = self.players[plr_id].team_id;
		let tid2 = self.players[target].team_id;

		self.phase == Phase::GiveAway &&
			self.current_player == plr_id &&
			tid1 != tid2
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
		self.phase == Phase::Playing && self.num_unfinished_teams() <= 1
	}

	/// Returns true if the game should end
	pub fn should_game_end(&self) -> bool {
		match self.setting.end_condition {
			EndCondition::Points(points) => {
				let mx = self.teams.iter()
					.map(|team| team.points)
					.max()
					.unwrap_or(i32::MIN);

				let num_best = self.teams.iter()
					.filter(|team| team.points == mx)
					.count();

				points <= mx && num_best == 1
			},
		}
	}

	/// Return an ordered list of team IDs starting with the best team
	pub fn rank_teams(&self) -> Vec<usize> {
		let mut v: Vec<_> = (0..self.teams.len()).collect();
		v.sort_by_key(|&id| self.teams[id].points);
		v.reverse();
		v
	}

	/// Returns how many cards a player receives
	pub fn cards_per_player(&self) -> usize {
		14 // TODO actually calculate depending on deck size
	}

	/// Clone the gamestate with only public information
	pub fn public_clone(&self) -> Self {
		let mut state = self.clone();

		for plr in state.players.iter_mut() {
			plr.cards.clear();
			plr.exchange.clear();
		}

		state
	}

	/// Returns the best trick on the table
	/// Returns None if no trick was played yet.
	pub fn get_best_trick(&self) -> Option<Trick> {
		self.best_trick.clone()
	}

	/// Set the public visible number of cards onto target player
	pub fn set_num_cards(&mut self, num: usize, plr: PlayerID) {
		self.players[plr].num_cards = num;
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
