pub mod card;
pub mod ruleset;
pub mod setting;
#[cfg(feature = "server")]
pub mod server;

use card::*;
use ruleset::*;
use setting::*;

use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone)]
#[derive(PartialEq, std::fmt::Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum Event {
    PlayCard(Card),
	PlayShow(Show),

	Announce(Playtype, bool),
	Pass,

	ShowPoints(i32,usize),
    ShowList(Vec<Vec<Show>>),
    HasMarriage(usize),

    GameState(Game, Cardset, Vec<Show>),
    GameSetting(Setting),
	EverythingPlaytype(Playtype),

    NewCards(Cardset),
	StartGame(usize),

	Bid(i32),
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, Copy, PartialEq, Eq, std::fmt::Debug, Default, Serialize, Deserialize)]
pub enum MarriageState {
    #[default]
	None,
	PlayedOne(usize),
	PlayedBoth(usize),
}


pub type PlayerID = usize;

#[derive(Clone, PartialEq, Eq, std::fmt::Debug, Default, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Player {
    pub team_id: TeamID,
    pub hand: Cardset,
	#[wasm_bindgen(skip)]
    pub shows: Vec<Show>,
}

impl Player {
	pub fn get_best_show(&self, ruleset: &RuleSet) -> Option<&Show> {
		let mut show = match self.shows.first() {
			Some(s) => s,
			None => return None,
		};

		for s in self.shows.iter() {
			if ruleset.is_show_stronger(*show, *s) {
				show = s;
			}
		}

		Some(show)
	}
}

pub type TeamID = usize;

// #[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, PartialEq, Eq, std::fmt::Debug, Default, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Team {
    pub points: i32,
    pub won_points: i32,
    pub show_points: i32,
	pub marriage_points: i32,
	pub target: i32, // Used for Difference
	pub won: Cardset,
}

#[wasm_bindgen]
impl Team {
	#[inline]
	pub fn gain_points(&self) -> i32 {
		self.won_points + self.show_points + self.marriage_points
	}

	#[inline]
	pub fn cur_points(&self) -> i32 {
		self.points + self.gain_points()
	}

	pub fn clear_round_data(&mut self) {
		self.won_points = 0;
		self.show_points = 0;
		self.marriage_points = 0;
		self.target = i32::MIN;
		self.won.clear();
	}
}

#[derive(Clone, PartialEq, Eq, std::fmt::Debug, Serialize, Deserialize)]
#[wasm_bindgen(getter_with_clone)]
pub struct Game {
    // History
    pub passed: usize,
	pub cards_played: usize,
	pub played_cards: Vec<Card>,
	pub best_player: usize,

	pub turncolor: Option<u8>,
    pub bestcard: Option<Card>,

	pub marriage: MarriageState,
	pub last_bid_player: Option<usize>,

    pub players: Vec<Player>,
    pub teams: Vec<Team>,

    pub ruleset: RuleSet,
    pub announce_player: usize,
    pub current_player: usize,

	pub round: usize,

    pub setting: Setting,
}

#[wasm_bindgen]
impl Game {
	#[wasm_bindgen(constructor)]
    pub fn new(setting: Setting) -> Self {
		let mut plrs = vec![Player::default(); setting.num_players];

		let num_teams = match setting.team_choosing {
			TeamChoosing::None => {
				for (id, plr) in plrs.iter_mut().enumerate() {
					plr.team_id = id;
				}
				setting.num_players
			},
			TeamChoosing::Periodic(n) => {
				for (id, plr) in plrs.iter_mut().enumerate() {
					plr.team_id = id % n;
				}
				std::cmp::min(n, setting.num_players)
			}
			// TeamChoosing::Blocks(n) => {
				// for (id, plr) in plrs.iter_mut().enumerate() {
					// plr.team_id = id / n;
				// }
				// (n as f32 / setting.num_players as f32).ceil() as usize
			// }
		};

        Game {
			round: 0,
			cards_played: 0,
			played_cards: vec![],
			best_player: 0,
			turncolor: None,
			bestcard: None,
			marriage: MarriageState::None,
			last_bid_player: None,

            players: plrs,
            teams: vec![Team::default(); num_teams],

            ruleset: RuleSet::default(),
            announce_player: 0,
            current_player: 0,

			passed: 0,

            setting,
        }
    }

    // Events ------

