pub mod card;
pub mod ruleset;
pub mod setting;

use card::*;
use ruleset::*;
use setting::*;

use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, Copy, PartialEq, Eq, std::fmt::Debug, Default, Serialize, Deserialize)]
pub enum MarriageState {
    #[default]
	None,
	PlayedOne(usize),
	PlayedBoth(usize),
}

#[derive(Clone, PartialEq, Eq, std::fmt::Debug, Default, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Player {
    pub team_id: usize,
    pub hand: Cardset,
	#[wasm_bindgen(skip)]
    pub shows: Vec<Show>,
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Clone, PartialEq, Eq, std::fmt::Debug, Default, Serialize, Deserialize)]
pub struct Team {
    pub points: i32,
    pub won_points: i32,
    pub show_points: i32,
	pub won: Cardset,
}

#[derive(Clone, PartialEq, Eq, std::fmt::Debug, Serialize, Deserialize)]
#[wasm_bindgen(getter_with_clone)]
pub struct Game {
    // History
	pub round: usize,
	pub cards_played: usize,
	pub played_cards: Vec<Card>,
	pub best_player: usize,

	pub turncolor: Option<u8>,
    pub bestcard: Option<Card>,

	pub marriage: MarriageState,

    #[serde(skip)]
    pub players: Vec<Player>,
    pub teams: Vec<Team>,

    pub ruleset: RuleSet,
    pub announce_player: usize,
    pub current_player: usize,

