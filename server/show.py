# All utility and classes about shows

from utils import *

class Show:
    def __init__(self, col, num, row):
        self.col = col
        self.num = num
        self.row = row # How many in a row

# Remarks regarding shows
#
# row = 1: four equals
# row = 2: Marriage, but only the server shows it
# Marriage is the pair of trumpf-queen and trumpf-king and gives 20p

def compress(show, plr):
    b1 = (show.col << 4) + show.num
    b2 = (plr << 4) + show.row

    return toBytes( (b1 << 8) + b2, 2 )

# Returns the number of points of the show
def getPoints(show):
    # Rule: all 9 give 150p and all boys give 200p
    return [ 0, 100 + (show.num == 3)*50 + (show.num == 5)*100,
             20, 20, 50, 100, 150, 200, 250, 300
           ][show.row]

# Determines whether a "show" is stronger than the "other"
def isStronger(show, other, playtype):
    # The one with more points is stronger
    p1 = getPoints(show)
    p2 = getPoints(other)
    if p1 != p2: return p2 < p1

    # The one with more cards is stronger
    p1 = show.row
    p2 = other.row # + 3*(other.row == 1) !! This is superfluous
    if p1 != p2: return p2 < p1

    # The one with a higher number (lower in downup) is stronger
    p1 = show.num
    p2 = other.num
    if p1 != p2:
        if playtype == DOWNUP or playtype == SLALOM_DOWNUP or playtype == MARY: p1, p2 = p2, p1
        return p2 < p1

    # The only case left when the show is stronger: It's the trumpf-color
    return show.col == playtype-2