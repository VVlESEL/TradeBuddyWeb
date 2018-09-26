//holds the user
var user;
//holds all trades that meet the filter criteria
var trades = [];
//holds a reference to the users db entry
var ref;
//holds the current account
var currentAccount;

firebase.auth().onAuthStateChanged(async function(userData) {
    if (userData) {
        console.log(userData);
        
        //update login/logout form
        $("#email-label").text(user.email);
        $("#form-logged-in").css("display", "block");
        $("#form-logged-out").css("display", "none");
        
        user = userData;
        //get a reference to the users db entry
        ref = firebase.database().ref("/user/"+user.uid);
        //get the current account of the user
        currentAccount = (await ref.child("settings/current_account").once("value")).val();        
        if(currentAccount == null) return false;
        console.log("current account is "+currentAccount);

        //load trades and store them in trades array
        await updateTrades();
        //show first 20 trades and initialize the tradesLoaded counter
        var tradesLoaded = await showMoreTrades(20, 0);
        //load more trades when the user reached the bottom of the page
        window.addEventListener('scroll', async function() {
            if (window.scrollY === document.body.scrollHeight - window.innerHeight) {
                tradesLoaded = await showMoreTrades(20, tradesLoaded);
            }
        });
        //show numbers
        await calculateNumbers();
        
        //show content
        $("#content").css("display", "block");
    } else {
        console.log(userData);
        //update login/logout form
        $("#form-logged-in").css("display", "none");
        $("#form-logged-out").css("display", "block");
        //hide content
        $("#content").css("display", "none");
    }
});

$("#button-login").click(function(event){
    firebase.auth().signInWithEmailAndPassword($("#email").val(), $("#password").val()).then(function() {
        console.log("Singed In");
        $("#email").val("");
        $("#password").val("");
    }, function(error) {
        alert(error.message);
    });    
});

$("#button-logout").click(function(event){
    firebase.auth().signOut().then(function() {
        console.log("Signed Out");
        resetNumbers();
        resetTrades();
    }, function(error) {
        alert("Error: "+error.message);
    });
});

async function updateTrades(){
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
}

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
        content +=                  '<div class="col" style="float: left; color: '+(t.type == "buy" ? "blue" : "red")+'">'+t.type+'<p style="float: left; color: black"><b>'+t.symbol+'</b>,&nbsp</p></div>';
        content +=                  '<div class="col" style="float: right;">'+t.closetime+'</div>';
        content +=              '</div>';               
        content +=              '<div class="row" style="margin: 0;">';
        content +=                  '<div class="col" style="float: left;">'+t.openprice+' => '+t.closeprice+'</div>';
        content +=                  '<div class="col" style="float: right; color: '+(t.profit > 0 ? "blue" : "red")+'"><b>'+t.profit+'</b></div>';
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

async function resetTrades() {
    $("#trades_ui").val("");
    trades = [];
}

