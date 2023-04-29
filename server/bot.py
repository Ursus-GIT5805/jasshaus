import keras
import numpy as np
import os
import random

import card
import utils as c

INPUT_DIM=13
INPUT_MAX=45

OUTPUT_DIM=9

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

        # Input layer. Set one axis to None for dynamic input
        #model.add( keras.layers.Input( shape=(INPUT_MAX, INPUT_DIM) ) )

        # RNN part of the model with 32 neurons
        #model.add( keras.layers.SimpleRNN( units=32 ) )

        model.add( keras.layers.Dense( INPUT_DIM*INPUT_MAX, input_shape=(INPUT_MAX*INPUT_DIM,), activation='relu' ) )

        model.add( keras.layers.Dense(128) )
        model.add( keras.layers.Dense(128) )

        # Output layer
        model.add( keras.layers.Dense(units=OUTPUT_DIM, activation='softmax') )

        model.compile( optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'] )

        return model

    def evaluateCard(self, cards, state):
        pass

    def evaluateAnnounce(self, cards):
        # Evaluating the playtype is not being evaluated by a neural network, but by a simple algorithm
        return random.rand

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
            curplr = (curplr + 1) % 4

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
        state[0,1+pt] = 1

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
