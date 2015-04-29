"use strict";

var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var Request = require("sdk/request").Request;
var Timers = require('sdk/timers');

// const { Geolocation } = require("geolocation");
const { getMostRecentBrowserWindow } = require("sdk/window/utils");
const prefs =  require("sdk/preferences/service");

var {Cc, Ci} = require("chrome");

function getPollutionLevel(aqe) {
  return Math.ceil(aqe / 50);
}

// Implement getCurrentPosition by loading the nsIDOMGeoGeolocation
// XPCOM object.
function getCurrentPosition() {
  var xpcomGeolocation
  try {
    xpcomGeolocation = Cc["@mozilla.org/geolocation;1"].getService(Ci.nsIDOMGeoGeolocation);
  } catch(e) {
    xpcomGeolocation = Cc["@mozilla.org/geolocation;1"].getService(Ci.nsISupports);
  }
  xpcomGeolocation.getCurrentPosition(function(position) {
    var lat = position.coords.latitude.toFixed(2);
    var lon = position.coords.longitude.toFixed(2);
    button.label = lat + ',' + lon;
    getAirCondition(lat, lon);
  }, function(err) {
    console.error(err);
  });
}

var button = buttons.ActionButton({
  id: "aircondition-status",
  label: 'loading',
  icon: {
    "16": "./1_16.png",
    "32": "./1_32.png",
    "64": "./1_64.png"
  }
});

function getAirCondition(lat, lon) {
  Request({
    url: 'http://106.186.28.30:9000/api/gps_air/longitude/' + lon +'/latitude/' + lat +'/type/aqe',
    onComplete: function(res) {
      res = res.json;
      if(res) {
        var level = getPollutionLevel(res.PositionAQE);
        button.label = res.CityName + '\n' + res.PositionAQE;
        button.icon = {
          "16": "./" + level + '_16.png',
          "32": "./" + level + '_32.png',
          "64": "./" + level + '_64.png'
        };
      }
      Timers.setTimeout(function() {
        getAirCondition(lat, lon);
      }, 1000 * 60 * 60);
    }
  }).get();
}

function prompt(window, pref, message, callback) {
  if (prefs.has(pref)) {
    callback(prefs.get(pref));
    return;
  }

  let done = false;

  function remember(value) {
    return function() {
      done = true;
      prefs.set(pref, value);
      callback(value);
    };
  }

  let self = window.PopupNotifications.show(
    window.gBrowser.selectedBrowser,
    "geolocation",
    message,
    "geo-notification-icon",
    {
      label: "Always Share",
      accessKey: "A",
      callback: remember(true)
    },
    [
      {
        label: "Share Once",
        accessKey: "S",
        callback: function(notification) {
          done = true;
          callback(true);
        }
      },
      {
        label: "Never Share",
        accessKey: "N",
        callback: remember(false)
      }
    ],
    {
      eventCallback: function(event) {
        if (event === "dismissed") {
          if (!done) callback(false);
          done = true;
          window.PopupNotifications.remove(self);
        }
      },
      persistWhileVisible: true
    });
}

prompt(getMostRecentBrowserWindow(),
  "extensions." + require('sdk/self').id + ".allowGeolocation",
  "Air Condition Add-on wants to know your location.",
  function callback(allowed) {
    if (allowed) {
      getCurrentPosition();
    }
});
