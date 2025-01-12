use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
#[derive(Default, std::fmt::Debug)]
#[derive(PartialEq, Eq, Clone, Copy)]
pub enum Votingtype {
    #[default]
    NONE, // Standard, there is no vote
    //STARTGAME,
    REVANCHE, // For another game
    //KICK(u8), // Kick a player
    //REPLACE(u8), // Kick and replace a player with a bot
}

#[derive(std::fmt::Debug)]
#[derive(Serialize, Deserialize)]
#[derive(PartialEq, Eq, Clone, Copy)]
pub enum Vote {
    NONE,
    AGREE,
    DECLINE,
    NEUTRAL,
}

#[derive(Serialize, Deserialize)]
#[derive(Clone)]
pub struct Votinghandler<Votetype>
where Votetype: PartialEq + Clone + Default {
    pub ready: usize,
    pub subject: Votetype,
    pub vote: Vec<Vote>,
}

impl<Votetype> Votinghandler<Votetype>
where Votetype: PartialEq + Clone + Default {
    pub fn new(num_players: usize) -> Self {
        Votinghandler {
            ready: 0,
            subject: Votetype::default(),
            vote:  vec![Vote::NONE; num_players],
        }
    }

    pub fn set_vote(&mut self, client_id: usize, vote: Vote) {
        self.ready += (self.vote[client_id] == Vote::NONE && vote != Vote::NONE) as usize;
        self.vote[client_id] = vote;
    }

    pub fn agree(&mut self, client_id: usize) {
        self.set_vote(client_id, Vote::AGREE);
    }

    pub fn decline(&mut self, client_id: usize) {
        self.set_vote(client_id, Vote::DECLINE);
    }

    pub fn all_ready(&self) -> bool {
        self.ready == self.vote.len()
    }

    pub fn is_accepted(&self) -> bool {
        let mut sum: isize = 0;
        for i in 0..4 {
            sum += match self.vote[i] {
                Vote::AGREE => 1,
                Vote::DECLINE => -1,
                _ => 0,
            };
        }
        sum > 0
    }

    pub fn set_subject(&mut self, subject: Votetype) {
        self.ready = 0;
        self.subject = subject;
        self.vote = vec![Vote::NONE ;self.vote.len()];
    }
}