async function calculateNumbers() {
    //final
    var netProfit = 0;
    var profitFactor = 0;
    var tradesAmount = 0;

    var grossProfit = 0;
    var expectedProfit = 0;
    var maxDrawdownMoney = 0;
    var maxDrawdownPercent = 0;
    var sellTradesAmount = 0;
    var sellTradesPercent = 0;
    var wonTradesAmount = 0;
    var wonTradesPercent = 0;
    var biggestProfit = 0;
    var averageProfit = 0;
    var maxWinRowAmount = 0;
    var maxWinRowMoney = 0;

    var grossLoss = 0;
    var buyTradesAmount = 0;
    var buyTradesPercent = 0;
    var lostTradesAmount = 0;
    var lostTradesPercent = 0;
    var biggestLoss = 0;
    var averageLoss = 0;
    var maxLossRowAmount = 0;
    var maxLossRowMoney = 0;

    //temp
    var maxProfit = 0, tempDrawdown = 0;
    var sellPositionsWon = 0,  buyPositionsWon = 0;
    var profit = 0, wonTrades = 0, lostTrades = 0;
    var tempWinRow = 0, tempLooseRow = 0;
    var tempWinRowProfit = 0, tempLooseRowProfit = 0;

    //calclate maxDD and profit
    var startingAccountBalance = (await ref.child("settings/accounts/"+currentAccount+"/balance").once("value")).val();
    var maxAccountBalance = startingAccountBalance;

    for(var i = 0; i < trades.length; i++){
        var t = trades[i];
        profit = t.profit + t.commission + t.swap;
        netProfit += profit;
        if(netProfit >= maxProfit){
            maxProfit = netProfit;
            tempDrawdown = 0;
            maxAccountBalance = startingAccountBalance + netProfit;
        }
        else{
            tempDrawdown += profit;
            if(maxAccountBalance != 0){
                var drawdownInPercent = tempDrawdown / maxAccountBalance * 100;
                maxDrawdownPercent = Math.min(drawdownInPercent, maxDrawdownPercent);
            }
            if(tempDrawdown <= maxDrawdownMoney) maxDrawdownMoney = tempDrawdown;
        }

        //calculate other numbers
        //calculate profit, profitBuy, profitSell
        tradesAmount++;
        if(t.type == "buy") buyTradesAmount++;
        else sellTradesAmount++;

        if(profit >= 0){
            wonTrades++;
            grossProfit += profit;
            if(profit > biggestProfit) biggestProfit = profit;

            if(t.type == "buy"){
                buyPositionsWon++;
            }else{
                sellPositionsWon++;
            }

            tempWinRow++;
            tempWinRowProfit += profit;
            maxWinRowMoney = Math.max(tempWinRowProfit,maxWinRowMoney);
            maxWinRowAmount = Math.max(tempWinRow, maxWinRowAmount);

            tempLooseRow = 0;
            tempLooseRowProfit = 0;
        }
        else {
            lostTrades++;
            grossLoss += profit;
            if(profit < biggestLoss) biggestLoss = profit;

            tempLooseRow++;
            tempLooseRowProfit += profit;
            maxLossRowMoney = Math.min(tempLooseRowProfit,maxLossRowMoney);
            maxLossRowAmount = Math.max(tempLooseRow, maxLossRowAmount);

            tempWinRow = 0;
            tempWinRowProfit = 0;
        }
    }

    //update numbers
    if(startingAccountBalance == 0) maxDrawdownPercent = 99.99;

    profitFactor = Math.abs(grossProfit / grossLoss);

    expectedProfit = netProfit / tradesAmount;
    sellTradesPercent = sellPositionsWon/sellTradesAmount*100;
    wonTradesAmount = buyPositionsWon+sellPositionsWon;
    wonTradesPercent = wonTradesAmount/tradesAmount*100;
    averageProfit = grossProfit/wonTrades;

    buyTradesPercent = buyPositionsWon/buyTradesAmount*100;
    lostTradesAmount = tradesAmount-buyPositionsWon-sellPositionsWon;
    lostTradesPercent = lostTradesAmount/tradesAmount*100;
    averageLoss = grossLoss/lostTrades;
    
    //update ui
    $("#net-profit").html(netProfit.toFixed(2));
    $("#gross-profit").html(grossProfit.toFixed(2));
    $("#gross-loss").html(grossLoss.toFixed(2));
    
    $("#profit-factor").html(profitFactor.toFixed(2));
    $("#expected-profit").html(expectedProfit.toFixed(2));
    
    $("#trades").html(tradesAmount);
    $("#max-drawdown").html(maxDrawdownMoney.toFixed(2));
    $("#max-drawdown-percent").html(maxDrawdownPercent.toFixed(2));

    $("#sell-trades").html(sellTradesAmount + " (" + sellTradesPercent.toFixed(2) + "%)");
    $("#buy-trades").html(buyTradesAmount + " (" + buyTradesPercent.toFixed(2) + "%)");
    
    $("#positive-trades").html(wonTradesAmount + " (" + wonTradesPercent.toFixed(2) + "%)");
    $("#negative-trades").html(lostTradesAmount + " (" + lostTradesPercent.toFixed(2) + "%)");

    $("#biggest-profit").html(biggestProfit.toFixed(2));
    $("#biggest-loss").html(biggestLoss.toFixed(2));
    
    $("#avg-profit").html(averageProfit.toFixed(2));
    $("#avg-loss").html(averageLoss.toFixed(2));
  
    $("#max-wins").html(maxWinRowAmount);
    $("#max-losses").html(maxLossRowAmount);
   
    $("#max-profit").html(maxWinRowMoney.toFixed(2));
    $("#max-loss").html(maxLossRowMoney.toFixed(2));
}

