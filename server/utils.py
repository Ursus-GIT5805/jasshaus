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

# ---

# Convert an integer to decoded bytestring
def toBytes( number, len ):
    bytes = number.to_bytes(len, 'big')
    out = ""
    for b in bytes: out += chr(b)
    return out

DEV_MODE = False
