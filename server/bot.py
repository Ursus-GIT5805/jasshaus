import keras
import numpy as np
import os
import random
import copy
import itertools

import card
import utils as c

INPUT_DIM=13
INPUT_MAX=45

OUTPUT_DIM=9

"""
The gamestate is as following
Input shape is 13 * 45 (1D)
Each 13 (except the first) is as following

4 "bits": The color of the card (i is 1 if col == i)
9 "bits": The number of the card (4+i is 1 if num == i )

The first 13 are bit different
1 "bit": Misère
1 "bit": Passed
10 "bits": playtype (2+i is true if)
1 "bit": unused

First layer 45 is the announcement information
Next nine are the cards in this players starting hand
Next 35 are the cards played in order

"""

class Bot:
    def __init__(self, doTrain=False):
        self.stats = [0]*10
        self.modelPath = "./.jassbot-1"
        self.model = self.loadModel()
        if doTrain: self.train()
        print("Bot loaded")

    # Load the model from a file, or if there's none, create it
    def loadModel(self):
        if os.path.exists( self.modelPath ):
            return keras.models.load_model( self.modelPath )

        inputs = keras.layers.Input( shape=(INPUT_DIM*INPUT_MAX) )

        hiddenlayer = keras.layers.Dense( 768, activation='sigmoid' )(inputs)
        hiddenlayer = keras.layers.Dense( 384, activation='sigmoid' )(hiddenlayer)
        hiddenlayer = keras.layers.Dense( 128, activation='sigmoid' )(hiddenlayer)
        hiddenlayer = keras.layers.Dense( 64, activation='sigmoid' )(hiddenlayer)
        hiddenlayer = keras.layers.Dense( 64, activation='sigmoid' )(hiddenlayer)

        outputs = keras.layers.Dense( OUTPUT_DIM, activation='softmax' )(hiddenlayer)

        model = keras.models.Model( inputs=inputs, outputs=outputs )
        model.compile( optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'] )

        return model

    def evaluateCard(self, state, legals):
        # Predict the next card
        result = self.model.predict( state.reshape( (1,INPUT_MAX*INPUT_DIM) ), verbose="none" )

        # Update probabilities of illegal cards
        for i in range(9): result[0,i] = min(result[0,i], legals[i])
        action = np.argmax( result[0] ) # get the index with the highest probability

        # Parse the card
        col = 0
        num = 0
        for i in range(4):
            if state[1+action,i] == 1: col = i
        for i in range(9):
            if state[1+action,4+i] == 1: num = i

        return card.Card(col, num) # here ya go

    # Calculates the guaranted number of turns you can win for either updown or downup
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
        trumpfWeight = [ 0.25, 0.25, 0.25, 2.25, 0.25, 3.5, 0.25, 0.25, 1.75 ]
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

        if (ptProp[best] < 5 and passPossible) or (not passPossible and ptProp[best] < 3):
            if passPossible: return c.PASS, False
            return worst, True
        return best, False

    def loadData(self, path, order):
        out = []
        content = open(path, 'r').read()

        if content.__len__() < 37: return [] # File is too small

        data = []
        for i in range( content.__len__() ): data.append( ord(content[i]) )

        # Extract playtype. misere and the player who started
        passed = (data[0] & 0x80) > 0
        misere = (data[0] & 0x40) > 0
        annplr = (data[0] >> 4) % 4
        pt = data[0] % 16
        if c.isTrumpf(pt): pt = 2 + order[pt-2] # Change the color if trumpf is announced
        self.stats[pt] += 1

        if misere: return []

        hand = [[], [], [], []]
        owner = [-1] * 36 # owner[i] = the owner of the card which has ID i

        # Simulate the game, so we know the owner of the cards
        curplr = (annplr + 2*passed*(pt < 2 or 5 < pt)) % 4
        bestcrd = card.Card(4,2)
        bestplr = -1
        rt = [0, 1, 2, 3, 4, 5, 0, 1, 0, 1][pt]

        # Reproduce the round
        for i in range(36):
            crd = card.Card( order[data[1+i] >> 4], data[1+i] % 16 ) # Decode card

            if bestplr == -1 or card.isStronger(crd, bestcrd, rt):
                bestplr = curplr
                bestcrd = crd

            owner[ crd.getID() ] = curplr
            hand[ curplr ].append( crd )
            curplr = (curplr + 1) % 4

            if i % 4 == 3:
                curplr = bestplr
                bestplr = -1

                # Swap directions
                if pt == c.SLALOM_UPDOWN or pt == c.SLALOM_DOWNUP: rt ^= 1
                if i == 19 and (pt == c.GUSCHTI or pt == c.MARY): rt ^= 1

        for i in range(4): hand[i].sort()

        # Generate the hand of all players in a numpy array and encoded
        handStates = []
        for i in range(4):
            handStates.append( np.zeros((9,INPUT_DIM)).astype('float32') )
            for j in range(9):
                crd = hand[i][j]
                handStates[i][j, crd.col] = 1
                handStates[i][j, crd.num+4] = 1

        # Specify playtype in the trainingstate
        state = np.zeros( (INPUT_MAX,INPUT_DIM) ).astype('float32')
        if misere: state[0,0] = 1
        if passed: state[0,1] = 1
        state[0,2+pt] = 1

        # Generate all the training states with the labels
        for i in range(36):
            crd = card.Card( data[1+i] >> 4, data[1+i] % 16 )
            plr = owner[ crd.getID() ]
            state[1:10,:] = handStates[ plr ]

            out.append( ( copy.copy( state.reshape(INPUT_DIM*INPUT_MAX) ), hand[plr].index(crd)) )

            if i == 35: continue
            state[10+i,crd.col] = 1
            state[10+i,crd.num+4] = 1

        return out

    def train(self):
        pwd = "../log" # Use the saved rounds for learning (see logger.py)

        trainData = [] # The training-inputs for the model
        trainLabel = [] # The desired outputs

        for perm in itertools.permutations([0,1,2,3]): # iterate over each permutation of colors
            for f in os.listdir(pwd):
                file = os.path.join(pwd, f)
                if not os.path.isfile(file): continue
                datapacket = self.loadData(file, perm)
                for data, label in datapacket:
                    trainData.append(data)
                    trainLabel.append(label)

        for i in range(10):
            print( "{}: {}".format( c.playtypeName(i), self.stats[i] ) )

        # Generate a 2D np-array of all training states
        l = len(trainLabel)
        trainDat = np.zeros( (l, INPUT_MAX*INPUT_DIM) )
        for i in range(l):
            trainDat[i,:] = trainData[i]
        trainLabel = keras.utils.to_categorical(trainLabel)

        # Train the model
        self.model.fit(trainDat, trainLabel, epochs=30, batch_size=128)
        self.model.save( self.modelPath )
