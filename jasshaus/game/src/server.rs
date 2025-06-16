use game_server::socket_message::SocketMessage;
use async_trait::async_trait;

use rand::Rng;
use rand::prelude::SliceRandom;

use crate::*;
use game_server::room::{
	*,
	client::*,
};
use Event::*;

#[derive(Clone, Copy)]
pub enum GameError {
	IllegalPlay,
	NotOnTurn,
}


#[derive(Clone, Copy)]
#[derive(PartialEq, std::fmt::Debug, Serialize, Deserialize)]
pub enum RoundState {
	Starting,
	Playing,
}

#[derive(Clone)]
pub struct JassRoom {
	starts: u32,
	roundstate: RoundState,
	game: Game,
}

impl TryFrom<Setting> for JassRoom {
	type Error = ();

	fn try_from(item: Setting) -> Result<Self,Self::Error> {
		if !legal_setting(&item) {
			return Err(());
		}

		let res = Self {
			starts: 0,
			roundstate: RoundState::Starting,
			game: Game::new(item),
		};

		Ok(res)
	}
}

impl JassRoom {
    fn get_first_announceplayer(&self) -> usize {
        match self.game.setting.startcondition {
            StartingCondition::Card(card) => self.game.players
                .iter()
                .position(|plr| plr.hand.contains(card))
                .unwrap_or(0),
            StartingCondition::Random => {
                let mut rng = rand::thread_rng();
				rng.gen_range(0..self.game.players.len())
            }
        }
    }

	async fn start_round(&mut self, clients: &mut ClientHandler) {
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

		self.roundstate = RoundState::Starting;
		self.game.start_new_round(cards);

        for (_, client) in clients.iter_mut() {
            let plr_id = client.player_id;
			let ev = SocketMessage::Event(
				NewCards(self.game.players[plr_id].hand)
			);
            client.send(ev).await;
        }

		match self.game.setting.announce {
			AnnounceRule::Random => if !self.game.should_end() {
				let pt_ids: Vec<_> = self.game.setting.playtype.iter()
					.enumerate()
					.filter(|(_, pt)| pt.allow)
					.map(|(i,_)| i)
					.collect();

				let (pt, misere) = {
					let mut rng = rand::thread_rng();

					let pt = {
						let id = *pt_ids.choose(&mut rng).unwrap_or(&0);
						Playtype::from_id(id)
							.unwrap_or(Playtype::Updown)
					};

					let misere = if self.game.setting.allow_misere {
						rng.gen_bool(0.5)
					} else {
						false
					};

					(pt, misere)
				};
				self.handle_announce(clients, pt, misere).await;
			},
			_ => {},
		}
    }

	async fn play_card(&mut self, clients: &mut ClientHandler, card: Card, plr_id: usize) {
		if self.roundstate != RoundState::Playing {
			return;
		}

		// Check for basic cheating
		if !self.game.is_playing() { return; }
		if self.game.current_player != plr_id { return; }
        if !self.game.is_legal_card(&self.game.players[plr_id].hand, card) { return; }

		// Handle shows
		if self.game.get_turn() == 0 {
			let shows = self.game.players[plr_id].shows.clone();
			let points = shows.into_iter()
				.map(|s| self.game.ruleset.get_show_value(s))
				.max()
				.unwrap_or(0);

			if 0 < points {
				clients.ev_send_to_all(ShowPoints(points, plr_id)).await;
			}
		}

        self.game.play_card(card);

		if self.game.get_turn() == 1 && self.game.setting.allow_shows {
			if self.game.fresh_turn() {
				let shows: Vec<Vec<Show>> = self
					.game
					.players
					.iter()
					.map(|plr| plr.shows.clone())
					.collect();

				clients.ev_send_to_all(ShowList(shows)).await;
			}
        }

		clients.ev_send_to_all(PlayCard(card)).await;

		if let Playtype::Everything = self.game.ruleset.playtype {
			if self.game.num_played_cards() == 0 && !self.game.round_ended() {
				let choices = vec![
					Playtype::Updown,
					Playtype::Downup,
					Playtype::Color(0),
					Playtype::Color(1),
					Playtype::Color(2),
					Playtype::Color(3),
				];
				let ele = {
					let mut rng = rand::thread_rng();
					*choices.choose(&mut rng)
						.unwrap_or(&Playtype::Updown)
				};

				self.game.ruleset.active = ele;
				clients.ev_send_to_all(EverythingPlaytype(ele)).await;
			}
		}

		if !self.game.should_end() && self.game.round_ended() {
			self.game.update_round_results();
			self.start_round(clients).await;
		}
	}

