use axum::extract::ws::{Message, WebSocket};
use futures::stream::SplitSink;
use futures::SinkExt;
use serde::Serialize;

use std::ops::{Deref, DerefMut};
use std::collections::HashMap;

use crate::socket_message::*;

pub type WsWriter = SplitSink<WebSocket, Message>;

pub struct Client {
    pub name: String,
    pub player_id: usize,
	pub vote: Option<usize>,
	pub ws: WsWriter,
}

impl Client {
    pub fn new(player_id: usize, ws_tx: WsWriter) -> Self {
        Client {
            name: String::new(),
            player_id,
			vote: None,
            ws: ws_tx,
        }
    }

    pub async fn send<T: Serialize>(&mut self, data: T) {
        let jsonstr = serde_json::to_string(&data).unwrap();
        let msg = Message::Text(jsonstr.into());

        if let Err(e) = self.ws.send(msg).await {
            eprintln!("Error sending data: {:?}", e);
        }
    }

	pub async fn close(&mut self) {
		match self.ws.close().await {
			Ok(_) => {},
			Err(e) => eprintln!("Could not close socket: {}", e),
		}
	}
}


#[derive(Default)]
pub struct ClientHandler {
	client_next: usize,
    pub clients: HashMap<usize, Client>,
}

impl ClientHandler {
	pub fn register(&mut self, plr_id: usize, ws_tx: WsWriter) -> usize {
		let id = self.client_next;
		self.client_next += 1;
        self.clients.insert(id, Client::new(plr_id, ws_tx));
		id
	}

	// General Sending

	pub async fn send_to<T>(&mut self, client_id: usize, data: T)
	where T: Serialize + Clone
	{
        if let Some(client) = self.clients.get_mut(&client_id) {
            client.send(data).await;
        }
    }

    pub async fn send_to_all_except<T>(&mut self, client_id: usize, data: T)
	where T: Serialize + Clone
	{
        for (id, client) in self.clients.iter_mut() {
            if *id == client_id { continue; }
            client.send(data.clone()).await;
        }
    }

    pub async fn send_to_all<T>(&mut self, data: T)
	where T: Serialize + Clone
	{
        for (_, client) in self.clients.iter_mut() {
            client.send(data.clone()).await;
        }
    }

	// Event Sending

	/// Send an event to everyone
    pub async fn ev_send_to_all<T>(&mut self, data: T)
	where T: Serialize + Clone
	{
		self.send_to_all(SocketMessage::<T>::Event(data)).await;
	}

	/// Send an event to only one player (not client)
    pub async fn ev_send_to<T>(&mut self, plr_id: usize, data: T)
	where T: Serialize + Clone
	{
		let ev = SocketMessage::<T>::Event(data);
        for (_, client) in self.clients.iter_mut() {
            if client.player_id == plr_id {
				client.send(ev.clone()).await;
			}
        }
    }

	/// Send an event to all players, except the one with the given plr_id
    pub async fn ev_send_to_all_except<T>(&mut self, plr_id: usize, data: T)
	where T: Serialize + Clone
	{
		let ev = SocketMessage::<T>::Event(data);
        for (_, client) in self.clients.iter_mut() {
            if client.player_id == plr_id { continue; }
            client.send(ev.clone()).await;
        }
    }
}

impl Deref for ClientHandler {
    type Target = HashMap<usize,Client>;

    fn deref(&self) -> &Self::Target {
        &self.clients
    }
}

impl DerefMut for ClientHandler {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.clients
    }
}