	/// Update results from the current round
	pub fn update_round_results(&mut self) {
		match self.setting.point_eval {
			PointEval::Add => {
				for team in self.teams.iter_mut() {
					team.points += team.gain_points();
				}
			},
			PointEval::Difference { include_shows, include_marriage, zero_diff_points, needs_win } => {
				for team in self.teams.iter_mut() {
					let points = {
						let mut p = team.won_points;

						if include_shows {
							p += team.show_points;
						} else {
							team.points += team.show_points;
						}

						if include_marriage {
							p += team.marriage_points;
						} else {
							team.points += team.marriage_points;
						}

						p
					};

					let diff = (points - team.target).abs();

					let has_win = team.won.len() > 0 || !needs_win;

					let gain = if diff == 0 && has_win {
						zero_diff_points
					} else {
						diff
					};

					team.points += gain;
				}
			}
		}

		// Rotate to the next player who must announce
		self.round += 1;
		self.announce_player = (self.announce_player + 1) % self.players.len();
        self.current_player = self.announce_player;
	}

    pub fn start_new_round(&mut self, cards: Vec<Cardset>) {
        for plr in self.players.iter_mut() {
            plr.shows.clear();
        }
		for (i, hand) in cards.into_iter().enumerate().take(self.players.len()) {
			self.players[i].hand = hand;
		}

        for team in self.teams.iter_mut() {
			team.clear_round_data();
        }

        self.ruleset = RuleSet::default();
		self.cards_played = 0;
		self.played_cards.clear();
		self.turncolor = None;
		self.bestcard = None;
		self.passed = 0;
		self.marriage = MarriageState::None;
    }

	/// Play the marriage for th given player
    pub fn play_marriage(&mut self, plr: usize) {
        self.marriage = MarriageState::PlayedBoth(plr);

		let gain = self.setting.marriage_points;
        let team = self.team_of(plr);
        team.marriage_points += gain;
    }

	/// Returns true if the given team would win with the marriage
	pub fn marriage_would_win(&self, team_id: usize) -> bool {
		match self.setting.end_condition {
			EndCondition::Points(maxp) => maxp <= self.teams[team_id].cur_points() + self.setting.marriage_points,
			_ => false,
		}
	}

	/// Set a player to have the marriage
	pub fn set_marriage(&mut self, plr: usize) {
		let trumpf = match self.ruleset.get_trumpf_color() {
			Some(col) => col,
			_ => return,
		};

		let queen = Card::new(trumpf, 6);
		let king = Card::new(trumpf, 7);

		let hand = &mut self.players[plr].hand;
		hand.insert(queen);
		hand.insert(king);
	}

	/// Returns the player who can still play the marriage
	pub fn player_with_marriage(&self) -> Option<usize> {
		let trumpf = match self.ruleset.get_trumpf_color() {
			Some(col) => col,
			None => return None,
		};

		let queen = Card::new(trumpf, 6);
		let king = Card::new(trumpf, 7);

		match self.marriage {
			MarriageState::None => {
				self.players.iter().position(|p| p.hand.contains(queen) && p.hand.contains(king))
			},
			MarriageState::PlayedOne(plr) => {
				let hand = &self.players[plr].hand;
				if hand.contains(queen) || hand.contains(king) {
					Some(plr)
				} else {
					None
				}
			},
			_ => None,
		}
	}

	/// Returns the player who HAS played the marriage
	pub fn player_with_played_marriage(&self) -> Option<usize> {
		match self.marriage {
			MarriageState::PlayedBoth(plr) => Some(plr),
			_ => None,
		}
	}

	/// Handles marriage
    pub fn handle_marriage(&mut self) {
		if !self.setting.allow_marriage { return; }

		let plr = match self.player_with_marriage() {
			Some(c) => c,
			None => return,
		};

		let team = self.players[plr].team_id;
		if self.marriage_would_win(team) {
			self.play_marriage(plr);
		}
	}

	/// Returns the player with the best show
	pub fn get_plr_with_best_show(&self) -> Option<usize> {
		let mut bestshow: Option<Show> = None;
		let mut plr_id = 0;

		let begplr = self.get_beginplayer();
		for i in 0..self.players.len() {
			// Begin with the player that began the turn
			let idx = (begplr + i) % self.players.len();

			let show = match self.players[idx].get_best_show(&self.ruleset) {
				Some(s) => s,
				None => continue,
			};

			let is_better = match bestshow {
				Some(s) => self.ruleset.is_show_stronger(s, *show),
				None => true,
			};

			if is_better {
                bestshow = Some(*show);
                plr_id = idx;
            }
        }

		match bestshow {
			Some(_) => Some(plr_id),
			None => None,
		}
	}