	async fn handle_announce(&mut self, clients: &mut ClientHandler, pt: Playtype, misere: bool) {
		self.roundstate = RoundState::Playing;

		self.game.announce(pt, misere);
		clients.ev_send_to_all(Announce(pt, misere)).await;

		if let Some(plr) = self.game.player_with_marriage() {
			let team = self.game.players[plr].team_id;
			if self.game.marriage_would_win(team) {
				clients.ev_send_to_all(HasMarriage(plr)).await;
			}
		}
	}

	async fn announce(&mut self, clients: &mut ClientHandler, pt: Playtype, misere: bool, plr_id: usize) {
        if self.game.can_announce(plr_id) && self.game.legal_announcement(pt, misere) {
			self.handle_announce(clients, pt, misere).await;
        }
    }

	async fn pass(&mut self, clients: &mut ClientHandler, plr_id: usize) {
		if self.game.can_pass(plr_id) {
			self.game.pass();
			clients.ev_send_to_all(Pass).await;
		}
	}

	async fn play_show(&mut self, _clients: &mut ClientHandler, show: Show, plr_id: usize) {
        if !self.game.can_show(plr_id) { return; }
        if let Err(_) = self.game.players[plr_id].hand.has_show(show) { return; }
        if self.game.players[plr_id].shows.iter().any(|s| *s == show) { return; }

		self.game.play_show(show, plr_id);
	}

	async fn bid(&mut self, clients: &mut ClientHandler, bid: i32, plr_id: usize) {
		if !self.game.can_bid(plr_id) { return; }
		self.game.bid(bid);
		clients.ev_send_to_all(Bid(bid)).await;
	}
}

#[async_trait]
impl ServerRoom<Event> for JassRoom {
	type Err = GameError;

	async fn start(&mut self, clients: &mut ClientHandler) -> Result<(), Self::Err> {

		let ranking = self.game.rank_teams();
		self.game = Game::new( self.game.setting.clone() );

		let annplr = if self.starts == 0 || self.game.setting.apply_startcondition_on_revanche {
            self.get_first_announceplayer()
        } else {
            let mut rng = rand::thread_rng();
			let worst_tid = ranking.last().unwrap_or(&0);

			*self.game.get_players_of_team(*worst_tid)
				.choose(&mut rng)
				.unwrap_or(&0)
		};

		self.game.announce_player = annplr;
		self.game.current_player = self.game.announce_player;
		self.starts += 1;

		clients.ev_send_to_all(StartGame(self.game.announce_player)).await;
        self.start_round(clients).await;
		Ok(())
	}

	async fn on_enter(&mut self, clients: &mut ClientHandler, plr_id: usize) {
		if self.starts > 0 {
			let game = self.game.public_clone();
            let hand = self.game.players[plr_id].hand;
            let shows = self.game.players[plr_id].shows.clone();
            clients.ev_send_to(plr_id, GameState(game, hand, shows)).await;
		} else {
			let setting = self.game.setting.clone();
			clients.ev_send_to(plr_id, GameSetting(setting)).await;
		}
	}
	async fn on_leave(&mut self, _clients: &mut ClientHandler, _plr_id: usize) {}

	async fn on_event(&mut self, clients: &mut ClientHandler, event: Event, plr_id: usize)
				-> Result<(), Self::Err>
	{
		if self.starts == 0 {
			return Ok(());
		}

		match event {
			PlayCard(card) => self.play_card(clients, card, plr_id).await,
			Announce(pt, misere) => self.announce(clients, pt, misere, plr_id).await,
			Pass => self.pass(clients, plr_id).await,
			PlayShow(show) => self.play_show(clients, show, plr_id).await,
			Bid(bid) => self.bid(clients, bid, plr_id).await,
			_ => {},
		}
		Ok(())
	}

	fn get_player_bound(&self) -> (usize,usize) {
		let n = self.game.setting.num_players;
		(n, n)
	}
	fn should_end(&self) -> bool { self.game.should_end() }
}
