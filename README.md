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

## Handling the AI-part

First you have to gather your own data of rounds by simply playing some games. Note that you have to create a log folder outside of this repository. Do this as following:
```
mkdir ../log
```
After playing a ton of rounds. You can start training a model with:
```
python3 server/server.py -train
```
*(The train stands for training, not the vehicle -.-)*

The AI should now work and play.

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
