# All utility functions and classes about cards

import random
from utils import *

class Card:
    def __init__(self, col=0, num=0):
        self.col = col
        self.num = num

    def getID(self):
        return (self.col*9 + self.num)

    def __eq__(self, object):
        return (self.col == object.col and self.num == object.num)

def parseCard(byte):
    return Card(byte >> 4, byte % 16)

# Structure that saves a list of cards within one number
class Cardlist:
    def __init__(self, cardlist=[]):
        self.list = 0
        for card in cardlist: self.addCard(card)

    def hasCard(self, card=Card):
        return bool(1 & self.list >> card.getID())

    def addCard(self, card=Card):
        self.list |= 1 << card.getID()

    def removeCard(self, card=Card):
        self.list &= ~(1 << card.getID())

    def clear(self):
        self.list = 0

    def toBytes(self):
        return toBytes( self.list, 5 )

    # Convert to [ Card, Card ... ]
    def toList(self):
        out = []
        for i in range(36):
            if 1 & self.list >> i: out.append( Card(i // 9, i % 9) )

        return out

# Generates 4 Cardlist's of 9 cards for the players
def generateHands():
    # This syntax is cursed, but it makes the code shorter, so...
    cards = [ Card( i // 9, i % 9 ) for i in range(36) ] # Generate all cards
    random.shuffle( cards ) # Shuffle the cards
    return [ Cardlist( cards[i:i+9] ) for i in range(0,36,9) ] # Return all Cardlist's

# Determines the number of points of the card
def getPoints(card, playtype):
    if playtype == UPDOWN or playtype == SLALOM_UPDOWN or playtype == GUSCHTI:
        return [0, 0, 8, 0, 10, 2, 3, 4, 11][ card.num ]
    if playtype == DOWNUP or playtype == SLALOM_DOWNUP or playtype == MARY:
        return [11, 0, 8, 0, 10, 2, 3, 4, 0][ card.num ]

    return [0, 0, 0,
            (card.col == playtype-2)*14, # the Trumpf-9 gives 14 Points
            10,
            2 + (card.col == playtype-2)*18, # the Trumpf-Boy gives 20 Points,
            3, 4, 11][ card.num ]

# Determines whether a "card" is stronger than the "other"
def isStronger(card, other, ruletype):
    if card.col != other.col:
        return card.col == (ruletype-2)

    if ruletype == UPDOWN:
        return other.num < card.num
    if ruletype == DOWNUP:
        return card.num < other.num

    # Trumpf territory ---
    if card.col != ruletype-2:
        return other.num < card.num

    order = [0, 1, 2, 7, 3, 8, 4, 5, 6]
    return order[ other.num ] < order[ card.num ]