	/// Determines the best show and gives point to the respective team
    pub fn handle_shows(&mut self) {
		if self.get_turn() > 1 { return; }

		let team_id = match self.get_plr_with_best_show() {
			Some(plr) => self.players[plr].team_id,
			None => return,
		};

        // Handle shows
        for plr in 0..self.players.len() {
            if self.players[plr].team_id != team_id {
				self.players[plr].shows.clear();
				continue;
            }

            for show in self.players[plr].shows.iter() {
                let sp = {
					let mut val = std::cmp::min(
						self.ruleset.get_show_value(*show),
						self.setting.show_points_maximum,
					);

					if self.setting.show_gives_negative {
						val = -val;
					}
					val
				};

                self.teams[team_id].show_points += sp;
            }
        }
    }

	// Handle events at the end of a round
	fn end_round(&mut self) {
		// The team which won the last turn
		let last_team = self.players[self.current_player].team_id;
		self.add_points(last_team, self.setting.last_points);

		if let Playtype::Molotow = self.ruleset.playtype {
			// It's important to add the points of eights if no trumpf has been decided
			match self.ruleset.get_active_trumpf_color() {
				Some(_) => {},
				_ => {
					for tid in 0..self.teams.len() {
						let num = self.teams[tid].won.count_number(2) as i32;
						self.add_points(tid, num * 8);
					}
				}
			}
		}

		// When this team won ALL cards: Extra points!
		if self.teams[last_team].won.len() == self.cards_distributed() {
			self.add_points(last_team, self.setting.match_points);
		}
	}

	// Handle events at the end of a turn
    fn end_turn(&mut self) {
		let points = self.played_cards
			.iter()
            .map(|&card| self.ruleset.get_card_value(card))
            .sum();

        let best_team = self.players[self.best_player].team_id;

		self.current_player = self.best_player;
		self.teams[best_team].won.merge(Cardset::from(self.played_cards.clone()));

        for rule in self.setting.point_recv_order.clone() {
			if self.should_end() { break; }
            match rule {
                PointRule::Play => self.add_points(best_team, points),
                PointRule::Show => self.handle_shows(),
                PointRule::Marriage => self.handle_marriage(),
                PointRule::TableShow => self.handle_table_show(),
            }
        }

		self.played_cards.clear();
		self.bestcard = None;
		self.turncolor = None;

        if !self.should_end() {
			if self.round_ended() {
				self.end_round();
			} else {
				self.update_ruletype();
			}
		}
    }

	fn handle_molotow(&mut self, card: Card) {
		if let Some(_) = self.ruleset.get_active_trumpf_color() {
			return;
		}

		let turncolor = match self.turncolor {
			Some(c) => c,
			None => return,
		};

		// Switch the active Playtype, only if it's the first color not kept
		if card.color == turncolor { return; }

		let trumpf = card.color;
		for tid in 0..self.teams.len() {
			// When a teams has the nine: extra (14-0) points
			if self.teams[tid].won.contains(Card::new(trumpf, 3)) {
				self.add_points(tid, 14);
			}
			// When a team has the trumpf boy extra (20-2) = 18 points
			if self.teams[tid].won.contains(Card::new(trumpf, 5)) {
				self.add_points(tid, 18);
			}
		}

		// Switch to trumpf
		self.ruleset.active = Playtype::Color(trumpf);
	}

	fn handle_table_show(&mut self) {
		if !self.setting.allow_table_shows { return; }

		let cards = Cardset::from(self.played_cards.clone());
		let tid = self.players[self.best_player].team_id;
		for show in cards.get_shows() {
			let sp = {
				let mut val = std::cmp::min(
					self.ruleset.get_show_value(show),
					self.setting.show_points_maximum,
				);

				if self.setting.table_show_gives_negative {
					val = -val;
				}
				val
			};

			self.teams[tid].show_points += sp;
		}
	}

    // Action functions ------

