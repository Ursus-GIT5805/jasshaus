// All informations and UI handlers related to the rounds
class Round {
    constructor(){
        // Gameplay variables
        this.points = [0, 0]; // points of the teams

        // Round data
        this.gp = [0, 0] // currently gotten points of the teams
        this.sp = [0, 0] // currently gotten points from shows
        this.playtype = -1; // trumpf etc. which rule is playing
        this.ruletype = -1; // which rule is applying

        this.passed = false;
        this.misere = false;

        // Turn data
        this.curplr = 0; // the player whose turn it is
        this.cardplayed = 0;
        this.bestplayer = 0; // id of player with the bestcard
        this.bestcarddata = new Card(0,0); // Data of the bestcard
        this.beginplayer = 0; // the player, who began this turn
        this.turncolor = -1; // The color that must be played this turn

        this.turn = 1; // number of current turn (a round consists of 9 turns)

        // Data aside from gameplay
        this.cardQueue = []; // All the cards, which must be played
        this.cardAnimation = false;
    }

    clearBoard(){
        for(let i = 0 ; i < 4 ; ++i){
            document.getElementById("card" + i).style.display = "none";
            document.getElementById("card" + i).style.borderStyle = "none";
            document.getElementById("card" + i).style.filter = "";
        }
        this.cardplayed = 0;
    }

    // Reset all the variables of the current round
    reset(){
        this.gp = [0, 0];
        this.sp = [0, 0];

        this.playtype = this.ruletype = -1;
        this.curplr = 0;
        this.passed = this.misere = false;
        this.turncolor = -1;
        this.cardplayed = 0;

        this.turn = 1;

        this.cardQueue = [];

        this.clearBoard();
    }


    // Displays and handles everything on cardplay
    playCard(card, newbest){
        if( this.cardQueue.length > 0 && card != this.cardQueue[0][0] ){
            this.cardQueue.push( [card, newbest] );
            return;
        }
        if( this.cardQueue.length == 0 ) this.cardQueue.push( [card, newbest] );

        if( this.cardplayed == 4 ) this.clearBoard();
        if( this.cardplayed == 0 ) this.turncolor = card.col;

        const POS = ((4-id+this.beginplayer) + this.cardplayed) % 4;

        // Draw the new card
        let lang = ["de", "fr"][+getStorageBool(2)];
        let crd = document.getElementById("card" +  POS);
        crd.src = "img/" + lang + "/" + card.col + card.num + ".png";

        if(newbest){
            document.getElementById("card" + (4-id + this.bestplayer) % 4).style.borderStyle = "none";
            crd.style.borderStyle = "solid";
            this.bestplayer = (this.beginplayer+this.cardplayed) % 4;
            this.bestcarddata = card;
        }

        crd.style.display = "block";

        if(!this.cardAnimation){
            this.afterCardPlayed();
            return;
        }

        if( POS == 0 ) this.afterCardPlayed();
        else crd.style.animationName = "CardPlay" + POS;
    }

    afterCardPlayed(){
        if(this.cardQueue.length == 0) return;

        this.cardplayed += 1;
        this.cardQueue.shift(); // remove first card from queue

        if(this.cardplayed < 4){
            this.curplr = (this.curplr+1) % 4;
            this.continueCardQueue();
            return;
        }

        // The end of a round
        this.turn += 1;
        this.turncolor = -1;
        this.curplr = this.beginplayer = this.bestplayer;
        checkShow();

        for(let i = 0 ; i < 4 ; ++i){
            let val = [(1-darkval)*100, 100][ +(i == (4-id+this.bestplayer) % 4) ];
            document.getElementById("card" + i).style.filter = "brightness(" + val + "%)";
        }

        this.continueCardQueue();

        if(this.playtype < 6) return; // Changing ruletype because of Slalom/Guschti/Mary ---

        // Update Slalom/Guschti/Mary direction
        if(this.playtype < 8)   this.ruletype = (this.ruletype+1) % 2;
        else if(this.turn == 5) this.ruletype = (this.ruletype+1) % 2;
        document.getElementById("roundRT").src = "img/" + ["updown", "downup"][this.ruletype] + ".png";
    }

    // Continues with playing cards from the queue or ends the round
    continueCardQueue(){
        if(!endRound) updateCurrentplayer();
        if(this.cardQueue.length > 0) this.playCard( this.cardQueue[0][0], this.cardQueue[0][1] );
        else if(endRound){
            // Wait for 2 second so the players can see the board
            setTimeout(function(){
                document.getElementById("roundSummary").style.display = "block";
            }, 2000);
        }
    }

    // Updates the points of a team in the gameDetails
    updatePoints(team){
        document.getElementById("points" + team).innerHTML = this.points[team];
        document.getElementById("gp" + team).innerHTML = (this.gp[team] + this.sp[team]);
    }

    // Update the cards on the field after the german/french style change
    updateCards( fr ){
        let repl = ["fr", "de"];
        if( fr ) repl = ["de", "fr"];

        for(let i = 0 ; i < 4 ; ++i){
            document.getElementById("card" + i).src = document.getElementById("card" + i).src.replace(repl[0], repl[1]);
        }
    }

    // Updates the symbols in the top left corner
    updateRoundDetails(){
        if(this.playtype == -1){
            for(let i = 0 ; i < 4 ; ++i) document.getElementById("round" + [ "Misere", "PT", "RT", "Pass" ][i]).style.visibility = "hidden";
            document.getElementById("namePT").innerHTML = "";
            return;
        }

        let state = [ "hidden", "visible" ];
        document.getElementById("roundMisere").style.visibility = state[ +this.misere ];
        document.getElementById("roundSymbols").style.filter = ["invert(0)", "invert(100%)"][ +this.misere ];
        document.getElementById("roundPass").style.visibility = state[ +this.passed ];

        document.getElementById("roundPT").style.visibility = "visible";
        document.getElementById("roundPT").src = document.getElementById("PT" + this.playtype).src;

        if(5 < this.playtype){
            document.getElementById("roundRT").style.visibility = "visible";
            document.getElementById("roundRT").src = document.getElementById("PT" + this.ruletype).src;
        } else document.getElementById("roundRT").style.visibility = "hidden";

        if(this.playtype == -1){
            document.getElementById("namePT").innerHTML = "";
            return;
        }

        let name = ["", "Misère: "][+this.misere] + getPlaytypeName( this.playtype, getStorageBool(2) );
        document.getElementById("namePT").innerHTML = name;
    }

    onResize(){
        let cardH = document.body.clientHeight * 0.20;
        let cardW = CARD_PROP * cardH;

        for(let i = 0 ; i < 4 ; ++i){
            document.getElementById("card" + i).width = cardW;
            document.getElementById("card" + i).height = cardH;
        }
    }
}
