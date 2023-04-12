import websockets
import asyncio
import sys
import os

import room
import utils as c

# Since this is a litte and not a serious server, one room is enough
rooms = room.Room()
ICEcredentials = ""

async def connection(websocket, path):
    global rooms

    print("New Socket")

    # Get player ID of the table
    id = await rooms.register( websocket )

    if id == -1:
        print("No place for this socket!")
        return

    await rooms.players[id].send('\x11', ICEcredentials)

    try:
        async for data in websocket:
            if c.DEV_MODE:
                print("Input from Player[{}]".format( rooms.order[id] ))
                print( [ ord(c) for c in data ] )
            await rooms.input( ord(data[0]) , data[1:], id)
    finally:
        await rooms.unregister(id)

        if rooms.numPlayers == 0: # Room is empty: Clean it
            rooms = room.Room()
            print("Reload room")

        print( "Socket closed!" )

if __name__ == "__main__":
    for arg in sys.argv[1:]:
        if arg == "-dev": c.DEV_MODE = True

    # Read the ICEcredentials because they might change in future
    PATH = "../jasshaus_ICEcredentials.txt"
    if os.path.exists(PATH):
        with open(PATH, 'r') as file:
            ICEcredentials = file.readline().strip()

    # Start websocketserver
    server = websockets.serve(connection, "0.0.0.0", 7999) # On the server, the reverse proxy handles the SSL-verification

    print( "Websocketserver started!" )

    # Run this program for ever
    loop = asyncio.get_event_loop();
    loop.run_until_complete(server)

    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        pass
