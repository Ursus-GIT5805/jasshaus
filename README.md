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
sudo pip3 install -r requirements.txt
```

---

## Running it on your computer

You want to change the 8th line of `content/js/utils.js` to the path to `jasshaus/content`, if you want to move between different sites.

Simply run in the main folder:
```
python3 server/server.py -dev
```
After that open `content/game.html` in a browser and have some fun.