# Names of the playtypes ---

UPDOWN = 0
DOWNUP = 1

SHIELD = 2
ACORN = 3
ROSE = 4
BELL = 5

SLALOM_UPDOWN = 6
SLALOM_DOWNUP = 7

GUSCHTI = 8
MARY = 9

PASS = 10

# Game states ---

GAME_ENTERING = 0 # Players are entering the game
GAME_TEAMMATE_CHOOSING = 1 # Players are choosing their teammate
GAME_PLAYING = 2 # The fun is happening
GAME_END = 3 # The game is finished

# ---

# Convert an integer to decoded bytestring
def toBytes( number, len ):
    bytes = number.to_bytes(len, 'big')
    out = ""
    for b in bytes: out += chr(b)
    return out

def playtypeName(pt, misere=False, passed=False):
    name = ["Obenabe", "Undeufe", "Schilte", "Eichle", "Rose", "Schelle", "Slalom Obenabe", "Slalom Undeufe", "Guschti", "Mary"][pt]
    return ["", "Misere: "][misere] + name + ["", " Geschoben"][passed]

DEV_MODE = False
