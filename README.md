# Jasshaus

A german Jass-website inclusive Websocket-server. Now rewritten in Rust.


## Simple usage

Run the following to compile the website and the server and run a local http-server serving the `content` directory.

```
make run
```

Don't forget to have `cargo` installed.

## Infos regarding running it on the server

If you want to run this program on a server, you have to do the following:

* Choose a webserver (e.g. Nginx, Apache)
* Create SSL-Certificates (and use it for the webserver)
* Create a reverse proxy to redirect the http upgrades (for the websockets) to port 127.0.0.1:7999/ws
* Then run the server manually or as a service.
