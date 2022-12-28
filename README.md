# Jasshaus
A german Jass-website inclusive Websocket-server. It exists only to play "Schieber".

---

**This program only got tested on a Linux-system. It may be uncompatible with other operating-systems!**

---
## Required packages

You have to install Python. Version 3.8.10 works, other versions may not work. Also be sure that you have pip3 installed.

### Linux

To install all required python-packages run in the main folder:
```
pip3 install -r requirements.txt
```

---

## Running it on your computer

Simply run in the main folder:
```
python3 server/server.py -dev
```
After that open `content/index.html` in a browser and have some fun.

---

## Infos regarding running it on the server

If you want to run this program on a server, you have to do the following:

* Choose a webserver (e.g. Nginx, Apache)
* Create SSL-Certificates (and use it for the webserver)
* Create a reverse proxy to redirect the wss://-protocol to port 7999
* Run `python3 server/server.py` as either a service or manually
