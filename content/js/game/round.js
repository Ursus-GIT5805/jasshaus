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
        this.bestcard = 0; // position of the bestcard
        this.bestcarddata = new Card(0,0); // The actual bestcard
        this.beginplayer = 0; // the player, who began this turn
        this.turncolor = -1; // The color that must be played this turn
    
        this.turn = 1; // number of current turn (a round consists of 9 turns)
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

        // Clear the board
        for(let i = 0 ; i < 4 ; ++i){
            document.getElementById("card" + i).style.display = "none";
            document.getElementById("card" + i).style.borderStyle = "none";
        }        
    }

    // Displays and handles everything on cardplay
    playCard(card, newbest){
        if( this.cardplayed == 4 ){ // If the board is full of cards, clear it!
            for(let i = 0 ; i < 4 ; ++i){
                document.getElementById("card" + i).style.display = "none";
                document.getElementById("card" + i).style.borderStyle = "none";
            }        
            this.cardplayed = 0;
        }
        if(this.cardplayed == 0) this.turncolor = card.col;

        // Draw the new card
        let lang = ["de", "fr"][+getStorageBool(2)];
        let crd = document.getElementById("card" + ((4-id) + this.beginplayer + this.cardplayed) % 4 );
        crd.src = "img/" + lang + "/" + card.col + card.num + ".png";

        if(newbest){
            document.getElementById("card" + (4-id + this.bestcard) % 4).style.borderStyle = "none";
            crd.style.borderStyle = "solid";
            this.bestcard = (this.beginplayer+this.cardplayed);
            this.bestcarddata = card;
        }
        crd.style.display = "block";

        // Update gameplay stats
        this.cardplayed += 1;

        if(this.cardplayed < 4) return;

        // The end of a round
        this.turn += 1;
        this.turncolor = -1;
        
        if(this.playtype < 6) return;

        // Update Slalom/Guschti/Mary direction
        if(this.playtype < 8)   this.ruletype = (this.ruletype+1) % 2;
        else if(this.turn == 5) this.ruletype = (this.ruletype+1) % 2;
        document.getElementById("roundRT").src = "img/" + ["updown", "downup"][this.ruletype] + ".png";

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
            return;
        }

        let state = [ "hidden", "visible" ];
        document.getElementById("roundMisere").style.visibility = state[ +this.misere ];
        document.getElementById("roundSymbols").style.filter = ["invert(0)", "invert(100%)"][ +this.misere ];
        document.getElementById("roundPass").style.visibility = state[ +this.passed ];

        document.getElementById("roundPT").style.visibility = "visible";
        document.getElementById("roundPT").src = document.getElementById("PT" + round.playtype).src;

        if(5 < this.playtype){
            document.getElementById("roundRT").style.visibility = "visible";
            document.getElementById("roundRT").src = document.getElementById("PT" + this.ruletype).src;
        } else document.getElementById("roundRT").style.visibility = "hidden";
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