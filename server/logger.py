# Logger class for saving round-logs

import time
import os

class Logger:
    def __init__(self):
        self.filename = "" # name/path to the log-file
        self.doLog = os.path.exists("../log")

    # Creates a new file to save the logs into
    def newLog(self):
        self.filename = time.strftime("%d-%m-%Y_%H:%M:%S") + ".dat"

    # Appends data to the current log
    def log(self, data):
        if not self.doLog: return
        file = open("../log/{0}".format(self.filename), "a")
        file.write(data)
        file.close()

    # to save: what playtype? who announced that? is it misere? is it passed?
    # This data can be saved in one byte
    def announce(self, playtype, annplr, misere, passed):
        byte = chr( (passed << 7) + (misere << 6) + (annplr << 4) + playtype )
        self.log( byte )

    # We just need the order the cards got played, we can calculate who played this cards
    # Cards can be stored as one byte
    def card(self, crd):
        self.log( chr( (crd.col << 4) + crd.num ) )

    # We need to save the show, else we can't know if someone didn't show something even tough he could've.
    # Shows can be stored in one byte, but the encoding and decoding is a bit nasty
    # For now, shows are stored in 2 bytes
    def show(self, s):
        self.log( chr( (s.col << 4) + s.num ) )
        self.log( chr( s.row ) )
