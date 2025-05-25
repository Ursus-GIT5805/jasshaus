export function construct_fetch_url(port: number) {
	let local = window.location.protocol == "file:" || window.location.protocol == "http:";

	if(local) return `http://${location.hostname}:${port}/rooms`;
	return `${location.origin}/rooms`;
}

export function enter_room(id: number | string) {
	window.location.assign(`game.html?room=${id}`);
}

export async function request_room(url: string, data: any): Promise<Response> {
	let response = await fetch(url, {
		method: "POST",
		body: JSON.stringify(data),
	});

	return response;
}

export async function get_rooms(url: string) {
	let response = await fetch(url, {
		method: "GET",
	});

	return await response.json();
}
