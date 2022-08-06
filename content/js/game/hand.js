const CARD_PROP = 161 / 247;

// Card class
class Card {
    constructor(color, number){
        this.col = color;
        this.num = number;
    }

    compress(){
        return ((this.col << 4) + this.num).fromCharCode();
    }
}

function parseCard(byte){
    return new Card((byte >>> 4) % 4, byte % 16);
}

// Parses a list of cards from 5 bytes
function parseCards(bytes){
    let cards = [];
    for(let i = 0 ; i < 36 ; ++i){
        if( 1 & bytes[ 4 - Math.floor(i/8) ] >>> i%8 ){
            cards.push( new Card(Math.floor(i/9), i % 9) );
        }
    }
    return cards;
}

// Show class
class Show {
    constructor(color, number, row){
        this.col = color;
        this.num = number;
        this.row = row;
    }

    getPoints(){
        return [0, 100 + 50*(this.num == 3) + 100*(this.num == 5),
                20, 20, 50, 100, 150, 200, 250, 300][this.row];
    }
}

// All informations and UI handlers for the hand
class Hand {
    constructor(){
        // Gameplay variables
        this.cards = [];
        this.legal = []; // keeps track of all legal cards to play
        this.onTurn = false; // Are you on the turn?
        for(let i = 0 ; i < 9 ; ++i) this.legal.push( false );

        // UI variables
        this.canvas = document.getElementById("cards");

        this.selected = -1; // The index of the currently selected cards

        this.mx = 0;
        this.my = 0;
        this.cardW = 0;
        this.cardH = 0;

        this.clickonly = getStorageBool(2);
        this.darkval = getStorageVal(0) / 255.0;
        this.allUsable = false; // If true, all cards are drawn without a dark layer
    }

    // Checks for all cards, if it's legal to play
    updateLegal(ruletype, bestcard, turncolor){
        this.legal = [];
        for(let i = 0 ; i < 9 ; ++i) this.legal.push(turncolor == -1);
        if(this.legal[0]) return;

        var numCols = [0, 0, 0, 0]
        let trumpfboy = false;
        for(let i = 0 ; i < this.cards.length ; ++i){
            numCols[ this.cards[i].col ] += 1;
            if(!trumpfboy) trumpfboy = ( this.cards[i].col == ruletype-2 && this.cards[i].num == 5 );
        }

        for(let i = 0 ; i < this.cards.length ; ++i){
            let crd = this.cards[i];
            
            if(1 < ruletype && ruletype < 6){
                if(turncolor != ruletype-2 && crd.col == ruletype-2){
                    this.legal[i] = (crd.col != bestcard.col);
                    if(this.legal[i]) continue;

                    var order = [0,1,2,7,3,8,4,5,6]
                    this.legal[i] = (order[bestcard.num] < order[crd.num] ||
                                    this.cards.length == numCols[ ruletype-2 ]);
                    continue;
                }

                if(turncolor == ruletype-2 && crd.col != ruletype-2 && numCols[turncolor] > 0){
                    this.legal[i] = (numCols[turncolor] == 1 && trumpfboy);
                    continue;
                }
            }

            this.legal[i] = (crd.col == turncolor || numCols[ turncolor ] == 0);
        }
    }

    // Returns each show with the current hand
    getShows(){
        var shows = [];
        var nums = [0,0,0,0,0,0,0,0,0]; // Counting of each card.num 
        let row = 1;
        let start = 0;
        // Push a temporary (and cursed) card into the hand to prevent indexErrors
        this.cards.push( new Card(4, 13) )
        for(let i = 0 ; i < this.cards.length-1 ; ++i){
            nums[ this.cards[i].num ] += 1;
            
            if( this.cards[i].num+1 == this.cards[i+1].num && this.cards[i].col == this.cards[i+1].col ){
                row++;
                continue;
            }

            // Push a new show when the row is big enough
            if( 3 <= row ){
                shows.push(new Show(this.cards[start].col, this.cards[start].num, row));
            }

            start = i + 1;
            row = 1;
        }
        this.cards.pop(); // Remove the temporary card

        // Add all equals
        for(let i = 0 ; i < 9 ; ++i) if( nums[i] == 4 ) shows.push( new Show(0, i, 1) );
    
        return shows;
    }

    // Returns whether a card is legal to play
    isLegal(index){
        return this.legal[index] && this.onTurn;
    }

    // Removes the card from the hand and sends it to the server
    playCard(index){
        if( !this.isLegal(index) ) return;

        send(0, [(this.cards[index].col << 4) + this.cards[index].num] );

        this.cards.splice(index, 1);
        this.onTurn = false;
    }

    // Draw functions ------

    eraseCard(x, y){
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(Math.floor(x), y, this.cardW+2, this.cardH);
    }

    drawCard(index, x, y){
        const ctx = this.canvas.getContext('2d');

        ctx.drawImage(cardIMG[this.cards[index].col][this.cards[index].num], 0, 0, 161, 247, x, y, this.cardW, this.cardH);
        if( !this.isLegal(index) && !this.allUsable ){
            ctx.fillStyle = "rgba(0,0,0," + this.darkval + ")";
            ctx.fillRect(x, y, this.cardW, this.cardH);
        }
    }

    // Draw entire canvas
    drawAll(){
        const w = document.body.clientWidth;
        const h = document.body.clientHeight;

        let disX = Math.min( this.cardW, w / this.cards.length );
        let startX = Math.max( (w - this.cards.length*this.cardW)/2, 0 );

        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h); // Clear entire canvas

        // Draw all the cards except the one selected
        for(let i = 0 ; i < this.cards.length ; ++i){
            if(this.selected == i) continue;
            this.drawCard(i, startX+disX*i, h-this.cardH );
        }

        if(this.selected != -1) this.drawCard(this.selected, this.mx-this.cardW/2, this.my-this.cardH/2);
    }

    // ---

    // Update function, when the left mousebutton got pressed
    onMousedown(mouseX, mouseY){
        this.mx = mouseX;
        this.my = mouseY;

        const w = document.body.clientWidth;
        const h = document.body.clientHeight;

        // Check whether mouse clicked a card
        // It can be done by simple calculations since the cards are assigned to a specific location
        if(mouseY < h - this.cardH || h < mouseY) return;        
        
        let disX = Math.min( this.cardW, w / this.cards.length );
        let startX = Math.max( (w - this.cards.length*this.cardW)/2, 0 );

        this.selected = Math.floor( (mouseX - startX) / disX );

        if( this.selected < 0 || this.cards.length <= this.selected ) this.selected = -1;

        if( this.clickonly ){ // Play the card immediately
            this.playCard( this.selected );
            this.selected = -1;
            this.drawAll();
        }

        this.drawAll();
    }

    // Update function, when the mouse moves
    // mouseDown (bool) - is the mouse pressed
    onMousemove(mouseX, mouseY, mouseDown){
        this.mx = mouseX;
        this.my = mouseY;

        if( !mouseDown ) return;
        this.drawAll();
    }

    // Update function, when the left mousebutton is not pressed anymore
    onMouseup(){
        if( this.selected == -1 ) return;

        if( this.my + this.cardH/2 < document.body.clientHeight - this.cardH ) this.playCard(this.selected);
        this.selected = -1;
        this.drawAll();
    }

    // which (number) - keycode
    onKeydown(which){

    }

    onKeyup(which){

    }

    onResize(){
        // Update canvas to the new resolution
        this.canvas.width = document.body.clientWidth;
        this.canvas.height = document.body.clientHeight;

        this.cardH = document.body.clientHeight * 0.20;
        this.cardW = CARD_PROP * this.cardH;

        this.drawAll();
    }
}