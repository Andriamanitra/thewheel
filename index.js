////////////////////// GAME LOGIC ////////////////
var TAU = Math.PI*2
var wheel_positions = [10,0,50,5,15, 25,50,10,100,5, 25,15,0,5,50, 10,25,5,15,5]
var rotation = 0
var scores = {}
// TEMP
var word = "KUN RAHA KIRSTUUN KILAHTAA NIIN SIELU TAIVAASEEN VILAHTAA"
var VALID_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVXYZÅÄÖ"
var letters = "KRNS"
function spin_the_wheel() {
  var rotation_speed = 0.06+0.05*Math.random()
  io.emit('spin', rotation_speed)
  var temp_rotation = rotation
  while (rotation_speed > 0.02) {
    temp_rotation += rotation_speed
    rotation_speed = rotation_speed*0.997
  }
  rotation = temp_rotation%TAU
  // return how many points they got
  return wheel_positions[Math.floor(rotation/(TAU/wheel_positions.length))]
}

function set_score(player, pts) {
  if (player in scores) {
    if (pts == 0) {
      scores[player] = Math.floor(scores[player]/2)
    }
    else {
      scores[player] += pts
    }
  }
  else {
    scores[player] = pts
  }
  io.emit('scores', scores)
}

function has_points(player, pts) {
  if (player in scores) {
    if (scores[player] >= pts) {
      return true
    }
  }
  return false
}

function public_word() {
  var re = new RegExp("[^ "+letters+"]", "g")
  return word.replace(re, "*") 
}

////////////////////// EXPRESS ///////////////////
var port = 8081
var express = require('express')
var app = express()
app.use(express.static('public'))

app.get('/', function (req, res) {
  res.sendFile('/index.html')
})


////////////////////// IRC ////////////////////////
var irc = require('irc')
var spin_cooldown = false
var can_guess = true
var CHAN = "#thewheel"
var config = {
  channels: [CHAN],
  server: 'irc.quakenet.org',
  nick: 'not_a_bot'
}
var bot = new irc.Client(config.server, config.nick, {
  channels: config.channels
})
bot.addListener('message', function(from, to, text, message) {
  if (text == 'SPIN THE WHEEL!') {
    var player = from
    if (spin_cooldown) {
      return
    }
    spin_cooldown = true
    setTimeout(function(){spin_cooldown = false}, 30000)
    bot.say(to, 'SPINNING THE WHEEL FOR '+player+'!')
    var pts = spin_the_wheel()
    setTimeout(function(){
      if (pts == 0) {
        bot.say(to, 'Thug sector! '+player+' loses half of their points!')
        set_score(player, pts)
      }
      else {
        bot.say(to, pts+' points for '+player+'!')
        set_score(player, pts)
      }
    }, 8000)
  }
})
bot.addListener('message', function(from, to, text, message) {
  if (text == word && can_guess) {
    var pts = word.length*10
    bot.say(CHAN, from+" guessed the word! "+pts+" points!")
    set_score(from, pts)
    io.emit('word', word)
    can_guess = false
  }
  if (text.slice(0, 11) == "BUY LETTER " && can_guess) {
    var letter = text[11];
    if (VALID_LETTERS.indexOf(letter) >= 0 && letters.indexOf(letter) == -1) {
      if (has_points(from, 100)) {
        set_score(from, -100)
        bot.say(CHAN, from+" bought the letter "+letter+"!");
        letters += letter
        emit_word()
      }
      else {
        bot.say(to, "You don't have enough points! You need 100 points to buy a letter.")
      }
    }
  }
  // TEMP
  else if (text.slice(0, 9) == "SET WORD ") {
    word = text.slice(9);
    letters = ""
    bot.say(CHAN, "NEW WORD! "+public_word())
    emit_word()
    can_guess = true
  }
});


////////////////////// SOCKET.IO /////////////////
var http = require('http').Server(app);
var io = require('socket.io')(http);

io.on('connection', function(socket){
  socket.emit('rotation', rotation)
  socket.emit('scores', scores)
  io.emit('word', public_word())
  io.emit('letters', letters)
})

function emit_word() {
  io.emit('word', public_word())
  io.emit('letters', letters)
}

http.listen(port, function() {
  console.log('Listening on *:'+port)
})