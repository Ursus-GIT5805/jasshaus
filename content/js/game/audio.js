var pc = [];
let useMic = false;
let micMuted = false;
var localStream = null;

let ICEusername = "";
let ICEpassword = "";

function initRTC(){
    for(let i = 0 ; i < 4 ; ++i){
        pc.push( new RTCPeerConnection() );
        renewPeer(i);
    }
}

function renewPeer(index){
    pc[index].close();

    // Using metered's server
    const config = {
        iceServers: [
            {
                urls: "stun:a.relay.metered.ca:80",
            },
            {
                urls: "turn:a.relay.metered.ca:80",
                username: ICEusername,
                credential: ICEpassword
            },
            {
                urls: "turn:a.relay.metered.ca:443",
                username: ICEusername,
                credential: ICEpassword
            },
            {
                urls: "turn:a.relay.metered.ca:443?transport=tcp",
                username: ICEusername,
                credential: ICEpassword
            }
        ]
    };

    pc[index] = new RTCPeerConnection( config );

    let remoteStream = new MediaStream();

    pc[index].ontrack = function(e){
        e.streams[0].getTracks().forEach(function(track){ remoteStream.addTrack(track); });
    }
    pc[index].onicecandidate = function(e){
        socket.send( "\x06" + String.fromCharCode((index << 2) + 2) + JSON.stringify(e.candidate) );
    }

    document.getElementById("audio" + index).srcObject = remoteStream;

    if( localStream == null ) return;

    // Push own audio to the peer connection
    localStream.getTracks().forEach( function(track){
        pc[index].addTrack( track, localStream );
    } );
}

async function setupMic(){
    if( !connected || useMic ) return;

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Push audiotrack to the peer connections
    localStream.getTracks().forEach( function(track){
        for(let i = 0 ; i < pc.length ; ++i) pc[i].addTrack( track, localStream );
    } );

    document.getElementById("micImg").style.filter = "grayscale(0)";
    document.getElementById("micImg").style.animationName = "Fading";
    useMic = true;
    socket.send( "\x07" + String.fromCharCode( id ) );
}

async function sendOffer(plr){
    const offDesc = await pc[plr].createOffer();
    await pc[plr].setLocalDescription(offDesc);

    socket.send( "\x06" + String.fromCharCode((plr << 2)) + JSON.stringify(offDesc) );    
}

async function onOffer(offer, plr){
    // Create and send answer
    pc[plr].setRemoteDescription( new RTCSessionDescription(offer) );
    const answer = await pc[plr].createAnswer();
    await pc[plr].setLocalDescription(answer);
    socket.send( "\x06" + String.fromCharCode(1 + (plr << 2)) + JSON.stringify(answer) );
}

async function onAnswer(answer, plr){
    const remDesc = new RTCSessionDescription( answer );
    await pc[plr].setRemoteDescription( remDesc );
}

async function onIceCanditate(canditate, plr){
    try {
        await pc[plr].addIceCandidate( canditate );
    } catch(e) {
        console.error("Error when adding ice canditate", e);
    }
}
