# Tichu

## Development

Use `make cont` to serv the website on `localhost:8000`.
Use `make serv` to run the WebSocket server.

`game/` contains the game logic (and the server side logic in `src/server.rs`).
`content/` contains the website.

Note that several files are just taken from the Jass repo.

### WASM

Some functions are provided through the WASM module.
The methods provided by the module can found by running `make doc`,
which creates the doc of the `game/` library.


### Branches

This is a branch of my Jass repo. There are several Symlinks to the Jass-sites resources which
I was able to reuse nicely.

If you need to change a file from the Jass repo: **Do not commit any change to the Jass website on this branch.**
Instead, send a PR to the main branch and I will merge it.

## Contributing

**Send a PR with your changes.**

This is still a broken and early version of this repo, so you're allowed to commit
breaking changes.

## Dependencies for Debugging

- `rsync` _(used for copying/updating build files)_
- `python3 -m http.server` _(used to serve the website on localhost)_
