//variable that holds all trades that meet the filter criteria
var trades = [];

firebase.auth().signInWithEmailAndPassword("test@test.de", "test12345").catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log(errorMessage);
});

firebase.auth().onAuthStateChanged(async function(user) {
    if (user) {
        //get a reference to the users db entry
        var ref = firebase.database().ref("/user/"+user.uid);
        //get the current account of the user
        var currentAccount = (await ref.child("settings/current_account").once("value")).val();
        if(currentAccount == null) return;
        //get all trades from the current account
        var res = await ref.child("trades/"+currentAccount).orderByChild("closetime").once("value");
        res.forEach(function(data){
            var obj = data.val();
            obj.id = data.key;
            trades.push(obj);                
        });
        //revert the order of the trades array
        trades.reverse();
        console.log(trades); 
        //load first 20 trades and initialize the tradesLoaded counter
        var tradesLoaded = await showMoreTrades(20, 0);
        //load more trades when the user reached the bottom of the page
        window.addEventListener('scroll', async function() {
            if (window.scrollY === document.body.scrollHeight - window.innerHeight) {
                tradesLoaded = await showMoreTrades(20, tradesLoaded);
            }
        });
    } else {
        console.log(user);
    }
});

async function showMoreTrades(amount, tradesLoaded) {
    var tradesList = "";
    var limit = Math.min(tradesLoaded+amount, trades.length);
    while(tradesLoaded < limit) {
        var t = trades[tradesLoaded];
        tradesLoaded++;

        var content = '<div class="card" role="button" data-toggle="collapse" data-target="#collapse'+t.id+'" aria-expanded="false" aria-controls="collapse'+t.id+'">';
        content +=      '<div class="card-header" id="heading'+t.id+'">';
        content +=          '<h5 class="mb-0">';
        content +=              '<div class="row" style="margin: 0;">';
        content +=                  '<div class="col" float: left;><b>'+t.symbol+'</b>, '+t.type+'</div>';
        content +=                  '<div class="col" float: right;>'+t.closetime+'</div>';
        content +=              '</div>';               
        content +=              '<div class="row" style="margin: 0;">';
        content +=                  '<div class="col" float: left;>'+t.openprice+' => '+t.closeprice+'</div>';
        content +=                  '<div class="col" float: right;>'+t.profit+'</div>';
        content +=              '</div>';
        content +=              '<p style="clear: both; margin: 0;"></p>';
        content +=          '</h5>';
        content +=      '</div>';
        content +=      '<div id="collapse'+t.id+'" class="collapse" aria-labelledby="heading'+t.id+'">';
        content +=          '<div class="card-body">';
        content +=              '<p style="margin: 0;">'+t.opentime+', '+t.commentary+'</p>'
        content +=              '<div class="row" style="margin: 0;">';
        content +=                  '<div class="col">SL:</div>';
        content +=                  '<div class="col">'+t.stoploss+'</div>';
        content +=                  '<div class="col">Swap:</div>';
        content +=                  '<div class="col">'+t.swap+'</div>';
        content +=              '</div>';
        content +=              '<div class="row" style="margin: 0;">';
        content +=                  '<div class="col">TP:</div>';
        content +=                  '<div class="col">'+t.takeprofit+'</div>';
        content +=                  '<div class="col">Commission:</div>';
        content +=                  '<div class="col">'+t.commission+'</div>';
        content +=              '</div>';
        content +=              '<div class="row" style="margin: 0;">';
        content +=                  '<div class="col">ID:</div>';
        content +=                  '<div class="col">'+t.id+'</div>';
        content +=                  '<div class="col">Strategy:</div>';
        content +=                  '<div class="col">'+(t.strategy != undefined ? t.strategy : ' ')+'</div>';
        content +=              '</div>';
        content +=          '</div>';
        content +=      '</div>';
        content += '</div>';
        tradesList = content + tradesList;
    }
    $("#trades_ui").append(tradesList);
    return tradesLoaded;
}