    pub passed: usize,

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
			TeamChoosing::Blocks(n) => {
				for (id, plr) in plrs.iter_mut().enumerate() {
					plr.team_id = id / n;
				}
				(n as f32 / setting.num_players as f32).ceil() as usize
			}
		};

        Game {
			round: 0,
			cards_played: 0,
			played_cards: vec![],
			best_player: 0,
			turncolor: None,
			bestcard: None,
			marriage: MarriageState::None,

            players: plrs,
            teams: vec![Team::default(); num_teams],

            ruleset: RuleSet::default(),
            announce_player: 0,
            current_player: 0,

			passed: 0,

            setting: Setting::schieber(),
        }
    }

    // Events ------

    pub fn start_new_round(&mut self, cards: Vec<Cardset>) {
        for plr in self.players.iter_mut() {
            plr.shows.clear();
        }
		for (i, hand) in cards.into_iter().enumerate().take(self.players.len()) {
			self.players[i].hand = hand;
		}

        for team in self.teams.iter_mut() {
            team.won_points = 0;
            team.show_points = 0;
			team.won.clear();
        }

		self.round += 1;
        self.ruleset = RuleSet::default();
		self.cards_played = 0;
		self.played_cards.clear();
		self.turncolor = None;
		self.bestcard = None;
		self.passed = 0;
		self.marriage = MarriageState::None;

		// Rotate to the next player who must announce
		self.announce_player = (self.announce_player + 1) % self.players.len();
        self.current_player = self.announce_player;
    }

	/// Play the marriage for th given player
    pub fn play_marriage(&mut self, plr: usize) {
        self.marriage = MarriageState::PlayedBoth(plr);

        let gain = self.setting.marriage_points;
        let team = self.team_of(plr);
        team.points += gain;
        team.show_points += gain;
    }

	/// Returns true if the given team would win with the marriage
	pub fn marriage_would_win(&self, team_id: usize) -> bool {
		match self.setting.end_condition {
			EndCondition::Points(maxp) => maxp <= self.teams[team_id].points + self.setting.marriage_points,
			_ => false,
		}
	}

	/// Set a player to have the marriage
	pub fn set_marriage(&mut self, plr: usize) {
		let trumpf = match self.ruleset.playtype {
			Playtype::Color(col) => col,
			_ => return,
		};

		let queen = Card::new(trumpf, 6);
		let king = Card::new(trumpf, 7);

		let hand = &mut self.players[plr].hand;
		hand.insert(queen);
		hand.insert(king);
	}

	/// Returns the player who can still get the marriage
	pub fn player_with_marriage(&self) -> Option<usize> {
		let trumpf = match self.ruleset.playtype {
			Playtype::Color(col) => col,
			_ => return None,
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

    // Handles marriage
    pub fn handle_marriage(&mut self) {
		if !self.setting.allow_marriage {
			return;
		}

		let plr = match self.player_with_marriage() {
			Some(c) => c,
			None => return,
		};

		let team = self.players[plr].team_id;
		if self.marriage_would_win(team) {
			self.play_marriage(plr);
		}
	}

	pub fn get_show_value(&self, show: Show) -> i32 {
		let mut val = std::cmp::min(
			self.ruleset.get_show_value(show),
			self.setting.show_points_maximum,
		);

		if self.setting.show_gives_negative {
			val = -val;
		}
		val
	}

    // Handles shows and add the points
    pub fn handle_shows(&mut self) {
        let mut bestshow: Option<Show> = None;
        let mut bestplr = 0;

        // Get best show
        for (plr_id, plr) in self.players.iter().enumerate() {
            for show in plr.shows.iter() {
                if bestshow.is_none() || self.ruleset.is_show_stronger(bestshow.unwrap(), *show) {
                    bestshow = Some(*show);
                    bestplr = plr_id;
                }
            }
        }
        if bestshow.is_none() {
            return;
        }

        let team_id = self.players[bestplr].team_id;

        // Handle shows
        for plr in 0..self.players.len() {
            if self.players[plr].team_id != team_id {
				self.players[plr].shows.clear();
				continue;
            }

            for show in self.players[plr].shows.iter() {
                let sp = self.get_show_value(*show);
                self.teams[team_id].points += sp;
                self.teams[team_id].show_points += sp;
            }
        }
    }

    fn end_turn(&mut self) {
		let points = self.played_cards
			.iter()
            .map(|&card| self.ruleset.get_card_value(card))
            .sum();

        let best_team = self.players[self.best_player].team_id;
        self.current_player = self.best_player;

		self.teams[best_team].won.merge(Cardset::from(self.played_cards.clone()));
		self.played_cards.clear();

		self.bestcard = None;
		self.turncolor = None;

        if self.get_turn() == 1 {
			// Acknowledge the order in the first round only!
            for rule in self.setting.point_recv_order.clone() {
                match rule {
                    PointRule::Play => self.add_points(best_team as usize, points),
                    PointRule::Show => self.handle_shows(),
                    PointRule::Marriage => self.handle_marriage(),
                }
				if self.should_end() { return; }
            }
        } else {
			if self.should_end() { return; }
            self.add_points(best_team as usize, points);
        }

		if self.round_ended() {
			 // The team which won the last turn
			let last_team = self.players[self.current_player].team_id;
			// Last team gets extra points
			self.add_points(last_team, self.setting.last_points);

			// It's important to add the eights if no trumpf has been decided
			if let Playtype::Molotow = self.ruleset.playtype {
				match self.ruleset.active {
					Playtype::Color(_) => {},
					_ => {
						for tid in 0..self.teams.len() {
							// Count the number of eights
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

        if !self.should_end() {
			self.update_ruletype();
		}
    }

	fn handle_molotow(&mut self, card: Card) {
		let turncolor = match self.turncolor {
			Some(c) => c,
			None => return,
		};

		// Switch the active Playtype, only if it's the first color not held
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
		let cards = Cardset::from(self.played_cards.clone());
		let tid = self.players[self.best_player].team_id;
		for show in cards.get_shows() {
            let sp = self.get_show_value(show);
            self.teams[tid].points += sp;
            self.teams[tid].show_points += sp;
		}
	}

    // Action functions ------

    pub fn play_card(&mut self, card: Card) {
		if let Playtype::Molotow = self.ruleset.playtype {
			match self.ruleset.active {
				Playtype::Color(_) => {},
				_ => self.handle_molotow(card),
			}
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

        self.played_cards.push(card);
		self.cards_played += 1;
        self.players[self.current_player].hand.erase(card);


		// TODO there are serious flaws with the Marriage/Show/Point ordering
		// Weird points like those are unhandled by the order!
		if self.setting.allow_table_shows {
			self.handle_table_show();
		}

        if let Playtype::Color(trumpf) = self.ruleset.playtype {
			// If the given card is a trumpf queen or king, handle marriage
			if card.color == trumpf && (card.number == 6 || card.number == 7) {
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
			// This Playtype has to be handled externally afterwards!
			Playtype::Everything => Playtype::Updown,
			Playtype::Molotow => self.ruleset.active,
            x => x,
        };
    }

	pub fn pass(&mut self) {
		if !self.setting.allow_pass { return; }

		self.passed += 1;
		self.current_player = self.get_announcing_player();
	}

    pub fn announce(&mut self, pt: Playtype, misere: bool) {
        if !self.setting.allow_misere && misere { return; }
		if let Some(id) = pt.get_id() {
			if !self.setting.playtype[id].allow { return; }
		}

		// Announce!
		self.ruleset = RuleSet::new(pt, misere);
        self.current_player = self.get_startplayer();


		if let Playtype::Molotow = pt {
			self.ruleset.active = Playtype::Updown;
		}
        self.update_ruletype();
    }

    // Utility functions ---

	#[inline]
	/// Return whether something is announced the current turn
	pub fn is_announced(&self) -> bool {
		self.ruleset.playtype != Playtype::None
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

    // Add points to a given team (or the other on misere)
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
        team.points += p;
        team.won_points += p;
    }

	pub fn cards_distributed(&self) -> usize {
		NUM_CARDS - (NUM_CARDS % self.players.len())
	}

	pub fn round_ended(&self) -> bool {
		self.cards_played == self.cards_distributed()
	}

    // The game should end if any team has reached the number of points for winning
    pub fn should_end(&self) -> bool {
		match self.setting.end_condition {
			EndCondition::Points(maxp) => self.teams
				.iter()
				.any(|team| maxp <= team.points),
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
			let pos = plrs.iter().position(|&plr| plr == self.announce_player).unwrap_or(0);

			plrs[(pos + self.passed) % plrs.len()]
        } else {
			(self.announce_player + self.passed) % self.players.len()
		}
    }

    // True when the given card is playable
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
        if let Playtype::Color(trumpf) = self.ruleset.active {
            let trumpf_first = turncolor == trumpf;
            let trumpf_card = card.color == trumpf;

            // Rule: you can't play a weaker trumpf than on the board
            // You can play it if you have no other choice
            if !trumpf_first && trumpf_card {
                // If the first card wasn't a trumpf and the new card is a trumpf, it must be stronger
                if self.ruleset.is_card_stronger(bcrd, card) {
                    return true;
                }
                // Since this is not true, there must be a stronger trumpf on the board
                // It's only legal to play if you can't play anything else
                return hand.only_has_color(card.color) && !hand.has_stronger_trumpf(bcrd);
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

	/// Returns true when the given player can show
    pub fn can_show(&self, player_id: usize) -> bool {
        self.current_player == player_id
            && self.get_turn() < 1
            && self.is_announced()
    }

	/// Return whether the given player can pass
	pub fn can_pass(&self, player_id: usize) -> bool {
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
}
