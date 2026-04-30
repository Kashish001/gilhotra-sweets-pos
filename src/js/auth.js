// src/js/auth.js

const Auth = {
  init() {
    document
      .getElementById("auth-pass")
      .addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          Auth.login();
        }
      });
    // Check if PocketBase has a saved, valid login session
    if (pb.authStore.isValid) {
      this.showApp();
    } else {
      this.showLoginScreen();
    }
  },

  showLoginScreen() {
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("shell").style.display = "none"; // Hide the main app

    setTimeout(() => {
      window.focus(); // Force Windows to actively focus the app
      document.getElementById("auth-user").focus(); // Put the blinking cursor in the username box automatically
    }, 150);
  },

  showApp() {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("shell").style.display = "flex";

    // Update UI with logged-in user's name
    const user = pb.authStore.model;
    document.getElementById("current-user-name").innerText =
      `Logged in as: ${user.username} ${user.isAdmin ? "(Admin)" : ""}`;

    // Start loading the shop data!
    loadData();
  },

  async login() {
    const user = document.getElementById("auth-user").value.trim();
    const pass = document.getElementById("auth-pass").value;

    if (!user || !pass) {
      // Using the new custom dialog!
      await customAlert("Please enter both username and password.");
      return;
    }

    toggleLoader(true, "Logging in...");
    try {
      await pb.collection("users").authWithPassword(user, pass);
      this.showApp();
    } catch (err) {
      toggleLoader(false);
      // Using the new custom dialog!
      await customAlert("Invalid Username or Password.");

      // Instantly put the mouse focus back into the password box after they click OK
      document.getElementById("auth-pass").focus();
    }
  },

  async register() {
    const user = document.getElementById("auth-user").value.trim();
    const pass = document.getElementById("auth-pass").value;

    if (pass.length < 8) {
      await customAlert("Password must be at least 8 characters.");
      return;
    }

    toggleLoader(true, "Creating account...");
    try {
      await pb.collection("users").create({
        username: user,
        password: pass,
        passwordConfirm: pass,
        isAdmin: false,
      });
      await this.login();
    } catch (err) {
      toggleLoader(false);
      await customAlert(
        "Username might already be taken, or an error occurred.",
      );
      console.error(err);
    }
  },

  logout() {
    pb.authStore.clear(); // Wipe the session
    window.location.reload(); // Refresh the app to show login screen
  },

  // A helper to protect features in your app from non-admins
  checkIsAdmin() {
    if (!pb.authStore.model?.isAdmin) {
      alert("Access Denied: Only Admins can perform this action.");
      return false;
    }
    return true;
  },
};
