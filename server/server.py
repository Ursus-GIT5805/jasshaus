import websockets
import asyncio
import ssl
import sys

import room
import utils as c

# Since this is a litte and not a serious server, one room is enough
rooms = room.Room()

async def connection(websocket, path):
    global rooms

    print("New Socket: {}".format(websocket.remote_address[0]))

    # Get player ID of the table
    id = await rooms.register( websocket )

    if id == -1:
        print("No place for this socket!")
        return

    try:
        async for data in websocket:
            print("Input from Player[{}]".format( rooms.order[id] ))
            print( [ ord(c) for c in data ] )
            await rooms.input( ord(data[0]) , data[1:], id)
    finally:
        await rooms.unregister(id)

        if rooms.numPlayers == 0: # Room is empty: Clean it
            rooms = room.Room()

        print( "Socket closed!" )

if __name__ == "__main__":
    for arg in sys.argv[1:]:
        if arg == "-dev": c.DEV_MODE = True

    # Setup websocketserver
    server = None

    print( "Websocketserver started!" )

    if c.DEV_MODE:
        server = websockets.serve(connection, "0.0.0.0", 7999) # Unsecure server on localhost
    else:
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain('../ssl/fullchain.pem', '../ssl/privkey.pem')

        server = websockets.serve(connection, "0.0.0.0", 7999, ssl=ssl_context)

    # Run this program for ever
    loop = asyncio.get_event_loop();
    loop.run_until_complete(server)

    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        pass