    pub fn play_card(&mut self, card: Card) {
		if let Playtype::Molotow = self.ruleset.playtype {
			self.handle_molotow(card);
		}

		let newbest = match self.bestcard {
			Some(bcrd) => self.ruleset.is_card_stronger(bcrd, card),
			None => {
				self.turncolor = Some(card.color);
				true
			},
		};

		if newbest {
			self.best_player = self.current_player;
			self.bestcard = Some(card);
		}

		// Play the card
        self.played_cards.push(card);
		self.cards_played += 1;
        self.players[self.current_player].hand.erase(card);

		// Rules regaring trumpf
        if let Some(trumpf) = self.ruleset.get_active_trumpf_color() {
			// If the given card is a trumpf queen or king, handle marriage
			if card.color == trumpf && (card.number == 6 || card.number == 7) &&
				Playtype::Everything != self.ruleset.playtype
			{
				let plr = self.current_player;

				match self.marriage {
					MarriageState::None => self.marriage = MarriageState::PlayedOne(plr),
					MarriageState::PlayedOne(p) => if p == plr {
						self.play_marriage(p);
					},
					_ => {}
				}
            }
        }

        if self.cards_played % self.players.len() == 0 { // All players played!
            self.end_turn();
        } else if self.should_end() {
            //self.end_game();
        } else {
			// Increment to next player
			self.current_player = (self.current_player + 1) % self.players.len();
		}
    }

    pub fn play_show(&mut self, show: Show, plr_id: usize) {
		if self.setting.allow_shows {
			self.players[plr_id].shows.push(show);
		}
    }

	/// Updates the current active playtype (such as slalom)
    pub fn update_ruletype(&mut self) {
        self.ruleset.active = match self.ruleset.playtype {
            Playtype::SlalomUpdown => {
                if self.get_turn() & 1 == 0 {
                    Playtype::Updown
                } else {
                    Playtype::Downup
                }
            }
            Playtype::SlalomDownup => {
                if self.get_turn() & 1 == 0 {
                    Playtype::Downup
                } else {
                    Playtype::Updown
                }
            }
            Playtype::Guschti => {
                if self.get_turn() < 4 {
                    Playtype::Updown
                } else {
                    Playtype::Downup
                }
            }
            Playtype::Mary => {
                if self.get_turn() < 4 {
                    Playtype::Downup
                } else {
                    Playtype::Updown
                }
            }
			Playtype::BigSlalomUpdown => {
				if (self.get_turn() / 3) & 1 == 1 {
					Playtype::Downup
				} else {
					Playtype::Updown
				}
			},
			Playtype::BigSlalomDownup => {
				if (self.get_turn() / 3) & 1 == 1 {
					Playtype::Updown
				} else {
					Playtype::Downup
				}
			},
			// These playtypes are handled externally
			Playtype::Everything => Playtype::Updown,
			Playtype::Molotow => self.ruleset.active,
            x => x,
        };
    }

	pub fn pass(&mut self) {
		self.passed += 1;
		self.current_player = self.get_announcing_player();
	}

    pub fn announce(&mut self, pt: Playtype, misere: bool) {
		self.ruleset = RuleSet::new(pt, misere);
        self.current_player = self.get_startplayer();

		if let Playtype::Molotow = pt {
			self.ruleset.active = Playtype::Updown;
		}
        self.update_ruletype();

		if self.setting.must_bid() {
			let plr = self.get_startplayer();
			self.last_bid_player = Some(plr);
		}
    }

	fn get_next_bid_player(&self) -> usize {
		let team = self.players[self.current_player].team_id;
		let plrs = self.get_players_of_team(team);

		let idx = plrs.iter()
			.position(|&x| x == self.current_player)
			.unwrap_or(0);
		let next_idx = (idx + 1) % plrs.len();

		plrs[next_idx]
	}

	fn proceed_bid(&mut self) {
		let team = self.players[self.current_player].team_id;
		let next_team = (team+1) % self.teams.len();

		let start_player = self.get_startplayer();

		let mod_class = self.players.len();
		let mod_sub = mod_class - start_player;

		let next_player = {
			let plrs = self.get_players_of_team(next_team);

			let next = plrs.into_iter()
				.map(|id| (id+mod_sub) % mod_class)
				.min()
				.unwrap_or(0);

			let plr_id = (next + start_player) % mod_class;
			plr_id
		};

		self.last_bid_player = if next_player != start_player {
			self.current_player = next_player;
			Some(next_player)
		} else {
			self.current_player = start_player;
			None
		};
	}

	pub fn bid(&mut self, bid: i32) {
		if self.last_bid_player.is_none() { return; }

		let team = self.players[self.current_player].team_id;
		let is_same = self.teams[team].target == bid;
		let next = self.get_next_bid_player();

		if !is_same {
			self.last_bid_player = Some(self.current_player);
			self.teams[team].target = bid;
			self.current_player = next;
		}

		let last_plr = self.last_bid_player.unwrap_or(0);

		if last_plr == next {
			self.proceed_bid();
		} else {
			self.current_player = next;
		}
	}

