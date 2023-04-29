# All infos and data about a player at a table

import card

class Player:
    def __init__(self, socket=None, connected=False):
        self.socket = socket 
        self.connected = connected
        self.name = ""
        self.useMic = False
        self.isBot = False
        self.agreed = False

        self.cards = card.Cardlist() # The current hand
        self.startcards = card.Cardlist()
        self.marriage = 2 # How many cards from the marriage the player must play. If = 0, then the player must've played both marriage cards.'

    def getData(self, id):
        return chr( (self.isBot << 3) + (self.useMic << 2) + id ) + self.name

    # Checks with the current turn, if the given card is legal to play
    def legalCard(self, crd, ruletype, turncolor, bestcard):
        if not self.cards.hasCard( crd ): return False
        if turncolor == -1: return True

        hand = self.cards.toList()

        numCols = [0, 0, 0, 0]
        for c in hand: numCols[ c.col ] += 1

        # All the extra rules from trumpf
        if 1 < ruletype and ruletype < 6:
            if turncolor != ruletype-2 and crd.col == ruletype-2:
                # Rule: you can't play a weaker trumpf than on the board
                # You can play it if you have no other choice
                return card.isStronger(crd, bestcard, ruletype) or hand.__len__() == numCols[ ruletype-2 ] 

            if turncolor == ruletype-2 and crd.col != ruletype-2 and numCols[turncolor] > 0:
                # Rule: If the boy is your only trumpf, you mustn't play it
                return (numCols[turncolor] == 1 and
                        self.cards.hasCard( card.Card(turncolor, 5) ) )

        # Rule for updown/downup
        return crd.col == turncolor or numCols[ turncolor ] == 0

    # Returns whether the player has the show
    def hasShow(self, show):
        if (show.row < 1 or 9 < show.row) or show.row == 2: return False # Illegal shows aren't accepted
        # If the last card does not exist, it's obv. illegal (e.g starting any King you have a row of 4)
        if show.row != 1 and show.num + show.row > 9: return

        cards = self.cards.list

        # Do bitmasks with the cardlist to check for it's legality!
        if show.row == 1:
            mask = 0x0008040201 << show.num
            return (cards & mask) == mask

        sp = 1 << (show.col*9 + show.num)

        # The mask looks something like this: ...00011100...
        mask = (sp << show.row) - sp

        if (cards & mask) != mask: return False

        # Verify that it isn't a subset of another show the player could show
        if show.num > 0:
            if (cards & (mask >> 1)) == (mask >> 1): return False

        if show.num + show.row == 9: return True

        return (cards & (mask << 1)) != (mask << 1)

    def hasMarriage(self, playtype):
        if playtype < 2 or 5 < playtype: return False # Terminate if it isn't trumpf
        queen = self.cards.hasCard( card.Card( playtype-2, 6 ) )
        king  = self.cards.hasCard( card.Card( playtype-2, 7 ) )
        return (self.marriage - queen - king) == 0

    # Setup all variables not regarding his game-variables
    def connect(self, socket):
        self.socket = socket
        self.connected = True
        self.isBot = False

    # Resets all variables not regarding his game-variables
    def disconnect(self):
        self.connected = False
        self.revanche = False
        self.name = ""
        self.socket = None
        self.useMic = False

    # Send data via websocket
    async def send(self, head, data):
        if not self.connected: return

        try:
            await self.socket.send( str(head + data) )
        except Exception as e:
            print( "Error! Error while sending data to player!" )
            print( e.with_traceback( None ) )
