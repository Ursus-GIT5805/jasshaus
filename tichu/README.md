# Tichu

## Development

Use `make cont` to serv the website on `localhost:8000`.
Use `make serv` to run the WebSocket server.

You can run `cont` and `serv` simultaneously by running `make run`.

`game/` contains the game logic (and the server side logic in `src/server.rs`).
`content/` contains the website.

Note that several files are just taken from the Jass repo.

### WASM

Some functions are provided through the WASM module.
The methods provided by the module can found by running `make doc`,
which creates the doc of the `game/` library.

## Dependencies for Debugging

- `rsync` _(used for copying/updating build files)_
- `python3 -m http.server` _(used to serve the website on localhost)_
