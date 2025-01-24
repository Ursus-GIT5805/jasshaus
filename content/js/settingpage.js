var form = null;

window.onload = (e) =>  {
	let def = getSettings();
	form = createForm("Einstellungen", JasshausForm, def);
	$("#settings").append( form.ele );
}

document.getElementById("quitButton").onclick = (e) => {
	let string = JSON.stringify(form.get());
	localStorage.setItem(LOCALSTORAGE_KEY, string);
};
