use clap::{Parser, Subcommand};

use std::error::Error;
use std::io::prelude::*;
use std::os::unix::net::UnixStream;
use std::path::PathBuf;

use game_server::room::*;

#[derive(Subcommand)]
enum Commands {
	Close { room_id: RoomID },
	List,
}

#[derive(Parser)]
struct Cli {
	#[command(subcommand)]
	command: Commands,

	#[arg(long, default_value_t = String::from("default"))]
	server: String,
}

use ServerAnswer::*;
use ServerRequest::*;

fn main() -> Result<(), Box<dyn Error>> {
	let cli = Cli::parse();

	let request = match cli.command {
		Commands::Close { room_id } => CloseRoom(room_id),
		Commands::List => ListRooms,
	};

	let packet = bincode::serialize(&request).unwrap();
	let path = {
		let mut pathbuf = PathBuf::from(".");
		pathbuf.push(cli.server);
		pathbuf.into_os_string()
	};

	let mut stream = UnixStream::connect(path)?;
	stream.set_read_timeout(None)?;
	stream.write_all(&packet)?;

	let mut response = vec![0; 4096];
	stream.read(&mut response)?;

	let answer: ServerAnswer = bincode::deserialize(&response)?;

	match answer {
		Successful => println!("Success!"),
		Unsuccessful => eprintln!("Error happened while doing operation!"),
		RoomList(rooms) => {
			let infos: Vec<_> = rooms
				.iter()
				.map(|room| {
					let plrs = room.players.join(", ");
					format!("{}: {}", room.id, plrs)
				})
				.collect();

			let out = infos.join("\n");
			println!("{}", out);
		}
	}

	Ok(())
}