	/// Returns whether the given announcement is legal
	pub fn legal_announcement(&self, pt: Playtype, misere: bool) -> bool {
		if pt == Playtype::None {
			return false;
		}

		match self.setting.announce {
			AnnounceRule::Choose => {
				if !self.setting.allow_misere && misere { return false; }
				if let Some(id) = pt.get_id() {
					if !self.setting.playtype[id].allow { return false; }
				}
				true
			},
			_ => false,
		}
	}

	#[inline]
	/// Return whether something is announced the current turn
	pub fn is_announced(&self) -> bool {
		self.ruleset.playtype != Playtype::None
	}

	#[inline]
	pub fn is_biding(&self) -> bool {
		self.last_bid_player.is_some()
	}

	#[inline]
	pub fn is_playing(&self) -> bool {
		self.is_announced() && !self.is_biding()
	}

    #[inline]
    /// Returns the number of currently played cards in the turn
    pub fn num_played_cards(&self) -> usize {
		self.played_cards.len()
    }

    /// Get the current turn count
    pub fn get_turn(&self) -> usize {
        self.cards_played / self.players.len()
    }

    /// Return a reference to the team of the plr_id
    fn team_of(&mut self, plr_id: usize) -> &mut Team {
        &mut self.teams[self.players[plr_id].team_id]
    }

    /// Add points to a given team, automatically handling misere
    fn add_points(&mut self, team_id: usize, points: i32) {
        let real_team_id = if self.ruleset.misere {
            (team_id + 1) % self.teams.len()
        } else {
            team_id
        };

        let team = &mut self.teams[real_team_id];

        let p = if let Some(id) = self.ruleset.playtype.get_id() {
			points * self.setting.playtype[id].multiplier
		} else {
			points
		};
        team.won_points += p;
    }

	/// Returns the number of cards that got distributed
	pub fn cards_distributed(&self) -> usize {
		NUM_CARDS - (NUM_CARDS % self.players.len())
	}

	/// Returns true if the round ended
	pub fn round_ended(&self) -> bool {
		self.cards_played == self.cards_distributed()
	}

	/// Returns true if a turn just started
	pub fn fresh_turn(&self) -> bool {
		self.turncolor.is_none()
	}

    /// Returns true if the round should end now
	pub fn should_end(&self) -> bool {
		match self.setting.end_condition {
			EndCondition::Points(maxp) => match self.setting.point_eval {
				PointEval::Add => self.teams
					.iter()
					.any(|team| maxp <= team.cur_points()),
				_ => self.teams
					.iter()
					.any(|team| maxp <= team.points)
			},
			EndCondition::Rounds(r) => r as usize <= self.round,
		}
    }

    /// The beginplayer is the player who began the current turn
    pub fn get_beginplayer(&self) -> usize {
        (self.current_player + self.players.len() - self.num_played_cards()) % self.players.len()
    }

    // The startplayer is the player who started the turn the first turn
    pub fn get_startplayer(&self) -> usize {
		if let Some(id) = self.ruleset.playtype.get_id() {
			if self.setting.playtype[id].passed_player_begins {
				return self.get_announcing_player();
			}
		}
		self.announce_player
    }

    /// Returns the player_id in the given team_id
    pub fn get_players_of_team(&self, team_id: usize) -> Vec<usize> {
        self.players
            .iter()
            .enumerate()
            .filter(|(_, plr)| plr.team_id == team_id)
            .map(|(i, _)| i)
            .collect()
    }

	/// Return for each team, which cards they got
	pub fn cards_per_team(&self) -> Vec<Cardset> {
		self.teams.iter()
			.map(|team| team.won)
			.collect()
	}

    /// The player who should announce now/or has announced.
    /// It takes passing into account!
    pub fn get_announcing_player(&self) -> usize {
		if self.setting.pass_to_same_team {
			let team = self.players[self.announce_player].team_id;
			let plrs = self.get_players_of_team(team);
			let pos = plrs.iter()
				.position(|&plr| plr == self.announce_player)
				.unwrap_or(0);

			plrs[(pos + self.passed) % plrs.len()]
        } else {
			(self.announce_player + self.passed) % self.players.len()
		}
    }

