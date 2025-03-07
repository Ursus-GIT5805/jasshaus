import init, { get_gamesettingform, playtype_from_id, setting_schieber } from "./pkg/jasshaus_game.js";
import { get_pt_name } from "./jass.js";
import { createForm } from "./formcreator.js";
import { get_setting_form, save_jass_setting } from "./jasssettings.js";
import { getClientSettingForm, save_client_setting } from "./clientsetting.js";

function get_fetch_url() {
	let local = window.location.protocol == "file:" || window.location.protocol == "http:";

	if(local) return `http://${location.hostname}:7999/rooms`;
	return `${location.origin}/rooms`;
}

const FETCH_URL = get_fetch_url();

function enter_room(id: number | string) {
	// saveSettings();
	window.location.assign(`game.html?room=${id}`);
}

async function request_new_room(data: any) {
	let response = await fetch(FETCH_URL, {
		method: "POST",
		body: JSON.stringify(data),
	});

	if(response.status == 200) {
		let id = await response.text();
		enter_room(id);
	} else {
		$("#settingInfo").text("Error occured while creating room. Please recheck if you have entered realistic rules.");
	}
}

async function fetch_rooms() {
	let response = await fetch(FETCH_URL, {
		method: "GET",
	});

	if(response.status == 200) {
		let res = await response.json();
		return res;
	}
}

async function update_rooms() {
	let rooms = undefined;

	try {
		rooms = await fetch_rooms();
	} catch(e) {
		$("#rooms")
			.text("Could not connect to server!")
			.addClass("Error");
		return;
	}

	let eles = rooms.map((room: any) => {
		let ele = $('<div>').addClass("Room");
		let join = $('<button>')
			.text("Beitreten")
			.click(() => enter_room(room.id));

		let ratio = `${room.players.length}/${room.max_players}`;
		let text = `Raum ${room.id} (${ratio})`;

		let title = $('<h2>').text(text);
		let names = $('<p>').text( room.players.join(", ") );

		ele.append(title)
			.append(names)
			.append( $('<p>').append(join) );

		return ele;
	});

	$("#rooms").removeClass("Error");
	if(eles.length > 0) {
		$("#rooms").html(eles);
	} else {
		$("#rooms").text("No open room found.");
	}
}


export function createGameSettingForm(): object {
	let formdata = JSON.parse( get_gamesettingform() );
	formdata['#title'] = "Spieleinstellungen";
	formdata['playtype']['#type']['#movable'] = false;
	formdata['playtype']['#type']['#resizable'] = false;
	formdata['playtype']['#type']['#id'] = "playtypes";

	formdata['point_recv_order']['#type']['#resizable'] = false;
	formdata['point_recv_order']['#type']['#list']['#disabled'] = true;

	let form = createForm(formdata, "Form", setting_schieber());

	if(form.ele) form.ele.find("#playtypes")
		.children().eq(1).children()
		.each((i: number, ele: any) => {
			let pt = playtype_from_id(i);
			if(pt === undefined) return;

			let pt_name = get_pt_name(pt) || "";

			let name = $("<div>").text(pt_name).addClass("Title")[0]
			ele.children[1].prepend( name );
		});


	return form;
}

window.onload = async () => {
	await init(); // init WASM

	let client = getClientSettingForm();
	let game = get_setting_form();

	window.onbeforeunload = () => {
		save_client_setting(client.get());
		save_jass_setting(game.get());
	}

	if(client.ele) $("#settings").append( client.ele );
	if(game.ele) $("#settings").append( game.ele );

	let gameForm: any = createGameSettingForm();

	$("#gameSettings").append( gameForm.ele );
	$("#createRoom").click(() => {
		let result = gameForm.get();
		request_new_room(result);
	});
	$("#manualRoomEnter").click(() => {
		let id = $("#roomInput").val();
		if(typeof id === 'string' || typeof id === 'number') {
			 enter_room( id );
		}
	})

	update_rooms();
}
