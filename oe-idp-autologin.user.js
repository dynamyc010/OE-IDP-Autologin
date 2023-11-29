// ==UserScript==
// @name         ÓE IDP Autologin
// @namespace    https://dynamyc.me/
// @version      1.0a
// @downloadURL  https://github.com/dynamyc010/OE-IDP-Autologin/releases/latest/download/oe-idp-autologin.user.js
// @description  Automatically logs you into IDP and accepts the consent form for you, if you want it to.
// @author       dynamyc
// @match        https://idp.uni-obuda.hu/saml2/module.php/core/loginuserpass.php*
// @match        https://idp.uni-obuda.hu/saml2/module.php/consent/getconsent.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=uni-obuda.hu
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM.info
// @require      https://code.jquery.com/jquery-3.7.1.slim.min.js
// @require      http://crypto.stanford.edu/sjcl/sjcl.js
// ==/UserScript==

(function () {
  "use strict";

  var autologin = {
    /* Inits */
    init: async function () {
      if (document.location.href.includes("loginuserpass.php")) {
        await autologin.loginInit();
      } else if (document.location.href.includes("getconsent.php")) {
        await autologin.consentInit();
      } else return;
    },

    loginInit: async function () {
      // Update the submit button
      autologin.changeSubmitButton();

      // Load data from storage
      await autologin.loadData();

      // Register menu commands
      GM.registerMenuCommand("Reset Login", autologin.resetLogin);

      // If there's a username and password, try to log in
      if (autologin.data.user && autologin.data.password) {
        autologin.runAutoLogin();
      }
    },

    consentInit: function () {
      // We check the remember box; we don't want to be asked this every time.
      $('input[type="checkbox"]')[0].checked = true;

      // Run the timer!
      autologin.runAutoConsent();
    },

    /* Data management */

    data: {},
    initParameters: function () {
      autologin.data = {
        encKey: "",
        password: "",
        user: "",
      };
    },

    loadData: async function () {
      autologin.data.encKey = await GM.getValue("encKey");
      try {
        autologin.data.password = autologin.decrypt(
          await GM.getValue("password")
        );
        autologin.data.user = autologin.decrypt(await GM.getValue("user"));
      } catch (error) {
        console.log(error);
      }
      if (
        !autologin.data.encKey ||
        !autologin.data.password ||
        !autologin.data.user
      ) {
        autologin.data.encKey = autologin.generateKey(512);
      }
    },

    saveData: async function () {
      await GM.setValue("encKey", autologin.data.encKey);
      await GM.setValue("password", autologin.encrypt(autologin.data.password));
      await GM.setValue("user", autologin.encrypt(autologin.data.user));
    },

    /* Menu commands */

    resetLogin: function () {
      autologin.data = {};
      autologin.saveData();
      location.reload();
    },

    /* Saving Login */

    registerLogin: async function () {
      if (
        $("input#username").val() == autologin.data.user &&
        $("input#password").val() == autologin.data.password &&
        $("img.erroricon").length == 0
      ) {
        $("form").submit();
        return;
      }

      if (
        confirm(
          "Do you want to save these values? You can reset it in your UserScripts menu."
        )
      ) {
        autologin.data.user = $("input#username").val();
        autologin.data.password = $("input#password").val();
        await autologin.saveData();
        $("form").submit();
      } else {
        $("form").submit();
      }
    },

    /* Autologin */

    runAutoLogin: function () {
      if ($("img.erroricon").length > 0) {
        let submitButton = $("button#submit_button");
        submitButton.text("Login (Autologin disabled)");
        return; // There's an error on the page. Don't try to log in.
      }

      // Add a 5 second countdown to it, and change the button's text to match the countdown. If the user clicks on anything in the form, cancel the countdown.
      // If the countdown reaches 0, click the button.
      // If the user clicks the anywhere, cancel the countdown.
      $("input#username").val(autologin.data.user);
      $("input#password").val(autologin.data.password);

      $("body").click(function () {
        clearInterval(timer);
        $("button#submit_button").text("Login (Autologin Cancelled)");
      });

      let countdown = 5;

      // Add a 5 second countdown to it, and change the button's text to match the countdown.
      let timer = setInterval(function () {
        let submitButton = $("button#submit_button");
        countdown -= 1;
        if (countdown <= 0) {
          submitButton.text("Logging in...");
          clearInterval(timer);
          $("form").submit();
        } else {
          submitButton.text("Logging in... (" + countdown + ")");
        }
      }, 1000);
    },

    runAutoConsent: function () {
      let button = $("button#yesbutton");
      $("body").click(function () {
        clearInterval(timer);
        button.text("Yes, continue");
      });

      let countdown = 16;

      // Add a 16 second countdown to it, and change the button's text to match the countdown.
      let timer = setInterval(function () {
        countdown -= 1;
        if (countdown <= 0) {
          button.text("Continuing...");
          clearInterval(timer);
          button.click();
        } else {
          button.text(
            "Continuing in " +
              countdown +
              "... (click anywhere to cancel timer)"
          );
        }
      }, 1000);
    },

    /* Utilities */

    // Terribly unsafe way to generate a key, but I cannot be bothered to figure out how to access Crypto from inside here. If anyone knows, hmu.
    generateKey: function (length) {
      let result = "";
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      const charactersLength = characters.length;
      let counter = 0;
      while (counter < length) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength)
        );
        counter += 1;
      }
      return result;
    },

    /* Encryption and decryption functions */

    encrypt: function (clearText) {
      return JSON.stringify(sjcl.encrypt(autologin.data.encKey, clearText));
    },

    decrypt: function (cipherText) {
      return sjcl.decrypt(autologin.data.encKey, JSON.parse(cipherText));
    },

    // :^D
    changeSubmitButton: function () {
      let submitButton = $("button#submit_button");
      submitButton.attr("type", "button");
      submitButton.attr("onclick", "autologin.registerLogin()");
      submitButton.text("Login");
    },
  };

  autologin.init();

  // This is so we can keep accessing the autologin object even after running the script.
  unsafeWindow.autologin = autologin;
})();
