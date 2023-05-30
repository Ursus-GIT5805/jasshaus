import keras
import numpy as np
import os
import random

import card
import utils as c

INPUT_DIM=13
INPUT_MAX=45

OUTPUT_DIM=9

"""
The gamestate is as following
Input shape is 13 * 45
Each 13 (except the first) is as following

4 "bits": The color of the card (i is 1 if col == i)
9 "bits": The number of the card (4+i is 1 if num == i )

The first 13 are bit different
1 "bit": Misère
1 "bit": Passed
10 "bits": playtype (2+i is true if)
1 "bit": unused

First of the 45 is the announcement information
Next nine are the cards in this players starting hand
Next 35 are the cards played in order

"""

class Bot:
    def __init__(self, doTrain=False):
        self.model = self.loadModel()
        if doTrain: self.train()
        print("Bot loaded")

    # Load the model from a file, or if there's none, create it
    def loadModel(self):
        if os.path.exists("jassbot-1"):
            return keras.models.load_model( "jassbot-1" )

        model = keras.Sequential()

        model.add( keras.layers.Dense( INPUT_DIM*INPUT_MAX, input_shape=(INPUT_MAX,INPUT_DIM,), activation='relu' ) )

        model.add( keras.layers.Dense(384) )
        model.add( keras.layers.Dense(384) )
        model.add( keras.layers.Dense(128) )
        model.add( keras.layers.Dense(128) )
        model.add( keras.layers.Dense(64) )

        # Output layer
        model.add( keras.layers.Dense(units=OUTPUT_DIM, activation='softmax') )

        model.compile( optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'] )

        return model

    def evaluateCard(self, cards, state):
        pass

    def getMaximumWins(self, cards, updown):
        n = len(cards)
        start = 0 + (n-1)*(updown)
        end = 0 + n*(not updown)
        step = 1 - 2*updown

        cnt = 0
        col = -1
        row = False
        for i in range(start, end, step):
            card = cards[i]
            if card.col == col and not row: continue
            if card.col != col:
                col = card.col
                if card.num == 0 + 8*(updown):
                    row = True
                    cnt += 1
            else:
                if cards[i-step].num + step == cards[i].num: cnt += 1
                else: row = False

        return cnt


    # Returns the playtype in a tuple (playtype, misere)
    def evaluateAnnounce(self, cards, passPossible):
        # Evaluating the playtype is not being evaluated by a neural network, but by a simple algorithm
        n = len(cards)

        definiteUpdown = self.getMaximumWins(cards, updown=True) # Number of turns you definitely win, when you announce Updown
        definiteDownup = self.getMaximumWins(cards, updown=False) # same but for downup

        ptProp = 10 * [0]

        ptProp[ c.UPDOWN ] = definiteUpdown
        ptProp[ c.DOWNUP ] = definiteDownup
        trumpfWeight = [ 0.5, 0.5, 0.5,  2, 0.5, 2.5,  0.5, 0.5, 1.5 ]
        for i in range(n): ptProp[ 2 + cards[i].col ] += trumpfWeight[ cards[i].num ]
        ptProp[ c.SLALOM_UPDOWN ] = min( definiteUpdown, definiteDownup + (definiteUpdown > definiteDownup) )
        ptProp[ c.SLALOM_DOWNUP ] = min( definiteUpdown + (definiteUpdown < definiteDownup), definiteDownup )
        ptProp[ c.GUSCHTI ] = min( definiteUpdown, 4 ) + definiteDownup*(definiteUpdown >= 4)
        ptProp[ c.MARY ] = min( definiteDownup, 4 ) + definiteUpdown*(definiteDownup >= 4)

        best = 0
        worst = 0
        for i in range(10):
            if ptProp[i] > ptProp[best]: best = i
            if ptProp[i] < ptProp[worst]: worst = i

        if ptProp[best] < 3:
            if passPossible: return c.PASS, False
            return worst, True
        return best, False

    def loadData(self, path):
        out = []
        content = open(path, 'r').read()

        if content.__len__() < 37: return [] # File is too small

        data = []
        for i in range( content.__len__() ): data.append( ord(content[i]) )

        # Extract playtype etc.
        passed = (data[0] & 0x80) > 0
        misere = (data[0] & 0x40) > 0
        annplr = (data[0] >> 4) % 4
        pt = data[0] % 16

        hand = [[], [], [], []]
        owner = [-1] * 36 # owner[i] = the owner of the card which has ID i

        # Simulate the game, so we know the owner of the cards
        curplr = (annplr + 2*passed*(pt < 2 or 5 < pt)) % 4
        bestcrd = card.Card(4,2)
        bestplr = -1
        rt = [0, 1, 2, 3, 4, 5, 0, 1, 0, 1][pt]

        for i in range(36):
            crd = card.Card( data[1+i] >> 4, data[1+i] % 16 ) # Decode card

            if bestplr == -1 or card.isStronger(crd, bestcrd, rt):
                bestplr = curplr
                bestcrd = crd

            owner[ crd.getID() ] = curplr
            hand[ curplr ].append( crd )
            curplr = (curplr + 1) % 2

            if i % 4 == 3:
                curplr = bestplr
                bestplr = -1

                # Swap directions
                if pt == c.SLALOM_UPDOWN or pt == c.SLALOM_DOWNUP: rt ^= 1
                if i == 19 and (pt == c.GUSCHTI or pt == c.MARY): rt ^= 1

        for i in range(4): hand[i].sort()

        handStates = []
        for i in range(4):
            handStates.append( np.zeros((9,INPUT_DIM)).astype('float32') )
            for j in range(9):
                crd = hand[i][j]
                handStates[i][j, crd.col] = 1
                handStates[i][j, crd.num+4] = 1

        state = np.zeros( (INPUT_MAX,INPUT_DIM) ).astype('float32')
        if misere: state[0,0] = 1
        if passed: state[0,1] = 1
        state[0,2+pt] = 1

        for i in range(36):
            crd = card.Card( data[1+i] >> 4, data[1+i] % 16 )
            plr = owner[ crd.getID() ]
            state[1:10,:] = handStates[ plr ]

            out.append( (state.reshape(INPUT_DIM*INPUT_MAX), hand[plr].index(crd)) )

            if i == 35: continue
            state[10+i,crd.col] = 1
            state[10+i,crd.num+4] = 1

        return out

    def train(self):
        # TODO Maybe make Deep-Q learning
        pwd = "/home/ursus/Documents/blub/log"

        trainData = []
        trainLabel = []

        for f in os.listdir(pwd):
            file = os.path.join(pwd, f)
            if not os.path.isfile(file): continue
            data = self.loadData(file)
            for data, label in data:
                trainData.append(data)
                trainLabel.append(label)

        l = len(trainLabel)
        trainDat = np.zeros( (l, INPUT_MAX*INPUT_DIM) )
        for i in range(l):
            trainDat[i,:] = trainData[i]
        trainLabel = keras.utils.to_categorical(trainLabel)

        print( trainDat.shape )
        print( trainLabel.shape )

        self.model.fit(trainDat, trainLabel, epochs=10, batch_size=128)

        self.model.save( "jassbot-1" )
