function get_fetch_url() {
	let local = window.location.protocol == "file:" || window.location.protocol == "http:";
	if(local) return "http://" + location.hostname + ":7999/rooms";
	return location.host + "/rooms";
}

const FETCH_URL = get_fetch_url();

function enter_room(id) {
	saveSettings();
	window.location.assign("game.html?room=" + id);
}

async function request_new_room(data) {
	let response = await fetch(FETCH_URL, {
		method: "POST",
		body: JSON.stringify(data),
	});

	console.log(response);

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
	let rooms = await fetch_rooms();

	let eles = rooms.map((room) => {
		let ele = $('<div>').addClass("Room");
		let join = $('<button>')
			.text("Beitreten")
			.click(() => enter_room(room.id));


		let ratio = room.players.length + "/" + room.max_players;

		let text = "Partie " + room.id + " (" + ratio + ")";

		let title = $('<h2>').text(text);
		let names = $('<p>').text( room.players.join(", ") );

		ele.append(title)
			.append(names)
			.append( $('<p>').html(join) );

		return ele;
	});

	if(eles.length > 0) {
		$("#rooms").html(eles)
	} else {
		$("#rooms").text("No open room found.")
	}
}

function afterModule() {
	let gameForm = createGameSettingForm();

	$("#gameSettings").append( gameForm.ele );
	$("#createRoom").click(() => {
		let result = gameForm.get();
		request_new_room(result);
	});
	$("#manualRoomEnter").click(() => {
		let id = $("#roomInput").val();
		enter_room(id);
	})

	setupSettings();
	update_rooms();
}