    /// Returns true when the given card is legal to play
    pub fn is_legal_card(&self, hand: &Cardset, card: Card) -> bool {
        if !hand.contains(card) {
            return false;
        }
		let turncolor = match self.turncolor {
			Some(c) => c,
			None => return true,
		};
		let bcrd = match self.bestcard {
			Some(c) => c,
			None => return true,
		};

        // First, check all additional rules from trumpf
        if let Some(trumpf) = self.ruleset.get_active_trumpf_color() {
            let trumpf_first = turncolor == trumpf;
            let trumpf_card = card.color == trumpf;

            // Rule: you can't play a weaker trumpf than on the board
            // You can play it if you have no other choice
            if !trumpf_first && trumpf_card {
                // If the first card wasn't a trumpf and the new card is a trumpf, it must be stronger
                if self.ruleset.is_card_stronger(bcrd, card) {
                    return true;
                }

				// We know it's a weaker trumpf
				let num_stronger_trumpf: usize = hand.as_vec()
					.into_iter()
					.filter(|c| c.color == trumpf)
					.filter(|&c| self.ruleset.is_card_stronger(bcrd, c))
					.count();

				let nothing_else = num_stronger_trumpf == 0 && hand.only_has_color(card.color);
				let can_hold = hand.has_color(turncolor);
				let can_undertrumpf = !can_hold && !self.setting.strict_undertrumpf;

				return nothing_else || can_undertrumpf;
            }

            // Rule: You are NEVER forced to play trumpf-boy
            if trumpf_first && !trumpf_card && hand.has_color(trumpf) {
                // You can play ANY card if you only possess the trumpf boy, since in this case you "must" hold trumpf
                return hand.count_color(trumpf) == 1
                    && hand.contains(Card::new(trumpf, 5));
            }
        }
        // Basic: You must hold the color if you can
        turncolor == card.color || !hand.has_color(turncolor)
    }

	/// Returns true when the given card would beat the current best card
	pub fn would_card_beat(&self, card: Card) -> bool {
		let bcrd = match self.bestcard {
			Some(c) => c,
			None => return true,
		};

		// On Molotow, if updown is active, it could also be better
		if self.ruleset.playtype == Playtype::Molotow && self.ruleset.active == Playtype::Updown {
			if bcrd.color != card.color {
				return true;
			}
		}

		self.ruleset.is_card_stronger(bcrd, card)
	}

	/// Returns true when the given player can show
    pub fn can_show(&self, player_id: usize) -> bool {
        self.current_player == player_id
            && self.get_turn() < 1
            && self.is_playing()
    }

	/// Returns true when the given player can bid
	pub fn can_bid(&self, player_id: usize) -> bool {
		self.is_biding() && self.current_player == player_id
	}

	/// Return whether the given player can pass
	pub fn can_pass(&self, player_id: usize) -> bool {
		if !self.setting.allow_pass {
			return false;
		}

		if self.current_player != player_id || self.is_announced() {
			return false;
		}

		let max_passes = {
			let passes = if self.setting.pass_to_same_team {
				self.get_players_of_team(self.players[player_id].team_id).len()
			} else {
				self.players.len()
			};

			// If no back pass is allowed, you can pass one time less
			passes - (!self.setting.allow_back_pass as usize)
		};

		self.passed < max_passes
	}

    /// Returns true when the given player can announce
    pub fn can_announce(&self, player_id: usize) -> bool {
        !self.is_announced() && self.get_announcing_player() == player_id
    }

    /// Returns a vector of cards which are on the board
    pub fn get_playedcards(&self) -> Vec<Card> {
		self.played_cards.clone()
    }

	/// Returns the currently best team
    pub fn get_winner_team(&self) -> usize {
        self.teams
            .iter()
            .enumerate()
            .max_by_key(|(_idx, &ref val)| val.points)
            .map(|(idx, _val)| idx)
            .expect("This should not happen...")
    }

	/// Rank the teams from best to worst, starting with the best
	pub fn rank_teams(&self) -> Vec<usize> {
		let mut v: Vec<_> = self.teams
			.iter()
			.enumerate()
			.map(|(i,t)| (t.points, i))
			.collect();

		v.sort();
		if !self.setting.less_points_win {
			v.reverse();
		}

		v.iter()
			.map(|(_,i)| *i)
			.collect()
	}

	pub fn public_clone(&self) -> Self {
		let mut out = self.clone();

		for plr in out.players.iter_mut() {
			plr.hand.clear();
			plr.shows.clear();
		}

		out
	}
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
impl Game {
	pub fn from_object(obj: JsValue) -> Option<Self> {
		match serde_wasm_bindgen::from_value(obj) {
			Ok(r) => Some(r),
			Err(_) => None,
		}
	}
}
