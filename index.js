////////////////////// GAME LOGIC ////////////////
var TAU = Math.PI*2
var wheel_positions = [10,0,50,5,15, 25,50,10,100,5, 25,15,0,5,50, 10,25,5,15,5]
var rotation = 0
var scores = {}
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
var config = {
  channels: ['#thewheel'],
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
    setTimeout(function(){spin_cooldown = false}, 8000)
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
    }, 5000)
  }
})


////////////////////// SOCKET.IO /////////////////
var http = require('http').Server(app);
var io = require('socket.io')(http);

io.on('connection', function(socket){
  socket.emit('rotation', rotation)
  socket.emit('scores', scores)
})

http.listen(port, function() {
  console.log('Listening on *:'+port)
})