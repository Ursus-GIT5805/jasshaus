use game_server::*;
use jasshaus_game::{server::*, setting::*, Event};

#[tokio::main]
async fn main() {
    Server::new("0.0.0.0:7999", "jasshaus")
		.unix_socket("/tmp/jasshaus_sock")
		.build::<Setting, Event, JassRoom>()
		.await;
}
