const mongoose = require("mongoose");
const nconf = require("nconf");

// Initialize nconf with hierarchical configuration

nconf
  .argv() // Command-line arguments first
  .env() // Environment variables second
  .file({
    // Configuration file third
    file: "config.json",
  })
  .defaults({
    // Default values last
    SESSION_SECRET_KEY: null,
    SESSION_SECRET_IV: null,
  });

// Get database URI
const dbUri = nconf.get("NODE_DB_URI");

async function main() {
  try {
    // Connect to MongoDB and wait for connection
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    // Register babel after MongoDB connection
    require("@babel/register")({
      extensions: [".js"],
      presets: ["@babel/preset-env"],
      cache: false,
    });

    console.log("Babel registered");

    const processTeamsCron = require("./scripts/team-cron.js");

    if (typeof processTeamsCron !== "function") {
      throw new Error("processTeamsCron is not properly exported");
    }

    // Run the cron job
    console.log("Starting team cron processing...");
    await processTeamsCron();
    console.log("Team cron processing completed");

    // Close the DB connection
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    if (mongoose.connection) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

main().catch(console.error);