async function resetNumbers() {
    //update ui
    $("#net-profit").html("");
    $("#gross-profit").html("");
    $("#gross-loss").html("");
    
    $("#profit-factor").html("");
    $("#expected-profit").html("");
    
    $("#trades").html("");
    $("#max-drawdown").html("");
    $("#max-drawdown-percent").html("");

    $("#sell-trades").html("");
    $("#buy-trades").html("");
    
    $("#positive-trades").html("");
    $("#negative-trades").html("");

    $("#biggest-profit").html("");
    $("#biggest-loss").html("");
    
    $("#avg-profit").html("");
    $("#avg-loss").html("");
  
    $("#max-wins").html("");
    $("#max-losses").html("");
   
    $("#max-profit").html("");
    $("#max-loss").html("");
}

var filter = {};
    refFilter = ref.child(user.uid+"/settings/accounts/"+currentAccount+"/filter");
    filter = await (refFilter.once("value")).val();

    //update buy and sell filter
    if (filter == null || filter["buy"] == null) {
      refFilter.update({
        "buy": true,
      });
    }
    if (filter == null || filter["sell"] == null) {
      refFilter.update({
        "sell": true,
      });
    }

    //update strategies filter
    if (filter == null ||
        filter["strategies"] == null ||
        filter["strategies"]["*"] == null) {
      refFilter.child("strategies").update({
        "*": true,
      });
    }

    SettingsController.strategies.values.forEach((strategy) {
      if (filter == null ||
          filter["strategies"] == null ||
          filter["strategies"][strategy] == null)
        refFilter.child("strategies").update({
          strategy: true,
        });
    });

    if(filter != null) {
      filter["strategies"]?.forEach((k, v) {
        if (k != "*" && !SettingsController.strategies.containsValue(k)) {
          refFilter.child("strategies").update({
            k: null,
          });
        }
      });
    }

    //update symbols filter
    if (filter == null ||
        filter["symbols"] == null ||
        filter["symbols"]["*"] == null) {
      refFilter.child("symbols").update({
        "*": true,
      });
    }

    SettingsController.symbols.keys.forEach((symbol) {
      if (filter == null ||
          filter["symbols"] == null ||
          filter["symbols"][symbol] == null)
        refFilter.child("symbols").update({
          symbol: true,
        });
    });

    if(filter != null) {
      filter["symbols"]?.forEach((k, v) {
        if (k != "*" && !SettingsController.symbols.containsKey(k)) {
          refFilter.child("symbols").update({
            k: null,
          });
        }
      });
    }

    await updateFilter();
  }


  static Future<void> updateGeneral({bool buy, bool sell}) async {
    //update buy and sell filter
    if (buy != null && filter != null) {
      refFilter.update({
        "buy": buy,
      });
    }
    if (sell != null && filter != null) {
      refFilter.update({
        "sell": sell,
      });
    }
  }
  static Future<void> updateStrategies(Map symbols) async {
    symbols.forEach((k,v) async {
        refFilter.child("strategies").update({
          k: v,
        });
    });
  }
  static Future<void> updateSymbols(Map strategies) async {
    strategies.forEach((k,v) async {
      refFilter.child("symbols").update({
        k: v,
      });
    });
  }
}