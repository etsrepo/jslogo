//
// Logo Interpreter in Javascript
//

// Copyright (C) 2011 Joshua Bell
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

if (!('console' in window)) {
  window.console = { log: function(){}, error: function(){} };
}

var $ = document.querySelector.bind(document);

var g_logo;


var savehook;
var historyhook;
function initStorage(loadhook) {
  if (!window.indexedDB)
    return;

  var req = indexedDB.open('logo', 3);
  req.onblocked = function(e) {
    alert("Please close other Logo pages to allow database upgrade to proceed.");
  };
  req.onerror = function(e) {
    console.error(e);
  };
  req.onupgradeneeded = function(e) {
    var db = req.result;
    if (e.oldVersion < 2) {
      db.createObjectStore('procedures');
    }
    if (e.oldVersion < 3) {
      db.createObjectStore('history', {autoIncrement: true});
    }
  };
  req.onsuccess = function() {
    var db = req.result;

    var tx = db.transaction('procedures');
    var curReq = tx.objectStore('procedures').openCursor();
    curReq.onsuccess = function() {
      var cursor = curReq.result;
      if (cursor) {
        try {
          loadhook(cursor.value);
        } catch (e) {
          console.error("error loading procedure: " + e);
        } finally {
          cursor.continue();
        }
      }
    };
    tx.oncomplete = function() {
      var orig_savehook = savehook;
      savehook = function(name, def) {
        try {
          var tx = db.transaction('procedures', 'readwrite');
          tx.objectStore('procedures').put(def, name);
        } catch (e) {
          console.error(e);
        } finally {
          if (orig_savehook)
            orig_savehook(name, def);
        }
      };
      var orig_historyhook = historyhook;
      historyhook = function(entry) {
        try {
          var tx = db.transaction('history', 'readwrite');
          tx.objectStore('history').put(entry);
        } catch (e) {
          console.error(e);
        } finally {
          if (orig_historyhook)
            orig_historyhook(entry);
        }
      };
    };
  };
}

window.addEventListener('load', function() {

  var stream = {
    read: function(s) {
      return window.prompt(s ? s : "");
    },
    write: function() {
      var div = $('#overlay');
      for (var i = 0; i < arguments.length; i += 1) {
        div.innerHTML += arguments[i];
      }
      div.scrollTop = div.scrollHeight;
    },
    clear: function() {
      var div = $('#overlay');
      div.innerHTML = "";
    },
    readback: function() {
      var div = $('#overlay');
      return div.innerHTML;
    }
  };

  var canvas_element = $("#sandbox"), canvas_ctx = canvas_element.getContext('2d'),
      turtle_element = $("#turtle"), turtle_ctx = turtle_element.getContext('2d');
  var turtle = new CanvasTurtle(
    canvas_ctx,
    turtle_ctx,
    canvas_element.width, canvas_element.height);

  g_logo = new LogoInterpreter(
    turtle, stream,
    function (name, def) {
      if (savehook) {
        savehook(name, def);
      }
    });
  initStorage(function (def) {
    g_logo.run(def);
  });

  function demo(param) {
    param = String(param);
    if (param.length > 0) {
      param = decodeURIComponent(param.substring(1).replace(/\_/g, ' '));
      // TODO: Fixme
      g_entry.value = param;
      try {
        // TODO: Fixme
        g_logo.run(param);
      } catch (e) {
        window.alert("Error: " + e.message);
      }
    }
  }

  // Look for a program to run in the query string / hash
  var param = document.location.search || document.location.hash;
  demo(param);
  window.addEventListener('hashchange', function(e) { demo(document.location.hash); } );
});