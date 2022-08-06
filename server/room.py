# A room consists up to 4 players and the game itself

import random

import player
import card
import show
import logger
from utils import *

class Room:
    def __init__(self):
        # Socket and players
        self.players = []
        for i in range(4): self.players.append( player.Player() )

        self.revanche = 0 # The number of players who agreed to a revanche
        self.numPlayers = 0 # Number of connected players
        self.gamestate = 0 # 0: before game, 1: in game, 2: game ended
        self.mate = [-1, -1, -1, -1] # The favorite mate chosen by the players
        self.order = [0, 1, 2, 3]

        # Gameplay variables
        self.goal = 1000 # The goal of the game is to reach 1000 points
        self.points = [0, 0] # The points of the teams

        self.annplr = 0 # The player who can announce first

        # Round data
        self.playtype = -1 # The ruleset of a round | -1: not announced yet
        self.ruletype = 0 # The ruleset of the current turn
        self.misere = False
        self.passed = False
        self.turnWins = [0, 0] # Number of turns a team has won (i.e the team had the "bestcard")
        self.gp = [0, 0] # The number of points currently won by a team (only used for "sendState")
        self.sp = [0, 0] # The number of points gotten by shows this round
        self.shows = [[], []] # The shows a player announced (sorted by his team)
        self.shwown = [[], []] # The owner of each show in "shows"
        self.bestshow = (-1, -1) # The (team, index) of the current best show
        self.turn = 1
        self.playercards = ""

        self.cardsT = [card.Cardlist(), card.Cardlist()] # Saving all the cards which the first team won on turns

        self.log = logger.Logger() # For logging rounds

        # Turn data
        self.curplr = 0
        self.bestcard = card.Card(4, 2) # The best card currently
        self.playedcards = [] # All the cards currently being played
        self.bestplr = 0 # The player who owns "bestcard"
        self.turncolor = -1 # The color which must be played
        self.playedvalue = 0 # The value of all the played cards this turn

    # Websocket handling
    async def register(self, socket):
        id = -1

        # Find a place for the new player
        for i in range(4):
            if not self.players[i].connected:
                self.players[i].connect(socket)
                id = i
                break

        if id != -1: # There is a place free!
            await self.players[id].send( '\x0B', toBytes(id, 1) )
            await self.sendMsg( "Guten Tag!", 1, id )
            self.numPlayers += 1

            for i in range(4):
                if i == id: continue
                if self.players[i].connected: # Send all the names of the player to the new player
                    useMic = self.players[i].useMic
                    await self.players[id].send( '\x04', chr( (useMic << 2) + i ) + self.players[i].name )

            if self.numPlayers == 4:
                if self.gamestate == 0: # Start the game if not started
                    await self.send( '\x0E', '\x04' )
                else: # The has already been started, send him the current state instead
                    await self.sendState( id )

        print(id)

        for i in range(4):
            if self.order[i] == id: return i

        return -1

    async def unregister(self, id):
        id = self.order[id]

        if self.gamestate == 2 and self.players[id].revanche:
            await self.send( '\x05', '\x01' ) # If the player left with agreeing to a revanche

        await self.send( '\x10', toBytes(id, 1) )
        self.players[id].disconnect()
        self.numPlayers -= 1

    # Gameplay functions ---

    async def generateCards(self, send=True):
        hands = card.generateHands()
        self.playercards = ""
        for h in hands: self.playercards += h.toBytes()

        for i in range(4):
            self.players[i].cards = hands[i]
            if send: await self.players[i].send( '\x0C', hands[i].toBytes() )

    async def startGame(self):
        self.gamestate = 1

        await self.send( '\x0E', '\x05' )
        await self.generateCards()

        # The player with the shield-10 begins
        for i in range(4):
            if self.players[i].cards.hasCard( card.Card(0, 4) ):
                self.annplr = i
                break

        await self.send( '\x0A', toBytes( self.annplr, 1 ) )

    # Resets all variables so a new round can be started
    def resetRound(self):
        self.playtype = -1
        self.ruletype = -1
        self.misere = False
        self.passed = False
        self.turnWins = [0, 0]
        self.gp = [0, 0]
        self.sp = [0, 0]
        self.shows = [[], []]
        self.shwown = [[], []]
        self.bestshow = (-1, -1)
        self.turn = 1

        for l in self.cardsT: l.clear()

        self.curplr = 0
        self.bestplr = 0
        self.turncolor = -1
        self.playedcards = []
        self.playedvalue = 0

        for i in range(4):
            self.players[i].marriage = 2

    # Checks whether a team has enough points to win the game and handles it if true
    async def checkEndgame(self):
        if self.gamestate == 2: return True # If the game has ended, no need to check

        res = -1
        for i in range(2):
            if self.goal <= self.points[i] + self.gp[i] + self.sp[i]:
                res = i

        if res == -1: return False
        # There is a winner of the game!
        self.annplr = random.randint(0,1)*2 + ((res+1) % 2)

        self.revanche = 0
        for i in range(4):
            self.players[i].revanche = False

        await self.send( '\x0E', '\x00' + self.cardsT[0].toBytes() + self.cardsT[1].toBytes() + self.playercards )
        self.resetRound()

        self.gamestate = 2 # Set state to "game ended"
        await self.send( '\x0E', toBytes( 1+res, 1 ) )

        return True

    # The rule: "marriage, show, win" -> the functions for the marriage
    async def handleMarriage(self):
        if self.playtype < 2 and 5 < self.playtype: return False # only in trumpf, of course

        for i in range(2):
            if self.points[i] + self.gp[i] + self.sp[i] + 20 < self.goal: continue

            for p in range(2):
                if not self.players[p+i*2].hasMarriage(self.playtype): continue

                # The player has the marriage and with this, his team wins the game
                await self.sendShow(show.Show(self.playtype-2, 6, 2), p+i*2)
                await self.checkEndgame()
                return True

        return False

    # Handle the end of a round
    async def handleEndround(self):
        # The last win get's another 5 points
        await self.sendPoints( 5, (self.bestplr+int(self.misere)) % 2 )

        # The shows are logged at the end of the file
        t, i = self.bestshow
        if t != -1:
            for s in self.shows[t]: self.log.show(s)

        # If a team won all 9 turns: 100 points extra!
        for i in range(2):
            if self.turnWins[i] == 9:
                await self.sendPoints( 100, (i+int(self.misere)) % 2 )

            self.points[i] += self.gp[i] + self.sp[i]

        self.gp = [0, 0] # Clear points
        self.sp = [0, 0]

        if await self.checkEndgame(): return # Game has ended: terminate

        await self.send( '\x0E', '\x00' + self.cardsT[0].toBytes() + self.cardsT[1].toBytes() + self.playercards )
        self.resetRound()

        self.annplr = (self.annplr + 1) % 4
        await self.generateCards( send=False )

    # Handle the and send all shows
    async def handleShows(self):
        t, i = self.bestshow
        if t != -1:
            for i in range(self.shows[t].__len__()):
                await self.sendShow(self.shows[t][i], self.shwown[t][i] )

    # Handle the end of a turn
    async def handleEndturn(self):
        self.curplr = self.bestplr
        self.turn += 1
        self.turncolor = -1
        self.turnWins[ self.bestplr % 2 ] += 1

        # Save all cards which the teams won. (for the roundSummary)
        for c in self.playedcards:
            self.cardsT[self.bestplr % 2].addCard( c )
        self.playedcards = []

        if self.turn == 2:
            await self.handleShows()

        # Rule: Showpoints before winpoints
        if await self.checkEndgame(): return

        await self.sendPoints( self.playedvalue, (self.bestplr+int(self.misere)) % 2 )
        self.playedvalue = 0

        if await self.checkEndgame(): return

        if self.turn < 10:
            if self.playtype == SLALOM_UPDOWN or self.playtype == SLALOM_DOWNUP:
                self.ruletype = (self.ruletype + 1) % 2 # Flip the direction on slalom
            elif (self.playtype == GUSCHTI or self.playtype == MARY) and self.turn == 5:
                self.ruletype = (self.ruletype + 1) % 2 # Flip the direction on the 5th turn

            # Handle Marriage at the beginning of a new turn
            if await self.handleMarriage(): return

            await self.sendCurrentplayer()
        else: # The round has ended!
            await self.handleEndround()

    # Input handling ---

    # Send a message to every player
    async def send(self, head, data):
        for i in range(4):
            await self.players[i].send( head, data )

    # Send to the players
    async def sendCurrentplayer(self):
        await self.send( "\x09", toBytes( self.curplr, 1) )

    # Sends the points and adjusts them to a team
    async def sendPoints(self, value, team):
        self.gp[team] += value
        await self.send( '\x0F', toBytes(value + (team << 9), 2) )

    # Sends a show to each player and add points
    async def sendShow(self, shw, plr):
        self.sp[plr % 2] += show.getPoints( shw )
        await self.send('\x01', show.compress(shw, plr) )

    async def sendMsg(self, msg, msgtype, plr):
        await self.send( '\x03', toBytes((msgtype << 2) + plr, 1) + msg )

    # A playtype is decoded into 1 byte
    # 0     | 0      | 00          | 0000
    # passed | misere | annplr's ID | playtype number
    async def announce(self, byte, plr):
        # Basic non-cheating check
        if self.playtype != -1: return
        if (plr != self.annplr and not self.passed) or (self.passed and plr != (self.annplr+2)%4): return

        self.playtype = byte % 16

        if self.playtype == PASS: # The player passed to his mate
            mate = (self.annplr + 2) % 4
            if self.passed: mate = plr # You can't pass twice in a row
            self.passed = True
            self.playtype = -1

            await self.sendMsg( "Ich schiebe!", 1, plr )
            # Add 4, so the player knows it is a passed announcement-making
            await self.send( '\x0A', toBytes(4 + mate, 1) )
            return

        self.misere = bool( 1 & byte >> 6 )
        self.playtype = byte % 16

        # The numbers in this list are the represent-number to a playtype
        self.ruletype = [0, 1, 2, 3, 4, 5, 0, 1, 0, 1][ self.playtype ]

        self.log.newLog()
        self.log.announce( self.playtype, self.annplr, self.misere, self.passed )

        bsend = (self.passed << 7) + (self.misere << 6) + (plr << 4) + self.playtype
        await self.send( '\x02', toBytes(bsend, 1) )

        if await self.handleMarriage(): return True

        self.curplr = plr
        if self.passed and 1 < self.playtype and self.playtype < 6:
            self.curplr = self.annplr

        await self.sendCurrentplayer()

    async def playCard(self, crd, plr):
        # Give the player trust issues, because they might be cheating
        if not self.players[plr].legalCard( crd, self.playtype, self.turncolor, self.bestcard ):
            print("Player[{}] wants to play a card he mustn't play!".format(plr))
            print( self.players[plr].cards.list )
            return

        # The player played fairly
        self.players[plr].cards.removeCard( crd )

        if self.playedcards.__len__() == 0:
            self.bestcard = crd
            self.bestplr = plr
            self.turncolor = crd.col
        elif card.isStronger( crd, self.bestcard, self.ruletype ):
            self.bestcard = crd
            self.bestplr = plr

        # Add the new card to the list
        self.playedcards.append( crd )

        # Log the card which got played
        self.log.card( crd )

        # Send the card to all players
        await self.send('\x00', toBytes( ((self.bestplr == plr) << 6) + (crd.col << 4) + crd.num, 1 ))

        self.playedvalue += card.getPoints( crd, self.playtype )

        # Determine the player which will play the next card
        self.curplr = (self.curplr + 1) % 4

        # Handle trumpf marriage
        self.players[plr].marriage -= (crd.num == 6 or crd.num == 7) and crd.col == self.playtype-2
        if self.players[plr].marriage == 0:
            await self.sendShow(show.Show(self.playtype-2, 6, 2), plr)
            self.players[plr].marriage = 2

        if self.playedcards.__len__() == 4: # The turn has come to an end
            await self.handleEndturn()
        else: # The turn goes on
            await self.sendCurrentplayer()

    async def input(self, head, data, plr):
        # Check that the header comes with the right number of bytes
        if data.__len__() < [1,2,1,1,1,0,1,0,0,1][head]:
            print("Error! Player sent to few bytes of data!")
            return

        plr = self.order[plr]

        if head == 0:
            if self.gamestate == 1:
                await self.playCard( card.parseCard( ord(data[0]) ), plr )
        elif head == 1: # A player has a show
            if self.playtype == -1 or self.turn != 1 or self.curplr != plr or self.gamestate != 1:
                print("Player wanted to show at a time he couldn't!")
                return

            data = [ ord( data[x] ) for x in range(2) ]
            shw = show.Show( data[0] >> 4, data[0] % 16, data[1] % 16 )
            if shw.row == 1: shw.col = 0 # For convenience

            # Give trust issues to the player
            for s in self.shows[ plr % 2 ]:
                if s.col == shw.col and s.num == shw.num and s.row == shw.row:
                    print("Player wanted to show something which has already been shown")
                    return

            if self.players[plr].hasShow(shw):
                t, i = self.bestshow

                # Determine if it's the new best show
                if t == -1 or show.isStronger( shw, self.shows[t][i], self.playtype ):
                    self.bestshow = ( plr % 2, self.shows[plr % 2].__len__() )

                self.shows[ plr%2 ].append(shw)
                self.shwown[ plr%2 ].append(plr)
                await self.sendMsg( str(show.getPoints(shw)), 1, plr )
            else:
                print("Player does not have show!")

        elif head == 2:
            if self.gamestate == 1:
                await self.announce( ord(data[0]), plr )
        elif head == 3:
            await self.send( '\x03', toBytes(plr, 1) + data )
        elif head == 4:
            name = filterString( data, [' ', '\n', '\ŧ', '<', '>', '"', '\'', '(', ')'], 16 )
            if name == "": name = "Unnamed"
            opt = plr
            self.players[plr].name = name
            await self.send( '\x04', toBytes(opt, 1) + name )
        elif head == 5:
            if self.gamestate != 2: return
            if self.players[ plr ].revanche: return # The player already agreed!

            self.revanche += 1
            self.players[ plr ].revanche = True

            await self.send( '\x05', '\00' )

            if self.revanche != self.numPlayers: return
            # All players agreed to a revanche

            self.resetRound()
            await self.send( '\x0E', '\x03' )
            await self.generateCards()
            self.points = [0, 0]
            self.gamestate = 1
            await self.send( '\x0A', toBytes( self.annplr, 1 ) )
        elif head == 6:
            dat = ord( data[0] )
            p = (dat >> 2) % 4
            h = (dat % 4) + (plr << 2)

            await self.players[p].send('\x06', toBytes(h, 1) + data[1:])
        elif head == 7:
            self.players[plr].useMic = True

            for i in range(4):
                if i == plr: continue
                await self.players[i].send('\x07', toBytes(plr, 1))
        elif head == 8:
            if self.gamestate != 1: return

            await self.players[plr].send( '\x0C', self.players[plr].cards.toBytes() )

            if self.playtype == -1:
                await self.players[plr].send( '\x0A', toBytes( self.annplr, 1 ) )
            else:
                await self.players[plr].send( '\x09', toBytes( self.curplr, 1) ) # When announced, send the currentplayer
        elif head == 9:
            if self.gamestate != 0: return
            if self.mate[plr] != -1: return

            self.mate[plr] = ord( data[0] ) % 4

            for m in self.mate:
                if m == -1: return # Terminate if a player hasn't chosen a mate yet

            order = []
            for i in range(4):
                m = self.mate[i]
                if i == m: continue # This player chose random

                if self.mate[m] == i or self.mate[ m ] == m:
                    # Construct order
                    order = [i, m]
                    order.append( (i + m + (min(i, m) == 0) + (min(i, m) == 0 and max(i, m) == 3)) % 4 )
                    order.append( 6 - i - m - order[2] )

                    order[1], order[2] = order[2], order[1]
                    break

            if order.__len__() == 0:
                order = [0, 1, 2, 3]
                random.shuffle( order )

            rOrd = [0, 0, 0, 0]
            for i in range(4): rOrd[ order[i] ] = i
            print( rOrd )

            self.players = [ self.players[ order[0] ], self.players[ order[1] ], self.players[ order[2] ], self.players[ order[3] ] ]

            self.order = rOrd
            compr = 0
            for i in range(4): compr += ( self.order[i] << (2*i) )
            await self.send( '\x08', toBytes( compr, 1 ) )

            await self.startGame()

    # Sends the entire state of the game to a player
    async def sendState(self, plr):
        state = ""

        # Points, gotPoints, showPoints of the teams
        for t in range(2):
            state += toBytes( self.points[t], 2 ) + toBytes( self.gp[t], 2 ) + toBytes( self.sp[t], 2 )

        # Playtype, misere, passed, announceplayer
        pt = self.playtype
        if pt == -1: pt = 15
        placeh = (self.passed << 7) + (self.misere << 6) + (self.annplr << 4) + pt
        state += toBytes( placeh, 1 )

        # That player's hand
        state += self.players[plr].cards.toBytes()

        # numTurn, numCards, current player
        placeh = (self.turn << 4) + ( self.playedcards.__len__() << 2 ) + self.curplr
        state += toBytes( placeh, 1 )

        # All the cards currently played
        for crd in self.playedcards:
            compr = ((crd == self.bestcard) << 6) + (crd.col << 4) + crd.num
            state += toBytes( compr, 1 )

        # Send it
        await self.players[ plr ].send( '\x0D', state )
