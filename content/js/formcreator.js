function createInput(entry) {
	let input = $("<input>");
	if(entry['type'] == "select") {
		input = $("<select>");
		for(let opt of entry['options']) {
			if(typeof opt === 'string') {
				input.append( $("<option>").text(opt) );
				continue;
			}

			input.append( $("<option>").attr("value", opt[0]).text(opt[1]) );
		}
	}

	let blacklist = ['title', 'options', 'description'];
	for(let key in entry) {
		if(blacklist.includes(key)) continue;
		input.attr(key, entry[key]);
	}

	return input;
}

/// Creates a form
/// Returns a list [form, getter], where 'form' is the element containing all fields
/// and 'getter' is a function which returns the current form.
/// You can give 'def' as a second argument which contains default values of the form.
function createForm(obj, def=null) {
	let form = $("<form>");
	let getters = {};

	for(let key in obj) {
		let entry = obj[key];

		let div = $('<div>');
		let label = $("<label>").text(entry['title'] + ": ");
		let input = createInput(entry);

		if(def && def.hasOwnProperty(key)) {
			if(entry['type'] === 'checkbox') input.prop("checked", def[key]);
			else input.val(def[key]);
		}

		div.append( $("<div>").append(label).append(input) );

		if('description' in entry) {
			div.append( $("<div>").append( $("<i>").text("(" + entry['description'] + ")")) );
		}

		form.append(div);

		let handler = () => input.val();
		if(entry['type'] === 'checkbox') handler = () => input.is(":checked");
		getters[key] = handler;
	}

	let getter = () => {
		let out = {};
		for(let key in getters) out[key] = getters[key]();
		return out;
	};

	return [form, getter];
}
